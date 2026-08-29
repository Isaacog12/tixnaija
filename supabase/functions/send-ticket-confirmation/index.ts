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
          tickets ( id, ticket_code, attendee_name, attendee_email )
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

    // 1. Send Master Receipt to Buyer
    let masterHtmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
      <div style="border-bottom: 2px solid #FF5A1F; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
        <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 40px; margin-bottom: 12px; display: inline-block;" />
      </div>
      
      <h1 style="font-size: 20px; margin: 0 0 8px;">Ticket confirmed</h1>
      <p style="margin: 0 0 24px; color: #444;">Hi ${recipientName}, your order is confirmed. Details below.</p>
    `;

    if (isGift) {
      masterHtmlBody += `
        <div style="background: #FFF5F2; border-left: 4px solid #FF5A1F; padding: 12px 16px; margin-bottom: 24px; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #444;">This is a gift from <strong>${order.buyer_name}</strong>!</p>
          ${order.gift_message ? `<p style="margin: 8px 0 0; font-style: italic; color: #666;">"${order.gift_message}"</p>` : ''}
        </div>
      `;
    }

    masterHtmlBody += `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Event</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 600;">${eventTitle}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date & time</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${date}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Venue</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${venue}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Ticket type</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${ticketTypes}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Quantity</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${totalQuantity}</td></tr>
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Amount paid</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${amountPaid}</td></tr>
        <tr><td style="padding: 10px 0; color: #666;">Order ref</td><td style="padding: 10px 0; text-align: right; font-family: monospace;">${orderRef}</td></tr>
      </table>

      <a href="${downloadUrl}" style="display: block; text-align: center; background: #FF5A1F; color: #fff; text-decoration: none; padding: 14px; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 12px; box-shadow: 0 4px 6px rgba(255, 90, 31, 0.2);">Download all tickets</a>
      <a href="${ticketUrl}" style="display: block; text-align: center; background: #111; color: #fff; text-decoration: none; padding: 14px; border-radius: 6px; font-weight: 600; font-size: 14px;">View tickets online</a>

      <p style="margin-top: 32px; font-size: 12px; color: #999;">TixNaija — questions? Reply to this email.</p>
    </div>
    `;

    // Send the master receipt
    await sendEmail({
      to: { address: recipientEmail, name: recipientName },
      subject,
      htmlBody: masterHtmlBody,
    });

    // 2. Send Individual Tickets to Attendees
    const allTickets = order.order_items?.flatMap((item: any) =>
      (item.tickets || []).map((t: any) => ({
        ...t,
        ticketTypeName: item.ticket_types?.name || 'General Admission'
      }))
    ) || [];

    const attendeeGroups = new Map<string, any[]>();
    for (const t of allTickets) {
      if (t.attendee_email && t.attendee_email !== recipientEmail) {
        if (!attendeeGroups.has(t.attendee_email)) attendeeGroups.set(t.attendee_email, []);
        attendeeGroups.get(t.attendee_email)!.push(t);
      }
    }

    for (const [email, tickets] of attendeeGroups.entries()) {
      const attendeeName = tickets[0].attendee_name || 'Attendee';
      const attSubject = `Your ticket for ${eventTitle} 🎟️`;

      let attHtmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #111;">
        <div style="border-bottom: 2px solid #FF5A1F; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
          <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 40px; margin-bottom: 12px; display: inline-block;" />
        </div>
        
        <h1 style="font-size: 20px; margin: 0 0 8px;">You've been sent a ticket!</h1>
        <p style="margin: 0 0 24px; color: #444;">Hi ${attendeeName}, <strong>${order.buyer_name}</strong> sent you a ticket for <strong>${eventTitle}</strong>.</p>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Date & time</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${date}</td></tr>
          <tr><td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Venue</td><td style="padding: 10px 0; border-bottom: 1px solid #eee; text-align: right;">${venue}</td></tr>
        </table>
        
        <p style="margin: 0 0 16px; font-weight: 600; text-align: center;">Your Tickets:</p>
      `;

      for (const t of tickets) {
        const singleUrl = `https://tixnaija.name.ng/t/${t.ticket_code}`;
        attHtmlBody += `
          <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; text-align: center;">
            <p style="margin: 0 0 4px; font-weight: 600;">${t.ticketTypeName}</p>
            <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">Ticket code: ${t.ticket_code.split('-')[0].toUpperCase()}</p>
            <a href="${singleUrl}" style="display: inline-block; background: #FF5A1F; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; box-shadow: 0 2px 4px rgba(255, 90, 31, 0.2);">View / Download Ticket</a>
          </div>
        `;
      }

      attHtmlBody += `
        <p style="margin-top: 32px; font-size: 12px; color: #999;">TixNaija — questions? Contact us at [EMAIL_ADDRESS] or visit our support page.</p>
      </div>
      `;

      await sendEmail({
        to: { address: email, name: attendeeName },
        subject: attSubject,
        htmlBody: attHtmlBody,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
  }
});
