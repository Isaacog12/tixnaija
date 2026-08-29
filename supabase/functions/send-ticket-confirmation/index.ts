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
          venue_name,
          address
        ),
        order_items (
          quantity,
          ticket_types ( name ),
          tickets ( ticket_code )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    const eventTitle = order.events?.title || "Event";
    const date = new Date(order.events?.start_datetime || "").toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    
    // Check if it's a gift
    const isGift = order.is_gift;
    const recipientName = order.recipient_name || order.buyer_name;
    const recipientEmail = order.recipient_email || order.buyer_email;

    const subject = isGift 
      ? `You received a gift for ${eventTitle} 🎁`
      : `Your tickets for ${eventTitle} are ready 🎟️`;

    const ticketUrl = `https://tixnaija.name.ng/orders/${order.id}/tickets?email=${encodeURIComponent(recipientEmail)}&accessCode=${order.access_code || ''}`;
    const downloadUrl = `${ticketUrl}&download=true`;

    const ticketTypes = order.order_items?.map((item: any) => item.ticket_types?.name).filter(Boolean).join(', ') || 'General Admission';
    const totalQuantity = order.order_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 1;
    const amountPaid = `₦${(order.total_kobo / 100).toLocaleString()}`;
    const venue = [order.events?.venue_name, order.events?.address].filter(Boolean).join(', ') || 'Online';
    const orderRef = order.id.split('-')[0].toUpperCase();

    const allTickets = order.order_items?.flatMap((item: any) => item.tickets || []) || [];
    let qrBlocksHtml = "";
    allTickets.forEach((ticket: any) => {
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${ticket.ticket_code}`;
      qrBlocksHtml += `
      <div style="text-align: center; padding: 20px 0; border-top: 1px solid #eee; border-bottom: 1px solid #eee; margin-bottom: 24px;">
        <img src="${qrCodeUrl}" alt="Entry QR code" width="160" height="160" style="display: block; margin: 0 auto 8px;" />
        <span style="font-family: monospace; font-size: 13px; letter-spacing: 1px; color: #FF5A1F;">${ticket.ticket_code}</span>
        <p style="font-size: 12px; color: #999; margin: 8px 0 0;">Show this at entry — don't share it with anyone else.</p>
      </div>
      `;
    });

    let htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <div style="border-bottom: 2px solid #FF5A1F; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
        <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 40px; margin-bottom: 12px; display: inline-block;" />
      </div>
      
      <h1 style="font-size: 20px; margin: 0 0 8px;">Ticket confirmed</h1>
      <p style="margin: 0 0 24px; color: #444;">Hi ${recipientName}, your order is confirmed. Details below.</p>
    `;

    if (isGift) {
      htmlBody += `
        <div style="background: #FFF5F2; border-left: 4px solid #FF5A1F; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #444;">This is a gift from <strong>${order.buyer_name}</strong>!</p>
          ${order.gift_message ? `<p style="margin: 8px 0 0; font-style: italic; color: #666;">"${order.gift_message}"</p>` : ''}
        </div>
      `;
    }

    htmlBody += `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Event</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${eventTitle}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date & time</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${date}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Venue</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${venue}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Ticket type</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${ticketTypes}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Quantity</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${totalQuantity}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Amount paid</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${amountPaid}</td></tr>
        <tr><td style="padding: 10px 0; color: #666;">Order ref</td><td style="padding: 10px 0; text-align: right; font-family: monospace;">${orderRef}</td></tr>
      </table>

      ${qrBlocksHtml}

      <a href="${downloadUrl}" style="display: block; text-align: center; background: #FF5A1F; color: #fff; text-decoration: none; padding: 14px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 12px; box-shadow: 0 4px 6px rgba(255, 90, 31, 0.2);">Download all tickets</a>
      <a href="${ticketUrl}" style="display: block; text-align: center; background: #111; color: #fff; text-decoration: none; padding: 14px; border-radius: 6px; font-weight: 600; font-size: 14px;">View tickets online</a>

      <p style="margin-top: 32px; font-size: 12px; color: #999;">TixNaija — questions? Reply to this email.</p>
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
