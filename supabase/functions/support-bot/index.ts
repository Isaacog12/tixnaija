// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Server-side only. Never accepted from the client.
const PUBLIC_SUPPORT_ADDRESS = "tixnaijaapp@gmail.com";
const PUBLIC_SUPPORT_PHONE = "+234 901 127 5275";
const SUPPORT_HOURS = "Mon-Fri, 9am-6pm WAT";

function readEnvVar(name: string): string {
  // @ts-ignore Deno is provided by the Edge runtime, not by the app tsconfig.
  return Deno.env.get(name) ?? "";
}

/**
 * Staff inboxes notified when the assistant escalates.
 *
 * Read from SUPPORT_ESCALATION_EMAILS (comma-separated) so an address can be
 * retired without a code change. That matters because escalation emails carry
 * the customer's address, IP and full question — a recipient list baked into
 * source keeps forwarding personal data to a mailbox after nobody is watching
 * it. The default preserves current behaviour.
 */
function escalationRecipients(): string[] {
  const configured = readEnvVar("SUPPORT_ESCALATION_EMAILS")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => isValidEmail(entry));

  const fallback = ["isaacnerds@gmail.com", PUBLIC_SUPPORT_ADDRESS];
  return Array.from(new Set(configured.length > 0 ? configured : fallback));
}

// Quoted from /refunds — policy only, never a promise about one customer.
const REFUND_POLICY =
  "Here's the policy in short:\n" +
  "- All sales are final unless the event is cancelled, postponed or materially misrepresented.\n" +
  "- If an event is cancelled, buyers are emailed automatically, and the refund is the organizer's responsibility because ticket money is settled to them through Paystack.\n" +
  "- After a postponement or venue change, you can request a refund within 14 calendar days of the notice.\n" +
  "- Requests are reviewed within 3 business days, and approved refunds land back on the card in 3 to 7 business days via Paystack.\n" +
  `- To request a refund, include your order reference, purchase email and reason, or email ${PUBLIC_SUPPORT_ADDRESS}.\n` +
  "Full policy: /refunds";

const MAX_MESSAGE_LENGTH = 500;
const MAX_EMAIL_LENGTH = 254;

const IP_WINDOW_MS = 10 * 60 * 1000;
const IP_MAX_MESSAGES = 20;
const SESSION_WINDOW_MS = 10 * 60 * 1000;
const SESSION_MAX_MESSAGES = 12;

const ESCALATION_WINDOW_MS = 60 * 60 * 1000;
const IP_MAX_ESCALATIONS = 3;
const EMAIL_MAX_ESCALATIONS = 2;

const GENERIC_ERROR = "Something went wrong on our side. Please try again.";
const GENERIC_RATE_LIMIT = "Too many messages. Please wait a few minutes and try again.";

const allowedOrigins = [
  "https://tixnaija.name.ng",
  "https://www.tixnaija.name.ng",
  "https://tixnaija.vercel.app",
  "http://localhost:8080",
  "http://localhost:5173",
];

/**
 * Vercel preview deployments for this project only.
 *
 * The previous check was `origin.endsWith(".vercel.app")`, which allowed any
 * Vercel tenant on earth to call this function from a browser. Preview URLs are
 * `<project>-<hash>-<scope>.vercel.app`, so anchoring on the project name keeps
 * previews working without opening the door to `anything.vercel.app`.
 */
const VERCEL_PREVIEW_ORIGIN = /^https:\/\/tixnaija[a-z0-9-]*\.vercel\.app$/;

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function getCorsHeaders(req: Request) {
  const origin = req?.headers?.get("origin") || "";
  // Loopback on any port: the app is served from localhost:8080 in one setup and
  // 127.0.0.1:8080 in another, and both must be treated as the dev origin.
  const isLoopback = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin);
  const isAllowed =
    allowedOrigins.includes(origin) || VERCEL_PREVIEW_ORIGIN.test(origin) || isLoopback;

  // A rejected origin gets no Access-Control-Allow-Origin at all. Naming a
  // fixed origin the request did not come from describes a permission that was
  // not granted, and misleads anyone reading the response.
  return isAllowed
    ? { ...corsHeaders, "Access-Control-Allow-Origin": origin }
    : { ...corsHeaders };
}

/**
 * Last entry of x-forwarded-for, not the first.
 *
 * A caller can send its own x-forwarded-for, and the gateway appends the address
 * it actually observed — so the first value is attacker-chosen and the last is
 * not. Every IP-keyed cap in this function (20 messages per 10 minutes, 3
 * escalations per hour) was bypassable by rotating that header while it read the
 * first value.
 */
function clientIp(req: Request): string {
  const header = req.headers.get("x-forwarded-for") ?? "";
  const entries = header
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries[entries.length - 1] || "unknown";
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Damerau-free Levenshtein, capped for speed. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = new Array<number>(cols);
  let current = new Array<number>(cols);
  for (let j = 0; j < cols; j++) previous[j] = j;
  for (let i = 1; i < rows; i++) {
    current[0] = i;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[cols - 1];
}

/** Whole-word match, so "hi" never fires inside "this". */
function containsPhrase(text: string, phrase: string): boolean {
  if (phrase.includes(" ")) return text.includes(phrase);
  return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

/** Tolerates one typo in words of five letters or more ("refnud", "tickts"). */
/** "refnud" is one adjacent swap away from "refund". */
function isAdjacentSwap(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const diffs: number[] = [];
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diffs.push(i);
  }
  if (diffs.length !== 2) return false;
  const [i, j] = diffs;
  return j === i + 1 && a[i] === b[j] && a[j] === b[i];
}

function fuzzyContains(text: string, phrase: string): boolean {
  if (phrase.includes(" ")) return text.includes(phrase);
  if (phrase.length < 5) return false;
  return text.split(" ").some((word) => {
    if (word.length < 5 || Math.abs(word.length - phrase.length) > 1) return false;
    return editDistance(word, phrase) <= 1 || isAdjacentSwap(word, phrase);
  });
}

// ---------------------------------------------------------------------------
// Intent rules
// ---------------------------------------------------------------------------

type Intent =
  | "human"
  | "fraud"
  | "refund"
  | "transfer"
  | "order"
  | "delivery_confirmation"
  | "entry"
  | "price"
  | "availability"
  | "venue"
  | "schedule"
  | "listing"
  | "past_event"
  | "how_to_buy"
  | "organizer"
  | "payment"
  | "promo"
  | "waitlist"
  | "cancelled"
  | "about"
  | "capabilities"
  | "account"
  | "account_delete"
  | "email_change"
  | "app"
  | "contact"
  | "greeting"
  | "thanks"
  | "unknown";

interface Rule {
  intent: Intent;
  phrases: string[];
  /** Higher wins when several intents match the same sentence. */
  weight: number;
}

const INTENT_RULES: Rule[] = [
  {
    intent: "human",
    weight: 100,
    phrases: [
      "human", "real person", "human agent", "agent", "support team", "customer care",
      "customer service", "support person", "talk to", "speak to", "chat with a person",
      "call me", "someone else", "abeg connect me", "person wey go help",
      "talk to somebody", "can i speak", "manager",
    ],
  },
  {
    intent: "fraud",
    weight: 96,
    phrases: [
      "fraud", "fake event", "fake organizer", "scam", "scammer", "suspicious event",
      "report event", "report organizer", "not legitimate", "event legit", "organizer legit",
      "i was scammed", "dem scam me", "fake show",
    ],
  },
  {
    intent: "refund",
    weight: 95,
    phrases: [
      "refund", "money back", "my money", "return my money", "reverse the payment",
      "reversal", "charge back", "chargeback", "cancel my ticket", "cancel my order",
      "give me back my money", "abeg refund", "make una refund", "i want my money",
      "refund policy", "refund status", "when will my refund", "how do refunds work",
      "how do i request a refund", "no refund",
    ],
  },
  {
    intent: "transfer",
    weight: 90,
    phrases: [
      "transfer my ticket", "transfer ticket", "give my ticket to", "change the name",
      "change attendee", "send ticket to", "sell my ticket", "resell",
      "reassign my ticket", "reassign ticket", "give ticket to", "change ticket name",
      "rename ticket", "change attendee name", "send to another person",
    ],
  },
  {
    intent: "order",
    weight: 85,
    phrases: [
      "my ticket", "my tickets", "my order", "my orders", "qr", "qr code",
      "ticket code", "scan", "didn't get", "did not get", "not received",
      "haven't received", "no email", "confirmation email", "resend", "lost my ticket",
      "i no see my ticket", "ticket never land", "my ticket no dey", "email me",
      "not sent", "never sent", "no ticket", "ticket missing", "email missing",
      "spam folder", "junk folder", "where is my ticket", "ticket email",
      "email not received", "resend my ticket", "find my ticket", "ticket link",
    ],
  },
  {
    intent: "delivery_confirmation",
    weight: 87,
    phrases: [
      "email came but error", "email arrived but error", "got email but not sent",
      "received email but not sent", "ticket email came", "mail came but error",
      "email don land but error", "i get mail but e say not sent",
    ],
  },
  {
    intent: "entry",
    weight: 86,
    phrases: [
      "qr won't scan", "qr not scanning", "code not scanning", "ticket not scanning",
      "can't enter", "cannot enter", "turned away", "gate staff", "door staff",
      "at the gate", "check in", "checkin", "manual check in", "admission",
      "entry denied", "code no dey work", "dem no allow me enter",
    ],
  },
  {
    intent: "price",
    weight: 80,
    phrases: [
      "how much", "price", "prices", "cost", "ticket fee", "fees", "gate fee",
      "na how much", "how much be", "wetin be the price", "how much e cost",
      "price list", "ticket price", "how much is",
    ],
  },
  {
    intent: "availability",
    weight: 78,
    phrases: [
      "sold out", "still available", "tickets left", "any left", "remaining tickets",
      "still get ticket", "ticket still dey", "space dey", "is it full", "any space",
      "available tickets", "sold finish",
    ],
  },
  {
    intent: "venue",
    weight: 70,
    phrases: [
      "where is", "where's", "where e dey", "where e hold", "venue", "location",
      "address", "direction", "how do i get there", "how i go reach", "take place",
    ],
  },
  {
    intent: "schedule",
    weight: 68,
    phrases: [
      "when is", "when's", "what time", "what date", "which day", "start time",
      "wetin be the date", "which time", "when e go start", "gate open", "doors open",
      "what day",
    ],
  },
  {
    intent: "cancelled",
    weight: 66,
    phrases: [
      "cancelled", "canceled", "postponed", "moved to", "event cancelled",
      "event cancelled?", "no longer holding", "dem cancel", "shifted",
    ],
  },
  {
    intent: "how_to_buy",
    weight: 64,
    phrases: [
      "how do i buy", "how to buy", "how can i buy", "how to purchase", "where to buy",
      "how do i get a ticket", "how i go buy", "buy ticket", "purchase", "checkout",
      "guest checkout", "buy without account", "do i need an account", "checkout steps",
    ],
  },
  {
    // A question about an event that is already over: "can I buy a ticket for an
    // event that has already ended?". The word "event" used to match `listing`
    // (40), extractSearchTerm reduced the message to "already ended", the event
    // lookup missed, and the listing fallback dumped a wall of upcoming events at
    // someone who had asked a yes/no policy question. Weighted above how_to_buy
    // (64) so "can I still buy a ticket for an event that ended" resolves here
    // instead of to generic purchase steps, but below refund/transfer/order so a
    // real money problem on a past event still wins.
    intent: "past_event",
    weight: 67,
    phrases: [
      "ended", "already ended", "has ended", "have ended", "event ended",
      "ended already", "already over", "already happened", "has happened",
      "already passed", "has passed", "event passed", "past event", "event is past",
      "already finished", "has finished", "event that ended", "old event",
      "ended event", "event don end", "e don end", "e don finish",
      "event finish already", "don end already",
    ],
  },
  {
    // Someone who wants to host, not attend. Nothing in the rule set covered
    // this, and "event" is a stopword, so "how do i create an event" reduced to
    // the search term "create", matched nothing, and escalated to a human as an
    // unanswerable question. Weighted just above how_to_buy and below every
    // specific customer intent, so "my event was cancelled" (66) and "what time
    // does my event start" (68) still resolve to the customer's actual problem.
    intent: "organizer",
    weight: 65,
    phrases: [
      "organizer", "organiser", "event organizer", "event organiser",
      "host an event", "host my event", "hosting an event", "list my event",
      "list an event", "how do i list", "create an event", "create event",
      "sell tickets", "selling tickets", "promote my event", "my own event",
      "i have an event", "planning an event", "become an organizer",
      "sign up as an organizer", "box office", "payout", "payouts", "my payout",
      "organizer application", "apply to sell", "organizer fee", "platform fee",
      "commission", "kyc", "become a seller", "application pending",
    ],
  },
  {
    intent: "payment",
    weight: 62,
    phrases: [
      "payment method", "pay with", "card payment", "transfer to", "bank transfer",
      "ussd", "opay", "palmpay", "paystack", "flutterwave", "how do i pay",
      "payment failed", "payment no go through", "was i charged", "debited",
      "double charge", "charged twice", "debited twice", "payment pending",
      "transaction failed", "no payment confirmation",
    ],
  },
  {
    intent: "promo",
    weight: 60,
    phrases: [
      "promo code", "discount", "coupon", "voucher", "promo", "referral code",
      "student discount", "early bird",
    ],
  },
  {
    intent: "waitlist",
    weight: 58,
    phrases: ["waitlist", "wait list", "notify me", "join queue", "sold out notify"],
  },
  {
    intent: "capabilities",
    weight: 59,
    phrases: [
      "help", "what can you do", "what do you do", "what can i ask", "how can you help",
      "how do you work", "what are you", "menu", "options", "commands", "features",
      "what should i ask", "wetin you fit do", "how you go help me", "what else can you do",
    ],
  },
  {
    intent: "about",
    weight: 57,
    phrases: [
      "who created", "who made", "who built", "who owns", "who owns tixnaija",
      "who founded", "founder", "ceo", "who is behind", "who runs", "owner",
      "tix africa", "tixafrica", "tix-africa", "is this tix africa",
      "are you tix africa", "same as tix africa", "about tixnaija", "about you",
      "who are you", "what is tixnaija", "isaac", "ogbomo",
    ],
  },
  {
    intent: "account",
    weight: 56,
    phrases: [
      "login", "log in", "sign in", "sign up", "create account", "reset password",
      "forgot password", "forgot my password", "forgot my pass", "reset my password",
      "change my password", "password reset", "can't log in", "can't login",
      "cant log in", "cant login", "cannot login", "can't sign in", "login issue",
      "login problem", "otp", "my account", "account locked", "verification email",
      "otp not received", "password not working",
    ],
  },
  {
    intent: "account_delete",
    weight: 57,
    phrases: [
      "delete my account", "close my account", "remove my account", "deactivate my account",
      "account deletion", "delete account", "how do i delete",
    ],
  },
  {
    intent: "email_change",
    weight: 57,
    phrases: [
      "change my email", "update my email", "new email address", "change email address",
      "update email address", "email change", "wrong email on account",
    ],
  },
  {
    intent: "app",
    weight: 54,
    phrases: ["app", "android", "iphone", "ios", "download", "play store", "apk"],
  },
  {
    intent: "contact",
    weight: 52,
    phrases: [
      "contact", "email address", "phone number", "whatsapp", "reach you",
      "organizer contact", "how do i reach the organizer", "support hours",
      "working hours", "customer care number", "whatsapp number", "support email",
    ],
  },
  {
    intent: "listing",
    weight: 40,
    // Bare singular nouns ("event", "show", "party", "concert") are deliberately
    // NOT triggers. A singular "event" appears in almost every question —
    // "the event ended", "my event was cancelled", "an event that..." — so letting
    // it fire on its own made the assistant dump a wall of upcoming events at
    // people who had asked something else entirely (the classic keyword-bot bug).
    // Plurals and explicit discovery phrases still signal a genuine "what can I
    // go to?" browse; a lone generic noun now falls through to the search/clarify
    // path instead of a confident wrong answer.
    phrases: [
      "events", "shows", "parties", "concerts",
      "what's happening", "whats happening", "what is happening", "what's on",
      "whats on", "any events", "show events", "upcoming", "upcoming events",
      "wetin dey happen", "this weekend", "this week", "tonight", "today",
      "events in", "events for", "show me events",
    ],
  },
  {
    intent: "greeting",
    weight: 20,
    phrases: [
      "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
      "good day", "how far", "how you dey", "how una dey", "wetin dey", "sup", "yo",
      "morning", "evening",
    ],
  },
  {
    intent: "thanks",
    weight: 10,
    phrases: ["thanks", "thank you", "thx", "well done", "god bless", "e go better", "appreciate"],
  },
];

const STOPWORDS = new Set([
  "a", "about", "abeg", "am", "an", "and", "any", "are", "as", "at", "be", "been",
  "but", "by", "can", "could", "dey", "did", "do", "does", "for", "from", "get",
  "give", "go", "going", "got", "has", "have", "he", "her", "him", "his", "how", "i",
  "if", "in", "is", "it", "its", "just", "me", "my", "na", "no", "not", "now", "of",
  "on", "or", "our", "please", "pls", "so", "tell", "that", "the", "their", "them",
  "there", "they", "this", "to", "una", "up", "us", "was", "we", "were", "wet",
  "wetin", "what", "whats", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your", "show", "shows", "event", "events", "party", "concert",
  "ticket", "tickets", "price", "cost", "much", "date", "time", "day", "venue",
  "location", "address", "still", "left", "available", "today", "tomorrow",
  "week", "weekend", "month", "next", "coming", "happening", "upcoming", "hold",
  "again", "sir", "ma", "oo", "o", "wan", "want", "see", "know", "happen", "dey",
  "get", "there", "any", "for", "am", "i'm", "im", "abeg",
]);

function detectIntent(message: string): { intent: Intent; matched: string[]; weight: number } {
  const text = normalise(message);
  let best: { intent: Intent; matched: string[]; weight: number } = {
    intent: "unknown",
    matched: [],
    weight: -1,
  };

  for (const rule of INTENT_RULES) {
    const matched = rule.phrases.filter((phrase) => containsPhrase(text, phrase));
    if (matched.length > 0 && rule.weight > best.weight) {
      best = { intent: rule.intent, matched, weight: rule.weight };
    }
  }

  if (best.intent !== "unknown") return best;

  // Second pass: tolerate typos in longer words.
  for (const rule of INTENT_RULES) {
    const matched = rule.phrases.filter((phrase) => fuzzyContains(text, phrase));
    if (matched.length > 0 && rule.weight > best.weight) {
      best = { intent: rule.intent, matched, weight: rule.weight };
    }
  }

  return best;
}

/** Everything that is a question word, an intent trigger or filler is removed. */
function extractSearchTerm(message: string, matchedPhrases: string[]): string {
  let text = normalise(message);
  for (const phrase of matchedPhrases) {
    text = text.split(phrase).join(" ");
  }
  const words = text
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOPWORDS.has(word));
  return words.join(" ").slice(0, 80);
}

/** Escapes LIKE wildcards so a customer cannot broaden the search. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

// ---------------------------------------------------------------------------
// Things the assistant must never accept or store
// ---------------------------------------------------------------------------

// Mentioning a credential is not the same as sending one: "I forgot my
// password" must still reach the account answer. Only a credential given as a
// value is refused.
const SENSITIVE_PATTERNS: RegExp[] = [
  // A card number supplied as a value: 15-19 digits, spaces or dashes allowed.
  // Starting at 15 keeps a 13-digit international phone number out of the net.
  /\b(?:\d[ -]?){15,19}\b/,
  // A payment credential supplied as a value: "cvv 123", "pin: 1234", "bvn 12345678901".
  // NIN and national id are included because an 11-digit NIN is personal data
  // under the same class as a BVN. A bare 11-digit run is deliberately NOT
  // matched: a Nigerian mobile number is also 11 digits, and refusing those
  // would block legitimate messages.
  /\b(cvv|cvc|card pin|pin code|pin|otp|one time password|bvn|nin|national id)\b\s*(?:is|are|:|=|-)?\s*\d{3,11}\b/i,
  // A password supplied as a value. The digit requirement keeps "my password is
  // not working" on the account path instead of refusing it.
  /\b(password|passcode)\b\s*(?:is|:|=)\s*\S*\d\S*/i,
  // Bank details supplied as numbers.
  /\b(account number|account no|acct number|nuban)\b\s*(?:is|:|=|-)?\s*\d{6,}\b/i,
  // A card expiry supplied as a value: "expiry 12/30".
  /\bexpir(?:y|es)\b\s*(?:date|is|:|=)?\s*\d{2}\s*\/\s*\d{2,4}\b/i,
];

function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

const SENSITIVE_REFUSAL =
  "Please don't send that here — I can't accept card numbers, CVV codes, PINs, passwords, OTPs, NIN, BVN or bank details, and this chat doesn't store them.\n\nIf a payment has an issue, tell me what happened without the card details and I'll pass it to the support team, or use /my-tickets to resend your links.";

/**
 * Cheap gibberish gate. Stops "asdf" from burning an escalation (and its
 * hourly cap) before a real question arrives.
 */
function looksSubstantive(message: string): boolean {
  const words = normalise(message)
    .split(" ")
    .filter((word) => word.length >= 2);
  const meaningful = words.filter(
    (word) => word.length >= 3 && /[aeiou]/.test(word) && !/^(.)\1+$/.test(word),
  );
  if (meaningful.length === 0) return false;
  if (meaningful.length === 1 && meaningful[0].length < 5 && !message.includes("?")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const LAGOS = "Africa/Lagos";

function formatWhen(start: string | null, end: string | null): string {
  if (!start) return "date to be announced";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "date to be announced";

  const datePart = startDate.toLocaleDateString("en-NG", {
    timeZone: LAGOS, weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
  const timePart = startDate.toLocaleTimeString("en-NG", {
    timeZone: LAGOS, hour: "numeric", minute: "2-digit",
  });

  if (!end) return `${datePart}, ${timePart}`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${datePart}, ${timePart}`;

  const sameDay = endDate.toDateString() === startDate.toDateString();
  const endTime = endDate.toLocaleTimeString("en-NG", {
    timeZone: LAGOS, hour: "numeric", minute: "2-digit",
  });
  return sameDay
    ? `${datePart}, ${timePart} to ${endTime}`
    : `${datePart}, ${timePart} until ${endDate.toLocaleDateString("en-NG", {
        timeZone: LAGOS, day: "numeric", month: "short", year: "numeric",
      })}, ${endTime}`;
}

function naira(kobo: number): string {
  if (!kobo || kobo <= 0) return "Free";
  return `NGN ${(kobo / 100).toLocaleString("en-NG")}`;
}

interface PublicEvent {
  id: string;
  title: string;
  slug: string;
  start_datetime: string | null;
  end_datetime: string | null;
  venue_name: string | null;
  city: string | null;
}

interface TicketType {
  name: string;
  price_kobo: number;
  quantity_available: number;
  quantity_sold: number;
  quantity_cancelled: number | null;
}

function remaining(event: TicketType): number {
  const sold = Math.max(0, event.quantity_sold - (event.quantity_cancelled ?? 0));
  return Math.max(0, event.quantity_available - sold);
}

function describeEvent(event: PublicEvent): string {
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");
  const lines = [event.title, formatWhen(event.start_datetime, event.end_datetime)];
  if (place) lines.push(place);
  lines.push(`Details: /e/${event.slug}`);
  return lines.join("\n");
}

/**
 * Structured event reference sent alongside the text reply.
 *
 * The chat panel renders reply text as plain text, so a path like `/e/slug`
 * arrived as inert characters the customer had to retype on a phone. Cards give
 * the client something tappable to render. Purely additive — the `reply` string
 * still carries the full answer for any client that ignores them.
 */
interface EventCard {
  title: string;
  slug: string;
  when: string;
  place: string | null;
  url: string;
}

function toCard(event: PublicEvent): EventCard {
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");
  return {
    title: event.title,
    slug: event.slug,
    when: formatWhen(event.start_datetime, event.end_datetime),
    place: place || null,
    url: `/e/${event.slug}`,
  };
}

function describeTickets(types: TicketType[]): string {
  if (types.length === 0) return "Ticket types for this event are not published yet.";
  const sorted = [...types].sort((a, b) => a.price_kobo - b.price_kobo);
  const totalLeft = sorted.reduce((sum, type) => sum + remaining(type), 0);

  const lines = sorted.slice(0, 6).map((type) => {
    const left = remaining(type);
    const state = left === 0 ? "sold out" : `${left} left`;
    return `- ${type.name}: ${naira(type.price_kobo)} (${state})`;
  });

  const cheapest = sorted.find((type) => remaining(type) > 0) ?? sorted[0];
  const summary =
    totalLeft === 0
      ? "This event is sold out."
      : `From ${naira(cheapest.price_kobo)}. ${totalLeft} ticket${totalLeft === 1 ? "" : "s"} left in total.`;

  return `${summary}\n${lines.join("\n")}`;
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

interface LimitResult {
  allowed: boolean;
  unavailable: boolean;
}

async function consumeLimit(
  supabase: any,
  ip: string,
  endpoint: string,
  windowMs: number,
  max: number,
  matchIp: boolean,
): Promise<LimitResult> {
  const { error: insertError } = await supabase
    .from("rate_limit_log")
    .insert({ ip_address: ip, endpoint });

  if (insertError) return { allowed: false, unavailable: true };

  const since = new Date(Date.now() - windowMs).toISOString();
  let query = supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", endpoint)
    .gte("created_at", since);

  if (matchIp) query = query.eq("ip_address", ip);

  const { count, error } = await query;
  if (error || count === null) return { allowed: false, unavailable: true };

  return { allowed: count <= max, unavailable: false };
}

// ---------------------------------------------------------------------------
// Caller identity (optional)
// ---------------------------------------------------------------------------

interface Caller {
  userId: string | null;
  email: string | null;
}

async function resolveCaller(req: Request, supabaseUrl: string, anonKey: string): Promise<Caller> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { userId: null, email: null };

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length !== 3) return { userId: null, email: null };

  try {
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data.user) return { userId: null, email: null };
    return { userId: data.user.id, email: data.user.email ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

// ---------------------------------------------------------------------------
// Escalation
// ---------------------------------------------------------------------------

function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function categoryFor(intent: Intent): string {
  switch (intent) {
    case "refund":
      return "refund";
    case "order":
    case "transfer":
      return "missing_ticket";
    // A price question is about an event's ticket tiers, not about a payment
    // that went wrong. Grouping it under "payment" made payment look like the
    // dominant support issue when much of it was pre-sale browsing.
    case "price":
    case "listing":
    case "schedule":
    case "venue":
    case "availability":
    case "cancelled":
    case "past_event":
      return "event_inquiry";
    case "payment":
    case "promo":
      return "payment";
    case "account":
      return "account";
    default:
      return "other";
  }
}

/**
 * Priority reflects what the customer stands to lose, not how confidently the
 * intent matched. Every escalation used to be written as "high", so a refund
 * request and a message the assistant simply did not understand arrived
 * identically and the field stopped carrying any triage information.
 */
function priorityFor(intent: Intent): "high" | "medium" {
  switch (intent) {
    // Money has already moved, or a paid ticket has not arrived.
    case "refund":
    case "order":
    case "transfer":
    case "payment":
      return "high";
    default:
      return "medium";
  }
}

interface EscalateResult {
  ok: boolean;
  caseNumber: string | null;
  /** False when the case was created but its notifications could not be queued. */
  notified: boolean;
}

/**
 * Record what the assistant was asked and whether it had to escalate. Used to
 * extend the rules from real traffic instead of guessing which phrasings fail.
 */
async function logBotQuery(
  supabase: any,
  params: {
    sessionId: string;
    message: string;
    intent: string;
    escalated: boolean;
  },
): Promise<void> {
  try {
    await supabase.from("support_bot_queries").insert({
      session_id: params.sessionId,
      message: params.message.slice(0, 500),
      matched_intent: params.intent,
      escalated: params.escalated,
    });
  } catch (err) {
    console.error("support-bot: query log failed", err);
  }
}

async function escalate(
  supabase: any,
  params: {
    message: string;
    intent: Intent;
    sessionId: string;
    ip: string;
    caller: Caller;
    guestEmail: string | null;
    lastEvent: string | null;
  },
): Promise<EscalateResult> {
  const { message, intent, sessionId, ip, caller, guestEmail, lastEvent } = params;
  const contactEmail = caller.email ?? guestEmail;
  const requestedAt = new Date().toISOString();

  const { data: created, error: caseError } = await supabase
    .from("support_cases")
    .insert({
      customer_id: caller.userId,
      guest_email: caller.userId ? null : guestEmail,
      subject: message.slice(0, 150),
      // The untruncated question. A guest has no auth.users row, so nothing can
      // be inserted into support_case_messages on their behalf (sender_id is NOT
      // NULL and foreign-keyed to auth.users). support_view_case presents this
      // column as the opening thread message instead. Without it the customer's
      // words past character 150 were discarded and the portal showed an empty
      // timeline.
      guest_message: caller.userId ? null : message,
      category: categoryFor(intent),
      status: "open",
      priority: priorityFor(intent),
      is_escalated: true,
      escalated_at: requestedAt,
      escalated_reason: "Automated assistant could not resolve this question",
    })
    .select("id, case_number")
    .single();

  if (caseError || !created) {
    console.error("support-bot: case insert failed", caseError);
    return { ok: false, caseNumber: null, notified: false };
  }

  // A signed-in customer does have an auth.users row, so their question goes
  // into the real thread table and lands beside the staff replies.
  if (caller.userId) {
    const { error: threadError } = await supabase.from("support_case_messages").insert({
      case_id: created.id,
      sender_id: caller.userId,
      is_internal: false,
      content: message,
    });
    if (threadError) {
      // The subject still carries the first 150 characters, so the case is
      // usable. Logged rather than swallowed.
      console.error("support-bot: thread insert failed", threadError);
    }
  }

  const staffRows = escalationRecipients().map((recipient) => ({
    case_id: created.id,
    recipient_email: recipient,
    template: "support_escalation",
    status: "pending",
    payload: {
      case_number: created.case_number,
      customer_email: contactEmail,
      customer_id: caller.userId,
      message,
      intent,
      last_event: lastEvent,
      session_id: sessionId,
      ip_address: ip,
      requested_at: requestedAt,
    },
  }));

  // The customer gets a receipt carrying the case number. Every recipient used
  // to be a staff inbox, so the person who asked received no email at all while
  // the reply text promised a human would follow up by email.
  const acknowledgementRows = contactEmail
    ? [
        {
          case_id: created.id,
          recipient_email: contactEmail,
          template: "support_acknowledgement",
          status: "pending",
          payload: {
            case_number: created.case_number,
            subject: message.slice(0, 300),
            intent,
            requested_at: requestedAt,
          },
        },
      ]
    : [];

  const { error: outboxError } = await supabase
    .from("email_outbox")
    .insert([...staffRows, ...acknowledgementRows]);

  if (outboxError) {
    // The case exists and is visible in the support portal, so reporting failure
    // here would hand the customer a 503 that invites a retry and a duplicate
    // case. Told the truth instead: it was passed on, notification is degraded.
    console.error("support-bot: outbox insert failed", outboxError);
    return { ok: true, caseNumber: created.case_number, notified: false };
  }

  return { ok: true, caseNumber: created.case_number, notified: true };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = readEnvVar("SUPABASE_URL");
  const serviceKey = readEnvVar("APP_SECRET_KEY") || readEnvVar("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey =
    readEnvVar("APP_PUBLISHABLE_KEY") ||
    readEnvVar("SUPABASE_PUBLISHABLE_KEY") ||
    readEnvVar("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !serviceKey) {
    console.error("support-bot: missing service credentials");
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 503,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const rawMessage = typeof body?.message === "string" ? body.message : "";
    const message = rawMessage.trim();

    if (!message) {
      return new Response(JSON.stringify({ error: "Please type a message first." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(sessionId)) {
      return new Response(JSON.stringify({ error: "Invalid chat session." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const guestEmailRaw = typeof body?.email === "string" ? body.email.trim() : "";
    const guestEmail = guestEmailRaw ? guestEmailRaw.toLowerCase() : null;
    if (guestEmail && !isValidEmail(guestEmail)) {
      return new Response(JSON.stringify({ error: "That email address doesn't look right." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Last event shown in this chat, so follow-ups like "how much?" resolve.
    const contextSlug = typeof body?.context === "string" ? body.context.trim().slice(0, 120) : "";

    const ip = clientIp(req);

    const ipLimit = await consumeLimit(
      supabase, ip, "support_bot_message", IP_WINDOW_MS, IP_MAX_MESSAGES, true,
    );
    if (!ipLimit.allowed) {
      return new Response(
        JSON.stringify({ error: ipLimit.unavailable ? GENERIC_ERROR : GENERIC_RATE_LIMIT }),
        {
          status: ipLimit.unavailable ? 503 : 429,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const sessionLimit = await consumeLimit(
      supabase, ip, `support_bot_session:${sessionId}`, SESSION_WINDOW_MS, SESSION_MAX_MESSAGES, false,
    );
    if (!sessionLimit.allowed) {
      return new Response(
        JSON.stringify({ error: sessionLimit.unavailable ? GENERIC_ERROR : GENERIC_RATE_LIMIT }),
        {
          status: sessionLimit.unavailable ? 503 : 429,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const caller = await resolveCaller(req, supabaseUrl, anonKey);
    const { intent, matched } = detectIntent(message);
    const searchTerm = extractSearchTerm(message, matched);

    const reply = (payload: Record<string, unknown>) => {
      // Bot gap analytics. Deliberately not awaited: measuring the assistant must
      // never add latency to, or fail, a customer's reply. Nothing that looked
      // like a card number, PIN or password is ever written here.
      if (!containsSensitiveData(message)) {
        void logBotQuery(supabase, {
          sessionId,
          message,
          intent,
          escalated: payload.escalated === true,
        });
      }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    };

    // Card numbers, PINs, OTPs and passwords are refused before anything else:
    // they are never stored in a case, an email or a log.
    if (containsSensitiveData(message)) {
      return reply({
        reply: SENSITIVE_REFUSAL,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    const eventFields = "id, title, slug, start_datetime, end_datetime, venue_name, city";

    // ---- Data access: published events and their public ticket types only ----
    const findEvents = async (term: string): Promise<PublicEvent[]> => {
      if (term.length < 2) return [];

      // Title and city run together. Both are common shapes ("burna boy",
      // "events in lagos") and they were previously awaited one after another,
      // so every lookup that missed on the title paid two round trips before the
      // third fallback even started.
      const [byTitle, byCity] = await Promise.all([
        supabase
          .from("events")
          .select(eventFields)
          .eq("status", "published")
          .ilike("title", `%${escapeLike(term)}%`)
          .order("start_datetime", { ascending: true })
          .limit(5),
        supabase
          .from("events")
          .select(eventFields)
          .eq("status", "published")
          .ilike("city", `%${escapeLike(term)}%`)
          .order("start_datetime", { ascending: true })
          .limit(5),
      ]);

      if (byTitle.error) {
        console.error("support-bot: event lookup failed", byTitle.error);
        return [];
      }
      if (byTitle.data && byTitle.data.length > 0) return byTitle.data as PublicEvent[];

      // Retry with the longest word alone: catches "lagos party vibes 2026".
      // Precedence is unchanged — a word match still beats a city match.
      const longest = term
        .split(" ")
        .filter((word) => word.length >= 4)
        .sort((a, b) => b.length - a.length)[0];
      if (longest && longest !== term) {
        const byWord = await supabase
          .from("events")
          .select(eventFields)
          .eq("status", "published")
          .ilike("title", `%${escapeLike(longest)}%`)
          .order("start_datetime", { ascending: true })
          .limit(5);
        if (byWord.data && byWord.data.length > 0) return byWord.data as PublicEvent[];
      }

      // A place rather than a title: "events in lagos".
      if (byCity.error) return [];
      return (byCity.data ?? []) as PublicEvent[];
    };

    const findUpcoming = async (limit = 5): Promise<PublicEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(eventFields)
        .eq("status", "published")
        .gte("start_datetime", new Date().toISOString())
        .order("start_datetime", { ascending: true })
        .limit(limit);
      if (error) {
        console.error("support-bot: upcoming lookup failed", error);
        return [];
      }
      return (data ?? []) as PublicEvent[];
    };

    const findEventBySlug = async (slug: string): Promise<PublicEvent | null> => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("events")
        .select(eventFields)
        .eq("status", "published")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) return null;
      return data as PublicEvent;
    };

    const findTickets = async (eventId: string): Promise<TicketType[]> => {
      const { data, error } = await supabase
        .from("ticket_types")
        .select("name, price_kobo, quantity_available, quantity_sold, quantity_cancelled")
        .eq("event_id", eventId)
        .order("price_kobo", { ascending: true })
        .limit(12);
      if (error) {
        console.error("support-bot: ticket lookup failed", error);
        return [];
      }
      return (data ?? []) as TicketType[];
    };

    // ---- Resolve which event, if any, this message is about ----
    let events = searchTerm.length >= 2 ? await findEvents(searchTerm) : [];
    let referencedEvent: PublicEvent | null = null;

    if (events.length === 1) {
      referencedEvent = events[0];
    } else if (events.length === 0 && contextSlug) {
      // Follow-up question about the event we just showed.
      referencedEvent = await findEventBySlug(contextSlug);
    }

    const withTickets = async (event: PublicEvent, includeTickets: boolean) => {
      const base = describeEvent(event);
      if (!includeTickets) return base;
      const types = await findTickets(event.id);
      return `${base}\n\n${describeTickets(types)}`;
    };

    // ---- 1. Small talk ----
    if (intent === "greeting") {
      return reply({
        reply: "Hi, I'm TixNaija. Ask me about events, tickets or orders.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "thanks") {
      return reply({
        reply: "You're welcome. If you need anything else about an event, ticket or order, just ask.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "organizer") {
      return reply({
        reply:
          "You can list an event on TixNaija yourself — there's no approval queue. Create an account at /auth, then open /dashboard to publish the event, set your ticket types and prices, and watch sales come in.\n\nTicket money settles to your own bank account through Paystack, and you can track and request payouts from the same dashboard.\n\nWant a hand setting it up? Say \"talk to a person\" and I'll pass you to the team.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // Answered directly, before the event-search results below can hijack a
    // yes/no policy question with a listing of upcoming events.
    if (intent === "past_event") {
      return reply({
        reply:
          "No — once an event has ended, its tickets come off sale and can't be bought any more. Tickets are only on sale for events that are still upcoming; you can see everything currently live at /browse.\n\nIf you already bought a ticket for an event that's now over and something went wrong with it, or you were charged for an event that got cancelled rather than simply ending, say \"talk to a person\" and I'll pass it to the support team.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 2. Events we found ----
    if (events.length > 1) {
      const header = `I found ${events.length} events that match. Which one do you mean?`;
      return reply({
        reply: `${header}\n\n${events.map(describeEvent).join("\n\n")}`,
        cards: events.map(toCard),
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 3. Ticket prices and availability ----
    if (intent === "price" || intent === "availability") {
      if (referencedEvent) {
        const types = await findTickets(referencedEvent.id);
        return reply({
          reply: `${describeEvent(referencedEvent)}\n\n${describeTickets(types)}`,
          cards: [toCard(referencedEvent)],
          escalated: false,
          context: referencedEvent.slug,
        });
      }
      if (!searchTerm) {
        return reply({
          reply: "Which event do you mean? Give me the event name and I'll check the price and availability.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }
      const upcoming = await findUpcoming(3);
      return reply({
        reply:
          `I couldn't find a published event matching "${searchTerm}". You can browse everything at /browse.` +
          (upcoming.length > 0
            ? `\n\nComing up soon:\n\n${upcoming.map(describeEvent).join("\n\n")}`
            : ""),
        cards: upcoming.map(toCard),
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 4. Date, venue, cancellation ----
    if (referencedEvent && ["schedule", "venue", "cancelled"].includes(intent)) {
      return reply({
        reply: await withTickets(referencedEvent, false),
        cards: [toCard(referencedEvent)],
        escalated: false,
        context: referencedEvent.slug,
      });
    }

    if (intent === "schedule" || intent === "venue") {
      if (!searchTerm) {
        return reply({
          reply: "Which event do you mean? Tell me the event name and I'll check the date and venue for you.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }
      return reply({
        reply: `I couldn't find a published event matching "${searchTerm}". You can browse everything at /browse.`,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "cancelled") {
      return reply({
        reply:
          "If an event is cancelled or postponed, the organizer updates the event page and buyers are emailed. Check the event page at /browse for the latest date. If you were charged for a cancelled event, I can pass this to the support team for review.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 5. Listing ----
    if (intent === "listing") {
      const upcoming = await findUpcoming(5);
      if (upcoming.length === 0) {
        return reply({
          reply: "There are no published events on sale right now. Check back soon, or browse everything at /browse.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }
      return reply({
        reply: `Here's what's coming up:\n\n${upcoming.map(describeEvent).join("\n\n")}\n\nSee everything at /browse.`,
        cards: upcoming.map(toCard),
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 6. Static, policy-safe guidance ----
    if (intent === "capabilities") {
      return reply({
        reply: [
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
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "about") {
      return reply({
        reply:
          "TixNaija was created by Isaac Ogbomo.\n\nIt's an independent Nigerian ticketing platform. TixNaija is not connected to Tix Africa in any way — separate company, separate team, separate platform.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "how_to_buy") {
      return reply({
        reply:
          "Open the event at /browse, pick your ticket type and quantity, then continue to checkout. You can pay with card, bank transfer or USSD, and your tickets are emailed right after payment. You don't need an account to buy.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "payment") {
      return reply({
        reply:
          "Checkout is handled by Paystack: card, bank transfer and USSD all work. If you were debited but no ticket arrived, enter the email you paid with at /my-tickets to resend the links. If it's still missing, I can pass it to the support team.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "promo") {
      return reply({
        reply:
          "If an event has a promo code, the field appears at checkout before you pay. Codes are set by the organizer, so I can't create one — but I can pass a request to the support team.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "waitlist") {
      return reply({
        reply:
          "When a ticket type sells out, the event page offers a waitlist so you're notified if tickets are released. Join it from the event page at /browse.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "account") {
      return reply({
        reply:
          "Sign in at /auth. If you've forgotten your password, use the reset link there. Bought as a guest? You don't need an account — use /my-tickets with your email.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "app") {
      return reply({
        reply: "The TixNaija Android app is available at /download. An iPhone version isn't released yet.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "contact") {
      return reply({
        reply: `You can reach the team at ${PUBLIC_SUPPORT_ADDRESS}. For a question about a specific event, the organizer's contact is listed on the event page.`,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "order") {
      // Recovery belongs to the customer's explicit, purchase-date-scoped
      // request. A chat message must not mail every historical order for an
      // address or turn the assistant into an unsolicited resend trigger.
      //
      // The assistant never calls resend-ticket-links itself: it holds no order
      // id and no purchase date, so a lookup from here could not be scoped to a
      // day and would release every order the address ever bought. The reply is
      // the handoff to /my-tickets, which asks for the date.
      return reply({
        reply:
          "Open /my-tickets and enter the email you bought with plus the purchase date to resend only that day's ticket links. Signed-in buyers can also open /tickets. Still nothing? Say \"talk to a person\" and I'll pass it on.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "transfer") {
      return reply({
        reply:
          "Tickets can't be renamed from the assistant — the support team handles attendee changes so the QR codes stay valid. I can pass the request on with your order details.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 7. Everything that needs a human ----
    const runEscalation = async (lead: string, successText?: string) => {
      const { status, caseNumber } = await maybeEscalate({
        supabase, message, intent, sessionId, ip, caller, guestEmail,
        lastEvent: referencedEvent?.slug ?? (contextSlug || null),
      });

      if (status === "needs_email") {
        return reply({
          needsEmail: true,
          escalated: false,
          reply: `${lead} What email address should they reply to?`,
        });
      }

      if (status === "capped") {
        // Deliberately does not claim the new question was captured. The old
        // wording said "they have it, there's no need to send it again", which
        // was untrue for a second, different problem — so the customer stopped
        // chasing something nobody had ever seen.
        return reply({
          reply:
            "I've already passed a message from you to the support team recently, so someone is looking into it. To keep the queue moving I can't open a second case just yet.\n\nIf this is a different problem, please try again in about an hour, or email " +
            PUBLIC_SUPPORT_ADDRESS +
            " and they'll pick it up straight away.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }

      if (status === "failed") {
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const confirmation =
        successText ??
        "I've passed this to the support team and they'll follow up by email. For anything urgent you can also reach them at " +
          PUBLIC_SUPPORT_ADDRESS +
          ".";

      // The case number was fetched and discarded before, so the customer had no
      // reference. Returning later meant starting from zero with nothing to
      // connect the two conversations.
      return reply({
        reply: caseNumber
          ? `${confirmation}\n\nYour case number is ${caseNumber}. Keep it — quoting it gets you a faster answer.`
          : confirmation,
        escalated: true,
        caseNumber: caseNumber ?? undefined,
        context: contextSlug || undefined,
      });
    };

    if (intent === "refund") {
      return runEscalation(
        "Refunds aren't automatic — each request is reviewed against the policy first.",
        `${REFUND_POLICY}\n\nI've sent your request to the support team for review, and they'll contact you about the outcome.`,
      );
    }

    if (intent === "human") {
      return runEscalation("I'll connect you with a person.");
    }

    // Events that exist but the question doesn't fit a rule: show details, then
    // let them decide whether they still want a human.
    if (referencedEvent) {
      return reply({
        reply: `${await withTickets(referencedEvent, true)}\n\nIf that doesn't answer it, say "talk to a person" and I'll pass it on.`,
        cards: [toCard(referencedEvent)],
        escalated: false,
        context: referencedEvent.slug,
      });
    }

    // Gibberish must not consume the hourly escalation budget.
    if (!looksSubstantive(message)) {
      return reply({
        reply:
          'Sorry, I didn\'t catch that. Ask me about an event, a ticket or an order — for example "when is <event name>" or "how much is <event name>".',
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    return runEscalation("I don't have an answer for that one, so a person should take a look.");
  } catch (error) {
    console.error("support-bot: unhandled error", error);
    return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

// ---------------------------------------------------------------------------
// Escalation with hourly caps per IP and per email
// ---------------------------------------------------------------------------

type EscalationStatus = "escalated" | "needs_email" | "capped" | "failed";

interface EscalationOutcome {
  status: EscalationStatus;
  caseNumber: string | null;
}

async function maybeEscalate(params: {
  supabase: any;
  message: string;
  intent: Intent;
  sessionId: string;
  ip: string;
  caller: Caller;
  guestEmail: string | null;
  lastEvent: string | null;
}): Promise<EscalationOutcome> {
  const { supabase, ip, caller, guestEmail } = params;
  const contactEmail = caller.email ?? guestEmail;

  // Guests must leave an address before a case is opened.
  if (!contactEmail) return { status: "needs_email", caseNumber: null };

  const ipCap = await consumeLimit(
    supabase, ip, "support_bot_escalation", ESCALATION_WINDOW_MS, IP_MAX_ESCALATIONS, true,
  );
  if (ipCap.unavailable) return { status: "failed", caseNumber: null };
  if (!ipCap.allowed) return { status: "capped", caseNumber: null };

  /**
   * Per-address escalation cap.
   *
   * This used to count email_outbox rows with template = 'support_escalation'.
   * escalate() writes one row per staff recipient — two by default — so a single
   * escalation produced a count of 2 against EMAIL_MAX_ESCALATIONS = 2. The real
   * limit was one per hour, not two, and the second reply told the customer
   * their earlier message already covered it. It also filtered an unindexed
   * jsonb path on a table that had no purge job.
   *
   * Keyed on the address in the ip_address column instead: the same
   * single-counter-table approach resend-ticket-links uses, and the one the
   * (ip_address, endpoint, created_at) index actually serves.
   */
  const emailCap = await consumeLimit(
    supabase,
    contactEmail,
    "support_bot_escalation_email",
    ESCALATION_WINDOW_MS,
    EMAIL_MAX_ESCALATIONS,
    true,
  );
  if (emailCap.unavailable) return { status: "failed", caseNumber: null };
  if (!emailCap.allowed) return { status: "capped", caseNumber: null };

  const result = await escalate(supabase, params);
  return result.ok
    ? { status: "escalated", caseNumber: result.caseNumber }
    : { status: "failed", caseNumber: null };
}
