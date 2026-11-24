import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";
import { escapeHtml } from "../_shared/html.ts";
import {
  actions,
  details,
  footer,
  hero,
  masthead,
  shell,
  BODY_TEXT,
  SITE,
} from "../_shared/email-layout.ts";
import { filterOptedInEmails } from "../_shared/notification-preferences.ts";
import { authorizeCronOrRoles } from "../_shared/cron-auth.ts";
import { buildEmailDeliveryKey, collectTicketRecipients } from "../_shared/email-delivery.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }
  const authorization = await authorizeCronOrRoles(req);
  if (!authorization.ok) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();

    // Define the reminder windows:
    // 1. 24-hour reminder (events starting in 24 to 25 hours)
    // 2. 1-hour reminder (events starting in 1 to 2 hours)
    const windows = [
      {
        type: "24h" as const,
        min: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        max: new Date(now.getTime() + 25 * 60 * 60 * 1000),
        subjectPrefix: "Reminder: ",
        subjectSuffix: " is happening tomorrow!",
        overline: "Tomorrow",
        lead: "your ticket is ready — this event is tomorrow.",
      },
      {
        type: "1h" as const,
        min: new Date(now.getTime() + 1 * 60 * 60 * 1000),
        max: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        subjectPrefix: "Starting soon: ",
        subjectSuffix: " starts in 1 hour!",
        overline: "Starting in about an hour",
        lead: "this event starts in approximately 1 hour.",
      },
    ];

    let totalSent = 0;
    let totalOptedOut = 0;
    let totalSkippedAlreadySent = 0;

    for (const win of windows) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, slug, start_datetime, venue_name, address, city, state")
        .eq("status", "published")
        .gte("start_datetime", win.min.toISOString())
        .lt("start_datetime", win.max.toISOString());

      if (eventsError) {
        console.error(`Error querying events for ${win.type} window:`, eventsError);
        continue;
      }

      if (!events || events.length === 0) continue;

      for (const event of events) {
        // Only paid and comp orders with valid tickets belong in a reminder.
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(`
            id,
            status,
            buyer_email,
            buyer_name,
            order_items (
              tickets (
                id,
                ticket_code,
                attendee_name,
                attendee_email,
                status
              )
            )
          `)
          .eq("event_id", event.id)
          .in("status", ["paid", "comp"]);

        if (ordersError || !orders) continue;

        const recipientMap = collectTicketRecipients(orders || []);

        const candidateEmails = Array.from(recipientMap.keys());
        if (candidateEmails.length === 0) continue;

        // 1. Filter out recipients who opted out of "event_reminders"
        const optedInEmails = await filterOptedInEmails(supabase, candidateEmails, "event_reminders");

        // 2. Query idempotency log to ensure no recipient receives duplicate reminders
        const { data: loggedReminders } = await supabase
          .from("event_reminders_log")
          .select("recipient_email")
          .eq("event_id", event.id)
          .eq("reminder_type", win.type);

        const alreadySentSet = new Set(
          (loggedReminders || []).map((r: any) => r.recipient_email.trim().toLowerCase())
        );

        const dateStr = new Date(event.start_datetime).toLocaleString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZone: "Africa/Lagos",
        });
        const subject = `${win.subjectPrefix}${event.title}${win.subjectSuffix}`;
        const location = [event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ") || "Online";
        const eventUrl = `https://tixnaija.name.ng/e/${encodeURIComponent(event.slug || "")}`;

        for (const email of candidateEmails) {
          // Check opt-out
          if (!optedInEmails.has(email)) {
            console.log(`[OPT-OUT] Skipping ${win.type} reminder for ${email} (user opted out of event_reminders)`);
            totalOptedOut++;
            continue;
          }

          // Check duplicate
          if (alreadySentSet.has(email)) {
            totalSkippedAlreadySent++;
            continue;
          }

          const name = recipientMap.get(email) || "Attendee";
          const deliveryKey = buildEmailDeliveryKey("event-reminder", `${event.id}:${win.type}`, email);
          const { data: claimStatus, error: claimError } = await supabase.rpc("claim_email_delivery", {
            p_delivery_key: deliveryKey,
          });
          if (claimError) {
            console.error(`Could not claim reminder delivery for ${email}:`, claimError);
            continue;
          }
          if (claimStatus !== "claimed") {
            totalSkippedAlreadySent++;
            continue;
          }

          const htmlBody = shell(
            masthead("Reminder") +
              hero(
                win.overline,
                escapeHtml(event.title),
                `Hello ${escapeHtml(name)}, ${win.lead}`,
              ) +
              details([
                ["When", escapeHtml(dateStr)],
                ["Where", escapeHtml(location)],
              ]) +
              `
        <tr>
          <td style="padding:24px 32px 0;">
            <p style="margin:0;font-size:14px;line-height:1.65;color:${BODY_TEXT};">Have your QR ticket open on your phone before you reach the gate. One entry per ticket.</p>
          </td>
        </tr>` +
              actions(eventUrl, "Event details", `${SITE}/my-tickets`, "Email my tickets") +
              footer("You are receiving this because you have a ticket for this event."),
          );

          try {
            await sendEmail({ to: { address: email, name }, subject, htmlBody });
            const { error: completionError } = await supabase.rpc("complete_email_delivery", {
              p_delivery_key: deliveryKey,
              p_success: true,
            });
            if (completionError) {
              console.error(`Reminder sent but ledger completion failed for ${email}:`, completionError);
            }
            totalSent++;

            // Keep the historical log for compatibility; the delivery ledger is
            // the concurrency guard if this insert fails.
            await supabase.from("event_reminders_log").insert({
              event_id: event.id,
              recipient_email: email,
              reminder_type: win.type,
            });
          } catch (err) {
            console.error(`Failed to send ${win.type} reminder to ${email}:`, err);
            try {
              await supabase.rpc("complete_email_delivery", {
                p_delivery_key: deliveryKey,
                p_success: false,
                p_error: err instanceof Error ? err.message : String(err),
              });
            } catch (completionError) {
              console.error(`Could not release reminder delivery claim for ${email}:`, completionError);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        opted_out: totalOptedOut,
        skipped_already_sent: totalSkippedAlreadySent,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-event-reminders error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
