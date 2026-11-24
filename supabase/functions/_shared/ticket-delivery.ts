// Ticket delivery, shared by every path that mails a ticket.
//
// This used to live inside send-ticket-confirmation, and the recovery path
// (resend-ticket-links) reached it by invoking that function over HTTP. That hop
// is what made delivery reporting unreliable: the outer function could only see
// "edge function returned non-2xx", so a receipt that had already been delivered
// was reported as a failure — and a single bad attendee address threw away the
// result of every email sent before it. Sending is local now, and every
// recipient is counted or reported on its own.
import { sendEmail } from "./zeptomail.ts";
import { escapeHtml } from "./html.ts";
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
} from "./email-layout.ts";

export type DeliveryResult = {
  /** Emails ZeptoMail accepted. */
  sent: number;
  /** Recipients already mailed for this order, so nothing was sent again. */
  skipped: number;
  /** One entry per recipient whose send threw, with the reason. */
  failures: string[];
};

export const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/** Loads everything a ticket email renders, including attendees and organizer. */
export async function fetchOrderForDelivery(supabase: any, orderId: string) {
  const { data: order, error } = await supabase
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

  return { order, error };
}

/**
 * Sends the order receipt plus each attendee's own ticket.
 *
 * `onlyEmail` marks a self-serve recovery: it reaches that one address and
 * nobody else. `ticketId` resends a single ticket after its details changed.
 */
export type DeliveryOptions = {
  ticketId?: string | null;
  onlyEmail?: string | null;
  /**
   * Set for the checkout hand-off only (browser + verify-payment). Those two can
   * both reach an order for the same payment, and without a guard each one mails
   * the buyer. The ledger makes the first caller the sender and the second a
   * no-op. Explicit resends never set this, so they still send.
   */
  ifUndelivered?: boolean;
  /** Needed for the ledger; checkout delivery is skipped without it. */
  supabase?: any;
};

export async function deliverOrderTickets(
  order: any,
  options: DeliveryOptions = {},
): Promise<DeliveryResult> {
  const { ticketId, onlyEmail } = options;
  const result: DeliveryResult = { sent: 0, skipped: 0, failures: [] };

  // Checkout delivery is the order-wide send (no recovery address, no single
  // ticket). Only that shape is guarded: a recovery or a reassigned ticket is an
  // explicit request from a person and must always send.
  const isCheckoutDelivery = !ticketId && !normalizeEmail(onlyEmail);
  const ledger = options.supabase;
  const gated = Boolean(options.ifUndelivered) && isCheckoutDelivery && Boolean(ledger);
  const claimKey = (address: string) => `ticket-checkout:${order.id}:${normalizeEmail(address)}`;

  /** True when this recipient still needs the email. */
  const claimRecipient = async (address: string) => {
    if (!gated) return true;
    const { data: status, error } = await ledger.rpc("claim_email_delivery", {
      p_delivery_key: claimKey(address),
    });
    if (error) throw new Error(`delivery ledger: ${error.message}`);
    return status === "claimed";
  };

  const completeRecipient = async (address: string, success: boolean, reason?: string) => {
    if (!gated) return;
    try {
      await ledger.rpc("complete_email_delivery", {
        p_delivery_key: claimKey(address),
        p_success: success,
        p_error: reason ?? null,
      });
    } catch (error: any) {
      console.error("Could not complete the delivery ledger entry:", error?.message ?? error);
    }
  };

  const eventTitle = order.events?.title || "Event";
  const date = new Date(order.events?.start_datetime || "").toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  });

  const isGift = order.is_gift;
  const recipientName = order.recipient_name || order.buyer_name;
  const recipientEmail = order.recipient_email || order.buyer_email;
  const buyerName = order.buyer_name || "Someone";

  const orderRef = String(order.id).split("-")[0].toUpperCase();

  const subject = isGift
    ? `You've received a gift for ${eventTitle} (Ref: ${orderRef})`
    : `Tickets confirmed for ${eventTitle} (Ref: ${orderRef})`;

  const ticketTypes =
    order.order_items?.map((item: any) => item.ticket_types?.name).filter(Boolean).join(", ") ||
    "General Admission";
  const totalQuantity =
    order.order_items?.reduce((acc: number, item: any) => acc + item.quantity, 0) || 1;
  const amountPaid = `₦${(order.total_kobo / 100).toLocaleString()}`;
  const venue =
    [order.events?.venue_name, order.events?.address].filter(Boolean).join(", ") || "Online";

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

  const onlyRecipient = normalizeEmail(onlyEmail);
  const recipientAddress = normalizeEmail(recipientEmail);
  const buyerAddress = normalizeEmail(order.buyer_email);

  // Who receives the order receipt for this call.
  //
  // Checkout delivery (no onlyEmail) goes to the recipient, the person the order
  // was bought for. A self-serve recovery (onlyEmail) goes to whoever asked. On a
  // gift order those are two different people: the buyer asking for their own
  // link matched neither branch, so the receipt was skipped and the attendee
  // emails were suppressed as well, leaving the request with no email at all.
  // The buyer now gets the receipt in that case.
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
    let claimed = false;
    try {
      claimed = await claimRecipient(receiptAddress);
      if (!claimed) {
        result.skipped += 1;
      } else {
        await sendEmail({
          to: { address: receiptAddress, name: receiptName || "there" },
          subject: receiptIsBuyerCopy
            ? `Your gift for ${eventTitle} is ready (Ref: ${orderRef})`
            : subject,
          htmlBody: buildMasterHtml(receiptName || "there", receiptAddress, receiptIsBuyerCopy),
        });
        result.sent += 1;
        await completeRecipient(receiptAddress, true);
      }
    } catch (error: any) {
      const reason = String(error?.message ?? error);
      result.failures.push(`receipt to ${receiptAddress}: ${reason}`);
      if (claimed) await completeRecipient(receiptAddress, false, reason);
    }
  }

  // Individual tickets, grouped so one inbox receives one email.
  const allTickets =
    order.order_items?.flatMap((item: any) =>
      (item.tickets || [])
        .filter((ticket: any) => ticket.status === "valid")
        .map((ticket: any) => ({
          ...ticket,
          ticketTypeName: item.ticket_types?.name || "General Admission",
        })),
    ) || [];

  const attendeeGroups = new Map<string, { email: string; tickets: any[] }>();
  for (const ticket of allTickets) {
    if (ticketId && ticket.id !== ticketId) continue;

    if (ticketId || ticket.attendee_email) {
      const targetEmail = normalizeEmail(ticket.attendee_email || recipientEmail);
      if (!targetEmail) continue;
      const group = attendeeGroups.get(targetEmail) ?? { email: targetEmail, tickets: [] };
      group.tickets.push(ticket);
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
      // Skip individual ticket emails to the buyer/recipient since they already
      // received the receipt, unless a single ticket is being resent.
      continue;
    }

    const attendeeName = tickets[0].attendee_name || "Attendee";

    const htmlBody = shell(
      masthead(`Ticket ${escapeHtml(shortCode(tickets[0].ticket_code))}`) +
        hero(
          "Your ticket",
          escapeHtml(eventTitle),
          `Hi ${escapeHtml(attendeeName)}, ${escapeHtml(buyerName)} sent you a ticket. Show the code below at the gate.`,
        ) +
        tickets.map((ticket) => ticketCard(ticket)).join("") +
        details([
          ["When", escapeHtml(date)],
          ["Where", escapeHtml(venue)],
        ]) +
        organizerNote(order.events?.custom_order_confirmation) +
        footer("You are receiving this because a ticket for this event was booked in your name."),
    );

    let claimed = false;
    try {
      claimed = await claimRecipient(email);
      if (!claimed) {
        result.skipped += 1;
        continue;
      }

      await sendEmail({
        to: { address: email, name: attendeeName },
        subject: `Your ticket for ${eventTitle} (Code: ${shortCode(tickets[0].ticket_code)})`,
        htmlBody,
      });
      result.sent += 1;
      await completeRecipient(email, true);
    } catch (error: any) {
      const reason = String(error?.message ?? error);
      result.failures.push(`ticket to ${email}: ${reason}`);
      if (claimed) await completeRecipient(email, false, reason);
    }
  }

  return result;
}
