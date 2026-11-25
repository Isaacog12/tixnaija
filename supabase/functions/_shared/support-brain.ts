/**
 * Pure support-assistant logic shared by the Edge Function and its unit tests.
 * Keep database and network access in index.ts so matching stays deterministic.
 */

export type Intent =
  | "human"
  | "fraud"
  | "trust"
  | "refund"
  | "refund_policy"
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
  | "payment_issue"
  | "promo"
  | "waitlist"
  | "cancelled"
  | "about"
  | "capabilities"
  | "account"
  | "account_delete"
  | "email_change"
  | "app"
  | "technical"
  | "contact"
  | "greeting"
  | "thanks"
  | "unknown";

export interface IntentMatch {
  intent: Intent;
  matched: string[];
  weight: number;
}

interface Rule {
  intent: Intent;
  phrases: string[];
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
    weight: 97,
    phrases: [
      "fraud", "fake event", "fake organizer", "scam", "scammer", "suspicious event",
      "report event", "report organizer", "not legitimate", "i was scammed", "dem scam me",
      "fake show", "fraudulent", "report a scam",
    ],
  },
  {
    intent: "trust",
    weight: 79,
    phrases: [
      "event legit", "organizer legit", "is this event legit", "is the event legit",
      "is this legit", "is it legit", "legit or fake", "real event", "is tixnaija legit",
      "is tixnaija safe", "safe to buy", "verified organizer", "organizer verified",
      "how do i know a event is real",
    ],
  },
  {
    intent: "refund",
    weight: 96,
    phrases: [
      "i want a refund", "i need a refund", "refund me", "refund my", "request a refund",
      "refund request", "money back", "return my money", "reverse the payment",
      "reversal", "charge back", "chargeback", "cancel my ticket", "cancel my order",
      "give me back my money", "abeg refund", "make una refund", "i want my money",
      "refund status", "when will my refund", "no refund",
    ],
  },
  {
    intent: "refund_policy",
    weight: 95,
    phrases: [
      "refund", "refunds", "refund policy", "how do refunds work", "how does a refund work",
      "am i eligible for a refund", "can i get a refund", "refund window", "change my mind",
      "change of mind", "how long does a refund take", "refund time", "refund timeline",
      "postponement refund", "cancellation refund",
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
      "hasn't arrived", "has not arrived", "didn't arrive", "did not arrive",
      "not delivered", "can't find my ticket", "cannot find my ticket", "no qr",
      "order status", "payment status", "where is my order",
    ],
  },
  {
    intent: "delivery_confirmation",
    weight: 87,
    phrases: [
      "email came but error", "email arrived but error", "got email but not sent",
      "received email but not sent", "ticket email came", "mail came but error",
      "email don land but error", "i get mail but e say not sent", "email came but",
      "email arrived but", "came but not sent", "says not sent",
    ],
  },
  {
    intent: "entry",
    weight: 88,
    phrases: [
      "qr won't scan", "qr not scanning", "qr code not scanning", "qr code is not scanning",
      "qr code isn't scanning", "qr code won't scan", "code not scanning", "code is not scanning",
      "code isn't scanning", "not scanning", "won't scan", "wont scan", "cant scan", "can't scan",
      "cannot scan", "scan failed", "scan not working", "scanner no dey work",
      "ticket not scanning",
      "can't enter", "cannot enter", "turned away", "gate staff", "door staff",
      "at the gate", "check in", "checkin", "manual check in", "admission", "entry",
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
    weight: 74,
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
    // Above "order": someone whose money left the account and got no ticket
    // needs payment reconciliation, not a resend link.
    intent: "payment_issue",
    weight: 90,
    phrases: [
      "payment failed", "payment no go through", "payment not going through",
      "not going through", "was i charged", "debited", "money deducted",
      "money was deducted", "deducted but", "debited but",
      "paid but no ticket", "pay but no ticket", "no ticket after payment",
      "money left my account", "double charge", "charged twice", "debited twice",
      "payment pending", "payment is pending", "pending payment", "still pending",
      "transaction pending", "payment stuck", "transaction failed",
      "no payment confirmation", "charged but", "paid but", "i paid but", "paid no ticket",
      "bank transfer pending", "transfer not confirmed", "payment not confirmed",
    ],
  },
  {
    intent: "payment",
    weight: 62,
    phrases: [
      "payment method", "payment methods", "payment options", "pay with",
      "card payment", "transfer to", "bank transfer", "card or transfer", "can i pay",
      "ussd", "opay", "palmpay", "paystack", "flutterwave", "how do i pay", "how to pay",
    ],
  },
  {
    // Above "venue": "where do i enter my promo code" was answered as a venue
    // question because "enter promo code" scored lower than the bare "where".
    intent: "promo",
    weight: 78,
    phrases: [
      "promo code", "promo codes", "enter promo", "apply promo", "promo field",
      "add promo", "have a code", "use a code", "discount code", "coupon code",
      "voucher code", "referral code", "promo not working", "code not working",
      "promo no dey work", "discount", "coupon", "voucher", "promo",
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
    intent: "account_delete",
    weight: 57,
    phrases: [
      "delete my account", "close my account", "remove my account", "deactivate my account",
      "account deletion", "delete account", "how do i delete",
    ],
  },
  {
    intent: "email_change",
    weight: 76,
    phrases: [
      "change my email", "update my email", "new email address", "change email address",
      "update email address", "email change", "wrong email on account",
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
    intent: "technical",
    weight: 55,
    phrases: [
      "page not loading", "website error", "can't open the page", "cannot open the page",
      "broken link", "error page", "site down", "ticket page error", "checkout error",
      "loading screen", "blank page", "page blank", "page is blank", "blank screen",
      "white screen", "website not working", "app not working",
      "not loading", "won't load", "wont load", "not opening", "won't open", "wont open",
      "keeps loading", "stuck on loading", "keeps reloading", "spinning",
      "page error", "technical error", "server error", "error 404", "404",
      "something went wrong", "app is not working", "website is not working", "is not working",
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
  "im", "need", "make", "come", "really", "should", "havent", "didnt", "dont", "cant",
]);

export const NIGERIAN_CITIES = [
  "Lagos", "Abuja", "Port Harcourt", "Kaduna", "Ibadan", "Kano", "Enugu",
  "Benin City", "Jos", "Owerri", "Abeokuta", "Warri", "Uyo", "Calabar", "Ilorin", "Akure",
] as const;

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance capped for short support queries. */
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
  const needle = normalise(phrase);
  if (!needle) return false;
  if (needle.includes(" ")) return text.includes(needle);
  return new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

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

function fuzzyWord(word: string, candidate: string): boolean {
  if (word === candidate) return true;
  if (word.length < 5 || candidate.length < 5) return false;
  if (Math.abs(word.length - candidate.length) > 1) return false;
  return editDistance(word, candidate) <= 1 || isAdjacentSwap(word, candidate);
}

/** Tolerates one typo in words of five letters or more ("refnud", "tickts"). */
function fuzzyContains(text: string, phrase: string): boolean {
  const needle = normalise(phrase);
  if (!needle) return false;
  if (needle.includes(" ")) return text.includes(needle);
  if (needle.length < 5) return false;
  return text.split(" ").some((word) => fuzzyWord(word, needle));
}

export function detectIntent(message: string, previousIntent?: Intent): IntentMatch {
  const text = normalise(message);
  let best: IntentMatch = { intent: "unknown", matched: [], weight: -1 };

  // Score exact and fuzzy matches together. A high-risk phrase with one typo
  // ("refnud my ticket") must still beat an exact but less urgent phrase.
  for (const rule of INTENT_RULES) {
    const exact = rule.phrases.filter((phrase) => containsPhrase(text, phrase));
    const fuzzy = exact.length === 0
      ? rule.phrases.filter((phrase) => fuzzyContains(text, phrase))
      : [];
    const matched = exact.length > 0 ? exact : fuzzy;
    const score = rule.weight - (fuzzy.length > 0 ? 8 : 0);
    if (matched.length > 0 && score > best.weight) {
      best = { intent: rule.intent, matched, weight: score };
    }
  }

  // A typo in the bare word "refund" is ambiguous. Possessive, status and
  // timing language makes it an action; "can I get a refnd?" stays a policy query.
  if (
    best.intent === "refund_policy" &&
    best.weight < 95 &&
    /\b(my|me|order|ticket|status|when|no)\b/.test(text)
  ) {
    return { intent: "refund", matched: best.matched, weight: best.weight + 1 };
  }

  if (best.intent !== "unknown" || !previousIntent) return best;
  if (["greeting", "thanks", "unknown"].includes(previousIntent)) return best;

  // Short follow-ups inherit the previous topic. The event slug still supplies
  // the subject; this supplies the question ("how much?", "what about entry?").
  const words = text.split(" ").filter(Boolean);
  const contextual = /^(what about|how about|tell me more|more details|and that|and it|yes|no|okay|ok|why|really|when|where|how much|what time)\b/.test(text);
  const barePlace = previousIntent === "listing" && extractCity(message) !== null;
  if (words.length <= 8 && (contextual || barePlace)) {
    return { intent: previousIntent, matched: ["conversation context"], weight: 0 };
  }
  return best;
}

export function isIntent(value: string): value is Intent {
  return new Set<Intent>([
    "human", "fraud", "trust", "refund", "refund_policy", "transfer", "order",
    "delivery_confirmation", "entry", "price", "availability", "venue", "schedule",
    "listing", "past_event", "how_to_buy", "organizer", "payment", "payment_issue",
    "promo", "waitlist", "cancelled", "about", "capabilities", "account",
    "account_delete", "email_change", "app", "technical", "contact", "greeting",
    "thanks", "unknown",
  ]).has(value as Intent);
}

function removePhrase(text: string, phrase: string): string {
  const needle = normalise(phrase);
  if (!needle) return text;
  if (needle.includes(" ")) return text.split(needle).join(" ");
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\b${escaped}\\b`, "g"), " ");
}

/** Everything that is a question word, an intent trigger or filler is removed. */
export function extractSearchTerm(message: string, matchedPhrases: string[]): string {
  let text = normalise(message);
  for (const phrase of matchedPhrases) text = removePhrase(text, phrase);
  return text
    .split(" ")
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .join(" ")
    .slice(0, 80);
}

export function extractCity(text: string): string | null {
  const normalised = normalise(text);
  for (const city of NIGERIAN_CITIES) {
    if (containsPhrase(normalised, city)) return city;
  }
  return null;
}

export interface ListingWindow {
  start: string;
  end: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

/** WAT has no daylight-saving transition, so a fixed UTC+1 conversion is exact. */
export function listingWindow(message: string, now = new Date()): ListingWindow | null {
  const text = normalise(message);
  const isWeekend = text.includes("weekend");
  const isWeek = text.includes("this week");
  const isToday = text.includes("today") || text.includes("tonight");
  if (!isWeekend && !isWeek && !isToday) return null;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const todayUtc = Date.UTC(value("year"), value("month") - 1, value("day"));
  const weekday = new Date(todayUtc).getUTCDay();

  let startDay = todayUtc;
  let endDay = todayUtc + DAY_MS;
  if (isWeekend) {
    // On Sunday, "this weekend" still includes today. Otherwise start Saturday.
    startDay = weekday === 0
      ? todayUtc
      : todayUtc + ((6 - weekday + 7) % 7) * DAY_MS;
    endDay = startDay + 2 * DAY_MS;
  } else if (isWeek) {
    endDay = todayUtc + 7 * DAY_MS;
  }

  return {
    start: new Date(startDay - LAGOS_OFFSET_MS).toISOString(),
    end: new Date(endDay - LAGOS_OFFSET_MS).toISOString(),
  };
}

// Mentioning a credential is not the same as sending one: "I forgot my
// password" must still reach the account answer. Only a credential given as a
// value is refused.
const SENSITIVE_PATTERNS: RegExp[] = [
  /\b(?:\d[ -]?){15,19}\b/,
  /\b(cvv|cvc|card pin|pin code|pin|otp|one time password|bvn|nin|national id)\b\s*(?:is|are|:|=|-)?\s*\d{3,11}\b/i,
  /\b(password|passcode)\b\s*(?:is|:|=)\s+(?!not\b|no\b|broken\b|incorrect\b)\S+/i,
  /\b(account number|account no|acct number|nuban)\b\s*(?:is|:|=|-)?\s*\d{6,}\b/i,
  /\bexpir(?:y|es)\b\s*(?:(?:date|is|:|=)\s*)*\d{2}\s*\/\s*\d{2,4}\b/i,
];

export function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(message));
}

export const SENSITIVE_REFUSAL =
  "Please don't send that here — I can't accept card numbers, CVV codes, PINs, passwords, OTPs, NIN, BVN or bank details, and this chat doesn't store them.\n\nIf a payment has an issue, tell me what happened without the card details and I'll pass it to the support team, or use /my-tickets to resend your links.";

/** Cheap gibberish gate; gibberish must not consume an escalation slot. */
export function looksSubstantive(message: string): boolean {
  const words = normalise(message).split(" ").filter((word) => word.length >= 2);
  const shortSupportWords = new Set(["app", "bug", "pay", "fee", "help", "otp", "scam"]);
  const meaningful = words.filter((word) => {
    if (word.length < 3 || /^(.)\1+$/.test(word)) return false;
    const vowels = (word.match(/[aeiou]/g) ?? []).length;
    return vowels >= 2 || shortSupportWords.has(word);
  });
  if (meaningful.length === 0) return false;
  if (meaningful.length === 1 && meaningful[0].length < 5 && !message.includes("?")) return false;
  return true;
}

export interface BotKnowledgeEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  triggers: string[];
}

export interface KnowledgeMatch {
  entry: BotKnowledgeEntry;
  score: number;
}

export interface ActionLink {
  label: string;
  href: string;
}

const CATEGORY_INTENTS: Record<string, Intent[]> = {
  tickets: ["how_to_buy", "order", "transfer", "entry", "delivery_confirmation", "waitlist"],
  payments: ["payment", "payment_issue", "promo"],
  refunds: ["refund", "refund_policy", "cancelled"],
  account: ["account", "account_delete", "email_change"],
  checkin: ["entry"],
  events: ["listing", "price", "availability", "venue", "schedule", "cancelled", "past_event", "trust"],
  organizer: ["organizer"],
  technical: ["technical", "app"],
  general: [],
};

function tokens(text: string): string[] {
  return Array.from(new Set(normalise(text).split(" ").filter((word) => word.length > 1 && !STOPWORDS.has(word))));
}

/**
 * Deterministic retrieval over staff-approved answers. Exact customer phrasing
 * wins, while token coverage handles paraphrase and a single common typo.
 * Returns null below the confidence threshold instead of guessing.
 */
export function rankKnowledge(
  message: string,
  entries: BotKnowledgeEntry[],
  intent: Intent = "unknown",
): KnowledgeMatch | null {
  const text = normalise(message);
  const queryTokens = tokens(message);
  if (queryTokens.length === 0) return null;

  let best: KnowledgeMatch | null = null;
  for (const entry of entries) {
    const title = normalise(entry.title);
    const triggers = entry.triggers.map(normalise).filter(Boolean);
    const entryTokens = tokens(`${entry.title} ${triggers.join(" ")}`);
    if (entryTokens.length === 0) continue;

    let matchedCount = 0;
    let fuzzyCount = 0;
    for (const queryToken of queryTokens) {
      const exact = entryTokens.some((token) => token === queryToken);
      const fuzzy = !exact && entryTokens.some((token) => fuzzyWord(queryToken, token));
      if (exact || fuzzy) {
        matchedCount += 1;
        if (fuzzy) fuzzyCount += 1;
      }
    }
    if (matchedCount === 0) continue;

    const exactTrigger = triggers.some(
      (trigger) => trigger.length >= 3 && containsPhrase(text, trigger),
    );
    const exactTitle = title.length >= 3 && containsPhrase(text, title);
    const triggerCovered = triggers.some((trigger) => {
      const triggerTokens = tokens(trigger);
      return triggerTokens.length > 0 && triggerTokens.every((triggerToken) =>
        queryTokens.some((queryToken) => fuzzyWord(queryToken, triggerToken)),
      );
    });
    const titleCovered = tokens(entry.title).every((titleToken) =>
      queryTokens.some((queryToken) => fuzzyWord(queryToken, titleToken)),
    );

    const coverage = matchedCount / queryTokens.length;
    const precision = matchedCount / entryTokens.length;
    let score = coverage * 52 + precision * 23;
    if (exactTrigger) score += 32;
    if (exactTitle) score += 28;
    if (triggerCovered) score += 22;
    if (titleCovered) score += 10;
    score -= fuzzyCount * 4;

    const category = entry.category.toLowerCase();
    const categoryIntents = CATEGORY_INTENTS[category];
    if (intent !== "unknown" && categoryIntents && categoryIntents.length > 0) {
      score += categoryIntents.includes(intent) ? 8 : -28;
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    if (score >= 78 && (!best || score > best.score)) best = { entry, score };
  }
  return best;
}

const KNOWN_LINKS: ActionLink[] = [
  { label: "Find my tickets", href: "/tickets" },
  { label: "Email my tickets", href: "/my-tickets" },
  { label: "Account settings", href: "/account" },
  { label: "Sign in", href: "/auth" },
  { label: "Reset password", href: "/forgot-password" },
  { label: "Refund policy", href: "/refunds" },
  { label: "Browse events", href: "/browse" },
  { label: "Contact support", href: "/contact" },
  { label: "Organizer dashboard", href: "/dashboard" },
  { label: "Help and FAQ", href: "/faq" },
  { label: "Download Android APK", href: "/Tixnaija.apk" },
];

const CATEGORY_LINK: Record<string, string> = {
  tickets: "/my-tickets",
  payments: "/my-tickets",
  refunds: "/refunds",
  account: "/account",
  checkin: "/tickets",
  events: "/browse",
  organizer: "/dashboard",
  technical: "/faq",
  general: "/faq",
};

/** Only known internal routes become buttons; staff cannot inject arbitrary URLs. */
export function linksForKnowledge(entry: BotKnowledgeEntry): ActionLink[] {
  const mentioned = KNOWN_LINKS.filter((link) => entry.content.includes(link.href));
  if (mentioned.length > 0) return mentioned.slice(0, 3);
  const fallback = CATEGORY_LINK[entry.category.toLowerCase()] ?? "/faq";
  return KNOWN_LINKS.filter((link) => link.href === fallback);
}

/** Safe wording for live order states; a failed order is not proof of no debit. */
export function orderStatusGuidance(status: string): string {
  switch (status) {
    case "paid":
      return "Payment is confirmed on this order. Your tickets should be available in your account and emailed to the purchase address.";
    case "comp":
      return "This is a confirmed complimentary order. The tickets should be available in your account and emailed to the purchase address.";
    case "pending":
      return "This order is still awaiting payment confirmation. Bank transfers can take 2–10 minutes; please don't pay again while it is pending. If it has been longer than 15 minutes, support can reconcile it.";
    case "failed":
      return "There is no successful payment recorded on this order. Check your bank alert before retrying checkout; if money left your account, support needs to investigate rather than treating it as unpaid.";
    case "refunded":
      return "This order is marked refunded. Once a refund is approved, Paystack usually credits the original bank account or card within 3–7 business days.";
    default:
      return "I can see the order, but its payment state needs a support agent to confirm.";
  }
}
