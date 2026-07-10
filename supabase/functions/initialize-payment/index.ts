import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
      }
    );

    const {
      eventId,
      buyerName,
      buyerEmail,
      buyerPhone,
      items,
    } = await req.json();

    if (!eventId || !buyerName || !buyerEmail || !items || !items.length) {
      throw new Error("Missing required checkout fields");
    }

    // Server-side subtotal calculation
    let totalKobo = 0;
    for (const item of items) {
      const { data: ticketType, error: ttErr } = await supabaseClient
        .from("ticket_types")
        .select("price_kobo, quantity_available, quantity_sold")
        .eq("id", item.ticketTypeId)
        .single();
      
      if (ttErr || !ticketType) {
        throw new Error(`Ticket type not found: ${item.ticketTypeId}`);
      }

      if (ticketType.quantity_available - ticketType.quantity_sold < item.count) {
        throw new Error("Not enough tickets available");
      }

      totalKobo += ticketType.price_kobo * item.count;
    }

    // Ensure order subtotal is greater than 0, otherwise it's a free order
    if (totalKobo <= 0) {
      // In a real app we'd process free tickets immediately here, 
      // but for this example we'll focus on Paystack flow
      throw new Error("Free orders not yet supported via this endpoint");
    }

    // Get user id if authenticated
    const { data: { user } } = await supabaseClient.auth.getUser();

    // Create a pending order
    // Use service role key to insert order if RLS blocks user from inserting their own pending order without Paystack info
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        event_id: eventId,
        user_id: user?.id || null,
        buyer_name: buyerName,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone || null,
        subtotal_kobo: totalKobo,
        total_kobo: totalKobo,
        status: "pending",
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // We should also store the requested items somewhere so verify-payment knows what to generate.
    // Let's create an `order_items` table or put it in a JSON column if it doesn't exist.
    // Wait, the schema doesn't have `order_items`. We'll use a transaction in verify-payment 
    // or store it in Paystack metadata.
    const metadata = {
      order_id: order.id,
      items: items,
      event_id: eventId
    };

    // Initialize Paystack transaction
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) throw new Error("Missing Paystack secret");

    const reqOrigin = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:5173";
    const callbackUrl = `${reqOrigin}/checkout/verify`;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: buyerEmail,
        amount: totalKobo, // Paystack expects lowest denomination (kobo)
        reference: `ORD_${order.id}_${Date.now()}`,
        callback_url: callbackUrl,
        metadata: metadata,
      }),
    });

    const paystackData = await paystackRes.json();
    if (!paystackData.status) {
      throw new Error(paystackData.message);
    }

    // Update order with reference
    await supabaseAdmin
      .from("orders")
      .update({ payment_reference: paystackData.data.reference })
      .eq("id", order.id);

    return new Response(
      JSON.stringify({ authorization_url: paystackData.data.authorization_url }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
