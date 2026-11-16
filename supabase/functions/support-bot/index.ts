// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Server-side only. Never accepted from the client.
const ESCALATION_RECIPIENT = "isaacnerds@gmail.com";
const PUBLIC_SUPPORT_ADDRESS = "support@tixnaija.name.ng";

// Quoted from /refunds — policy only, never a promise about one customer.
const REFUND_POLICY =
  "Here's the policy in short:\n" +
  "- All sales are final unless the event is cancelled, postponed or materially misrepresented.\n" +
  "- If an event is cancelled, buyers are emailed automatically, and the refund is the organizer's responsibility because ticket money is settled to them through Paystack.\n" +
  "- After a postponement or venue change, you can request a refund within 14 calendar days of the notice.\n" +
  "- Requests are reviewed within 3 business days, and approved refunds land back on the card in 3 to 7 business days via Paystack.\n" +
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
    allowedOrigins.includes(origin) || origin.endsWith(".vercel.app") || isLoopback;
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.vercel.app",
  };
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
  | "refund"
  | "transfer"
  | "order"
  | "price"
  | "availability"
  | "venue"
  | "schedule"
  | "listing"
  | "how_to_buy"
  | "payment"
  | "promo"
  | "waitlist"
  | "cancelled"
  | "about"
  | "capabilities"
  | "account"
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
      "human", "real person", "agent", "support team", "customer care", "talk to",
      "speak to", "chat with a person", "call me", "someone else", "abeg connect me",
      "person wey go help", "talk to somebody", "can i speak", "manager",
    ],
  },
  {
    intent: "refund",
    weight: 95,
    phrases: [
      "refund", "money back", "my money", "return my money", "reverse the payment",
      "reversal", "charge back", "chargeback", "cancel my ticket", "cancel my order",
      "give me back my money", "abeg refund", "make una refund", "i want my money",
    ],
  },
  {
    intent: "transfer",
    weight: 90,
    phrases: [
      "transfer my ticket", "transfer ticket", "give my ticket to", "change the name",
      "change attendee", "send ticket to", "sell my ticket", "resell",
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
    ],
  },
  {
    intent: "payment",
    weight: 62,
    phrases: [
      "payment method", "pay with", "card payment", "transfer to", "bank transfer",
      "ussd", "opay", "paystack", "flutterwave", "how do i pay", "payment failed",
      "payment no go through", "was i charged", "debited", "double charge",
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
      "who are you", "what is tixnaija",
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
      "login problem", "otp", "my account",
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
      "organizer contact", "how do i reach the organizer",
    ],
  },
  {
    intent: "listing",
    weight: 40,
    phrases: [
      "events", "event", "shows", "show", "parties", "party", "concert", "concerts",
      "what's happening", "whats happening", "upcoming", "wetin dey happen",
      "what is happening", "this weekend", "this week", "tonight", "today",
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
  /\b(cvv|cvc|card pin|pin code|pin|otp|one time password|bvn)\b\s*(?:is|are|:|=|-)?\s*\d{3,11}\b/i,
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
  "Please don't send that here — I can't accept card numbers, CVV codes, PINs, passwords, OTPs or bank details, and this chat doesn't store them.\n\nIf a payment has an issue, tell me what happened without the card details and I'll pass it to the support team, or use /my-tickets to resend your links.";

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
    case "price":
    case "payment":
    case "promo":
      return "payment";
    case "listing":
    case "schedule":
    case "venue":
    case "availability":
    case "cancelled":
      return "event_inquiry";
    case "account":
      return "account";
    default:
      return "other";
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
): Promise<{ ok: boolean }> {
  const { message, intent, sessionId, ip, caller, guestEmail, lastEvent } = params;
  const contactEmail = caller.email ?? guestEmail;

  const { data: created, error: caseError } = await supabase
    .from("support_cases")
    .insert({
      customer_id: caller.userId,
      guest_email: caller.userId ? null : guestEmail,
      subject: message.slice(0, 150),
      category: categoryFor(intent),
      status: "open",
      priority: "high",
      is_escalated: true,
      escalated_at: new Date().toISOString(),
      escalated_reason: "Automated assistant could not resolve this question",
    })
    .select("id, case_number")
    .single();

  if (caseError || !created) {
    console.error("support-bot: case insert failed", caseError);
    return { ok: false };
  }

  // The internal inbox and the public support address both get a copy, so a
  // customer replying to support@tixnaija.name.ng isn't talking to nobody.
  const recipients = Array.from(
    new Set([ESCALATION_RECIPIENT, PUBLIC_SUPPORT_ADDRESS].filter(Boolean)),
  );

  const { error: outboxError } = await supabase.from("email_outbox").insert(
    recipients.map((recipient) => ({
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
        requested_at: new Date().toISOString(),
      },
    })),
  );

  if (outboxError) {
    console.error("support-bot: outbox insert failed", outboxError);
    return { ok: false };
  }

  return { ok: true };
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

  // @ts-ignore Deno is provided by the Edge runtime, not by the app tsconfig.
  const readEnv = (name: string): string => Deno.env.get(name) ?? "";

  const supabaseUrl = readEnv("SUPABASE_URL");
  const serviceKey = readEnv("APP_SECRET_KEY") || readEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey =
    readEnv("APP_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readEnv("SUPABASE_ANON_KEY");

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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

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

    const reply = (payload: Record<string, unknown>) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });

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

      const byTitle = await supabase
        .from("events")
        .select(eventFields)
        .eq("status", "published")
        .ilike("title", `%${escapeLike(term)}%`)
        .order("start_datetime", { ascending: true })
        .limit(5);
      if (byTitle.error) {
        console.error("support-bot: event lookup failed", byTitle.error);
        return [];
      }
      if (byTitle.data && byTitle.data.length > 0) return byTitle.data as PublicEvent[];

      // Retry with the longest word alone: catches "lagos party vibes 2026".
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
      const byCity = await supabase
        .from("events")
        .select(eventFields)
        .eq("status", "published")
        .ilike("city", `%${escapeLike(term)}%`)
        .order("start_datetime", { ascending: true })
        .limit(5);
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

    // ---- 2. Events we found ----
    if (events.length > 1) {
      const header = `I found ${events.length} events that match. Which one do you mean?`;
      return reply({
        reply: `${header}\n\n${events.map(describeEvent).join("\n\n")}`,
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
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 4. Date, venue, cancellation ----
    if (referencedEvent && ["schedule", "venue", "cancelled"].includes(intent)) {
      return reply({
        reply: await withTickets(referencedEvent, false),
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
          "- Resend your ticket links — \"I didn't get my ticket\"",
          "- Explain refunds, payments, promo codes, waitlists and accounts",
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
      const orderEmail = caller.email ?? guestEmail;

      if (!orderEmail) {
        return reply({
          needsEmail: true,
          escalated: false,
          reply: "I can resend your ticket links. What email address did you buy with?",
        });
      }

      // Deliberately neutral: this must not reveal whether the address has orders.
      await triggerTicketResend(supabaseUrl, serviceKey, ip, orderEmail);

      return reply({
        reply:
          "If that email has orders, your ticket links are on the way — check the inbox and spam folder over the next couple of minutes. Signed-in buyers can also open /tickets. Still nothing? Say \"talk to a person\" and I'll pass it on.",
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
      const status = await maybeEscalate({
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
        return reply({
          reply:
            "I've already passed your earlier message to the support team, so they have it — there's no need to send it again. For anything urgent you can also email " +
            PUBLIC_SUPPORT_ADDRESS +
            ".",
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

      return reply({
        reply:
          successText ??
          "I've passed this to the support team and they'll follow up by email. For anything urgent you can also reach them at " +
            PUBLIC_SUPPORT_ADDRESS +
            ".",
        escalated: true,
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
// Self-serve ticket recovery
// ---------------------------------------------------------------------------

/**
 * Hands the address to resend-ticket-links without forwarding or inspecting the
 * result: the caller always gets the same neutral answer, so the assistant can
 * never be used to test whether an address has orders.
 */
async function triggerTicketResend(
  supabaseUrl: string,
  serviceKey: string,
  ip: string,
  email: string,
): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/resend-ticket-links`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      console.error("support-bot: resend-ticket-links returned", response.status);
    }
  } catch (error) {
    console.error("support-bot: resend-ticket-links call failed", error);
  }
}

// ---------------------------------------------------------------------------
// Escalation with hourly caps per IP and per email
// ---------------------------------------------------------------------------

type EscalationStatus = "escalated" | "needs_email" | "capped" | "failed";

async function maybeEscalate(params: {
  supabase: any;
  message: string;
  intent: Intent;
  sessionId: string;
  ip: string;
  caller: Caller;
  guestEmail: string | null;
  lastEvent: string | null;
}): Promise<EscalationStatus> {
  const { supabase, ip, caller, guestEmail } = params;
  const contactEmail = caller.email ?? guestEmail;

  // Guests must leave an address before a case is opened.
  if (!contactEmail) return "needs_email";

  const ipCap = await consumeLimit(
    supabase, ip, "support_bot_escalation", ESCALATION_WINDOW_MS, IP_MAX_ESCALATIONS, true,
  );
  if (ipCap.unavailable) return "failed";
  if (!ipCap.allowed) return "capped";

  const since = new Date(Date.now() - ESCALATION_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .eq("template", "support_escalation")
    .filter("payload->>customer_email", "eq", contactEmail)
    .gte("created_at", since);

  if (error || count === null) return "failed";
  if (count >= EMAIL_MAX_ESCALATIONS) return "capped";

  const result = await escalate(supabase, params);
  return result.ok ? "escalated" : "failed";
}
