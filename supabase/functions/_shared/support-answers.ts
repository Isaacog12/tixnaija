/**
 * Every answer the assistant can give without touching the database.
 *
 * Kept apart from the handler so the wording can be reviewed and tested as
 * copy, and so a missing answer is a failing test instead of a silent
 * escalation. Answers that depend on live data — events, prices, orders — are
 * not here; they belong to the handler.
 */

import type { Intent } from "./support-brain.ts";

// Server-side only. Never accepted from the client.
export const PUBLIC_SUPPORT_ADDRESS = "tixnaijaapp@gmail.com";
export const PUBLIC_SUPPORT_PHONE = "+234 901 127 5275";
export const SUPPORT_HOURS = "Mon-Fri, 9am-6pm WAT";

// Quoted from /refunds — policy only, never a promise about one customer.
export const REFUND_POLICY =
  "Here's the policy in short:\n" +
  "- All sales are final unless the event is cancelled, postponed or materially misrepresented.\n" +
  "- If an event is cancelled, buyers are emailed automatically, and the refund is the organizer's responsibility because ticket money is settled to them through Paystack.\n" +
  "- After a postponement or venue change, you can request a refund within 14 calendar days of the notice.\n" +
  "- Requests are reviewed within 3 business days, and approved refunds land back on the card in 3 to 7 business days via Paystack.\n" +
  `- To request a refund, include your order reference, purchase email and reason, or email ${PUBLIC_SUPPORT_ADDRESS}.\n` +
  "Full policy: /refunds";

const ENTRY_GUIDANCE =
  "Show the live QR code at the gate: open /tickets in your account, or the ticket email itself. Turn your screen brightness up and don't show a screenshot — gate staff scan the live code.\n\nIf it still won't scan, staff can check you in manually — show them your order reference or the purchase email. If you were already turned away, say \"talk to a person\" and I'll escalate it with your details.";

const EMAIL_CONFIRMATION_GUIDANCE =
  "That \"not sent\" line means our email provider didn't confirm delivery of that message — it does not mean your ticket is invalid or gone. Your order still stands.\n\nCheck the spam/junk folder for the address you paid with, then open /my-tickets, enter that email and the purchase date, and resend only that day's links. If it still doesn't arrive, say \"talk to a person\" and I'll pass it on.";

const TECHNICAL_GUIDANCE =
  "Most of these clear up with three steps:\n\n1. Hard-refresh the page (Ctrl+Shift+R, or pull down to reload on a phone).\n2. Try another browser, or the Android app at /Tixnaija.apk.\n3. Turn off any ad-blocker or data-saver on the checkout page.\n\nIf checkout failed, don't pay a second time — check your bank alert, then look the order up at /my-tickets. Still broken? Tell me the page and what you clicked, and I'll pass it to the team.";

const ACCOUNT_DELETE_GUIDANCE =
  "You can do it yourself: open /account, go to Security, choose Delete account and type DELETE to confirm. That removes your profile and personal data and signs you out.\n\nIf you organize events, delete or hand over those first — deletion is blocked while any event is still under your account. Want the team to do it instead? Say \"talk to a person\".";

const EMAIL_CHANGE_GUIDANCE =
  "The email on your account is read-only in /account, so the form can't change it. Sign in and ask the support team to move it — they verify the current address first so nobody can take over an account.\n\nIf you bought as a guest with a different address, /my-tickets still works with the email you paid with.";

export const PAYMENT_ISSUE_GUIDANCE =
  "Please don't pay again while this is open — a second payment creates a second order.\n\nBank transfers can take 2–10 minutes to show as confirmed. Check the order at /my-tickets with the email and date you paid, and check your bank alert: if the money left your account, a failed order is not proof of no debit, so the team has to reconcile it rather than treat it as unpaid.";

const TRUST_GUIDANCE =
  "Every event on TixNaija is published by a signed-in organizer, and the event page shows who they are. Before you pay:\n\n- Check the organizer's name and their other events.\n- Read the refund terms on the event page.\n- Pay only through TixNaija checkout — never to a personal account or a DM.\n\nIf something looks off, send me the event name and I'll have the team check it.";

/**
 * Answers that are true for every customer, keyed by intent.
 *
 * An intent in this map never reaches the database. Anything whose answer
 * depends on an event, a ticket, an order or a person must not be added here.
 */
export const STATIC_ANSWERS: Partial<Record<Intent, string>> = {
  greeting: "Hi, I'm TixNaija. Ask me about events, tickets or orders.",

  thanks: "You're welcome. If you need anything else about an event, ticket or order, just ask.",

  organizer:
    "You can list an event on TixNaija yourself — there's no approval queue. Create an account at /auth, then open /dashboard to publish the event, set your ticket types and prices, and watch sales come in.\n\nTixNaija keeps a 10% platform fee from paid ticket sales; Paystack processing charges are deducted on settlement. Connect your Paystack subaccount in /account so payouts can settle automatically to your bank, then track them in the dashboard's Payouts tab.\n\nWant a hand setting it up? Say \"talk to a person\" and I'll pass you to the team.",

  capabilities: [
    "Here's what I can do:",
    "",
    "- Find an event and give you the date, time and venue — try \"when is <event name>\"",
    "- Show ticket prices and how many are left — \"how much is <event name>\"",
    "- Tell you what's coming up — \"what events are happening\"",
    "- Show you how to resend your ticket links — \"I didn't get my ticket\"",
    "- Explain refunds, payments, promo codes, waitlists and accounts",
    "- Show you how to list and sell tickets for your own event",
    "- Answer who runs the platform",
    "",
    "If I can't answer something, I'll pass it to a person who can.",
  ].join("\n"),

  about:
    "TixNaija was created by Isaac Ogbomo.\n\nIt's an independent Nigerian ticketing platform. TixNaija is not connected to Tix Africa in any way — separate company, separate team, separate platform.",

  how_to_buy:
    "Open the event at /browse, pick your ticket type and quantity, then continue to checkout. You can pay with card, bank transfer or USSD, and your tickets are emailed right after payment. You don't need an account to buy.",

  payment:
    "Checkout is handled by Paystack: card, bank transfer and USSD all work. If you were debited but no ticket arrived, enter the email you paid with at /my-tickets to resend the links. If it's still missing, I can pass it to the support team.",

  promo:
    "If an event has a promo code, the field appears at checkout before you pay. Codes are set by the organizer, so I can't create one — but I can pass a request to the support team.",

  waitlist:
    "When a ticket type sells out, the event page offers a waitlist so you're notified if tickets are released. Join it from the event page at /browse.",

  account:
    "Sign in at /auth. If you've forgotten your password, use the reset link there. Bought as a guest? You don't need an account — use /my-tickets with your email.",

  app: "You can download the TixNaija Android APK directly at /Tixnaija.apk. An iPhone version isn't released yet.",

  contact: `You can reach the team at ${PUBLIC_SUPPORT_ADDRESS} or ${PUBLIC_SUPPORT_PHONE}, ${SUPPORT_HOURS}. For a question about a specific event, the organizer's contact is listed on the event page.`,

  refund_policy: REFUND_POLICY,
  entry: ENTRY_GUIDANCE,
  delivery_confirmation: EMAIL_CONFIRMATION_GUIDANCE,
  technical: TECHNICAL_GUIDANCE,
  account_delete: ACCOUNT_DELETE_GUIDANCE,
  email_change: EMAIL_CHANGE_GUIDANCE,
  trust: TRUST_GUIDANCE,

  transfer:
    "You can reassign a ticket yourself before doors open and before it has been checked in. Sign in, open /tickets, find the ticket and choose Reassign Ticket, then update the attendee's name and email. If the email changes, the old QR code is invalidated and the new attendee receives the updated ticket.\n\nIf the Reassign Ticket option is missing or the event has started, say \"talk to a person\" and I'll pass it to the team.",
};

/**
 * Copy for the classifier's two non-case outcomes.
 *
 * PLAYFUL gets one friendly line that steers back to the assistant's actual
 * job, and never opens a case or spends an escalation slot. CONFIRM asks a
 * single question and hands the decision to the customer with two buttons.
 */
export const PLAYFUL_REPLY =
  "Ha — noted. I'm best at events, tickets, orders and payments, so tell me what you need and I'll dig in.";

export const ABUSIVE_REPLY =
  "I'll leave that one. Tell me what went wrong with an event, ticket or payment and I'll get it to a person.";

export const CONFIRM_QUESTION =
  "That sounds frustrating, and I don't want to guess at it. Do you want me to open a support case so a person looks into it?";

export const CONFIRM_DECLINED_REPLY =
  "No problem — no case opened. Ask me anything about events, tickets, orders or payments.";

/** Short replies are answered against the last thing the assistant asked. */
export const FOLLOW_UP_REPLIES: Record<"ok" | "thanks" | "bye" | "never_mind", string> = {
  ok: "Got it. Anything else about an event, ticket or order?",
  thanks: "You're welcome. If anything else comes up, I'm here.",
  bye: "Bye for now — take care.",
  never_mind: "No problem, I've left it. Ask me anything else whenever you're ready.",
};

/**
 * The sentence that follows every successful escalation.
 *
 * contactVerified is accepted and deliberately ignored: the wording must not
 * change depending on whether the typed address has ever bought a ticket here.
 * The old version said "I couldn't send a receipt ... because it isn't linked to
 * an order", which let anyone test whether an address had ever transacted.
 */
export function escalationReplyFor(params: {
  caseNumber: string | null;
  lead?: string;
  contactVerified?: boolean;
}): string {
  const lead = params.lead ??
    "I've passed this to the support team and they'll follow up by email.";
  const reference = params.caseNumber
    ? `\n\nYour case number is ${params.caseNumber}. Keep it — quoting it gets you a faster answer.`
    : "";
  return `${lead}${reference}\n\nIf a receipt hasn't reached your inbox within a few minutes, keep this case number and email ${PUBLIC_SUPPORT_ADDRESS}.`;
}

/**
 * Reply when the hourly case cap is hit.
 *
 * A case number is only repeated to a signed-in customer who owns it. A guest
 * who typed someone else's address must not be handed that person's reference,
 * so the guest wording never contains one.
 */
export function cappedEscalationReplyFor(params: {
  caseNumber: string | null;
  signedIn: boolean;
}): string {
  const lead = params.signedIn && params.caseNumber
    ? `Your case ${params.caseNumber} is already with the support team, so someone is on it. I can't open a second case just yet — that keeps the queue moving.`
    : "I've already passed a message from you to the support team recently, so someone is looking into it. I can't open a second case just yet.";
  return `${lead}\n\nIf this is a different problem, try again in about an hour, or email ${PUBLIC_SUPPORT_ADDRESS} and they'll pick it up straight away.`;
}

/**
 * Intents whose answer must come from live data or a person. Listed explicitly
 * so a future static answer cannot silently shadow the live one.
 */
export const DYNAMIC_INTENTS: readonly Intent[] = [
  "listing", "price", "availability", "schedule", "venue", "cancelled",
  "past_event", "order", "payment_issue", "refund", "fraud", "human",
  "ticket_email_change", "unknown",
];
