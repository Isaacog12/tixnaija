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
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.vercel.app",
  };
}

// ---------------------------------------------------------------------------
// Intent rules
// ---------------------------------------------------------------------------

type Intent =
  | "human"
  | "refund"
  | "order"
  | "price"
  | "venue"
  | "schedule"
  | "availability"
  | "listing"
  | "greeting"
  | "thanks"
  | "unknown";

const INTENT_RULES: Array<{ intent: Intent; phrases: string[] }> = [
  {
    intent: "human",
    phrases: [
      "human", "real person", "agent", "someone", "somebody", "support team",
      "customer care", "talk to", "speak to", "call me", "chat with a person",
      "abeg connect me", "person wey go help",
    ],
  },
  {
    intent: "refund",
    phrases: [
      "refund", "money back", "my money", "return my money", "reverse the payment",
      "reversal", "charge back", "chargeback", "cancel my ticket", "cancel my order",
      "give me back my money", "abeg refund", "make una refund",
    ],
  },
  {
    intent: "order",
    phrases: [
      "my ticket", "my tickets", "my order", "my orders", "qr", "qr code",
      "ticket code", "scan", "didn't get", "did not get", "not received",
      "haven't received", "no email", "confirmation email", "resend",
      "lost my ticket", "i no see my ticket", "ticket never land",
    ],
  },
  {
    intent: "price",
    phrases: [
      "how much", "price", "prices", "cost", "ticket fee", "fees", "gate fee",
      "na how much", "how much be", "wetin be the price", "how much e cost",
    ],
  },
  {
    intent: "venue",
    phrases: [
      "where is", "where's", "where e dey", "where e hold", "venue", "location",
      "address", "direction", "how do i get there", "how i go reach",
    ],
  },
  {
    intent: "schedule",
    phrases: [
      "when is", "when's", "what time", "what date", "which day", "start time",
      "wetin be the date", "which time", "when e go start",
    ],
  },
  {
    intent: "availability",
    phrases: [
      "sold out", "still available", "tickets left", "any left", "remaining tickets",
      "still get ticket", "ticket still dey", "space dey",
    ],
  },
  {
    intent: "listing",
    phrases: [
      "events", "event", "shows", "show", "parties", "party", "concert", "concerts",
      "what's happening", "whats happening", "upcoming", "wetin dey happen",
    ],
  },
  {
    intent: "greeting",
    phrases: [
      "hi", "hello", "hey", "good morning", "good afternoon", "good evening",
      "good day", "how far", "how you dey", "how una dey", "wetin dey", "sup", "yo",
    ],
  },
  {
    intent: "thanks",
    phrases: ["thanks", "thank you", "thx", "well done", "god bless", "e go better"],
  },
];

const STOPWORDS = new Set([
  "a", "about", "abeg", "am", "an", "and", "any", "are", "as", "at", "be", "been",
  "but", "by", "can", "could", "dey", "did", "do", "does", "for", "from", "get",
  "give", "go", "got", "has", "have", "he", "her", "him", "his", "how", "i", "if",
  "in", "is", "it", "its", "just", "me", "my", "na", "no", "not", "now", "of",
  "on", "or", "our", "please", "pls", "so", "tell", "that", "the", "their", "them",
  "there", "they", "this", "to", "una", "up", "us", "was", "we", "were", "wet",
  "wetin", "what", "whats", "when", "where", "which", "who", "why", "will", "with",
  "would", "you", "your", "show", "shows", "event", "events", "party", "concert",
  "ticket", "tickets", "price", "cost", "much", "date", "time", "day", "venue",
  "location", "address", "still", "left", "available", "today", "tomorrow",
  "week", "weekend", "month", "next", "coming", "happening", "upcoming", "hold",
  "again", "sir", "ma", "abeg", "oo", "o", "wan", "want", "see", "know",
]);

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  if (phrase.includes(" ")) return text.includes(phrase);
  return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text);
}

function detectIntent(message: string): { intent: Intent; matched: string[] } {
  const text = normalise(message);
  for (const rule of INTENT_RULES) {
    const matched = rule.phrases.filter((phrase) => containsPhrase(text, phrase));
    if (matched.length > 0) return { intent: rule.intent, matched };
  }
  return { intent: "unknown", matched: [] };
}

/**
 * Pulls the most likely event name out of a sentence. Everything that is a
 * question word, an intent trigger or filler is removed; what is left is used
 * for the ILIKE lookup.
 */
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
// Formatting helpers
// ---------------------------------------------------------------------------

function formatWhen(start: string | null, end: string | null): string {
  if (!start) return "date to be announced";
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return "date to be announced";

  const datePart = startDate.toLocaleDateString("en-NG", {
    timeZone: "Africa/Lagos",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timePart = startDate.toLocaleTimeString("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
  });

  if (!end) return `${datePart}, ${timePart}`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${datePart}, ${timePart}`;

  const sameDay = endDate.toDateString() === startDate.toDateString();
  const endTime = endDate.toLocaleTimeString("en-NG", {
    timeZone: "Africa/Lagos",
    hour: "numeric",
    minute: "2-digit",
  });
  return sameDay
    ? `${datePart}, ${timePart} - ${endTime}`
    : `${datePart}, ${timePart} - ${endDate.toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" })}, ${endTime}`;
}

interface PublicEvent {
  title: string;
  slug: string;
  start_datetime: string | null;
  end_datetime: string | null;
  venue_name: string | null;
  city: string | null;
}

function describeEvent(event: PublicEvent): string {
  const place = [event.venue_name, event.city].filter(Boolean).join(", ");
  const parts = [event.title, formatWhen(event.start_datetime, event.end_datetime)];
  if (place) parts.push(place);
  return `${parts.join(" — ")}\nDetails: /e/${event.slug}`;
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
      return "missing_ticket";
    case "price":
      return "payment";
    case "listing":
    case "schedule":
    case "venue":
    case "availability":
      return "event_inquiry";
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
  },
): Promise<{ ok: boolean }> {
  const { message, intent, sessionId, ip, caller, guestEmail } = params;
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

  const { error: outboxError } = await supabase.from("email_outbox").insert({
    case_id: created.id,
    recipient_email: ESCALATION_RECIPIENT,
    template: "support_escalation",
    status: "pending",
    payload: {
      case_number: created.case_number,
      customer_email: contactEmail,
      customer_id: caller.userId,
      message,
      intent,
      session_id: sessionId,
      ip_address: ip,
      requested_at: new Date().toISOString(),
    },
  });

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

  // @ts-ignore
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
  const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")) ?? "";

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

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Per-IP limit.
    const ipLimit = await consumeLimit(
      supabase,
      ip,
      "support_bot_message",
      IP_WINDOW_MS,
      IP_MAX_MESSAGES,
      true,
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

    // Per-session limit (session id lives in the endpoint column).
    const sessionLimit = await consumeLimit(
      supabase,
      ip,
      `support_bot_session:${sessionId}`,
      SESSION_WINDOW_MS,
      SESSION_MAX_MESSAGES,
      false,
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

    const reply = async (payload: Record<string, unknown>) =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
          ...cors,
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });

    // 1. Greeting and small talk — no data lookup, no escalation.
    if (intent === "greeting") {
      return reply({
        reply: "Hi, I'm TixNaija. Ask me about events, tickets or orders.",
        escalated: false,
      });
    }

    if (intent === "thanks") {
      return reply({
        reply: "You're welcome. If you need anything else about an event, ticket or order, just ask.",
        escalated: false,
      });
    }

    // 2. Event lookups. Published events only, public fields only.
    const lookupEvents = async (term: string): Promise<PublicEvent[]> => {
      if (term.length < 2) return [];
      const { data, error } = await supabase
        .from("events")
        .select("title, slug, start_datetime, end_datetime, venue_name, city")
        .eq("status", "published")
        .ilike("title", `%${escapeLike(term)}%`)
        .order("start_datetime", { ascending: true })
        .limit(5);
      if (error) {
        console.error("support-bot: event lookup failed", error);
        return [];
      }
      return (data ?? []) as PublicEvent[];
    };

    const events = await lookupEvents(searchTerm);

    if (events.length > 0) {
      const header =
        events.length === 1
          ? "Here is what I found:"
          : `I found ${events.length} events that match:`;
      return reply({
        reply: `${header}\n\n${events.map(describeEvent).join("\n\n")}`,
        escalated: false,
      });
    }

    // A data question with no matching event: say so instead of guessing.
    const dataIntents: Intent[] = ["price", "venue", "schedule", "availability"];
    if (dataIntents.includes(intent)) {
      if (!searchTerm) {
        return reply({
          reply:
            "Which event do you mean? Tell me the event name and I'll check the details for you.",
          escalated: false,
        });
      }
      return reply({
        reply: `I couldn't find a published event matching "${searchTerm}". You can browse everything at /browse. If you think this is a mistake, I can pass it to the support team.`,
        escalated: false,
      });
    }

    if (intent === "listing") {
      return reply({
        reply: "You can see every published event at /browse. Tell me an event name and I'll pull up the date, venue and ticket details.",
        escalated: false,
      });
    }

    // 3. Refunds — never promise an automatic refund.
    if (intent === "refund") {
      const outcome = await maybeEscalate({
        supabase,
        message,
        intent,
        sessionId,
        ip,
        caller,
        guestEmail,
      });
      if (outcome.needsEmail) {
        return reply({
          needsEmail: true,
          escalated: false,
          reply:
            "Refunds are not automatic. The support team has to review each request against the event's policy first. What email address should they reply to?",
        });
      }
      if (!outcome.ok) {
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return reply({
        reply:
          "Refunds are not automatic. Your request has been passed to the support team for review, and they'll contact you about the outcome. You can also read the refund policy at /refunds.",
        escalated: true,
      });
    }

    // 4. Ticket and order questions the assistant cannot resolve on its own.
    if (intent === "order") {
      return reply({
        reply:
          "If you bought without an account, enter your email at /my-tickets and we'll resend your ticket links. Signed-in buyers can open /tickets. Still stuck? I can pass this to a person.",
        escalated: false,
      });
    }

    if (intent === "human") {
      const outcome = await maybeEscalate({
        supabase,
        message,
        intent,
        sessionId,
        ip,
        caller,
        guestEmail,
      });
      if (outcome.needsEmail) {
        return reply({
          needsEmail: true,
          escalated: false,
          reply: "I'll connect you with a person. What email address should they reply to?",
        });
      }
      if (!outcome.ok) {
        return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
          status: 503,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return reply({
        reply: `Thanks — I've sent this to the support team. They'll reply to you by email. If you'd rather write directly, the address is ${PUBLIC_SUPPORT_ADDRESS}.`,
        escalated: true,
      });
    }

    // 5. Anything unmatched escalates to a human.
    const outcome = await maybeEscalate({
      supabase,
      message,
      intent,
      sessionId,
      ip,
      caller,
      guestEmail,
    });
    if (outcome.needsEmail) {
      return reply({
        needsEmail: true,
        escalated: false,
        reply:
          "I don't have an answer for that one, so a person should take a look. What email address should they reply to?",
      });
    }
    if (!outcome.ok) {
      return new Response(JSON.stringify({ error: GENERIC_ERROR }), {
        status: 503,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return reply({
      reply:
        "I've passed your question to the support team — they'll follow up by email. For anything urgent you can also reach them at " +
        PUBLIC_SUPPORT_ADDRESS +
        ".",
      escalated: true,
    });
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

async function maybeEscalate(params: {
  supabase: any;
  message: string;
  intent: Intent;
  sessionId: string;
  ip: string;
  caller: Caller;
  guestEmail: string | null;
}): Promise<{ ok: boolean; needsEmail: boolean }> {
  const { supabase, ip, caller, guestEmail } = params;
  const contactEmail = caller.email ?? guestEmail;

  // Guests must leave an address before a case is opened.
  if (!contactEmail) return { ok: false, needsEmail: true };

  const ipCap = await consumeLimit(
    supabase,
    ip,
    "support_bot_escalation",
    ESCALATION_WINDOW_MS,
    IP_MAX_ESCALATIONS,
    true,
  );
  if (!ipCap.allowed) return { ok: false, needsEmail: false };

  const since = new Date(Date.now() - ESCALATION_WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .eq("template", "support_escalation")
    .filter("payload->>customer_email", "eq", contactEmail)
    .gte("created_at", since);

  if (error || count === null) return { ok: false, needsEmail: false };
  if (count >= EMAIL_MAX_ESCALATIONS) return { ok: false, needsEmail: false };

  const result = await escalate(supabase, params);
  return { ok: result.ok, needsEmail: false };
}
