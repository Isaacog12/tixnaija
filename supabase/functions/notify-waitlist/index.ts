import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { ticket_tier_id } = await req.json();

    if (!ticket_tier_id) {
      throw new Error("ticket_tier_id is required");
    }

    // 1. Get the ticket tier info (available vs sold vs cancelled)
    const { data: tier, error: tierError } = await supabaseClient
      .from("ticket_types")
      .select("*, events(title, slug)")
      .eq("id", ticket_tier_id)
      .single();

    if (tierError || !tier) throw new Error("Tier not found");

    const availableSpots = tier.quantity_available - (tier.quantity_sold - tier.quantity_cancelled);

    if (availableSpots <= 0) {
      return new Response(
        JSON.stringify({ message: "No available spots, ignoring." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch up to 'availableSpots' people from the waitlist
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

    // 3. Send emails using Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const resend = new Resend(RESEND_API_KEY);

    for (const person of waitlisters) {
      const eventUrl = `https://tixnaija.com/e/${tier.events.slug}`;
      const html = `
        <div style="font-family: sans-serif; max-w-lg mx-auto">
          <h2>Good news, ${person.name}!</h2>
          <p>A ticket for <strong>${tier.events.title}</strong> (${tier.name}) has become available.</p>
          <p>Please claim it before it sells out again!</p>
          <a href="${eventUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 6px;">
            Get Ticket Now
          </a>
        </div>
      `;

      if (RESEND_API_KEY) {
        await resend.emails.send({
          from: "TixNaija Waitlist <hello@updates.tixnaija.com>",
          to: [person.email],
          subject: `Tickets are available for ${tier.events.title}!`,
          html,
        });
      } else {
        console.log("Would send email to", person.email, "but RESEND_API_KEY is not set.");
      }

      // Update their status
      await supabaseClient
        .from("waitlist_entries")
        .update({ status: "notified" })
        .eq("id", person.id);
    }

    return new Response(
      JSON.stringify({ message: `Notified ${waitlisters.length} people.` }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
