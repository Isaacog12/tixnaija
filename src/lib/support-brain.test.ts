import { describe, expect, it } from "vitest";
import {
  containsSensitiveData,
  detectIntent,
  extractCity,
  extractSearchTerm,
  isIntent,
  linksForIntent,
  linksForKnowledge,
  listingWindow,
  looksSubstantive,
  orderStatusGuidance,
  rankKnowledge,
  type BotKnowledgeEntry,
} from "../../supabase/functions/_shared/support-brain";
import {
  DYNAMIC_INTENTS,
  STATIC_ANSWERS,
} from "../../supabase/functions/_shared/support-answers";
import {
  describeEvent,
  describeTickets,
  eventStatusGuidance,
} from "../../supabase/functions/_shared/support-events";

describe("support intent detection", () => {
  it("separates refund policy questions from refund requests", () => {
    expect(detectIntent("Can I get a refund?").intent).toBe("refund_policy");
    expect(detectIntent("What is your refund policy?").intent).toBe("refund_policy");
    expect(detectIntent("I want a refund for my order").intent).toBe("refund");
    expect(detectIntent("When will my refund arrive?").intent).toBe("refund");
  });

  it("separates payment instructions from payment failures", () => {
    expect(detectIntent("How can I pay with bank transfer?").intent).toBe("payment");
    expect(detectIntent("I was debited twice").intent).toBe("payment_issue");
    expect(detectIntent("Payment is still pending").intent).toBe("payment_issue");
  });

  it("does not treat a legitimacy question as a fraud report", () => {
    expect(detectIntent("Is this event legit?").intent).toBe("trust");
    expect(detectIntent("This organizer is a scammer").intent).toBe("fraud");
  });

  it("prioritizes specific account actions over generic account questions", () => {
    expect(detectIntent("How do I delete my account?").intent).toBe("account_delete");
    expect(detectIntent("I want to change my email address").intent).toBe("email_change");
    expect(detectIntent("I forgot my password").intent).toBe("account");
  });

  it("recognizes ticket delivery and entry problems", () => {
    expect(detectIntent("My ticket hasn't arrived").intent).toBe("order");
    expect(detectIntent("The email came but it says not sent").intent).toBe("delivery_confirmation");
    expect(detectIntent("My QR won't scan at the gate").intent).toBe("entry");
    expect(detectIntent("The app is not working").intent).toBe("technical");
  });

  it("tolerates a typo in a high-priority intent", () => {
    expect(detectIntent("Refnud my ticket please").intent).toBe("refund");
    expect(detectIntent("My refnud status").intent).toBe("refund");
  });

  it("uses the previous intent for short contextual follow-ups", () => {
    expect(detectIntent("What about it?", "price").intent).toBe("price");
    expect(detectIntent("Lagos", "listing").intent).toBe("listing");
    expect(detectIntent("What about entry?", "price").intent).toBe("entry");
  });

  it("routes a payment problem above an order lookup", () => {
    expect(detectIntent("My money was deducted but no ticket").intent).toBe("payment_issue");
    expect(detectIntent("I paid but no ticket").intent).toBe("payment_issue");
    expect(detectIntent("My ticket has not arrived").intent).toBe("order");
  });

  it("recognizes gate scanning problems and blank pages", () => {
    expect(detectIntent("The QR code is not scanning at the venue").intent).toBe("entry");
    expect(detectIntent("My QR wont scan").intent).toBe("entry");
    expect(detectIntent("Why is the page blank?").intent).toBe("technical");
  });

  it("does not read a promo-code question as a venue question", () => {
    expect(detectIntent("Where do I enter my promo code?").intent).toBe("promo");
  });

  it("validates intents supplied by the browser", () => {
    expect(isIntent("refund_policy")).toBe(true);
    expect(isIntent("not-an-intent")).toBe(false);
  });

  it("applies the additive training phrasings", () => {
    expect(detectIntent("I need a person").intent).toBe("human");
    expect(detectIntent("Dem debit my card twice").intent).toBe("payment_issue");
    expect(detectIntent("App dey crash").intent).toBe("technical");
    expect(detectIntent("I no see my ticket").intent).toBe("order");
  });

  it("separates a checkout email typo from account and order questions", () => {
    expect(detectIntent("I entered the wrong email during checkout").intent).toBe("ticket_email_change");
    expect(detectIntent("I want to change my account email").intent).toBe("email_change");
    expect(detectIntent("Where is my ticket?").intent).toBe("order");
    expect(isIntent("ticket_email_change")).toBe(true);
  });

  it("tolerates one typo inside a multi-word intent phrase", () => {
    expect(detectIntent("Paymnt failed for my order").intent).toBe("payment_issue");
    expect(detectIntent("My refund polcy please").intent).toBe("refund_policy");
  });

  it("does not match a singular phrase inside a plural word", () => {
    expect(detectIntent("No tickets available").intent).toBe("availability");
  });

  it("matches precompiled phrases on whole words and still tolerates typos", () => {
    expect(detectIntent("Hi").intent).toBe("greeting");
    // "hi" must not fire inside "this".
    expect(detectIntent("This is not acceptable").intent).not.toBe("greeting");
    expect(detectIntent("My ticekt has not arrived").intent).toBe("order");
  });
});

describe("event query extraction", () => {
  it("keeps the event name and removes question words", () => {
    const match = detectIntent("How much is Burna Boy concert?");
    expect(extractSearchTerm("How much is Burna Boy concert?", match.matched)).toBe("burna boy");
  });

  it("removes Pidgin price wording and generic concert nouns", () => {
    const match = detectIntent("How much be Burna Boy concert?");
    expect(extractSearchTerm("How much be Burna Boy concert?", match.matched)).toBe("burna boy");
  });

  it("recognizes multi-word Nigerian cities", () => {
    expect(extractCity("Any shows in Port Harcourt this weekend?")).toBe("Port Harcourt");
    expect(extractCity("Events for Benin City")).toBe("Benin City");
    expect(extractCity("Events for London")).toBeNull();
  });

  it("builds listing windows in West Africa Time", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(listingWindow("events today", now)).toEqual({
      start: "2026-11-23T23:00:00.000Z",
      end: "2026-11-24T23:00:00.000Z",
    });
    expect(listingWindow("events this weekend", now)).toEqual({
      start: "2026-11-27T23:00:00.000Z",
      end: "2026-11-29T23:00:00.000Z",
    });
    expect(listingWindow("all events", now)).toBeNull();
  });

  it("scopes tomorrow, next week and next weekend separately", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    expect(listingWindow("events tomorrow", now)).toEqual({
      start: "2026-11-24T23:00:00.000Z",
      end: "2026-11-25T23:00:00.000Z",
    });
    expect(listingWindow("events next week", now)).toEqual({
      start: "2026-11-29T23:00:00.000Z",
      end: "2026-12-06T23:00:00.000Z",
    });
    expect(listingWindow("events next weekend", now)).toEqual({
      start: "2026-12-04T23:00:00.000Z",
      end: "2026-12-06T23:00:00.000Z",
    });
  });
});

describe("safe message handling", () => {
  it.each([
    "My card number is 4111 1111 1111 1111",
    "The CVV is 123",
    "OTP: 123456",
    "My BVN is 12345678901",
    "Password is Summer2026!",
    "Account number: 0123456789",
    "Expiry date is 12/30",
  ])("refuses sensitive values: %s", (message) => {
    expect(containsSensitiveData(message)).toBe(true);
  });

  it("allows people to describe a credential problem without sharing it", () => {
    expect(containsSensitiveData("I forgot my password")).toBe(false);
    expect(containsSensitiveData("My password is not working")).toBe(false);
    expect(containsSensitiveData("I did not receive my OTP")).toBe(false);
    expect(containsSensitiveData("My phone number is 08012345678")).toBe(false);
  });

  it("does not spend an escalation on gibberish", () => {
    expect(looksSubstantive("asdfgh qwerty")).toBe(false);
    expect(looksSubstantive("I paid but my ticket is missing")).toBe(true);
  });
});

describe("staff-approved knowledge retrieval", () => {
  const refundKnowledge: BotKnowledgeEntry = {
    id: "refund-policy",
    title: "Refund policy",
    category: "refunds",
    content: "Requests are reviewed within 3 business days. Full policy: /refunds",
    triggers: ["refund policy", "can i get a refund", "change my mind"],
  };

  it("returns an exact approved answer", () => {
    const match = rankKnowledge("What is your refund policy?", [refundKnowledge], "refund_policy");
    expect(match?.entry.id).toBe("refund-policy");
    expect(match?.score).toBeGreaterThanOrEqual(78);
  });

  it("handles a paraphrase and one typo without guessing on unrelated text", () => {
    expect(rankKnowledge("Could I get a refnd?", [refundKnowledge], "refund_policy")?.entry.id).toBe("refund-policy");
    expect(rankKnowledge("How do I cook jollof rice?", [refundKnowledge], "unknown")).toBeNull();
  });

  it("only exposes allowlisted internal links", () => {
    const entry = {
      ...refundKnowledge,
      content: "Use /refunds or visit https://example.com/phishing",
    };
    expect(linksForKnowledge(entry)).toEqual([{ label: "Refund policy", href: "/refunds" }]);
    expect(linksForIntent("app")).toEqual([{ label: "Download Android APK", href: "/Tixnaija.apk" }]);
    expect(linksForIntent("transfer")).toEqual([{ label: "Find my tickets", href: "/tickets" }]);
  });
});

describe("ticket sale windows", () => {
  const now = new Date("2026-11-25T12:00:00.000Z");
  const base = { quantity_available: 50, quantity_sold: 10, quantity_cancelled: 0 };

  it("quotes a tier only while it is on sale", () => {
    const text = describeTickets([{ ...base, name: "Early bird", price_kobo: 500000 }], now);
    expect(text).toContain("From NGN 5,000");
    expect(text).toContain("40 left");
  });

  it("marks a tier whose sales have closed instead of offering it", () => {
    const text = describeTickets([
      { ...base, name: "Early bird", price_kobo: 500000, sales_end_at: "2026-11-20T00:00:00.000Z" },
      { ...base, name: "Regular", price_kobo: 800000 },
    ], now);
    expect(text).toContain("Early bird: NGN 5,000 (sales closed)");
    expect(text).toContain("From NGN 8,000");
  });

  it("says sales have not opened instead of calling it sold out", () => {
    const text = describeTickets([
      { ...base, name: "Gate", price_kobo: 900000, sales_start_at: "2026-12-01T09:00:00.000Z" },
    ], now);
    expect(text).toContain("haven't opened yet");
    expect(text).not.toContain("sold out");
  });

  it("counts only tickets that can be bought now", () => {
    const text = describeTickets([
      { ...base, name: "Closed", price_kobo: 100000, sales_end_at: "2026-11-20T00:00:00.000Z" },
      { ...base, name: "Open", price_kobo: 200000, quantity_sold: 45 },
    ], now);
    expect(text).toContain("5 tickets left in total");
  });

  it("reports a genuinely sold out event", () => {
    const text = describeTickets([
      { ...base, name: "All", price_kobo: 100000, quantity_sold: 50 },
    ], now);
    expect(text).toContain("sold out");
    expect(text).not.toContain("From NGN");
  });

  it("states an event's own status instead of assuming it is upcoming", () => {
    const event = {
      id: "e1",
      title: "Lagos Night",
      slug: "lagos-night",
      start_datetime: "2026-11-20T19:00:00.000Z",
      end_datetime: null,
      venue_name: "Eko Hotel",
      city: "Lagos",
      status: "cancelled",
    };
    expect(describeEvent(event)).toContain("cancelled by the organizer");
  });

  it("explains postponement and cancellation from lifecycle fields", () => {
    const base = {
      id: "e1",
      title: "Lagos Night",
      slug: "lagos-night",
      start_datetime: "2026-12-05T19:00:00.000Z",
      end_datetime: null,
      venue_name: "Eko Hotel",
      city: "Lagos",
      status: "published",
    };
    const postponed = { ...base, postponed_at: "2026-11-25T10:00:00.000Z", organizer_note: "Moved to Saturday." };
    expect(describeEvent(postponed)).toContain("Status: postponed by the organizer");
    expect(describeEvent(postponed)).toContain("Moved to Saturday");
    expect(eventStatusGuidance(postponed)).toContain("14 calendar days");
    expect(eventStatusGuidance({ ...base, status: "cancelled" })).toContain("organizer handles the refund");
    expect(eventStatusGuidance(base)).toContain("not marked as cancelled or postponed");
  });
});

describe("answer catalogue", () => {
  it("has a real answer for every static intent", () => {
    for (const [intent, answer] of Object.entries(STATIC_ANSWERS)) {
      expect(isIntent(intent)).toBe(true);
      expect((answer ?? "").trim().length).toBeGreaterThan(20);
    }
  });

  it("never shadows a live answer with static copy", () => {
    for (const intent of DYNAMIC_INTENTS) {
      expect(STATIC_ANSWERS[intent]).toBeUndefined();
    }
  });

  it("keeps product copy free of decoration", () => {
    for (const answer of Object.values(STATIC_ANSWERS)) {
      expect(answer).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2728}]/u);
    }
  });

  it("never conflates TixNaija with Tix Africa", () => {
    expect(STATIC_ANSWERS.about).toContain("not connected to Tix Africa");
  });

  it("uses verified self-service, app, contact and organizer guidance", () => {
    expect(STATIC_ANSWERS.transfer).toContain("/tickets");
    expect(STATIC_ANSWERS.transfer).toContain("Reassign Ticket");
    expect(STATIC_ANSWERS.app).toContain("/Tixnaija.apk");
    expect(STATIC_ANSWERS.app).not.toContain("/download");
    expect(STATIC_ANSWERS.contact).toContain("+234 901 127 5275");
    expect(STATIC_ANSWERS.contact).toContain("9am-6pm WAT");
    expect(STATIC_ANSWERS.organizer).toContain("10% platform fee");
    expect(STATIC_ANSWERS.organizer).toContain("Paystack subaccount");
  });
});

describe("order status wording", () => {
  it("never claims a failed order proves no money left the account", () => {
    expect(orderStatusGuidance("failed")).toContain("if money left your account");
  });

  it("covers every live order state without inventing a result", () => {
    for (const status of ["pending", "paid", "failed", "refunded", "comp", "unexpected"]) {
      expect(orderStatusGuidance(status).length).toBeGreaterThan(20);
    }
  });
});
