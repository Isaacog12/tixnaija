import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }
  try {
    const { reference } = await req.json();
    if (!reference) {
      throw new Error("Payment reference is required");
    }
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      throw new Error("Paystack secret key not configured");
    }
    // 1. Verify with Paystack
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });
    const verifyData = await verifyRes.json();
    if (!verifyData.status || verifyData.data.status !== "success") {
      throw new Error("Payment verification failed");
    }
    const metadata = verifyData.data.metadata;
    if (!metadata || !metadata.eventId || !metadata.tickets) {
      throw new Error("Missing order metadata in payment");
    }
    // 2. Initialize Supabase Client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch event dates to block past events
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("start_datetime, end_datetime")
      .eq("id", metadata.eventId)
      .single();

    if (eventError || !eventData) {
      throw new Error("Event not found");
    }

    const start = new Date(eventData.start_datetime);
    const end = eventData.end_datetime ? new Date(eventData.end_datetime) : start;
    if (end < new Date()) {
      throw new Error("This event has ended. Tickets are no longer available for purchase.");
    }

    // 3. Process the checkout using the updated RPC function
    const { data: orderId, error: checkoutError } = await supabase.rpc('process_checkout', {
      p_event_id: metadata.eventId,
      p_user_id: metadata.userId || null,
      p_buyer_name: metadata.buyerName,
      p_buyer_email: metadata.buyerEmail,
      p_buyer_phone: metadata.buyerPhone || null,
      p_tickets: metadata.tickets,
      p_amount_paid: verifyData.data.amount,
      p_payment_reference: reference,
      p_promo_code_id: metadata.promoCodeId || null,
      p_is_gift: metadata.isGift || false,
      p_recipient_name: metadata.recipientName || null,
      p_recipient_email: metadata.recipientEmail || null,
      p_gift_message: metadata.giftMessage || null,
      p_access_code: metadata.accessCode || null,
    });
    if (checkoutError) {
      console.error("Supabase checkout error:", checkoutError);
      throw new Error(`Database error: ${checkoutError.message}`);
    }
    return new Response(JSON.stringify({ success: true, order_id: orderId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
