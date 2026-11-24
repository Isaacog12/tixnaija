// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { deliverOrderTickets, fetchOrderForDelivery } from "../_shared/ticket-delivery.ts";

const allowedOrigins = [
  "https://www.tixnaija.name.ng",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://tixnaija.name.ng"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://www.tixnaija.name.ng",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function getCorsHeaders(req: Request) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://www.tixnaija.name.ng",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { orderId, ticketId, accessCode, onlyEmail, ifUndelivered } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    // @ts-ignore
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    // @ts-ignore
    const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
    // @ts-ignore
    const supabaseAnonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")) || supabaseKey;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { order, error: orderError } = await fetchOrderForDelivery(supabase, orderId);
    if (orderError || !order) throw new Error("Order not found");

    // Authorization & Ownership Verification:
    // 1. service_role (backend tasks, and the resend helper, which sends in-process)
    // 2. The buyer who owns the order (order.user_id === user.id, or the same email)
    // 3. The event organizer
    // 4. Platform staff (admin, customer_care)
    // 5. Valid order accessCode / payment reference (guest order viewers)
    const authHeader = req.headers.get("Authorization");
    const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "").trim() : null;
    const isServiceRole = Boolean(token && token === supabaseKey);

    let isBuyer = false;
    let isOrganizer = false;
    let isStaff = false;

    if (token && !isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) {
        if (order.user_id && order.user_id === user.id) {
          isBuyer = true;
        } else if (user.email && user.email.toLowerCase() === order.buyer_email?.toLowerCase()) {
          isBuyer = true;
        }

        if (order.events?.organizer_id && order.events.organizer_id === user.id) {
          isOrganizer = true;
        }

        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["admin", "customer_care"])
          .maybeSingle();
        if (roleRow) {
          isStaff = true;
        }
      }
    }

    const normalizedAccessCode = (accessCode || "").trim().toUpperCase();
    const isGuestAuthorized = Boolean(
      normalizedAccessCode && (
        (order.access_code && order.access_code.toUpperCase() === normalizedAccessCode) ||
        (order.payment_reference && order.payment_reference.toUpperCase() === normalizedAccessCode)
      )
    );

    const isAuthorized = isServiceRole || isBuyer || isOrganizer || isStaff || isGuestAuthorized;
    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Forbidden: You are not authorized to send confirmation for this order." }),
        { headers: getCorsHeaders(req), status: 403 }
      );
    }

    // Rate limit resend requests (max 5 per 10 minutes per order)
    if (!isServiceRole) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("endpoint", `resend_order_${order.id}`)
        .gte("created_at", tenMinutesAgo);

      if (count && count >= 5) {
        return new Response(
          JSON.stringify({ error: "Too many email requests for this order. Please wait a few minutes." }),
          { headers: getCorsHeaders(req), status: 429 }
        );
      }

      await supabase.from("rate_limit_log").insert({
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        endpoint: `resend_order_${order.id}`,
      });
    }

    // Delivery runs in this isolate, so the count below is what actually left.
    // A recipient that fails is reported without discarding the emails that
    // already went out — that was the bug that reported "couldn't email them"
    // for a receipt the buyer was holding.
    const { sent, skipped, failures } = await deliverOrderTickets(order, {
      ticketId,
      onlyEmail,
      ifUndelivered: Boolean(ifUndelivered),
      supabase,
    });

    // A checkout hand-off that lost the race to verify-payment has nothing left
    // to mail. That is success, not a failure — it is how the duplicate stops.
    if (sent === 0 && skipped > 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped, alreadyDelivered: true }),
        { headers: getCorsHeaders(req), status: 200 }
      );
    }

    if (sent === 0) {
      return new Response(
        JSON.stringify({
          error: failures[0]
            ? `Ticket email could not be sent. ${failures[0]}`
            : "There was no ticket email to send for this order.",
          sent: 0,
        }),
        { headers: getCorsHeaders(req), status: 502 }
      );
    }

    if (failures.length > 0) {
      console.error(`Ticket delivery sent ${sent}, failed ${failures.length}:`, failures);
    }

    return new Response(
      JSON.stringify({ success: true, sent, failed: failures.length }),
      { headers: getCorsHeaders(req), status: 200 }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: getCorsHeaders(req), status: 400 });
  }
});
