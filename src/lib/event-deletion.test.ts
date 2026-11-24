import { describe, it, expect } from "vitest";
import {
  canPurgeEvent,
  purgeBlockReason,
  type EventDeletionPreview,
} from "./event-deletion";

const preview = (overrides: Partial<EventDeletionPreview> = {}): EventDeletionPreview => ({
  orders: 0,
  tickets: 0,
  buyers: 0,
  paid_unrefunded: 0,
  open_refunds: 0,
  revenue_kobo: 0,
  refunded_kobo: 0,
  money_owed: false,
  ...overrides,
});

describe("purgeBlockReason", () => {
  it("allows purging when a buyer paid and has no processed refund", () => {
    const p = preview({
      orders: 3,
      tickets: 5,
      buyers: 3,
      paid_unrefunded: 2,
      revenue_kobo: 250000,
      money_owed: true,
    });
    expect(purgeBlockReason(p)).toBeNull();
    expect(canPurgeEvent(p)).toBe(true);
  });

  it("allows purging while a refund request is still open", () => {
    const p = preview({
      orders: 1,
      tickets: 1,
      buyers: 1,
      paid_unrefunded: 1,
      open_refunds: 1,
      money_owed: true,
    });
    expect(purgeBlockReason(p)).toBeNull();
  });

  it("keeps money_owed informational even if the counters say otherwise", () => {
    const p = preview({ paid_unrefunded: 0, open_refunds: 0, money_owed: true });
    expect(canPurgeEvent(p)).toBe(true);
  });

  it("allows purging an event that never sold a ticket", () => {
    expect(purgeBlockReason(preview())).toBeNull();
    expect(canPurgeEvent(preview())).toBe(true);
  });

  it("allows purging once every paid buyer has a processed refund", () => {
    const p = preview({
      orders: 4,
      tickets: 6,
      buyers: 4,
      paid_unrefunded: 0,
      open_refunds: 0,
      revenue_kobo: 400000,
      refunded_kobo: 400000,
      money_owed: false,
    });
    expect(canPurgeEvent(p)).toBe(true);
  });

  it("never reads a missing preview as 'no sales'", () => {
    // A failed admin_event_deletion_preview call must not unlock a purge: doing
    // so would delete orders nobody managed to count.
    expect(purgeBlockReason(null)).toBe("preview_unavailable");
    expect(canPurgeEvent(null)).toBe(false);
  });
});
