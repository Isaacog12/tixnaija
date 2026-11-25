/**
 * Pure event and ticket presentation shared by the Edge Function and its tests.
 * No database or network access, so sale-window behaviour can be unit tested.
 */

export interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  start_datetime: string | null;
  end_datetime: string | null;
  venue_name: string | null;
  city: string | null;
  status?: string | null;
  postponed_at?: string | null;
  organizer_note?: string | null;
}

export interface TicketType {
  name: string;
  price_kobo: number;
  quantity_available: number;
  quantity_sold: number;
  quantity_cancelled: number | null;
  sales_start_at?: string | null;
  sales_end_at?: string | null;
}

const LAGOS = "Africa/Lagos";

// Building an Intl.DateTimeFormat is the expensive part, not formatting, and
// every event answer formats two or three dates. Created once per isolate.
const EVENT_DATE_FORMAT = new Intl.DateTimeFormat("en-NG", {
  timeZone: LAGOS, weekday: "short", day: "numeric", month: "short", year: "numeric",
});
const EVENT_TIME_FORMAT = new Intl.DateTimeFormat("en-NG", {
  timeZone: LAGOS, hour: "numeric", minute: "2-digit",
});
const EVENT_END_DATE_FORMAT = new Intl.DateTimeFormat("en-NG", {
  timeZone: LAGOS, day: "numeric", month: "short", year: "numeric",
});

export function formatWhen(start: string | null, end: string | null): string {
  if (!start) return "date to be announced";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "date to be announced";

  const datePart = EVENT_DATE_FORMAT.format(startDate);
  const timePart = EVENT_TIME_FORMAT.format(startDate);

  if (!end) return `${datePart}, ${timePart}`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${datePart}, ${timePart}`;

  const sameDay = EVENT_END_DATE_FORMAT.format(endDate) === EVENT_END_DATE_FORMAT.format(startDate);
  const endTime = EVENT_TIME_FORMAT.format(endDate);
  return sameDay
    ? `${datePart}, ${timePart} to ${endTime}`
    : `${datePart}, ${timePart} until ${EVENT_END_DATE_FORMAT.format(endDate)}, ${endTime}`;
}

export function naira(kobo: number): string {
  if (!kobo || kobo <= 0) return "Free";
  return `NGN ${(kobo / 100).toLocaleString("en-NG")}`;
}

export function remaining(type: TicketType): number {
  const sold = Math.max(0, type.quantity_sold - (type.quantity_cancelled ?? 0));
  return Math.max(0, type.quantity_available - sold);
}

export function describeEvent(event: PublicEvent): string {
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");
  const lines = [event.title, formatWhen(event.start_datetime, event.end_datetime)];
  if (place) lines.push(place);
  // The organizer can cancel or complete an event long before its start time,
  // so the page state is part of the answer, not an assumption.
  if (event.status === "cancelled") {
    lines.push("Status: cancelled by the organizer");
  } else if (event.postponed_at) {
    lines.push("Status: postponed by the organizer");
  } else if (event.status === "completed") {
    lines.push("Status: this event has ended");
  }
  const note = event.organizer_note?.trim();
  if (note) lines.push(`Organizer note: ${note.slice(0, 300)}`);
  lines.push(`Details: /e/${event.slug}`);
  return lines.join("\n");
}

/** cancellation/postponement answer derived from the event's actual lifecycle state. */
export function eventStatusGuidance(event: PublicEvent): string {
  if (event.status === "cancelled") {
    return "The organizer has marked this event cancelled. Buyers are emailed, and the organizer handles the refund through Paystack. Requests are reviewed within 3 business days; approved refunds usually arrive in 3–7 business days. Full policy: /refunds.";
  }
  if (event.postponed_at) {
    return "The organizer has postponed this event; the updated date is shown above. You can request a refund within 14 calendar days of the postponement or venue-change notice. Full policy: /refunds.";
  }
  if (event.status === "completed") {
    return "This event has ended and is not marked as cancelled. If you received a cancellation notice or were charged in error, say \"talk to a person\" and I'll pass it to the team.";
  }
  return "This event is currently published and is not marked as cancelled or postponed. If the organizer sent you a different update, say \"talk to a person\" and I'll pass it to the team.";
}

/** Why a ticket type cannot be bought right now, if it cannot. */
export type TicketSaleState = "on_sale" | "not_started" | "closed" | "sold_out";

export function ticketSaleState(type: TicketType, now: Date = new Date()): TicketSaleState {
  const end = type.sales_end_at ? new Date(type.sales_end_at).getTime() : Number.NaN;
  if (!Number.isNaN(end) && now.getTime() >= end) return "closed";

  const start = type.sales_start_at ? new Date(type.sales_start_at).getTime() : Number.NaN;
  if (!Number.isNaN(start) && now.getTime() < start) return "not_started";

  return remaining(type) === 0 ? "sold_out" : "on_sale";
}

/**
 * Prices and availability with the sale window applied.
 *
 * The query used to skip sales_start_at/sales_end_at, so the assistant could
 * quote a tier that wasn't on sale yet, or say "12 left" for a tier whose sales
 * had already closed — a price the customer could not actually pay.
 */
export function describeTickets(types: TicketType[], now: Date = new Date()): string {
  if (types.length === 0) return "Ticket types for this event are not published yet.";
  const sorted = [...types].sort((a, b) => a.price_kobo - b.price_kobo);
  const stateOf = (type: TicketType) => ticketSaleState(type, now);

  const onSale = sorted.filter((type) => stateOf(type) === "on_sale");
  const totalLeft = onSale.reduce((sum, type) => sum + remaining(type), 0);

  const lines = sorted.slice(0, 6).map((type) => {
    const state = stateOf(type);
    const suffix =
      state === "sold_out"
        ? "sold out"
        : state === "closed"
        ? "sales closed"
        : state === "not_started"
        ? `sales open ${formatWhen(type.sales_start_at ?? null, null)}`
        : `${remaining(type)} left`;
    return `- ${type.name}: ${naira(type.price_kobo)} (${suffix})`;
  });

  let summary: string;
  if (onSale.length > 0) {
    summary = `From ${naira(onSale[0].price_kobo)}. ${totalLeft} ticket${totalLeft === 1 ? "" : "s"} left in total.`;
  } else {
    const upcoming = sorted
      .filter((type) => stateOf(type) === "not_started")
      .sort((a, b) => (a.sales_start_at ?? "").localeCompare(b.sales_start_at ?? ""))[0];
    if (upcoming) {
      summary = `Ticket sales haven't opened yet — they start ${formatWhen(upcoming.sales_start_at ?? null, null)}.`;
    } else if (sorted.some((type) => stateOf(type) === "closed")) {
      summary = "Ticket sales for this event have closed.";
    } else {
      summary = "This event is sold out.";
    }
  }

  return `${summary}\n${lines.join("\n")}`;
}
