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
    const { reference } = await req.json();

    if (!reference) {
      throw new Error("Missing payment reference");
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) throw new Error("Missing Paystack secret");

    // Server-side verification of payment
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const paystackData = await paystackRes.json();
    
    if (!paystackData.status) {
      throw new Error(`Paystack error: ${paystackData.message}`);
    }

    if (paystackData.data.status !== "success") {
      throw new Error(`Payment not successful: ${paystackData.data.status}`);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the order using the reference
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        events (
          title,
          venue_name,
          city,
          state,
          start_datetime
        )
      `)
      .eq("payment_reference", reference)
      .single();

    if (orderErr || !order) {
      throw new Error("Order not found for this reference");
    }

    if (order.status === "paid" || order.status === "completed") {
      return new Response(JSON.stringify({ success: true, message: "Order already fulfilled", order_id: order.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify amount matches exactly
    if (paystackData.data.amount < order.total_kobo) {
      throw new Error("Payment amount does not match order total");
    }

    // Retrieve items from metadata
    const metadata = paystackData.data.metadata;
    if (!metadata || !metadata.items || metadata.order_id !== order.id) {
      throw new Error("Invalid metadata in Paystack transaction");
    }

    // Begin fulfillment process
    // 1. Generate tickets
    const newTickets = [];
    for (const item of metadata.items) {
      // Create ticket records
      for (let i = 0; i < item.count; i++) {
        newTickets.push({
          order_id: order.id,
          event_id: order.event_id,
          ticket_type_id: item.ticketTypeId,
          user_id: order.user_id,
          status: 'valid'
        });
      }

      // Increment quantity_sold for the ticket type
      // Using an RPC or direct update if we have it. We'll do direct update for simplicity,
      // but in high concurrency an RPC `increment_ticket_sold` is safer. 
      // For now we'll do a simple read/write update using service key.
      const { data: tt } = await supabaseAdmin
        .from("ticket_types")
        .select("quantity_sold")
        .eq("id", item.ticketTypeId)
        .single();
        
      if (tt) {
        await supabaseAdmin
          .from("ticket_types")
          .update({ quantity_sold: tt.quantity_sold + item.count })
          .eq("id", item.ticketTypeId);
      }
    }

    const { data: insertedTickets, error: ticketErr } = await supabaseAdmin
      .from("tickets")
      .insert(newTickets)
      .select("id");

    if (ticketErr) throw ticketErr;

    // 2. Mark order as paid
    await supabaseAdmin
      .from("orders")
      .update({ status: "paid" })
      .eq("id", order.id);

    // 3. Create inbox message for ticket delivery
    const ticketIds = insertedTickets.map(t => t.id);
    const event = order.events;
    const locationStr = [event.venue_name, event.city, event.state].filter(Boolean).join(", ");
    const dateStr = new Date(event.start_datetime).toLocaleDateString();

    const bodyText = `Your tickets for ${event.title} are ready! 🎟️\n\nEvent: ${event.title}\nDate: ${dateStr}\nLocation: ${locationStr}\n\nClick the link below to view or download your tickets.`;

    await supabaseAdmin
      .from("messages")
      .insert({
        recipient_id: order.user_id,
        recipient_email: order.buyer_email,
        type: "ticket_delivery",
        title: `Your tickets for ${event.title} are ready 🎟️`,
        body: bodyText,
        related_order_id: order.id,
        related_ticket_ids: ticketIds,
      });

    return new Response(JSON.stringify({ success: true, order_id: order.id }), {
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
