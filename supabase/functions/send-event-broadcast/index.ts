import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { broadcastId } = await req.json();
    if (!broadcastId) throw new Error("Missing broadcastId");

    // Fetch broadcast
    const { data: broadcast, error: bErr } = await supabase
      .from("event_broadcasts")
      .select("*, events (title, slug, organizer_id)")
      .eq("id", broadcastId)
      .single();

    if (bErr || !broadcast) throw new Error("Broadcast not found");
    if (broadcast.recipient_count && broadcast.recipient_count > 0) throw new Error("Broadcast already sent");

    // Fetch all unique attendees for this event (successful paid orders)
    const { data: orders, error: oErr } = await supabase
      .from("orders")
      .select("buyer_email, buyer_name")
      .eq("event_id", broadcast.event_id)
      .eq("status", "paid");

    if (oErr) throw new Error("Failed to fetch attendees");

    // De-duplicate emails
    const uniqueAttendees = new Map<string, string>();
    orders.forEach(o => {
      uniqueAttendees.set(o.buyer_email, o.buyer_name || "Attendee");
    });

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("Missing RESEND_API_KEY");

    const eventLink = `https://tixnaija.com/e/${broadcast.events.slug}`;
    let successCount = 0;
    
    // In a production environment, we should batch these or use Resend's batch API.
    // For now, loop through and send individual emails.
    const emails = Array.from(uniqueAttendees.entries());
    
    const batchPayloads = emails.map(([email, name]) => ({
      from: `TixNaija <hello@tixnaija.com>`,
      to: email,
      subject: broadcast.subject,
      html: `
        <div style="font-family: sans-serif; max-w: 600px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="color: #ff6b00;">Update: ${broadcast.events.title}</h2>
          <p>Hi ${name},</p>
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; white-space: pre-wrap;">${broadcast.message}</div>
          <p>Best regards,<br>The ${broadcast.events.title} Team</p>
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 40px 0 20px;" />
          <p style="font-size: 12px; color: #666;">
            You are receiving this email because you bought a ticket to this event on TixNaija.<br>
            <a href="${eventLink}" style="color: #ff6b00; text-decoration: none;">View Event Page</a>
          </p>
        </div>
      `
    }));

    // Resend batch API limit is 100 emails per request.
    const chunkSize = 100;
    for (let i = 0; i < batchPayloads.length; i += chunkSize) {
      const chunk = batchPayloads.slice(i, i + chunkSize);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });
      if (res.ok) {
        successCount += chunk.length;
      } else {
        console.error("Batch failed", await res.text());
      }
    }

    // Mark broadcast as sent
    await supabase
      .from("event_broadcasts")
      .update({
        recipient_count: successCount,
      })
      .eq("id", broadcastId);

    return new Response(JSON.stringify({ success: true, count: successCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
