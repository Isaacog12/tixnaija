// @ts-nocheck
// Emails a guest their ticket links on demand.
//
// Guests have no account and no access code: the emailed ticket link (order id
// + buyer/recipient email) is the only key. This function is the "I lost the
// email" recovery path used by /my-tickets.
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req), status: 200 });
  }

  try {
    const { email, orderId } = await req.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
      return jsonResponse(req, { error: "A valid email address is required." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "",
    );

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const MAX_REQUESTS = 3;

    // Per-IP and per-email throttle. The ip_address column is used as the
    // bucket key in both cases, which keeps a single counter table in play.
    for (const [endpoint, bucketKey] of [
      ["resend_ticket_links_ip", ip],
      ["resend_ticket_links_email", normalizedEmail],
    ]) {
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
      supabase
        .from("orders")
        .select("id")
        .in("status", statuses)
        .ilike("buyer_email", pattern)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("orders")
        .select("id")
        .in("status", statuses)
        .ilike("recipient_email", pattern)
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
