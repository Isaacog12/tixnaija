import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        events (
          title,
          start_datetime,
          venue_name
        ),
        order_items (
          quantity,
          ticket_types ( name )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    const eventTitle = order.events?.title || "Event";
    const date = new Date(order.events?.start_datetime || "").toLocaleDateString();
    
    // Check if it's a gift
    const isGift = order.is_gift;
    const recipientName = order.recipient_name || order.buyer_name;
    const recipientEmail = order.recipient_email || order.buyer_email;

    const subject = isGift 
      ? `You received a gift for ${eventTitle} 🎁`
      : `Your tickets for ${eventTitle} are ready 🎟️`;

    let htmlBody = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>${subject}</h2>
        <p>Hi ${recipientName},</p>
    `;

    if (isGift) {
      htmlBody += `<p>You received a gift from ${order.buyer_name}!</p>`;
      if (order.gift_message) {
        htmlBody += `<blockquote style="border-left: 4px solid #eee; padding-left: 10px; color: #555;">"${order.gift_message}"</blockquote>`;
      }
    } else {
      htmlBody += `<p>Thank you for your purchase. Your tickets are ready!</p>`;
    }

    htmlBody += `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <strong>Date:</strong> ${date}<br>
          <strong>Location:</strong> ${order.events?.venue_name || 'Online'}<br>
        </div>
        <p>Click the link below to view and download your tickets:</p>
        <a href="https://tixnaija.name.ng/orders" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">View Tickets</a>
      </div>
    `;

    await sendEmail({
      to: { address: recipientEmail, name: recipientName },
      subject,
      htmlBody,
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
  }
});
