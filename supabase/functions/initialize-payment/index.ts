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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req), status: 200 });
  }
  try {
    const { email, metadata } = await req.json();
    if (!email) {
      throw new Error("Email is required");
    }
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      throw new Error("Paystack secret key not configured");
    }

    // Rate Limiting Check
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

    await supabase.from("rate_limit_log").insert({ ip_address: ip, endpoint: "initialize_payment" });

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from("rate_limit_log")
      .select("*", { count: "exact", head: true })
      .eq("ip_address", ip)
      .eq("endpoint", "initialize_payment")
      .gte("created_at", fiveMinsAgo);

    if (countError) {
      console.error("Rate limit check error:", countError);
    } else if (count !== null && count > 10) {
      return new Response(JSON.stringify({ error: "Too many attempts, please wait a moment and try again" }), {
        status: 429,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" }
      });
    }

    const eventId = metadata?.eventId;
    if (!eventId) {
      throw new Error("Event ID is missing from metadata");
    }

    // Fetch organizer's subaccount code
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("organizer_id, start_datetime, end_datetime, status")
      .eq("id", eventId)
      .single();

    if (eventError || !eventData) {
      throw new Error("Event not found");
    }

    if (eventData.status === "cancelled") {
      throw new Error("This event has been cancelled. Tickets are no longer available.");
    }

    if (eventData.status === "completed") {
      throw new Error("This event has ended. Tickets are no longer available for purchase.");
    }

    const start = new Date(eventData.start_datetime);
    const end = eventData.end_datetime ? new Date(eventData.end_datetime) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    if (end < new Date()) {
      throw new Error("This event has ended. Tickets are no longer available for purchase.");
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("paystack_subaccount_code")
      .eq("id", eventData.organizer_id)
      .single();

    if (profileError || !profileData?.paystack_subaccount_code) {
      throw new Error("Organizer payout not configured. Cannot process payment.");
    }

    const subaccount_code = profileData.paystack_subaccount_code;

    const tickets = metadata?.tickets;
    const promoCodeId = metadata?.promoCodeId;

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      throw new Error("Ticket type missing");
    }

    let finalTotalKobo = 0;

    for (const item of tickets) {
      if (!item.ticketTypeId || !item.count) continue;
      const { data: ticketType, error: ttError } = await supabase
        .from("ticket_types")
        .select("price_kobo")
        .eq("id", item.ticketTypeId)
        .single();

      if (ttError || !ticketType) throw new Error("Ticket type not found");
      finalTotalKobo += ticketType.price_kobo * item.count;
    }

    if (promoCodeId) {
       const { data: promo } = await supabase
         .from("promo_codes")
         .select("discount_percentage, active")
         .eq("id", promoCodeId)
         .single();
       if (promo && promo.active) {
          finalTotalKobo = Math.round(finalTotalKobo * (1 - promo.discount_percentage / 100));
       }
    }

    const payload: any = {
      email,
      amount: finalTotalKobo,
      metadata,
      callback_url: `${req.headers.get("origin")}/checkout/verify`,
      subaccount: subaccount_code,
      bearer: "subaccount",
    };

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || "Failed to initialize payment");
    }
    return new Response(JSON.stringify(data.data), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Initialize payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200, // Return 200 so Supabase JS client parses the JSON instead of throwing FunctionsHttpError
    });
  }
});



