import { describe, expect, it } from "vitest";
import {
  containsSensitiveData,
  detectIntent,
  extractCity,
  extractSearchTerm,
  isIntent,
  linksForKnowledge,
  listingWindow,
  looksSubstantive,
  orderStatusGuidance,
  rankKnowledge,
  type BotKnowledgeEntry,
} from "../../supabase/functions/_shared/support-brain";

const refundKnowledge: BotKnowledgeEntry = {
  id: "refund-policy",
  title: "Refund policy",
  category: "refunds",
  content: "Requests are reviewed within 3 business days. Full policy: /refunds",
  triggers: ["refund policy", "can i get a refund", "change my mind"],
};

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
  it("returns an exact approved answer", () => {
    const match = rankKnowledge("What is your refund policy?", [refundKnowledge], "refund_policy");
    expect(match?.entry.id).toBe("refund-policy");
    expect(match?.score).toBeGreaterThanOrEqual(78);
  });

  it("handles paraphrases and a single typo", () => {
    expect(
      rankKnowledge("Could I get a refnd?", [refundKnowledge], "refund_policy")?.entry.id,
    ).toBe("refund-policy");
    expect(
      rankKnowledge("Can I get a refnd?", [refundKnowledge], "refund_policy")?.entry.id,
    ).toBe("refund-policy");
  });

  it("returns no answer rather than guessing on an unrelated question", () => {
    expect(rankKnowledge("How do I cook jollof rice?", [refundKnowledge], "unknown")).toBeNull();
  });

  it("does not penalize general knowledge for a known intent", () => {
    const entry: BotKnowledgeEntry = {
      ...refundKnowledge,
      id: "general",
      category: "general",
    };
    expect(rankKnowledge("refund policy", [entry], "refund_policy")?.entry.id).toBe("general");
  });

  it("only exposes recognized internal action links", () => {
    const entry: BotKnowledgeEntry = {
      ...refundKnowledge,
      content: "Use /refunds or visit https://example.com/phishing",
    };
    expect(linksForKnowledge(entry)).toEqual([{ label: "Refund policy", href: "/refunds" }]);
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
