import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/zeptomail.ts";

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

function getCorsHeaders(req: Request) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.vercel.app",
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
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

    const eventLink = `https://tixnaija.name.ng/e/${broadcast.events.slug}`;
    let successCount = 0;
    
    // In a production environment, we should batch these via ZeptoMail's batch API.
    // For now, loop through and send individual emails since attendee numbers might be small for testing.
    const emails = Array.from(uniqueAttendees.entries());
    
    for (const [email, name] of emails) {
      const htmlBody = `
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
      `;

      try {
        await sendEmail({
          to: { address: email, name },
          subject: broadcast.subject,
          htmlBody,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
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
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 400,
    });
  }
});
