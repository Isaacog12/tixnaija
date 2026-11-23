export interface TicketRecord {
  id: string;
  ticket_code: string;
  attendee_name?: string | null;
  attendee_email?: string | null;
  status?: string | null;
  ticketTypeName?: string | null;
}

export interface TicketOrderRecord {
  id: string;
  status?: string | null;
  is_gift?: boolean | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  recipient_name?: string | null;
  recipient_email?: string | null;
  order_items?: Array<{ tickets?: TicketRecord[] | null }> | null;
}

export type TicketEmailKind = "master" | "gift_buyer_receipt" | "attendee";

export interface PlannedTicketEmail {
  kind: TicketEmailKind;
  address: string;
  name: string;
  tickets: TicketRecord[];
  deliveryKey: string;
}

export interface TicketEmailPlanOptions {
  ticketId?: unknown;
  onlyEmail?: unknown;
  requestId?: unknown;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Synthetic comp-order addresses must never be passed to the email provider. */
export function isDeliverableEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  if (!EMAIL_PATTERN.test(email)) return false;
  const domain = email.slice(email.lastIndexOf("@") + 1);
  return domain !== "local" && !domain.endsWith(".local");
}

export function flattenValidTickets(order: TicketOrderRecord): TicketRecord[] {
  return (order.order_items ?? []).flatMap((item) =>
    (item.tickets ?? [])
      .filter((ticket) => !ticket.status || ticket.status === "valid")
      .map((ticket) => ({ ...ticket })),
  );
}

function groupTickets(tickets: TicketRecord[]): Map<string, TicketRecord[]> {
  const groups = new Map<string, TicketRecord[]>();
  for (const ticket of tickets) {
    const email = normalizeEmail(ticket.attendee_email);
    if (!isDeliverableEmail(email)) continue;
    const group = groups.get(email) ?? [];
    group.push(ticket);
    groups.set(email, group);
  }
  return groups;
}

function stableTicketIds(tickets: TicketRecord[]): string {
  const ids = tickets
    .map((ticket) => ticket.id)
    .sort()
    .join(",");
  if (ids.length <= 120) return ids;

  // Delivery keys have a database limit. Two independent 32-bit hashes keep
  // large grouped sends bounded without collapsing different ticket sets.
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < ids.length; index++) {
    const code = ids.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second ^ code, 3266489917);
  }
  return `tickets-${tickets.length}-${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}`;
}

function deliveryKey(
  orderId: string,
  requestId: string,
  kind: TicketEmailKind,
  address: string,
  tickets: TicketRecord[],
): string {
  const scope = requestId ? `ticket:${orderId}:request:${requestId}` : `ticket:${orderId}:initial`;
  const ticketScope = tickets.length > 0 ? stableTicketIds(tickets) : kind;
  return `${scope}:${ticketScope}:${normalizeEmail(address)}`;
}

/**
 * Builds the exact recipient list for a ticket send before any provider call.
 * Recovery is always scoped to the requesting inbox; checkout delivery reaches
 * the recipient and each distinct attendee. Gift buyers receive a receipt, not
 * the recipient's ticket access.
 */
export function planTicketEmails(
  order: TicketOrderRecord,
  options: TicketEmailPlanOptions = {},
): PlannedTicketEmail[] {
  const requestId =
    typeof options.requestId === "string" ? options.requestId.trim().slice(0, 50) : "";
  const onlyRecipient = normalizeEmail(options.onlyEmail);
  const requestedTicketId = typeof options.ticketId === "string" ? options.ticketId.trim() : "";
  const recipientEmail = normalizeEmail(order.recipient_email || order.buyer_email);
  const recipientName = order.recipient_name || order.buyer_name || "Attendee";
  const buyerEmail = normalizeEmail(order.buyer_email);
  const isGift = Boolean(order.is_gift);
  const isComp = order.status === "comp";

  let tickets = flattenValidTickets(order);
  if (requestedTicketId) {
    tickets = tickets.filter((ticket) => ticket.id === requestedTicketId);
  }

  // A ticket-confirmation message is useful only while at least one valid
  // ticket remains. This also keeps recovery from mailing an empty order link.
  if (tickets.length === 0) return [];

  const groups = groupTickets(tickets);
  const plan: PlannedTicketEmail[] = [];

  const add = (
    kind: TicketEmailKind,
    address: string,
    name: string,
    groupedTickets: TicketRecord[] = [],
  ) => {
    const normalized = normalizeEmail(address);
    if (!isDeliverableEmail(normalized)) return;
    plan.push({
      kind,
      address: normalized,
      name,
      tickets: groupedTickets,
      deliveryKey: deliveryKey(order.id, requestId, kind, normalized, groupedTickets),
    });
  };

  if (onlyRecipient) {
    if (requestedTicketId) {
      const group = groups.get(onlyRecipient);
      if (group) add("attendee", onlyRecipient, group[0].attendee_name || "Attendee", group);
      return plan;
    }

    // A gift buyer recovering a purchase gets proof of purchase only. Sending
    // the recipient's master ticket email here would expose ticket access.
    if (isGift && buyerEmail && onlyRecipient === buyerEmail && buyerEmail !== recipientEmail) {
      add("gift_buyer_receipt", buyerEmail, order.buyer_name || "Buyer");
      return plan;
    }

    if (!isComp && onlyRecipient === recipientEmail) {
      add("master", recipientEmail, recipientName);
      return plan;
    }

    const group = groups.get(onlyRecipient);
    if (group) add("attendee", onlyRecipient, group[0].attendee_name || "Attendee", group);
    return plan;
  }

  if (requestedTicketId) {
    for (const [email, group] of groups) {
      add("attendee", email, group[0].attendee_name || "Attendee", group);
    }
    return plan;
  }

  if (!isComp && isDeliverableEmail(recipientEmail)) {
    add("master", recipientEmail, recipientName);
  }

  for (const [email, group] of groups) {
    // Paid orders already include the recipient's tickets in the master email.
    // Comp orders have no master email, so their real recipient still needs the
    // attendee copy even when attendee_email matches recipient_email.
    if (!isComp && email === recipientEmail) continue;
    add("attendee", email, group[0].attendee_name || "Attendee", group);
  }

  if (
    isGift &&
    isDeliverableEmail(buyerEmail) &&
    buyerEmail !== recipientEmail &&
    !groups.has(buyerEmail)
  ) {
    add("gift_buyer_receipt", buyerEmail, order.buyer_name || "Buyer");
  }

  return plan;
}

/** Valid ticket holders only, shared by reminders and organizer broadcasts. */
export function collectTicketRecipients(orders: TicketOrderRecord[]): Map<string, string> {
  const recipients = new Map<string, string>();
  for (const order of orders) {
    if (order.status !== "paid" && order.status !== "comp") continue;
    const tickets = flattenValidTickets(order);
    for (const ticket of tickets) {
      const email = normalizeEmail(ticket.attendee_email) || normalizeEmail(order.buyer_email);
      if (!isDeliverableEmail(email)) continue;
      recipients.set(email, ticket.attendee_name || order.buyer_name || "Attendee");
    }
  }
  return recipients;
}

export function buildEmailDeliveryKey(
  scope: string,
  identifier: string,
  recipient: string,
): string {
  return `${scope}:${identifier}:${normalizeEmail(recipient)}`;
}
