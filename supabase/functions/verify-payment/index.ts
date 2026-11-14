// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  "https://tixnaija.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://www.tixnaija.name.ng",
  "https://tixnaija.name.ng"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tixnaija.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function getCorsHeaders(req) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.vercel.app",
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HMAC-SHA512 hex digest using the Web Crypto API (Deno-compatible). */
async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Shared checkout processing
// ---------------------------------------------------------------------------

async function processVerifiedPayment(
  reference: string,
  amountPaid: number,
  metadata: any,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Block past / cancelled events
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("start_datetime, end_datetime, status")
    .eq("id", metadata.eventId)
    .single();

  if (eventError || !eventData) throw new Error("Event not found");
  if (eventData.status === "cancelled") {
    throw new Error("This event has been cancelled. Tickets are no longer available.");
  }

  if (eventData.status === "completed") {
    throw new Error("This event has ended. Tickets are no longer available for purchase.");
  }

  const start = new Date(eventData.start_datetime);
  const end = eventData.end_datetime
    ? new Date(eventData.end_datetime)
    : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (end < new Date()) {
    throw new Error("This event has ended. Tickets are no longer available for purchase.");
  }

  // Idempotency — skip if order already exists for this reference
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_reference", reference)
    .maybeSingle();

  if (existingOrder) {
    return { order_id: existingOrder.id, already_existed: true };
  }

  // Process checkout via RPC
  const { data: orderId, error: checkoutError } = await supabase.rpc(
    "process_checkout",
    {
      p_event_id: metadata.eventId,
      p_user_id: metadata.userId || null,
      p_buyer_name: metadata.buyerName,
      p_buyer_email: metadata.buyerEmail,
      p_buyer_phone: metadata.buyerPhone || null,
      p_tickets: metadata.tickets,
      p_amount_paid: amountPaid,
      p_payment_reference: reference,
      p_promo_code_id: metadata.promoCodeId || null,
      p_is_gift: metadata.isGift || false,
      p_recipient_name: metadata.recipientName || null,
      p_recipient_email: metadata.recipientEmail || null,
      p_gift_message: metadata.giftMessage || null,
      p_promoter_link_id: metadata.promoterLinkId || null,
      p_checkout_answers: metadata.checkoutAnswers || null,
    },
  );

  if (checkoutError) {
    console.error("Supabase checkout error:", checkoutError);
    throw new Error(`Database error: ${checkoutError.message}`);
  }

  // Send ticket confirmation email (fire-and-forget).
  //
  // functions.invoke() resolves with { error } for non-2xx responses instead of
  // rejecting, so a .catch() alone never fires — every failure has to be
  // inspected or it is lost silently.
  supabase.functions
    .invoke("send-ticket-confirmation", { body: { orderId } })
    .then(({ error }: any) => {
      if (error) console.error("Ticket confirmation email failed:", error);
    })
    .catch((e: any) => console.error("Ticket confirmation email failed:", e));

  return { order_id: orderId, already_existed: false };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req), status: 200 });
  }

  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!paystackSecret) {
    return new Response(
      JSON.stringify({ error: "Paystack secret key not configured" }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 500 },
    );
  }

  const paystackSignature = req.headers.get("x-paystack-signature");

  try {
    // -----------------------------------------------------------------------
    // MODE A — Paystack Webhook (x-paystack-signature present)
    // Paystack POSTs the full event payload directly.
    // We MUST verify the HMAC-SHA512 signature before trusting the body.
    // -----------------------------------------------------------------------
    if (paystackSignature) {
      const rawBody = await req.text();

      // Verify HMAC-SHA512 signature
      const expectedHash = await hmacSha512Hex(paystackSecret, rawBody);
      if (!timingSafeEqual(expectedHash, paystackSignature)) {
        console.error("Webhook signature mismatch — rejecting request");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 401,
        });
      }

      const event = JSON.parse(rawBody);

      // Only process successful charges
      if (event.event !== "charge.success") {
        return new Response(JSON.stringify({ message: "Event ignored" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        });
      }

      const txData = event.data;
      if (!txData || txData.status !== "success") {
        return new Response(JSON.stringify({ error: "Transaction not successful" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 200,
        });
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Record charge event into payment_events
      try {
        await supabase.from("payment_events").upsert(
          {
            reference: txData.reference,
            event_type: event.event,
            amount_kobo: txData.amount,
            customer_email: txData.customer?.email || null,
            channel: txData.channel || null,
            status: txData.status,
            metadata: txData.metadata || null,
            raw_payload: event,
          },
          { onConflict: "reference,event_type" }
        );
      } catch (logErr) {
        console.error("Failed to persist payment_event:", logErr);
      }

      const metadata = txData.metadata;
      if (!metadata || !metadata.eventId || !metadata.tickets) {
        return new Response(
          JSON.stringify({ error: "Missing order metadata in webhook payload" }),
          { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }, status: 200 },
        );
      }

      const result = await processVerifiedPayment(
        txData.reference,
        txData.amount,
        metadata,
      );

      // Link matched order ID in payment_events
      if (result && result.order_id) {
        await supabase
          .from("payment_events")
          .update({ matched_order_id: result.order_id })
          .eq("reference", txData.reference)
          .eq("event_type", event.event);
      }

      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    // -----------------------------------------------------------------------
    // MODE B — Client-side verification (no signature header)
    // The browser redirects back with a reference; we call Paystack's
    // verify API to confirm the payment is genuine.
    // -----------------------------------------------------------------------
    const { reference } = await req.json();
    if (!reference) {
      throw new Error("Payment reference is required");
    }

    // Verify with Paystack API
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${paystackSecret}` },
      },
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      throw new Error("Payment verification failed");
    }

    const metadata = verifyData.data.metadata;
    if (!metadata || !metadata.eventId || !metadata.tickets) {
      throw new Error("Missing order metadata in payment");
    }

    // -----------------------------------------------------------------------
    // Authorization for Mode B. A reference alone must not be enough to trigger
    // fulfilment, because this path runs with the service role:
    //   • Signed-in orders (metadata.userId) require a valid Supabase JWT that
    //     belongs to exactly that user.
    //   • Guest orders have no session to prove (guest checkout is anonymous), so
    //     they are accepted only once Paystack has confirmed the charge above,
    //     and are throttled per IP to make reference guessing impractical.
    // -----------------------------------------------------------------------
    const modeBSupabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

    if (metadata.userId) {
      const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
      const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")) ?? "";

      if (!token || !anonKey) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 401,
        });
      }

      const authClient = createClient(modeBSupabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const {
        data: { user },
        error: authError,
      } = await authClient.auth.getUser(token);

      if (authError || !user || user.id !== metadata.userId) {
        console.error("Verify payment rejected: caller does not own this order", {
          reference,
          expected: metadata.userId,
          actual: user?.id ?? null,
        });
        return new Response(
          JSON.stringify({ error: "You are not authorized to verify this payment" }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            status: 403,
          },
        );
      }
    } else {
      const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      const limitClient = createClient(
        modeBSupabaseUrl,
        (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "",
      );

      // Fail closed: if the counter cannot be written, do not serve the request.
      const { error: logError } = await limitClient
        .from("rate_limit_log")
        .insert({ ip_address: ipAddress, endpoint: "verify_payment_guest" });

      if (logError) {
        console.error("Guest verify rate-limit write failed:", logError);
        return new Response(
          JSON.stringify({ error: "Could not verify this payment right now. Please try again." }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            status: 503,
          },
        );
      }

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count, error: countError } = await limitClient
        .from("rate_limit_log")
        .select("*", { count: "exact", head: true })
        .eq("ip_address", ipAddress)
        .eq("endpoint", "verify_payment_guest")
        .gte("created_at", tenMinutesAgo);

      if (countError) {
        console.error("Guest verify rate-limit read failed:", countError);
        return new Response(
          JSON.stringify({ error: "Could not verify this payment right now. Please try again." }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            status: 503,
          },
        );
      }

      if (typeof count === "number" && count > 20) {
        return new Response(
          JSON.stringify({ error: "Too many verification attempts. Please try again later." }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            status: 429,
          },
        );
      }
    }

    const result = await processVerifiedPayment(
      reference,
      verifyData.data.amount,
      metadata,
    );

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Verify payment error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});



