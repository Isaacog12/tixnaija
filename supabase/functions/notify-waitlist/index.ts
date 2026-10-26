// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { sendEmail } from "../_shared/zeptomail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    // 1. Authorize caller: Must be organizer of this event or platform admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRole = token === serviceKey;
    const isInternalTrigger = token === anonKey;
    let isAuthorized = isServiceRole || isInternalTrigger;

    const supabaseClient = createClient(supabaseUrl, serviceKey);

    const { ticket_tier_id } = await req.json();
    if (!ticket_tier_id) {
      throw new Error("ticket_tier_id is required");
    }

    // 2. Get the ticket tier info (available vs sold vs cancelled) and event organizer
    const { data: tier, error: tierError } = await supabaseClient
      .from("ticket_types")
      .select("*, events(title, slug, organizer_id)")
      .eq("id", ticket_tier_id)
      .single();

    if (tierError || !tier) throw new Error("Tier not found");

    if (!isAuthorized) {
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });
      const { data: { user }, error: authErr } = await authClient.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check organizer or admin role
      const { data: adminRole } = await supabaseClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isOrganizer = tier.events?.organizer_id === user.id;
      if (!isOrganizer && !adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: You are not authorized to notify this waitlist" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const isOrganizer = tier.events?.organizer_id === user.id;
    if (!adminRole && !isOrganizer) {
      return new Response(JSON.stringify({ error: "Forbidden: You are not authorized to notify waitlists for this event" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const availableSpots = tier.quantity_available - (tier.quantity_sold - (tier.quantity_cancelled || 0));

    if (availableSpots <= 0) {
      return new Response(
        JSON.stringify({ message: "No available spots, ignoring." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch up to 'availableSpots' people from the waitlist
    const { data: waitlisters, error: waitlistError } = await supabaseClient
      .from("waitlist_entries")
      .select("*")
      .eq("ticket_tier_id", ticket_tier_id)
      .eq("status", "waiting")
      .order("created_at", { ascending: true })
      .limit(availableSpots);

    if (waitlistError) throw waitlistError;

    if (!waitlisters || waitlisters.length === 0) {
      return new Response(
        JSON.stringify({ message: "No one on waitlist." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let notifiedCount = 0;

    for (const person of waitlisters) {
      const eventUrl = `https://tixnaija.name.ng/e/${tier.events.slug}`;
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; padding: 20px;">
          <h2 style="color: #ea580c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Good news, ${person.name}!</h2>
          <p style="font-size: 15px; color: #333333; line-height: 1.5;">A ticket for <strong>${tier.events.title}</strong> (${tier.name}) has just become available.</p>
          <p style="font-size: 15px; color: #333333; line-height: 1.5;">Please claim it before it sells out again!</p>
          <div style="margin: 28px 0;">
            <a href="${eventUrl}" style="display: inline-block; padding: 14px 28px; background: #ea580c; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
              Get Ticket Now
            </a>
          </div>
          <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 28px 0 16px;" />
          <p style="font-size: 12px; color: #6b7280; margin: 0 0 6px;">
            You received this email because you joined the waitlist for this event on TixNaija.
          </p>
          <p style="font-size: 11px; color: #9ca3af; margin: 0;">
            TixNaija · Independent Nigerian Ticketing Platform · <a href="https://tixnaija.name.ng/privacy" style="color: #6b7280; text-decoration: underline;">Privacy Policy</a>
          </p>
        </div>
      `;

      try {
        await sendEmail({
          to: { address: person.email, name: person.name },
          subject: `Tickets are available for ${tier.events.title}!`,
          htmlBody,
        });

        // Update their status
        await supabaseClient
          .from("waitlist_entries")
          .update({ status: "notified" })
          .eq("id", person.id);

        notifiedCount++;
      } catch (sendErr) {
        console.error(`Failed to send waitlist email to ${person.email}:`, sendErr);
      }
    }

    return new Response(
      JSON.stringify({ message: `Notified ${notifiedCount} people.`, count: notifiedCount }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
