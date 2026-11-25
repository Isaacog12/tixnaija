// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  containsSensitiveData,
  detectIntent,
  extractCity,
  extractSearchTerm,
  listingWindow,
  looksSubstantive,
  orderStatusGuidance,
  SENSITIVE_REFUSAL,
  type Intent,
} from "../_shared/support-brain.ts";

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

// Guidance quoted from the app's own screens. These answers exist so a plain
// policy question never has to open a support case — the previous handler had no
// branch for them, so "what is your refund policy" escalated to a human.
const ENTRY_GUIDANCE =
  "Show the live QR code at the gate: open /tickets in your account, or the ticket email itself. Turn your screen brightness up and don't show a screenshot — gate staff scan the live code.\n\nIf it still won't scan, staff can check you in manually — show them your order reference or the purchase email. If you were already turned away, say \"talk to a person\" and I'll escalate it with your details.";

const EMAIL_CONFIRMATION_GUIDANCE =
  "That \"not sent\" line means our email provider didn't confirm delivery of that message — it does not mean your ticket is invalid or gone. Your order still stands.\n\nCheck the spam/junk folder for the address you paid with, then open /my-tickets, enter that email and the purchase date, and resend only that day's links. If it still doesn't arrive, say \"talk to a person\" and I'll pass it on.";

const TECHNICAL_GUIDANCE =
  "Most of these clear up with three steps:\n\n1. Hard-refresh the page (Ctrl+Shift+R, or pull down to reload on a phone).\n2. Try another browser, or the Android app at /download.\n3. Turn off any ad-blocker or data-saver on the checkout page.\n\nIf checkout failed, don't pay a second time — check your bank alert, then look the order up at /my-tickets. Still broken? Tell me the page and what you clicked, and I'll pass it to the team.";

const ACCOUNT_DELETE_GUIDANCE =
  "You can do it yourself: open /account, go to Security, choose Delete account and type DELETE to confirm. That removes your profile and personal data and signs you out.\n\nIf you organize events, delete or hand over those first — deletion is blocked while any event is still under your account. Want the team to do it instead? Say \"talk to a person\".";

const EMAIL_CHANGE_GUIDANCE =
  "The email on your account is read-only in /account, so the form can't change it. Sign in and ask the support team to move it — they verify the current address first so nobody can take over an account.\n\nIf you bought as a guest with a different address, /my-tickets still works with the email you paid with.";

const TRUST_GUIDANCE =
  "Every event on TixNaija is published by a signed-in organizer, and the event page shows who they are. Before you pay:\n\n- Check the organizer's name and their other events.\n- Read the refund terms on the event page.\n- Pay only through TixNaija checkout — never to a personal account or a DM.\n\nIf something looks off, send me the event name and I'll have the team check it.";

const PAYMENT_ISSUE_GUIDANCE =
  "Please don't pay again while this is open — a second payment creates a second order.\n\nBank transfers can take 2–10 minutes to show as confirmed. Check the order at /my-tickets with the email and date you paid, and check your bank alert: if the money left your account, a failed order is not proof of no debit, so the team has to reconcile it rather than treat it as unpaid.";

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

/** Escapes LIKE wildcards so a customer cannot broaden the search. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
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
        if (text.includes("weekend")) return "this weekend";
        if (text.includes("today") || text.includes("tonight")) return "today";
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

    // Policy and how-to answers. Each of these intents was detected by the
    // shared brain and then had no branch here, so a question the assistant
    // knew the answer to was escalated as "I don't have an answer for that one".
    if (intent === "refund_policy") {
      return reply({
        reply: REFUND_POLICY,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "entry") {
      return reply({
        reply: ENTRY_GUIDANCE,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "delivery_confirmation") {
      return reply({
        reply: EMAIL_CONFIRMATION_GUIDANCE,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "technical") {
      return reply({
        reply: TECHNICAL_GUIDANCE,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "account_delete") {
      return reply({
        reply: ACCOUNT_DELETE_GUIDANCE,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "email_change") {
      return reply({
        reply: EMAIL_CHANGE_GUIDANCE,
        escalated: false,
        context: contextSlug || undefined,
      });
    }

    if (intent === "trust") {
      return reply({
        reply: TRUST_GUIDANCE,
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
      const known = caller.userId ? await findLatestOrder(caller.userId) : null;
      return reply({
        reply:
          (known ? `${known}\n\n` : "") +
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

    // Money has already moved, so this opens a case as well as explaining what
    // the customer should not do (pay again).
    if (intent === "payment_issue") {
      const known = caller.userId ? await findLatestOrder(caller.userId) : null;
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
