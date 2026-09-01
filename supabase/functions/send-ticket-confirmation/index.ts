// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #ffffff; padding: 40px 20px; text-align: center;">
      <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1A1D24 0%, #13151A 100%); border-radius: 16px; padding: 32px 24px; text-align: left; border: 1px solid #272A32; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        
        <div style="text-align: center; margin-bottom: 32px;">
          <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 28px; display: inline-block; margin-bottom: 16px;" />
          <div style="height: 3px; width: 100%; background: linear-gradient(90deg, #FF5A1F 0%, #0ea5e9 100%); border-radius: 4px;"></div>
        </div>
        
        <h1 style="font-size: 26px; font-weight: 700; margin: 0 0 8px; color: #ffffff;">
          Ticket confirmed <span style="display:inline-block; font-size: 20px;">✅</span>
        </h1>
        <p style="margin: 0 0 32px; color: #e4e4e7; font-size: 18px;">Hi ${recipientName}</p>
    `;

    if (isGift) {
      masterHtmlBody += `
        <div style="background: #2a1510; border-left: 4px solid #FF5A1F; padding: 16px; margin-bottom: 32px; border-radius: 4px;">
          <p style="margin: 0; font-size: 15px; color: #fff;">This is a gift from <strong>${order.buyer_name}</strong>!</p>
          ${order.gift_message ? `<p style="margin: 12px 0 0; font-style: italic; color: #fb923c;">"${order.gift_message}"</p>` : ''}
        </div>
      `;
    }

    masterHtmlBody += `
        <table style="width: 100%; border-collapse: collapse; background: #1f222b; border-radius: 12px; border: 1px solid #2a2e37; overflow: hidden; margin-bottom: 32px;">
          <tr>
            <td style="width: 50%; padding: 20px 16px; border-bottom: 1px solid #2a2e37; border-right: 1px solid #2a2e37; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">🎭 EVENT</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${eventTitle}</p>
            </td>
            <td style="width: 50%; padding: 20px 16px; border-bottom: 1px solid #2a2e37; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">📅 DATE & TIME</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${date}</p>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 20px 16px; border-bottom: 1px solid #2a2e37; border-right: 1px solid #2a2e37; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">📍 VENUE</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${venue}</p>
            </td>
            <td style="width: 50%; padding: 20px 16px; border-bottom: 1px solid #2a2e37; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">🎟️ TICKET INFO</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">Type: ${ticketTypes}, Qty: ${totalQuantity}</p>
            </td>
          </tr>
          <tr>
            <td style="width: 50%; padding: 20px 16px; border-right: 1px solid #2a2e37; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">💰 AMOUNT PAID</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${amountPaid}</p>
            </td>
            <td style="width: 50%; padding: 20px 16px; vertical-align: top;">
              <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">🧾 ORDER REF</p>
              <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${orderRef}</p>
            </td>
          </tr>
        </table>
        
        <a href="${downloadUrl}" style="display: block; width: 100%; text-align: center; background: #c2410c; color: #ffffff; text-decoration: none; padding: 18px 0; border-radius: 8px; font-weight: 600; font-size: 16px; margin-bottom: 16px; border: 1px solid #ea580c;">Download all tickets 📥</a>
        <a href="${ticketUrl}" style="display: block; width: 100%; text-align: center; background: #1e293b; color: #94a3b8; text-decoration: none; padding: 18px 0; border-radius: 8px; font-weight: 600; font-size: 16px; border: 1px solid #334155;">🌐 View tickets online</a>

        <p style="margin-top: 48px; font-size: 13px; color: #71717a; text-align: center;">TixNaija — questions? Reply to this email.</p>
      </div>
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
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #ffffff; padding: 40px 20px; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(180deg, #1A1D24 0%, #13151A 100%); border-radius: 16px; padding: 32px 24px; text-align: left; border: 1px solid #272A32; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          
          <div style="text-align: center; margin-bottom: 32px;">
            <img src="https://tixnaija.name.ng/logo.png" alt="TixNaija" style="height: 28px; display: inline-block; margin-bottom: 16px;" />
            <div style="height: 3px; width: 100%; background: linear-gradient(90deg, #FF5A1F 0%, #0ea5e9 100%); border-radius: 4px;"></div>
          </div>
          
          <h1 style="font-size: 26px; font-weight: 700; margin: 0 0 8px; color: #ffffff;">
            You've got a ticket! 🎟️
          </h1>
          <p style="margin: 0 0 32px; color: #e4e4e7; font-size: 16px;">Hi ${attendeeName}, <strong>${order.buyer_name}</strong> sent you a ticket for <strong>${eventTitle}</strong>.</p>
          
          <table style="width: 100%; border-collapse: collapse; background: #1f222b; border-radius: 12px; border: 1px solid #2a2e37; overflow: hidden; margin-bottom: 32px;">
            <tr>
              <td style="width: 50%; padding: 20px 16px; border-right: 1px solid #2a2e37; vertical-align: top;">
                <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">📅 DATE & TIME</p>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${date}</p>
              </td>
              <td style="width: 50%; padding: 20px 16px; vertical-align: top;">
                <p style="margin: 0 0 6px; font-size: 11px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">📍 VENUE</p>
                <p style="margin: 0; font-size: 15px; font-weight: 600; color: #ffffff;">${venue}</p>
              </td>
            </tr>
          </table>
          
          <p style="margin: 0 0 16px; font-weight: 600; font-size: 14px; color: #a1a1aa; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Your Tickets</p>
      `;

      for (const t of tickets) {
        const singleUrl = `https://tixnaija.name.ng/t/${t.ticket_code}`;
        attHtmlBody += `
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 16px; text-align: center;">
            <p style="margin: 0 0 8px; font-weight: 700; font-size: 18px; color: #fff;">${t.ticketTypeName}</p>
            <p style="margin: 0 0 24px; font-size: 13px; color: #94a3b8; font-family: monospace; letter-spacing: 1px;">CODE: ${t.ticket_code.split('-')[0].toUpperCase()}</p>
            <a href="${singleUrl}" style="display: inline-block; background: #c2410c; border: 1px solid #ea580c; color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.2);">View / Download Ticket 📥</a>
          </div>
        `;
      }

      attHtmlBody += `
          <p style="margin-top: 48px; font-size: 13px; color: #71717a; text-align: center;">TixNaija — questions? Contact us at support or reply to this email.</p>
        </div>
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
