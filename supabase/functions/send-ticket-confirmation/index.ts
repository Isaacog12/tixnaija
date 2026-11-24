// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";
import { escapeHtml } from "../_shared/html.ts";
import {
  actions,
  cover,
  details,
  footer,
  giftNote,
  hero,
  masthead,
  organizerNote,
  shell,
  shortCode,
  ticketCard,
  MUTED,
  SITE,
} from "../_shared/email-layout.ts";

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
    const { orderId, ticketId, accessCode, onlyEmail } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    // Addresses are entered in several different forms (checkout, attendee
    // details, the guest lookup page), so they are compared normalized. Without
    // this, "Ada@Example.com" and "ada@example.com" were treated as two people
    // and the same inbox received a receipt plus a separate ticket email.
    const normalizeEmail = (value: unknown) =>
      typeof value === "string" ? value.trim().toLowerCase() : "";

    // A self-serve recovery request carries onlyEmail: it must reach the person
    // who asked and nobody else. Checkout delivery omits it, so attendees still
    // get their own tickets.

    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
    // @ts-ignore
    const supabaseAnonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")) || supabaseKey;
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
          custom_order_confirmation,
          organizer_id
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

    // Authorization & Ownership Verification:
    // Authorized callers:
    // 1. service_role (e.g. verify-payment webhook or backend task)
    // 2. The buyer who owns the order (order.user_id === user.id or user.email === order.buyer_email)
    // 3. The event organizer (order.events.organizer_id === user.id)
    // 4. Platform staff (admin, super_admin, or support role)
    // 5. Valid order accessCode / payment reference provided in body (for guest order viewers)

    const authHeader = req.headers.get("Authorization");
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;
    const isServiceRole = Boolean(token && token === supabaseKey);

    let isBuyer = false;
    let isOrganizer = false;
    let isStaff = false;

    if (token && !isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) {
        if (order.user_id && order.user_id === user.id) {
          isBuyer = true;
        } else if (user.email && user.email.toLowerCase() === order.buyer_email?.toLowerCase()) {
          isBuyer = true;
        }

        if (order.events?.organizer_id && order.events.organizer_id === user.id) {
          isOrganizer = true;
        }

        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "customer_care"])
          .maybeSingle();
        if (roleRow) {
          isStaff = true;
        }
      }
    }

    const normalizedAccessCode = (accessCode || "").trim().toUpperCase();
    const isGuestAuthorized = Boolean(
      normalizedAccessCode && (
        (order.access_code && order.access_code.toUpperCase() === normalizedAccessCode) ||
        (order.payment_reference && order.payment_reference.toUpperCase() === normalizedAccessCode)
      )
    );

    const isAuthorized = isServiceRole || isBuyer || isOrganizer || isStaff || isGuestAuthorized;
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You are not authorized to send confirmation for this order." }),
        { headers: getCorsHeaders(req), status: 403 }
      );
    }

    // Rate limit resend requests (max 5 per 10 minutes per order)
    if (!isServiceRole) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("endpoint", `resend_order_${order.id}`)
        .gte("created_at", tenMinutesAgo);

      if (count && count >= 5) {
        return new Response(
          JSON.stringify({ error: "Too many email requests for this order. Please wait a few minutes." }),
          { headers: getCorsHeaders(req), status: 429 }
        );
      }

      await supabase.from("rate_limit_log").insert({
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        endpoint: `resend_order_${order.id}`,
      });
    }

    const eventTitle = order.events?.title || "Event";
    const date = new Date(order.events?.start_datetime || "").toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

    // Check if it's a gift
    const isGift = order.is_gift;
    const recipientName = order.recipient_name || order.buyer_name;
    const recipientEmail = order.recipient_email || order.buyer_email;
    const buyerName = order.buyer_name || "Someone";

    const orderRef = order.id.split('-')[0].toUpperCase();

    const subject = isGift
      ? `You've received a gift for ${eventTitle} (Ref: ${orderRef})`
      : `Tickets confirmed for ${eventTitle} (Ref: ${orderRef})`;

    const ticketTypes = order.order_items?.map((item: any) => item.ticket_types?.name).filter(Boolean).join(', ') || 'General Admission';
    const totalQuantity = order.order_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 1;
    const amountPaid = `₦${(order.total_kobo / 100).toLocaleString()}`;
    const venue = [order.events?.venue_name, order.events?.address].filter(Boolean).join(', ') || 'Online';

    // The receipt is built per addressee: the recipient reads "you received a
    // gift", while the buyer asking for their own copy gets the order and a note
    // that the recipient's link is theirs alone.
    const buildMasterHtml = (name: string, email: string, buyerCopy: boolean) => {
      // Guests unlock their order with the emailed link alone: order id + email.
      const guestFragment = `#email=${encodeURIComponent(email)}`;
      const ticketUrl = `${SITE}/orders/${order.id}/tickets${guestFragment}`;
      const downloadUrl = `${SITE}/orders/${order.id}/tickets?download=true${guestFragment}`;

      const overline = buyerCopy ? "Your gift" : isGift ? "A gift for you" : "Order confirmed";
      const intro = buyerCopy
        ? `Hello ${escapeHtml(name)}, this is your copy of the order. ${escapeHtml(recipientName)} has their own link, so there is nothing to forward.`
        : isGift
          ? `Hello ${escapeHtml(name)}, ${escapeHtml(buyerName)} sent you a ticket. Show the code at the gate when you arrive.`
          : `Hello ${escapeHtml(name)}, your order is complete. Your tickets and receipt are one link away — no account needed.`;

      const glance = details([
        ["When", escapeHtml(date)],
        ["Where", escapeHtml(venue)],
        ["Tickets", escapeHtml(`${ticketTypes} (×${totalQuantity})`)],
        ["Paid", escapeHtml(amountPaid)],
      ]);

      return shell(
        masthead(`Order ${escapeHtml(orderRef)}`) +
        hero(overline, escapeHtml(eventTitle), intro) +
        (isGift
          ? giftNote({
              label: buyerCopy ? "Gift for" : "Gifted by",
              value: buyerCopy
                ? [recipientName, recipientEmail].filter(Boolean).join(" · ")
                : buyerName,
              message: order.gift_message,
            })
          : "") +
        organizerNote(order.events?.custom_order_confirmation) +
        cover(order.events?.cover_image_url) +
        glance +
        actions(ticketUrl, "View tickets", downloadUrl, "Download PDF receipt") +
        `
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:14px;line-height:1.65;color:${MUTED};">Bring the ticket on your phone. Each attendee gets their own ticket link, so there is nothing to print.</p>
          </td>
        </tr>` +
        footer("You are receiving this because an order was placed on TixNaija with this email address."),
      );
    };

    // 1. Send Master Receipt to Buyer.
    //
    // Ticket delivery is transactional: the email IS how the buyer receives
    // what they paid for, so it must never be gated behind notification
    // preferences. Those preferences only govern marketing and reminders.
    // Silently skipping this was why buyers (and guests sharing the same
    // address) received a "success" response with no email at all.
    let emailsSent = 0;
    const onlyRecipient = normalizeEmail(onlyEmail);
    const recipientAddress = normalizeEmail(recipientEmail);
    const buyerAddress = normalizeEmail(order.buyer_email);

    // Who receives the order receipt for this call.
    //
    // Checkout delivery (no onlyEmail) goes to the recipient, the person the
    // order was bought for. A self-serve recovery (onlyEmail) goes to whoever
    // asked. On a gift order those are two different people: the buyer asking
    // for their own link matched neither branch, so the receipt was skipped and
    // the attendee emails were suppressed as well, leaving the request with no
    // email at all. The buyer now gets the receipt in that case.
    let receiptAddress: string | null = null;
    let receiptName = "";
    let receiptIsBuyerCopy = false;

    if (!ticketId) {
      if (!onlyRecipient || onlyRecipient === recipientAddress) {
        receiptAddress = recipientEmail;
        receiptName = recipientName;
      } else if (onlyRecipient === buyerAddress) {
        receiptAddress = order.buyer_email;
        receiptName = order.buyer_name || recipientName;
        receiptIsBuyerCopy = true;
      }
    }

    if (receiptAddress) {
      await sendEmail({
        to: { address: receiptAddress, name: receiptName || "there" },
        subject: receiptIsBuyerCopy
          ? `Your gift for ${eventTitle} is ready (Ref: ${orderRef})`
          : subject,
        htmlBody: buildMasterHtml(receiptName || "there", receiptAddress, receiptIsBuyerCopy),
      });
      emailsSent += 1;
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

    // Keyed on the normalized address so one inbox is one group, whichever form
    // the address was typed in.
    const attendeeGroups = new Map<string, { email: string; tickets: any[] }>();
    for (const t of allTickets) {
      if (ticketId && t.id !== ticketId) continue; // Only process the specific ticket if provided

      // If ticketId is provided, force send to that ticket's email. Otherwise, send to attendee.
      if (ticketId || t.attendee_email) {
        const targetEmail = normalizeEmail(t.attendee_email || recipientEmail);
        if (!targetEmail) continue;
        const group = attendeeGroups.get(targetEmail) ?? { email: targetEmail, tickets: [] };
        group.tickets.push(t);
        attendeeGroups.set(targetEmail, group);
      }
    }

    for (const { email, tickets } of attendeeGroups.values()) {
      // A self-serve recovery reaches only the person who asked. That person is
      // not always the buyer or recipient: an attendee-only inbox used to be
      // skipped entirely, so the request succeeded while sending no email.
      if (onlyRecipient) {
        if (email !== onlyRecipient) continue;
        if (receiptAddress === onlyRecipient) continue; // receipt already covered them
      } else if (!ticketId && email === receiptAddress) {
        // Skip individual ticket emails to the buyer/recipient since they already received the Master Receipt,
        // UNLESS we are specifically resending a single ticket (ticketId is present).
        continue;
      }

      const attendeeName = tickets[0].attendee_name || 'Attendee';
      const attSubject = `Your ticket for ${eventTitle} (Code: ${shortCode(tickets[0].ticket_code)})`;

      const attHtmlBody = shell(
        masthead(`Ticket ${escapeHtml(shortCode(tickets[0].ticket_code))}`) +
        hero(
          "Your ticket",
          escapeHtml(eventTitle),
          `Hi ${escapeHtml(attendeeName)}, ${escapeHtml(buyerName)} sent you a ticket. Show the code below at the gate.`,
        ) +
        tickets.map((t) => ticketCard(t)).join("") +
        details([
          ["When", escapeHtml(date)],
          ["Where", escapeHtml(venue)],
        ]) +
        organizerNote(order.events?.custom_order_confirmation) +
        footer("You are receiving this because a ticket for this event was booked in your name."),
      );

      // Individual tickets are transactional too: each attendee must receive
      // the ticket that gets them through the door.
      await sendEmail({
        to: { address: email, name: attendeeName },
        subject: attSubject,
        htmlBody: attHtmlBody,
      });
      emailsSent += 1;
    }

    return new Response(JSON.stringify({ success: true, sent: emailsSent }), { headers: getCorsHeaders(req), status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: getCorsHeaders(req), status: 400 });
  }
});
