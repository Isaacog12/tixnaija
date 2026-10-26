import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/zeptomail.ts";
import { filterOptedInEmails } from "../_shared/notification-preferences.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe.ts";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;

    // 1. Verify caller session
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

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

    // 2. Authorize: Caller must be the event organizer or an admin
    const { data: adminRole } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isOrganizer = broadcast.organizer_id === user.id || broadcast.events?.organizer_id === user.id;
    if (!adminRole && !isOrganizer) {
      return new Response(JSON.stringify({ error: "Forbidden: You are not authorized to send broadcasts for this event" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

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
      if (o.buyer_email) {
        uniqueAttendees.set(o.buyer_email.trim().toLowerCase(), o.buyer_name || "Attendee");
      }
    });

    const candidateEmails = Array.from(uniqueAttendees.keys());
    if (candidateEmails.length === 0) {
      return new Response(JSON.stringify({ success: true, count: 0, message: "No attendees found" }), {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Filter attendees who opted in for organizer_updates (default: true)
    const optedInEmails = await filterOptedInEmails(supabase, candidateEmails, "organizer_updates");

    const eventLink = `https://tixnaija.name.ng/e/${broadcast.events?.slug || ""}`;
    let successCount = 0;
    let optedOutCount = 0;
    
    for (const [email, name] of uniqueAttendees.entries()) {
      if (!optedInEmails.has(email)) {
        console.log(`[OPT-OUT] Skipping organizer broadcast for ${email} (user opted out of organizer_updates)`);
        optedOutCount++;
        continue;
      }

      const unsubToken = await generateUnsubscribeToken(email, "organizer_updates");
      const unsubUrl = `https://tixnaija.name.ng/unsubscribe?email=${encodeURIComponent(email)}&type=organizer_updates&token=${unsubToken}`;

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a; padding: 20px;">
          <h2 style="color: #ea580c; font-size: 20px; font-weight: 700; margin-bottom: 12px;">Update: ${broadcast.events?.title || "Event Announcement"}</h2>
          <p style="font-size: 15px; color: #333333; line-height: 1.5;">Hi ${name},</p>
          <div style="background-color: #f4f4f5; padding: 20px; border-radius: 12px; margin: 20px 0; white-space: pre-wrap; font-size: 15px; line-height: 1.6; border: 1px solid #e4e4e7;">${broadcast.message}</div>
          <p style="font-size: 15px; color: #333333; line-height: 1.5;">Best regards,<br><strong>The ${broadcast.events?.title || "Event"} Team</strong></p>
          <hr style="border: 0; border-top: 1px solid #e4e4e7; margin: 32px 0 20px;" />
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #71717a; margin-bottom: 8px;">
              You received this update because you bought a ticket to this event on TixNaija.<br>
              <a href="${eventLink}" style="color: #ea580c; text-decoration: underline;">View Event Page</a>
            </p>
            <p style="font-size: 12px; color: #71717a; margin-bottom: 12px;">
              <a href="${unsubUrl}" style="color: #ea580c; text-decoration: underline;">Unsubscribe from event updates</a> · <a href="https://tixnaija.name.ng/account?tab=notifications" style="color: #ea580c; text-decoration: underline;">Notification Settings</a> · <a href="https://tixnaija.name.ng/privacy" style="color: #ea580c; text-decoration: underline;">Privacy Policy</a>
            </p>
            <p style="font-size: 11px; color: #a1a1aa; margin: 0;">
              TixNaija · Independent Nigerian Ticketing Platform
            </p>
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: { address: email, name },
          subject: broadcast.subject,
          htmlBody,
          headers: [
            { name: "List-Unsubscribe", value: `<${unsubUrl}>, <mailto:tixnaijaapp@gmail.com?subject=Unsubscribe>` },
            { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
          ],
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

    return new Response(JSON.stringify({ success: true, count: successCount, opted_out: optedOutCount }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 400,
    });
  }
});
