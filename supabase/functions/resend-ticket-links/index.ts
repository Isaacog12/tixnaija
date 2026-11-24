// @ts-nocheck
// Emails a guest their ticket links on demand.
//
// Guests have no account and no access code: the emailed ticket link (order id
// + buyer/recipient email) is the only key. This function is the "I lost the
// email" recovery path used by /my-tickets.
//
// Every recovery email this function causes is addressed to the person who
// asked: buyers, gift recipients, and attendee-only inboxes receive only their
// own delivery. Explicit order-id checkout delivery still reaches each attendee.
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
import { isDeliverableEmail } from "../_shared/email-delivery.ts";

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
    const requestedOrderId = typeof orderId === "string" ? orderId.trim() : "";

    if (!isDeliverableEmail(normalizedEmail)) {
      return jsonResponse(req, { error: "A valid email address is required." }, 400);
    }

    const rawPurchaseDate = typeof purchaseDate === "string" ? purchaseDate.trim() : "";
    if (!requestedOrderId && !rawPurchaseDate) {
      return jsonResponse(req, { error: "A purchase date (YYYY-MM-DD) is required." }, 400);
    }
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

    // Per-IP and per-email throttle. The ip_address column is used as the
    // bucket key in both cases, which keeps a single counter table in play.
    //
    // The email bucket is the real anti-spam guard: it decides whether an inbox
    // can be mailed again. The IP bucket only stops one connection sweeping many
    // addresses, so it has to stay loose. Most Nigerian mobile networks put
    // thousands of subscribers behind a single CGNAT address, and a cap of 3 per
    // IP locked out innocent people — including whoever was retrying a broken
    // lookup three times while debugging it.
    const buckets: Array<{ endpoint: string; key: string; max: number }> = [
      { endpoint: "resend_ticket_links_ip", key: ip, max: 20 },
      { endpoint: "resend_ticket_links_email", key: normalizedEmail, max: 5 },
    ];

    for (const { endpoint, key: bucketKey, max } of buckets) {
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

      if (typeof count === "number" && count >= max) {
        return jsonResponse(
          req,
          {
            error:
              "This address has asked for its ticket email several times in the last few minutes. Please wait 10 minutes, then try again.",
          },
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
          .select("id, access_code")
          .in("status", statuses)
          .ilike("buyer_email", pattern),
        purchaseDayStart,
      )
        .order("created_at", { ascending: false })
        .limit(10),
      withinPurchaseDay(
        supabase
          .from("orders")
          .select("id, access_code")
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

    /*
     * Orders whose tickets were assigned to this address.
     *
     * A ticket belongs to an order through order_items (tickets.order_item_id),
     * never directly, and PostgREST cannot filter orders on an embedded path
     * that is not in the select list. Filtering `order_items.tickets.attendee_email`
     * therefore failed the whole lookup, so *every* request — including a plain
     * buyer's — returned a 500 and the page could only show "Edge Function
     * returned a non-2xx status code". Attendee matches are resolved in explicit
     * steps now, and a failure here cannot take the buyer/recipient lookups down
     * with it.
     */
    let attendeeOrders: any[] = [];
    let attendeeLookupFailed = false;

    const attendeeTickets = await supabase
      .from("tickets")
      .select("order_item_id")
      .ilike("attendee_email", pattern)
      .limit(50);

    if (attendeeTickets.error) {
      console.error("Attendee ticket lookup failed:", attendeeTickets.error);
      attendeeLookupFailed = true;
    } else {
      const orderItemIds = Array.from(
        new Set((attendeeTickets.data ?? []).map((ticket: any) => ticket.order_item_id)),
      ).filter(Boolean);

      if (orderItemIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select("order_id")
          .in("id", orderItemIds);

        if (itemsError) {
          console.error("Attendee order item lookup failed:", itemsError);
          attendeeLookupFailed = true;
        } else {
          const candidateIds = Array.from(
            new Set((items ?? []).map((item: any) => item.order_id)),
          ).filter(Boolean);

          if (candidateIds.length > 0) {
            const { data: matched, error: matchedError } = await withinPurchaseDay(
              supabase
                .from("orders")
                .select("id, access_code")
                .in("status", statuses)
                .in("id", candidateIds),
              purchaseDayStart,
            ).limit(10);

            if (matchedError) {
              console.error("Attendee order lookup failed:", matchedError);
              attendeeLookupFailed = true;
            } else {
              attendeeOrders = matched ?? [];
            }
          }
        }
      }
    }

    const matchedOrders = [
      ...(asBuyer.data ?? []),
      ...(asRecipient.data ?? []),
      ...attendeeOrders,
    ] as any[];

    // Each order's own access code is passed along to send-ticket-confirmation.
    // The call already proves ownership of the address, and a guest access code
    // keeps it authorized even if the gateway ever refuses the service-role
    // header — which silently turned every recovery into "couldn't email them"
    // while the receipt had in fact been sent.
    const accessCodeById = new Map<string, string>();
    for (const order of matchedOrders) {
      if (order?.id) accessCodeById.set(order.id, order.access_code ?? "");
    }

    const orderIds = Array.from(new Set(matchedOrders.map((order) => order.id)))
      .filter((id) => (requestedOrderId ? id === requestedOrderId : true))
      .slice(0, 10);

    // Name the two things a guest gets wrong — the address and the day — instead
    // of reporting a send that never happened. A generic "sent" with an empty
    // inbox was indistinguishable from a broken function.
    if (orderIds.length === 0) {
      return jsonResponse(
        req,
        {
          error: attendeeLookupFailed
            ? "We couldn't check your tickets right now. Please try again in a minute."
            : "No tickets found for that email on this date. Check the address you paid with and the day you bought them.",
        },
        attendeeLookupFailed ? 500 : 404,
      );
    }

    const requestId = crypto.randomUUID();
    const results = await Promise.allSettled(
      orderIds.map((id) =>
        supabase.functions.invoke("send-ticket-confirmation", {
          // A recovery request (no orderId from the caller) mails only the
          // requesting address. First delivery from checkout supplies orderId
          // and keeps sending each attendee their own ticket.
          body: requestedOrderId
            ? { orderId: id, accessCode: accessCodeById.get(id), requestId }
            : {
                orderId: id,
                accessCode: accessCodeById.get(id),
                onlyEmail: normalizedEmail,
                requestId,
              },
        }),
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

      // invoke() hides the function's own message behind "Edge Function returned
      // a non-2xx status code", which is why this looked like a mail outage with
      // no cause. Log the status and body of each failure instead.
      for (const failure of failures) {
        if (failure.status === "rejected") {
          console.error("send-ticket-confirmation request failed:", failure.reason);
          continue;
        }
        const invokeError = (failure as PromiseFulfilledResult<any>).value?.error;
        const context = invokeError?.context as Response | undefined;
        let body = "";
        try {
          body = context ? await context.clone().text() : "";
        } catch {
          body = "unreadable response body";
        }
        console.error(
          "send-ticket-confirmation returned an error:",
          context?.status,
          invokeError?.message,
          body,
        );
      }
    }

    const sent = results.reduce((total, result) => {
      if (result.status === "rejected") return total;
      const value = result.value;
      if (value?.error) return total;
      const count = Number(value?.data?.sent);
      return total + (Number.isFinite(count) && count > 0 ? count : 0);
    }, 0);

    // The order exists, so reporting "sent" here would be a lie: say the mail
    // failed and let the guest retry or reach support.
    if (sent === 0) {
      return jsonResponse(
        req,
        {
          error:
            "We found your tickets but couldn't email them. Please try again in a few minutes, or contact support.",
          // Kept out of the page copy but logged by the client, so the next
          // failure names its cause without another deploy.
          detail: failures.map((failure) => {
            if (failure.status === "rejected") return String(failure.reason ?? "request failed");
            const value = (failure as PromiseFulfilledResult<any>).value;
            return String(value?.error?.message ?? "unknown error");
          }),
        },
        502,
      );
    }

    return jsonResponse(req, { ok: true, sent });
  } catch (error: any) {
    console.error("Resend ticket links error:", error);
    return jsonResponse(req, { error: error?.message || "Unknown error" }, 400);
  }
});
