import { describe, expect, it } from "vitest";
import {
  buildEmailDeliveryKey,
  collectTicketRecipients,
  isDeliverableEmail,
  normalizeEmail,
  planTicketEmails,
  type TicketOrderRecord,
  type TicketRecord,
} from "../../supabase/functions/_shared/email-delivery";

const ORDER_ID = "123e4567-e89b-12d3-a456-426614174000";

function ticket(
  id: string,
  email: string | null,
  overrides: Partial<TicketRecord> = {},
): TicketRecord {
  return {
    id,
    ticket_code: `code-${id}`,
    attendee_name: `Attendee ${id}`,
    attendee_email: email,
    status: "valid",
    ticketTypeName: "General Admission",
    ...overrides,
  };
}

function order(overrides: Partial<TicketOrderRecord> = {}): TicketOrderRecord {
  return {
    id: ORDER_ID,
    status: "paid",
    is_gift: false,
    buyer_name: "Buyer",
    buyer_email: "buyer@example.com",
    recipient_name: "Buyer",
    recipient_email: "buyer@example.com",
    order_items: [{ tickets: [ticket("ticket-1", "buyer@example.com")] }],
    ...overrides,
  };
}

function planSummary(value: TicketOrderRecord, options = {}) {
  return planTicketEmails(value, options).map((message) => ({
    kind: message.kind,
    address: message.address,
    ticketIds: message.tickets.map((item) => item.id),
  }));
}

describe("email address normalization", () => {
  it("trims and lowercases addresses", () => {
    expect(normalizeEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(normalizeEmail(null)).toBe("");
  });

  it("rejects malformed and synthetic comp addresses", () => {
    expect(isDeliverableEmail("guest@example.com")).toBe(true);
    expect(isDeliverableEmail("guest@comp.local")).toBe(false);
    expect(isDeliverableEmail("guest@local")).toBe(false);
    expect(isDeliverableEmail("not-an-email")).toBe(false);
    expect(isDeliverableEmail("guest@example.com extra")).toBe(false);
  });
});

describe("planTicketEmails", () => {
  it("sends one master email for a normal single-recipient checkout", () => {
    expect(planSummary(order())).toEqual([
      { kind: "master", address: "buyer@example.com", ticketIds: [] },
    ]);
  });

  it("groups case-variant attendee addresses and keeps other attendees separate", () => {
    const value = order({
      order_items: [
        {
          tickets: [
            ticket("ticket-1", "buyer@example.com"),
            ticket("ticket-2", "Guest@Example.com"),
            ticket("ticket-3", "guest@example.COM"),
            ticket("ticket-4", "other@example.com"),
          ],
        },
      ],
    });

    expect(planSummary(value)).toEqual([
      { kind: "master", address: "buyer@example.com", ticketIds: [] },
      {
        kind: "attendee",
        address: "guest@example.com",
        ticketIds: ["ticket-2", "ticket-3"],
      },
      { kind: "attendee", address: "other@example.com", ticketIds: ["ticket-4"] },
    ]);
  });

  it("excludes cancelled, checked-in, and invalid-address tickets", () => {
    const value = order({
      order_items: [
        {
          tickets: [
            ticket("ticket-1", "buyer@example.com"),
            ticket("ticket-2", "cancelled@example.com", { status: "cancelled" }),
            ticket("ticket-3", "checked-in@example.com", { status: "checked_in" }),
            ticket("ticket-4", "synthetic@comp.local"),
            ticket("ticket-5", "malformed"),
          ],
        },
      ],
    });

    expect(planSummary(value)).toEqual([
      { kind: "master", address: "buyer@example.com", ticketIds: [] },
    ]);
  });

  it("emails the real comp recipient without mailing the synthetic buyer", () => {
    const value = order({
      status: "comp",
      buyer_email: "organizer@comp.local",
      recipient_email: "recipient@example.com",
      recipient_name: "Recipient",
      order_items: [{ tickets: [ticket("ticket-1", "recipient@example.com")] }],
    });

    expect(planSummary(value)).toEqual([
      { kind: "attendee", address: "recipient@example.com", ticketIds: ["ticket-1"] },
    ]);
  });

  it("does not suppress a comp recipient's attendee copy when the addresses match", () => {
    const value = order({
      status: "comp",
      order_items: [{ tickets: [ticket("ticket-1", "buyer@example.com")] }],
    });

    expect(planSummary(value)).toEqual([
      { kind: "attendee", address: "buyer@example.com", ticketIds: ["ticket-1"] },
    ]);
  });

  it("separates gift ticket access from the buyer's purchase receipt", () => {
    const value = order({
      is_gift: true,
      buyer_email: "buyer@example.com",
      recipient_email: "recipient@example.com",
      recipient_name: "Recipient",
      order_items: [{ tickets: [ticket("ticket-1", "recipient@example.com")] }],
    });

    expect(planSummary(value)).toEqual([
      { kind: "master", address: "recipient@example.com", ticketIds: [] },
      { kind: "gift_buyer_receipt", address: "buyer@example.com", ticketIds: [] },
    ]);
  });

  it("sends only one message when a gift buyer is also the recipient", () => {
    const value = order({ is_gift: true });

    expect(planSummary(value)).toEqual([
      { kind: "master", address: "buyer@example.com", ticketIds: [] },
    ]);
  });

  it("limits gift-buyer recovery to a receipt without ticket access", () => {
    const value = order({
      is_gift: true,
      recipient_email: "recipient@example.com",
      order_items: [{ tickets: [ticket("ticket-1", "recipient@example.com")] }],
    });

    expect(planSummary(value, { onlyEmail: "BUYER@example.com" })).toEqual([
      { kind: "gift_buyer_receipt", address: "buyer@example.com", ticketIds: [] },
    ]);
  });

  it("limits gift-recipient recovery to the recipient's ticket email", () => {
    const value = order({
      is_gift: true,
      recipient_email: "recipient@example.com",
      order_items: [{ tickets: [ticket("ticket-1", "recipient@example.com")] }],
    });

    expect(planSummary(value, { onlyEmail: "recipient@example.com" })).toEqual([
      { kind: "master", address: "recipient@example.com", ticketIds: [] },
    ]);
  });

  it("allows attendee-only recovery without exposing the rest of the order", () => {
    const value = order({
      order_items: [
        {
          tickets: [
            ticket("ticket-1", "buyer@example.com"),
            ticket("ticket-2", "attendee@example.com"),
            ticket("ticket-3", "other@example.com"),
          ],
        },
      ],
    });

    expect(planSummary(value, { onlyEmail: "attendee@example.com" })).toEqual([
      { kind: "attendee", address: "attendee@example.com", ticketIds: ["ticket-2"] },
    ]);
  });

  it("does not mail an unrelated recovery address", () => {
    expect(planSummary(order(), { onlyEmail: "stranger@example.com" })).toEqual([]);
  });

  it("restricts an attendee edit to the selected ticket", () => {
    const value = order({
      order_items: [
        {
          tickets: [
            ticket("ticket-1", "buyer@example.com"),
            ticket("ticket-2", "attendee@example.com"),
          ],
        },
      ],
    });

    expect(planSummary(value, { ticketId: "ticket-2" })).toEqual([
      { kind: "attendee", address: "attendee@example.com", ticketIds: ["ticket-2"] },
    ]);
    expect(planSummary(value, { ticketId: "ticket-2", onlyEmail: "buyer@example.com" })).toEqual(
      [],
    );
  });

  it("does not send a ticket confirmation when no valid tickets remain", () => {
    const value = order({
      order_items: [
        { tickets: [ticket("ticket-1", "buyer@example.com", { status: "cancelled" })] },
      ],
    });

    expect(planTicketEmails(value)).toEqual([]);
    expect(planTicketEmails(value, { onlyEmail: "buyer@example.com" })).toEqual([]);
  });

  it("uses stable initial keys and stable per-request retry keys", () => {
    const value = order();
    const initial = planTicketEmails(value);
    const request = planTicketEmails(value, { requestId: "request-123" });

    expect(planTicketEmails(value)[0].deliveryKey).toBe(initial[0].deliveryKey);
    expect(planTicketEmails(value, { requestId: "request-123" })[0].deliveryKey).toBe(
      request[0].deliveryKey,
    );
    expect(request[0].deliveryKey).not.toBe(initial[0].deliveryKey);
    expect(planTicketEmails(value, { requestId: "request-456" })[0].deliveryKey).not.toBe(
      request[0].deliveryKey,
    );
  });

  it("bounds large ticket groups and long request IDs in delivery keys", () => {
    const tickets = Array.from({ length: 30 }, (_, index) =>
      ticket(`ticket-${index}-${"x".repeat(20)}`, "attendee@example.com"),
    );
    const value = order({ order_items: [{ tickets }] });
    const email = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(61)}`;
    const withLongEmail = order({
      order_items: [{ tickets: tickets.map((item) => ({ ...item, attendee_email: email })) }],
    });
    const [message] = planTicketEmails(withLongEmail, {
      onlyEmail: email,
      requestId: "r".repeat(200),
    });

    expect(message.deliveryKey).toContain("tickets-30-");
    expect(message.deliveryKey.length).toBeLessThanOrEqual(500);
    expect(message.deliveryKey).toBe(
      planTicketEmails(withLongEmail, {
        onlyEmail: email,
        requestId: "r".repeat(200),
      })[0].deliveryKey,
    );
  });
});

describe("collectTicketRecipients", () => {
  it("collects distinct valid recipients from paid and comp orders", () => {
    const recipients = collectTicketRecipients([
      order({
        order_items: [
          {
            tickets: [
              ticket("ticket-1", "Buyer@Example.com"),
              ticket("ticket-2", "guest@example.com"),
              ticket("ticket-3", "cancelled@example.com", { status: "cancelled" }),
            ],
          },
        ],
      }),
      order({
        id: "123e4567-e89b-12d3-a456-426614174001",
        status: "comp",
        buyer_email: "organizer@comp.local",
        order_items: [{ tickets: [ticket("ticket-4", "guest@example.COM")] }],
      }),
    ]);

    expect(Array.from(recipients.keys())).toEqual(["buyer@example.com", "guest@example.com"]);
  });

  it("falls back to the buyer for a valid ticket with no attendee address", () => {
    const recipients = collectTicketRecipients([
      order({ order_items: [{ tickets: [ticket("ticket-1", "   ")] }] }),
    ]);

    expect(Array.from(recipients.keys())).toEqual(["buyer@example.com"]);
  });

  it("excludes unpaid, failed, refunded, and unknown-status orders", () => {
    const recipients = collectTicketRecipients(
      ["pending", "failed", "refunded", undefined].map((status, index) =>
        order({
          id: `order-${index}`,
          status,
          order_items: [{ tickets: [ticket(`ticket-${index}`, `person-${index}@example.com`)] }],
        }),
      ),
    );

    expect(recipients.size).toBe(0);
  });
});

describe("buildEmailDeliveryKey", () => {
  it("normalizes the recipient and preserves the campaign scope", () => {
    expect(buildEmailDeliveryKey("event-broadcast", "broadcast-1", " Guest@Example.COM ")).toBe(
      "event-broadcast:broadcast-1:guest@example.com",
    );
  });
});
