/**
 * The rules for permanently clearing an event.
 *
 * `admin_delete_event` enforces these on the server, and that is the authority.
 * They are mirrored here so the dialog cannot offer an action the server will
 * reject, and so the decision can be tested without a database.
 *
 * A preview is required before purging so the action is audited with accurate
 * sales totals. Money owed is reported to the admin but does not block an
 * explicit purge; refund records and audit history are retained.
 */

export type EventDeletionPreview = {
  orders: number;
  tickets: number;
  buyers: number;
  /** Paid orders with no processed refund for that buyer. */
  paid_unrefunded: number;
  /** Refund requests in pending, needs_admin_review, customer_contacted or approved. */
  open_refunds: number;
  revenue_kobo: number;
  refunded_kobo: number;
  money_owed: boolean;
};

export type PurgeBlockReason = "preview_unavailable";

/**
 * Why "clear everything" must stay disabled, or null when it is allowed.
 * A null preview covers both "still loading" and "the check failed".
 */
export function purgeBlockReason(
  preview: EventDeletionPreview | null,
): PurgeBlockReason | null {
  if (!preview) return "preview_unavailable";
  return null;
}

export function canPurgeEvent(preview: EventDeletionPreview | null): boolean {
  return purgeBlockReason(preview) === null;
}
