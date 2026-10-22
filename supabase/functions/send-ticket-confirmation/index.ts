// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// @ts-ignore
import QRCode from "https://esm.sh/qrcode@1.5.3";
import { sendEmail } from "../_shared/zeptomail.ts";
import { isNotificationOptedIn } from "../_shared/notification-preferences.ts";

const allowedOrigins = [
  "https://www.tixnaija.name.ng",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://tixnaija.name.ng"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tixnaija.name.ng",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function getCorsHeaders(req: Request) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://www.tixnaija.name.ng",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { orderId, ticketId } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
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
          address,
          cover_image_url,
          custom_order_confirmation
        ),
        order_items (
          quantity,
          ticket_types ( name ),
          tickets ( id, ticket_code, attendee_name, attendee_email, status )
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

    const orderRef = order.id.split('-')[0].toUpperCase();
    const sentTime = new Date().toLocaleString("en-US", { timeStyle: "short" });

    const subject = isGift
      ? `You received a gift for ${eventTitle} 🎁 (Ref: ${orderRef})`
      : `Your tickets for ${eventTitle} are ready 🎟️ (Ref: ${orderRef})`;

    const ticketUrl = `https://tixnaija.name.ng/orders/${order.id}/tickets?email=${encodeURIComponent(recipientEmail)}`;
    const downloadUrl = `${ticketUrl}&download=true`;

    const ticketTypes = order.order_items?.map((item: any) => item.ticket_types?.name).filter(Boolean).join(', ') || 'General Admission';
    const totalQuantity = order.order_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 1;
    const amountPaid = `₦${(order.total_kobo / 100).toLocaleString()}`;
    const venue = [order.events?.venue_name, order.events?.address].filter(Boolean).join(', ') || 'Online';

    // 1. Send Master Receipt to Buyer
    const eventImageHtml = order.events?.cover_image_url 
      ? `<img src="${order.events.cover_image_url}" alt="${eventTitle}" style="width: 100%; border-radius: 12px; margin-bottom: 32px; object-fit: cover;" />` 
      : '';

    let masterHtmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; background-color: #000000; color: #F5F5F7; padding: 60px 20px; text-align: center; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 480px; margin: 0 auto; text-align: left;">
        
        <div style="text-align: center; margin-bottom: 48px;">
          <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 24px; display: inline-block;" />
        </div>
        
        ${eventImageHtml}

        <h1 style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; color: #FFFFFF;">
          Tickets Confirmed.
        </h1>
        <p style="margin: 0 0 40px; color: #A1A1A6; font-size: 17px; line-height: 1.4;">Hello ${recipientName}, your order is complete.</p>
    `;

    if (isGift) {
      masterHtmlBody += `
        <div style="border-left: 2px solid #FF5A1F; padding-left: 16px; margin-bottom: 40px;">
          <p style="margin: 0; font-size: 15px; color: #FFFFFF;">Gifted by <strong>${order.buyer_name}</strong></p>
          ${order.gift_message ? `<p style="margin: 8px 0 0; color: #A1A1A6; font-style: italic;">"${order.gift_message}"</p>` : ''}
        </div>
      `;
    }

    if (order.events?.custom_order_confirmation) {
      masterHtmlBody += `
        <div style="background-color: #1C1C1E; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
          <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 500; color: #86868B; text-transform: uppercase; letter-spacing: 0.05em;">Message from Organizer</h3>
          <p style="margin: 0; font-size: 15px; color: #E5E5EA; line-height: 1.5; white-space: pre-wrap;">${order.events.custom_order_confirmation}</p>
        </div>
      `;
    }

    masterHtmlBody += `
        <div style="margin-bottom: 48px;">
          <div style="border-bottom: 1px solid #333336; padding: 16px 0;">
            <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Event</span>
            <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${eventTitle}</span>
          </div>
          <div style="border-bottom: 1px solid #333336; padding: 16px 0;">
            <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Date & Time</span>
            <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${date}</span>
          </div>
          <div style="border-bottom: 1px solid #333336; padding: 16px 0;">
            <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Venue</span>
            <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${venue}</span>
          </div>
          <div style="border-bottom: 1px solid #333336; padding: 16px 0; display: flex; justify-content: space-between;">
            <div>
              <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Ticket</span>
              <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${ticketTypes} (x${totalQuantity})</span>
            </div>
            <div style="text-align: right;">
              <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Total</span>
              <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${amountPaid}</span>
            </div>
          </div>
        </div>
        
        <a href="${ticketUrl}" style="display: block; width: 100%; text-align: center; background-color: #FFFFFF; color: #000000; text-decoration: none; padding: 16px 0; border-radius: 12px; font-weight: 500; font-size: 17px; margin-bottom: 12px;">View Tickets</a>
        <a href="${downloadUrl}" style="display: block; width: 100%; text-align: center; background-color: transparent; border: 1px solid #333336; color: #FFFFFF; text-decoration: none; padding: 16px 0; border-radius: 12px; font-weight: 500; font-size: 17px;">Download PDF Receipt</a>

        <div style="margin-top: 60px; padding-top: 24px; border-top: 1px solid #1C1C1E; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #86868B;">Order Ref: ${orderRef}</p>
          <p style="margin: 0 0 8px; font-size: 12px; color: #86868B;">TixNaija. Sent at ${sentTime}</p>
          <p style="margin: 0; font-size: 12px; color: #86868B;">
            To manage notifications, visit your <a href="https://tixnaija.name.ng/account?tab=notifications" style="color: #ea580c; text-decoration: underline;">Account Settings</a>.
          </p>
        </div>
      </div>
    </div>
    `;

    // 1. Send Master Receipt to Buyer (Only if not a single ticket resend and not opted out)
    if (!ticketId) {
      const buyerOptedIn = await isNotificationOptedIn(
        supabase,
        { email: recipientEmail, userId: order.user_id },
        "ticket_confirmations"
      );

      if (buyerOptedIn) {
        await sendEmail({
          to: { address: recipientEmail, name: recipientName },
          subject,
          htmlBody: masterHtmlBody,
        });
      } else {
        console.log(`[OPT-OUT] Skipping master ticket confirmation for ${recipientEmail} (user opted out of ticket_confirmations)`);
      }
    }

    // 2. Send Individual Tickets to Attendees
    const allTickets = order.order_items?.flatMap((item: any) =>
      (item.tickets || [])
        .filter((t: any) => t.status === 'valid')
        .map((t: any) => ({
          ...t,
          ticketTypeName: item.ticket_types?.name || 'General Admission'
        }))
    ) || [];

    const attendeeGroups = new Map<string, any[]>();
    for (const t of allTickets) {
      if (ticketId && t.id !== ticketId) continue; // Only process the specific ticket if provided

      // If ticketId is provided, force send to that ticket's email. Otherwise, send to attendee.
      if (ticketId || t.attendee_email) {
        const targetEmail = t.attendee_email || recipientEmail;
        if (!attendeeGroups.has(targetEmail)) attendeeGroups.set(targetEmail, []);
        attendeeGroups.get(targetEmail)!.push(t);
      }
    }

    for (const [email, tickets] of attendeeGroups.entries()) {
      // Skip sending individual ticket emails to the buyer/recipient since they already received the Master Receipt,
      // UNLESS we are specifically resending a single ticket (ticketId is present).
      if (!ticketId && email === recipientEmail) {
        continue;
      }

      const attendeeName = tickets[0].attendee_name || 'Attendee';
      const attSubject = `Your ticket for ${eventTitle} 🎟️ (Code: ${tickets[0].ticket_code.split('-')[0].toUpperCase()})`;

      let attHtmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif; background-color: #000000; color: #F5F5F7; padding: 60px 20px; text-align: center; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 480px; margin: 0 auto; text-align: left;">
          
          <div style="text-align: center; margin-bottom: 48px;">
            <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 24px; display: inline-block;" />
          </div>

          ${eventImageHtml}
          
          <h1 style="font-size: 28px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 8px; color: #FFFFFF;">
            Your Ticket.
          </h1>
          <p style="margin: 0 0 40px; color: #A1A1A6; font-size: 17px; line-height: 1.4;">Hi ${attendeeName}, <strong>${order.buyer_name}</strong> sent you a ticket for <strong>${eventTitle}</strong>.</p>
      `;

      if (order.events?.custom_order_confirmation) {
        attHtmlBody += `
          <div style="background-color: #1C1C1E; border-radius: 12px; padding: 24px; margin-bottom: 40px;">
            <h3 style="margin: 0 0 12px; font-size: 13px; font-weight: 500; color: #86868B; text-transform: uppercase; letter-spacing: 0.05em;">Message from Organizer</h3>
            <p style="margin: 0; font-size: 15px; color: #E5E5EA; line-height: 1.5; white-space: pre-wrap;">${order.events.custom_order_confirmation}</p>
          </div>
        `;
      }

      attHtmlBody += `
          <div style="margin-bottom: 40px;">
            <div style="border-bottom: 1px solid #333336; padding: 16px 0;">
              <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Date & Time</span>
              <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${date}</span>
            </div>
            <div style="border-bottom: 1px solid #333336; padding: 16px 0;">
              <span style="display: block; font-size: 13px; color: #86868B; margin-bottom: 4px;">Venue</span>
              <span style="display: block; font-size: 17px; color: #FFFFFF; font-weight: 500;">${venue}</span>
            </div>
          </div>
      `;

      for (const t of tickets) {
        const singleUrl = `https://tixnaija.name.ng/t/${t.ticket_code}`;
        const singlePdfUrl = `${singleUrl}?download=true`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(t.ticket_code)}&margin=1`;
        
        attHtmlBody += `
          <div style="background-color: #1C1C1E; border-radius: 16px; padding: 32px; margin-bottom: 24px; text-align: center; border: 1px solid #333336;">
            <p style="margin: 0 0 4px; font-weight: 600; font-size: 20px; color: #FFFFFF;">${t.ticketTypeName}</p>
            <p style="margin: 0 0 24px; font-size: 14px; color: #86868B; letter-spacing: 0.05em;">CODE: ${t.ticket_code.split('-')[0].toUpperCase()}</p>
            
            <div style="background: #FFFFFF; padding: 16px; border-radius: 16px; display: inline-block; margin-bottom: 32px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);">
              <img src="${qrUrl}" alt="Ticket QR Code" style="display: block; width: 160px; height: 160px; margin: 0 auto;" />
            </div>
            
            <a href="${singlePdfUrl}" style="display: block; width: 100%; text-align: center; background-color: #FFFFFF; color: #000000; text-decoration: none; padding: 16px 0; border-radius: 12px; font-weight: 500; font-size: 17px; margin-bottom: 12px;">Download PDF Ticket</a>
            <a href="${singleUrl}" style="display: block; width: 100%; text-align: center; background-color: transparent; border: 1px solid #48484A; color: #FFFFFF; text-decoration: none; padding: 16px 0; border-radius: 12px; font-weight: 500; font-size: 17px;">View in Browser</a>
          </div>
        `;
      }

      attHtmlBody += `
          <div style="margin-top: 60px; padding-top: 24px; border-top: 1px solid #1C1C1E; text-align: center;">
            <p style="margin: 0 0 8px; font-size: 12px; color: #86868B;">TixNaija Support</p>
            <p style="margin: 0 0 8px; font-size: 12px; color: #86868B;">Sent at ${sentTime}</p>
            <p style="margin: 0; font-size: 12px; color: #86868B;">
              Manage notifications: <a href="https://tixnaija.name.ng/account?tab=notifications" style="color: #ea580c; text-decoration: underline;">Notification Settings</a>
            </p>
          </div>
        </div>
      </div>
      `;

      const attendeeOptedIn = await isNotificationOptedIn(
        supabase,
        { email },
        "ticket_confirmations"
      );

      if (!attendeeOptedIn) {
        console.log(`[OPT-OUT] Skipping ticket email for attendee ${email} (user opted out of ticket_confirmations)`);
        continue;
      }

      await sendEmail({
        to: { address: email, name: attendeeName },
        subject: attSubject,
        htmlBody: attHtmlBody,
      });
    }

    return new Response(JSON.stringify({ success: true }), { headers: getCorsHeaders(req), status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: getCorsHeaders(req), status: 400 });
  }
});




