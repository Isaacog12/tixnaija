// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
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
  SENSITIVE_REFUSAL,
  type BotKnowledgeEntry,
  type Intent,
} from "../_shared/support-brain.ts";
import {
  PAYMENT_ISSUE_GUIDANCE,
  PUBLIC_SUPPORT_ADDRESS,
  REFUND_POLICY,
  STATIC_ANSWERS,
} from "../_shared/support-answers.ts";
import {
  describeEvent,
  describeTickets,
  eventStatusGuidance,
  formatWhen,
  naira,
  type PublicEvent,
  type TicketType,
} from "../_shared/support-events.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

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

/**
 * Intents answered from a named event. Every other message skips the event
 * search entirely — it used to run for any message with a searchable word.
 */
const EVENT_INTENTS: ReadonlySet<Intent> = new Set<Intent>([
  "price", "availability", "schedule", "venue", "cancelled",
]);

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

/** Escapes LIKE wildcards so a customer cannot broaden the search. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Values inside a PostgREST `or(...)` filter are comma-separated, so a token
 * containing a comma, parenthesis or wildcard could change the filter's shape.
 * Search terms are already lowercased alphanumerics; this enforces it.
 */
function escapeFilterValue(value: string): string {
  return value.replace(/[,()%_\\]/g, "").trim();
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

  // Failing closed took the whole assistant offline whenever the log table was
  // unavailable: every message became a 503. Losing one counter is the smaller
  // harm, and it is logged so the outage is still visible.
  if (insertError) {
    console.error("support-bot: rate limit write failed", insertError);
    return { allowed: true, unavailable: true };
  }

  const since = new Date(Date.now() - windowMs).toISOString();
  let query = supabase
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("endpoint", endpoint)
    .gte("created_at", since);

  if (matchIp) query = query.eq("ip_address", ip);

  const { count, error } = await query;
  if (error || count === null) {
    console.error("support-bot: rate limit count failed", error);
    return { allowed: true, unavailable: true };
  }

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
    case "delivery_confirmation":
    case "entry":
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
    case "payment_issue":
    case "promo":
      return "payment";
    case "account":
    case "account_delete":
    case "email_change":
    case "ticket_email_change":
      return "account";
    case "fraud":
    case "trust":
      return "event_inquiry";
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
    // Money has already moved, a paid ticket has not arrived, someone is at the
    // gate, or a scam is being reported.
    case "refund":
    case "order":
    case "transfer":
    case "payment":
    case "payment_issue":
    case "entry":
    case "fraud":
    case "ticket_email_change":
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
  /** False when no receipt was sent to the customer (unverified address). */
  notifiedCustomer: boolean;
}

/**
 * Whether an address belongs to someone who has actually transacted here.
 *
 * The assistant invites a guest to type any address, and an acknowledgement is
 * a real email to it. Without this check the bot could be used to send mail to
 * a stranger twice an hour. A failed lookup is treated as unverified.
 */
async function buyerEmailExists(supabase: any, email: string | null): Promise<boolean> {
  if (!email) return false;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_email", email)
    .limit(1);
  if (error) {
    console.error("support-bot: buyer verification failed", error);
    return false;
  }
  return (count ?? 0) > 0;
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

/**
 * Staff-approved fallback answers (support_bot_knowledge), cached per isolate.
 *
 * A paraphrase that no intent rule covers used to become an escalation. This
 * gives it a checked answer instead. The 60 second cache keeps a hot bot from
 * paying one query per message while still picking up a staff edit quickly.
 */
const KNOWLEDGE_TTL_MS = 60 * 1000;
let knowledgeCache: { loadedAt: number; entries: BotKnowledgeEntry[] } = {
  loadedAt: 0,
  entries: [],
};

async function loadKnowledge(supabase: any): Promise<BotKnowledgeEntry[]> {
  if (Date.now() - knowledgeCache.loadedAt < KNOWLEDGE_TTL_MS) return knowledgeCache.entries;

  const { data, error } = await supabase
    .from("support_bot_knowledge")
    .select("id, title, category, content, triggers")
    .eq("active", true)
    .limit(200);

  if (error) {
    // An empty answer list is fine; failing the whole reply is not.
    console.error("support-bot: knowledge load failed", error);
    return knowledgeCache.entries;
  }

  knowledgeCache = { loadedAt: Date.now(), entries: (data ?? []) as BotKnowledgeEntry[] };
  return knowledgeCache.entries;
}

async function matchKnowledge(
  supabase: any,
  message: string,
  intent: Intent,
): Promise<string | null> {
  try {
    const entries = await loadKnowledge(supabase);
    if (entries.length === 0) return null;
    return rankKnowledge(message, entries, intent)?.entry.content ?? null;
  } catch (error) {
    console.error("support-bot: knowledge lookup failed", error);
    return null;
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

  // A signed-in customer's address is verified by their session. A guest's is
  // only trusted for a receipt when it has bought something here.
  const verifiedContact = caller.userId ? true : await buyerEmailExists(supabase, guestEmail);

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
    return { ok: false, caseNumber: null, notified: false, notifiedCustomer: false };
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
  const acknowledgementRows = contactEmail && verifiedContact
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
    return {
      ok: true,
      caseNumber: created.case_number,
      notified: false,
      notifiedCustomer: verifiedContact,
    };
  }

  return {
    ok: true,
    caseNumber: created.case_number,
    notified: true,
    notifiedCustomer: verifiedContact,
  };
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

    // The previous intent, echoed by the client, is what keeps the subject of
    // "and the venue?" or "what about entry?". Validated against the enum, and
    // used only to choose a reply branch — never as a permission.
    const previousIntentRaw = typeof body?.previousIntent === "string" ? body.previousIntent : "";
    const previousIntent = isIntent(previousIntentRaw) ? previousIntentRaw : undefined;

    const ip = clientIp(req);

    // Both counters are independent, so they are written and counted in one
    // round trip instead of two sequential ones before any answer can start.
    const [ipLimit, sessionLimit] = await Promise.all([
      consumeLimit(supabase, ip, "support_bot_message", IP_WINDOW_MS, IP_MAX_MESSAGES, true),
      consumeLimit(
        supabase, ip, `support_bot_session:${sessionId}`, SESSION_WINDOW_MS,
        SESSION_MAX_MESSAGES, false,
      ),
    ]);
    if (!ipLimit.allowed) {
      return new Response(JSON.stringify({ error: GENERIC_RATE_LIMIT }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!sessionLimit.allowed) {
      return new Response(JSON.stringify({ error: GENERIC_RATE_LIMIT }), {
        status: 429,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Supabase auth is only contacted when an answer actually needs identity
    // (order lookups and escalation). A signed-in customer asking a policy
    // question used to pay an auth round trip for nothing.
    let callerPromise: Promise<Caller> | null = null;
    const getCaller = (): Promise<Caller> =>
      (callerPromise ??= resolveCaller(req, supabaseUrl, anonKey));

    const { intent, matched } = detectIntent(message, previousIntent);
    const searchTerm = extractSearchTerm(message, matched);
    // The message is scanned once; the reply logger and the refusal branch used
    // to run the same seven patterns twice for every message.
    const sensitive = containsSensitiveData(message);

    const reply = (payload: Record<string, unknown>) => {
      // Bot gap analytics. Deliberately not awaited: measuring the assistant must
      // never add latency to, or fail, a customer's reply. Nothing that looked
      // like a card number, PIN or password is ever written here.
      if (!sensitive) {
        void logBotQuery(supabase, {
          sessionId,
          message,
          intent,
          escalated: payload.escalated === true,
        });
      }
      // The matched intent goes back so the client can echo it as
      // previousIntent, which is what gives short follow-ups their subject.
      return new Response(JSON.stringify({ intent, ...payload }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    };

    // Card numbers, PINs, OTPs and passwords are refused before anything else:
    // they are never stored in a case, an email or a log.
    if (sensitive) {
      return reply({
        reply: SENSITIVE_REFUSAL,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    const eventFields =
      "id, title, slug, start_datetime, end_datetime, venue_name, city, status, postponed_at, organizer_note";

    // ---- Data access: events and their public ticket types only ----
    /**
     * Title phrase, individual title words and city, in one round trip.
     *
     * The previous version matched the whole cleaned phrase only, so "burna boy
     * lagos concert" found nothing unless those words were contiguous in the
     * title, then retried a single longest word. All three shapes now run in
     * parallel and are read in order of confidence.
     */
    const findEvents = async (
      term: string,
      options: { includeEnded?: boolean } = {},
    ): Promise<PublicEvent[]> => {
      if (term.length < 2) return [];

      const statuses = options.includeEnded
        ? ["published", "cancelled", "completed"]
        : ["published"];
      const words = term
        .split(" ")
        .map(escapeFilterValue)
        .filter((word) => word.length >= 3)
        .slice(0, 4);
      const tokenFilter = words.length > 1
        ? words.map((word) => `title.ilike.%${word}%`).join(",")
        : null;

      // Past lookups want the most recent match; upcoming ones want the soonest.
      const search = () =>
        supabase
          .from("events")
          .select(eventFields)
          .in("status", statuses)
          .order("start_datetime", { ascending: !options.includeEnded })
          .limit(5);

      const empty = { data: [] as PublicEvent[], error: null };
      const [byPhrase, byToken, byCity] = await Promise.all([
        search().ilike("title", `%${escapeLike(term)}%`),
        tokenFilter ? search().or(tokenFilter) : Promise.resolve(empty),
        search().ilike("city", `%${escapeLike(term)}%`),
      ]);

      if (byPhrase.error) {
        console.error("support-bot: event lookup failed", byPhrase.error);
        return [];
      }

      const rows = byPhrase.data?.length
        ? byPhrase.data
        : byToken.data?.length
        ? byToken.data
        : byCity.data ?? [];
      return rows as PublicEvent[];
    };

    const findUpcoming = async (
      limit = 5,
      options: { city?: string | null; window?: { start: string; end: string } | null } = {},
    ): Promise<PublicEvent[]> => {
      const window = options.window ?? null;
      let query = supabase
        .from("events")
        .select(eventFields)
        .eq("status", "published")
        .gte("start_datetime", window?.start ?? new Date().toISOString())
        .order("start_datetime", { ascending: true })
        .limit(limit);

      // "events in Lagos this weekend" used to return five events from anywhere:
      // the city and the date range were extracted by the shared brain and then
      // never applied, so the answer looked confident and was wrong.
      if (window) query = query.lt("start_datetime", window.end);
      if (options.city) query = query.ilike("city", `%${escapeLike(options.city)}%`);

      const { data, error } = await query;
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
        .in("status", ["published", "cancelled", "completed"])
        .eq("slug", slug)
        .maybeSingle();
      if (error || !data) return null;
      return data as PublicEvent;
    };

    const findTickets = async (eventId: string): Promise<TicketType[]> => {
      const { data, error } = await supabase
        .from("ticket_types")
        .select(
          "name, price_kobo, quantity_available, quantity_sold, quantity_cancelled, sales_start_at, sales_end_at",
        )
        .eq("event_id", eventId)
        .order("price_kobo", { ascending: true })
        .limit(12);
      if (error) {
        console.error("support-bot: ticket lookup failed", error);
        return [];
      }
      return (data ?? []) as TicketType[];
    };

    /**
     * The signed-in customer's most recent order.
     *
     * Scoped to the verified JWT subject — never to an email or order id the
     * browser sent — so one account cannot read another's order.
     */
    const findLatestOrder = async (userId: string): Promise<string | null> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_kobo, created_at, events(title, slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;

      const order = data as {
        id: string;
        status: string;
        total_kobo: number;
        events: { title: string; slug: string } | null;
      };
      const reference = `TN-${order.id.slice(0, 8).toUpperCase()}`;
      const event = order.events?.title ? ` for ${order.events.title}` : "";

      return `Your latest order${event} is ${reference} (${naira(order.total_kobo)}, ${order.status}). ${orderStatusGuidance(order.status)}`;
    };

    const withTickets = async (event: PublicEvent, includeTickets: boolean) => {
      const base = describeEvent(event);
      if (!includeTickets) return base;
      if (event.status === "cancelled" || event.status === "completed") {
        return `${base}\n\nTickets are no longer on sale for this event.`;
      }
      const types = await findTickets(event.id);
      return `${base}\n\n${describeTickets(types)}`;
    };

    // ---- 1. Answers that are the same for every customer ----
    // One lookup instead of a chain of branches, and the copy lives in the
    // shared catalogue where a test can prove every static intent has an answer.
    const staticAnswer = STATIC_ANSWERS[intent];
    if (staticAnswer) {
      return reply({
        reply: staticAnswer,
        links: linksForIntent(intent),
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // A finished or cancelled event can be looked up by name, so "was the Burna
    // Boy show cancelled?" is answered from the record instead of with policy
    // prose. Published-only search could never find it.
    if (intent === "past_event") {
      if (searchTerm.length >= 2) {
        const found = await findEvents(searchTerm, { includeEnded: true });
        if (found.length >= 1) {
          const match = found[0];
          return reply({
            reply: `${
              describeEvent(match)
            }\n\n${
              match.status === "cancelled"
                ? "This event was cancelled by the organizer. Buyers are emailed automatically, and the refund is handled by the organizer through Paystack."
                : "This event has ended, so its tickets are no longer on sale. If something went wrong with a ticket you bought for it, say \"talk to a person\" and I'll pass it to the support team."
            }`,
            cards: [toCard(match)],
            escalated: false,
            context: match.slug,
          });
        }
      }
      return reply({
        reply:
          "Once an event has ended, its tickets come off sale and can't be bought any more — you can see everything still live at /browse.\n\nIf you already bought a ticket for an event that's now over and something went wrong with it, or you were charged for an event that got cancelled rather than simply ending, tell me the event name or say \"talk to a person\" and I'll pass it to the support team.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- Resolve which event, if any, this message is about ----
    // Only event intents search, and the listing branch runs its own
    // city/date-scoped query. Everything else used to pay one to three event
    // queries it never read — and a message like "my payment failed for Burna
    // Boy" could be answered with an event list instead of payment help.
    let events: PublicEvent[] = [];
    let referencedEvent: PublicEvent | null = null;

    if (EVENT_INTENTS.has(intent) || intent === "unknown") {
      events = searchTerm.length >= 2
        ? await findEvents(searchTerm, { includeEnded: intent === "cancelled" })
        : [];
      if (events.length === 1) {
        referencedEvent = events[0];
      } else if (events.length === 0 && contextSlug) {
        // Follow-up question about the event we just showed.
        referencedEvent = await findEventBySlug(contextSlug);
      }
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
        return reply({
          reply: await withTickets(referencedEvent, true),
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
    if (referencedEvent && ["schedule", "venue"].includes(intent)) {
      return reply({
        reply: await withTickets(referencedEvent, false),
        cards: [toCard(referencedEvent)],
        escalated: false,
        context: referencedEvent.slug,
      });
    }

    if (intent === "cancelled" && referencedEvent) {
      const statusAnswer = eventStatusGuidance(referencedEvent);
      return reply({
        reply: `${describeEvent(referencedEvent)}\n\n${statusAnswer}`,
        links: linksForIntent("refund_policy"),
        cards: [toCard(referencedEvent)],
        escalated: false,
        context: referencedEvent.slug,
      });
    }

    if (intent === "schedule" || intent === "venue") {
      if (!searchTerm) {
        // "when is the next event" has no subject to look up; listing what is
        // actually on beats parroting "which event do you mean?".
        const upcoming = await findUpcoming(3);
        return reply({
          reply: upcoming.length > 0
            ? `Which event do you mean? Here's what's coming up next:\n\n${upcoming.map(describeEvent).join("\n\n")}`
            : "Which event do you mean? Tell me the event name and I'll check the date and venue for you.",
          cards: upcoming.map(toCard),
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
      const city = extractCity(message);
      const window = listingWindow(message);
      const upcoming = await findUpcoming(5, { city, window });

      const windowLabel = (() => {
        const text = message.toLowerCase();
        if (text.includes("next weekend")) return "next weekend";
        if (text.includes("weekend")) return "this weekend";
        if (text.includes("tomorrow")) return "tomorrow";
        if (text.includes("today") || text.includes("tonight") || text.includes("this night")) return "today";
        if (text.includes("next week")) return "next week";
        if (text.includes("this week")) return "this week";
        return "";
      })();
      const scope = [windowLabel, city ? `in ${city}` : ""].filter(Boolean).join(" ");

      if (upcoming.length === 0) {
        return reply({
          reply: scope
            ? `Nothing is published ${scope} yet. There may still be other events on sale — browse everything at /browse.`
            : "There are no published events on sale right now. Check back soon, or browse everything at /browse.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }
      return reply({
        reply: `Here's what's on${scope ? ` ${scope}` : ""}:\n\n${upcoming.map(describeEvent).join("\n\n")}\n\nSee everything at /browse.`,
        cards: upcoming.map(toCard),
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
      //
      // A signed-in customer gets their own latest order state as well, so
      // "where is my order" is answered from the record instead of a guess.
      const { userId } = await getCaller();
      const known = userId ? await findLatestOrder(userId) : null;
      return reply({
        reply:
          (known ? `${known}\n\n` : "") +
          "Open /my-tickets and enter the email you bought with plus the purchase date to resend only that day's ticket links. Signed-in buyers can also open /tickets. Still nothing? Say \"talk to a person\" and I'll pass it on.",
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    // ---- 7. Everything that needs a human ----
    /** The customer's own open case, so a capped reply can point at it. */
    const findOpenCase = async (): Promise<string | null> => {
      const { userId, email } = await getCaller();
      const contact = email ?? guestEmail;
      if (!userId && !contact) return null;

      let query = supabase
        .from("support_cases")
        .select("case_number")
        .in("status", ["open", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);
      query = userId ? query.eq("customer_id", userId) : query.eq("guest_email", contact);

      const { data, error } = await query.maybeSingle();
      if (error || !data) return null;
      return (data as { case_number: string }).case_number;
    };

    const findKnowledgeAnswer = async () => {
      const { data, error } = await supabase
        .from("support_bot_knowledge")
        .select("id, title, category, content, triggers")
        .eq("active", true)
        .limit(100);
      if (error) {
        console.error("support-bot: knowledge lookup failed", error);
        return null;
      }
      return rankKnowledge(message, (data ?? []) as BotKnowledgeEntry[], intent);
    };

    const runEscalation = async (lead: string, successText?: string) => {
      const caller = await getCaller();
      const outcome = await maybeEscalate({
        supabase, message, intent, sessionId, ip, caller, guestEmail,
        lastEvent: referencedEvent?.slug ?? (contextSlug || null),
      });

      if (outcome.status === "needs_email") {
        return reply({
          needsEmail: true,
          escalated: false,
          reply: `${lead} What email address should they reply to?`,
        });
      }

      if (outcome.status === "capped") {
        // Deliberately does not claim the new question was captured. The old
        // wording said "they have it, there's no need to send it again", which
        // was untrue for a second, different problem — so the customer stopped
        // chasing something nobody had ever seen.
        const openCase = await findOpenCase();
        return reply({
          reply:
            (openCase
              ? `Your case ${openCase} is already with the support team, so someone is on it. I can't open a second case just yet — that keeps the queue moving.\n\n`
              : "I've already passed a message from you to the support team recently, so someone is looking into it. I can't open a second case just yet.\n\n") +
            "If this is a different problem, try again in about an hour, or email " +
            PUBLIC_SUPPORT_ADDRESS +
            " and they'll pick it up straight away.",
          escalated: false,
          context: contextSlug || undefined,
        });
      }

      if (outcome.status === "failed") {
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

      // No receipt is sent to an address we cannot tie to this platform, so the
      // reply says so instead of promising an email that will never arrive.
      const unverifiedNote = outcome.notifiedCustomer
        ? ""
        : `\n\nI couldn't send a receipt to ${caller.email ?? guestEmail} because it isn't linked to an order here. Keep this case number and email us from that address so the team can verify it.`;

      // The case number was fetched and discarded before, so the customer had no
      // reference. Returning later meant starting from zero with nothing to
      // connect the two conversations.
      return reply({
        reply: (outcome.caseNumber
          ? `${confirmation}\n\nYour case number is ${outcome.caseNumber}. Keep it — quoting it gets you a faster answer.`
          : confirmation) + unverifiedNote,
        escalated: true,
        caseNumber: outcome.caseNumber ?? undefined,
        context: contextSlug || undefined,
      });
    };

    if (intent === "ticket_email_change") {
      return runEscalation(
        "For security, a ticket delivered to the wrong checkout email needs the support team to verify the order before it can be reissued.",
        `I've passed this to the support team for verification. Don't send card details, a PIN or an OTP here. They'll confirm the order and the correct delivery address before reissuing the ticket. You can also email ${PUBLIC_SUPPORT_ADDRESS}.`,
      );
    }

    if (intent === "refund") {
      return runEscalation(
        "Refunds aren't automatic — each request is reviewed against the policy first.",
        `${REFUND_POLICY}\n\nI've sent your request to the support team for review, and they'll contact you about the outcome.`,
      );
    }

    // Money has already moved, so this opens a case as well as explaining what
    // the customer should not do (pay again).
    if (intent === "payment_issue") {
      const { userId } = await getCaller();
      const known = userId ? await findLatestOrder(userId) : null;
      return runEscalation(
        "I'm sorry about that — a payment that looks failed can still have left your account, so this needs a person to check it.",
        [known, PAYMENT_ISSUE_GUIDANCE]
          .filter(Boolean)
          .join("\n\n") +
          `\n\nI've passed this to the support team with your message. For anything urgent you can also email ${PUBLIC_SUPPORT_ADDRESS}.`,
      );
    }

    if (intent === "fraud") {
      return runEscalation(
        "Thank you for reporting this — a person needs to look at it, and I'm flagging it as urgent.",
        "I've sent this to the support team as an urgent case. Don't send money to anyone outside TixNaija checkout in the meantime; if you already paid outside the platform, report it to your bank as well.",
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

    const knowledge = intent === "unknown" ? await findKnowledgeAnswer() : null;
    if (knowledge) {
      return reply({
        reply: knowledge.entry.content,
        links: linksForKnowledge(knowledge.entry),
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
  /** False when the customer's address is unverified and no receipt was sent. */
  notifiedCustomer: boolean;
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
  if (!contactEmail) return { status: "needs_email", caseNumber: null, notifiedCustomer: false };

  const ipCap = await consumeLimit(
    supabase, ip, "support_bot_escalation", ESCALATION_WINDOW_MS, IP_MAX_ESCALATIONS, true,
  );
  if (!ipCap.allowed) return { status: "capped", caseNumber: null, notifiedCustomer: false };

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
  if (!emailCap.allowed) return { status: "capped", caseNumber: null, notifiedCustomer: false };

  const result = await escalate(supabase, params);
  return result.ok
    ? {
      status: "escalated",
      caseNumber: result.caseNumber,
      notifiedCustomer: result.notifiedCustomer,
    }
    : { status: "failed", caseNumber: null, notifiedCustomer: false };
}
