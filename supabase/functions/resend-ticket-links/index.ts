// @ts-nocheck
// Emails a guest their ticket links on demand.
//
// Guests have no account and no access code: the emailed ticket link (order id
// + buyer/recipient email) is the only key. This function is the "I lost the
// email" recovery path used by /my-tickets.
//
// A guest must also supply the calendar day they bought the tickets
// (purchaseDate, YYYY-MM-DD, Nigerian time). Without it, one email address would
// release every ticket that address ever bought — so the page requires it and
// the lookup is narrowed to that single day. Support flows that already know the
// order id are unaffected.
//
// Authorization model: the caller proves nothing but an email address, so the
// response is always generic and the lookup is rate limited per IP and per
// email to prevent inbox spam.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  "https://tixnaija.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://www.tixnaija.name.ng",
  "https://tixnaija.name.ng",
];

function getCorsHeaders(req: Request) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.name.ng",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
  };
}

function jsonResponse(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

/** Escape LIKE wildcards so a crafted email cannot widen the match. */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Narrows an orders query to a single Nigerian calendar day (WAT, UTC+1).
 * The date is interpreted in WAT rather than the caller's timezone so an order
 * placed at 00:30 in Lagos always counts as that day, wherever it is looked up.
 */
function withinPurchaseDay(query: any, dayStart: Date | null) {
  if (!dayStart) return query;
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  return query
    .gte("created_at", dayStart.toISOString())
    .lt("created_at", dayEnd.toISOString());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req), status: 200 });
  }

  try {
    const { email, orderId, purchaseDate } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      return jsonResponse(req, { error: "A valid email address is required." }, 400);
    }

    const rawPurchaseDate = typeof purchaseDate === "string" ? purchaseDate.trim() : "";
    let purchaseDayStart: Date | null = null;
    if (rawPurchaseDate) {
      purchaseDayStart = new Date(`${rawPurchaseDate}T00:00:00+01:00`);
      if (!DATE_PATTERN.test(rawPurchaseDate) || Number.isNaN(purchaseDayStart.getTime())) {
        return jsonResponse(req, { error: "A valid purchase date (YYYY-MM-DD) is required." }, 400);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "",
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const MAX_REQUESTS = 3;

    // A trusted server-to-server caller (the support assistant) is throttled per
    // IP and per session on its own side, and its x-forwarded-for can be rewritten
    // by the gateway. Keeping it in the IP bucket would collapse every caller into
    // one shared counter and stop real resends after three, so only the per-email
    // bucket applies to it.
    const serviceKey =
      (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
    const authorization = req.headers.get("authorization") ?? "";
    const isServiceCall = Boolean(serviceKey) && authorization === `Bearer ${serviceKey}`;

    // Per-IP and per-email throttle. The ip_address column is used as the
    // bucket key in both cases, which keeps a single counter table in play.
    const buckets: [string, string][] = isServiceCall
      ? [["resend_ticket_links_email", normalizedEmail]]
      : [
          ["resend_ticket_links_ip", ip],
          ["resend_ticket_links_email", normalizedEmail],
        ];

    for (const [endpoint, bucketKey] of buckets) {
      const { count, error: countError } = await supabase
        .from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", bucketKey)
        .eq("endpoint", endpoint)
        .gte("created_at", tenMinutesAgo);

      // Fail closed: an unreadable counter must not silently remove the throttle
      // from an endpoint that mails real ticket links to anyone who asks.
      if (countError) {
        console.error("Rate limit read failed:", countError);
        return jsonResponse(
          req,
          { error: "Could not process this request right now. Please try again." },
          503,
        );
      }

      if (typeof count === "number" && count >= MAX_REQUESTS) {
        return jsonResponse(
          req,
          { error: "Too many requests. Please wait a few minutes and try again." },
          429,
        );
      }

      const { error: logError } = await supabase
        .from("rate_limit_log")
        .insert({ ip_address: bucketKey, endpoint });

      if (logError) {
        console.error("Rate limit write failed:", logError);
        return jsonResponse(
          req,
          { error: "Could not process this request right now. Please try again." },
          503,
        );
      }
    }

    const pattern = escapeLike(normalizedEmail);
    const statuses = ["paid", "comp"];

    const [asBuyer, asRecipient] = await Promise.all([
      withinPurchaseDay(
        supabase
          .from("orders")
          .select("id")
          .in("status", statuses)
          .ilike("buyer_email", pattern),
        purchaseDayStart,
      )
        .order("created_at", { ascending: false })
        .limit(10),
      withinPurchaseDay(
        supabase
          .from("orders")
          .select("id")
          .in("status", statuses)
          .ilike("recipient_email", pattern),
        purchaseDayStart,
      )
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    if (asBuyer.error || asRecipient.error) {
      console.error("Order lookup failed:", asBuyer.error || asRecipient.error);
      return jsonResponse(req, { error: "Could not look up your orders right now." }, 500);
    }

    const orderIds = Array.from(
      new Set([...(asBuyer.data ?? []), ...(asRecipient.data ?? [])].map((order: any) => order.id)),
    ).filter((id) => (orderId ? id === orderId : true)).slice(0, 10);

    // Never reveal whether the email matched any order.
    if (orderIds.length === 0) {
      return jsonResponse(req, { ok: true, sent: 0 });
    }

    const results = await Promise.allSettled(
      orderIds.map((id) =>
        supabase.functions.invoke("send-ticket-confirmation", { body: { orderId: id } }),
      ),
    );

    // invoke() resolves with { error } on non-2xx instead of rejecting, so
    // failed sends have to be detected from the resolved value too. Counting
    // rejections alone reported 400/403 responses as successful sends.
    const failures = results.filter(
      (result) =>
        result.status === "rejected" ||
        Boolean((result as PromiseFulfilledResult<any>).value?.error),
    );
    if (failures.length > 0) {
      console.error(
        `Ticket email failed for ${failures.length} of ${orderIds.length} orders`,
        failures,
      );
    }

    return jsonResponse(req, { ok: true, sent: orderIds.length - failures.length });
  } catch (error: any) {
    console.error("Resend ticket links error:", error);
    return jsonResponse(req, { error: error?.message || "Unknown error" }, 400);
  }
});
