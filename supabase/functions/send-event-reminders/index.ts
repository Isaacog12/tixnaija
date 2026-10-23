import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";
import { filterOptedInEmails } from "../_shared/notification-preferences.ts";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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
        headline: "Your event is tomorrow! 🎟️",
        timeNotice: "is happening tomorrow",
      },
      {
        type: "1h" as const,
        min: new Date(now.getTime() + 1 * 60 * 60 * 1000),
        max: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        subjectPrefix: "Starting soon: ",
        subjectSuffix: " starts in 1 hour!",
        headline: "Starting in 1 hour! 🚀",
        timeNotice: "starts in approximately 1 hour",
      },
    ];

    let totalSent = 0;
    let totalOptedOut = 0;
    let totalSkippedAlreadySent = 0;

    for (const win of windows) {
      const { data: events, error: eventsError } = await supabase
        .from("events")
        .select("id, title, slug, start_datetime, venue_name, address, city, state")
        .gte("start_datetime", win.min.toISOString())
        .lt("start_datetime", win.max.toISOString());

      if (eventsError) {
        console.error(`Error querying events for ${win.type} window:`, eventsError);
        continue;
      }

      if (!events || events.length === 0) continue;

      for (const event of events) {
        // Fetch paid orders and tickets for this event
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select(`
            buyer_email,
            buyer_name,
            order_items (
              tickets (
                attendee_name,
                attendee_email
              )
            )
          `)
          .eq("event_id", event.id)
          .eq("status", "paid");

        if (ordersError || !orders) continue;

        // Gather all recipient emails and names
        const recipientMap = new Map<string, string>();
        for (const order of orders) {
          const tickets = order.order_items?.flatMap((item: any) => item.tickets || []) || [];
          if (tickets.length > 0) {
            for (const ticket of tickets) {
              const email = (ticket.attendee_email || order.buyer_email || "").trim().toLowerCase();
              if (email) {
                recipientMap.set(email, ticket.attendee_name || order.buyer_name || "Attendee");
              }
            }
          } else if (order.buyer_email) {
            recipientMap.set(order.buyer_email.trim().toLowerCase(), order.buyer_name || "Attendee");
          }
        }

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

        const dateStr = new Date(event.start_datetime).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
        const subject = `${win.subjectPrefix}${event.title}${win.subjectSuffix}`;
        const location = [event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ") || "Online";
        const eventUrl = `https://tixnaija.name.ng/e/${event.slug || ""}`;

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

          const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 20px; text-align: center;">
              <div style="max-width: 560px; margin: 0 auto; background-color: #18181b; border-radius: 16px; padding: 36px 28px; text-align: left; border: 1px solid #27272a;">
                
                <div style="margin-bottom: 28px;">
                  <span style="font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px;">TixNaija</span>
                </div>
                
                <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 14px; color: #ffffff; letter-spacing: -0.3px;">
                  ${win.headline}
                </h2>
                <p style="margin: 0 0 20px; color: #a1a1aa; font-size: 15px; line-height: 1.6;">Hi ${name},</p>
                
                <p style="margin: 0 0 24px; color: #d4d4d8; font-size: 15px; line-height: 1.6;">
                  This is a quick reminder that <strong>${event.title}</strong> ${win.timeNotice}.
                </p>
                
                <div style="background-color: #27272a; border-left: 4px solid #ea580c; padding: 18px; margin-bottom: 28px; border-radius: 0 12px 12px 0;">
                  <p style="margin: 0 0 8px; color: #d4d4d8; font-size: 14px;"><strong style="color: #ffffff;">Time:</strong> ${dateStr}</p>
                  <p style="margin: 0; color: #d4d4d8; font-size: 14px;"><strong style="color: #ffffff;">Location:</strong> ${location}</p>
                </div>
                
                <div style="margin-bottom: 32px; text-align: center;">
                  <a href="${eventUrl}" style="display: inline-block; background-color: #ea580c; color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 28px; border-radius: 9999px; text-decoration: none;">
                    View Event & Tickets
                  </a>
                </div>
                
                <p style="margin: 0 0 24px; color: #a1a1aa; font-size: 14px; line-height: 1.6;">
                  Make sure your QR tickets are downloaded or accessible on your phone before arrival.
                </p>
                
                <hr style="border: 0; border-top: 1px solid #27272a; margin: 32px 0 20px;" />
                
                <div style="text-align: center;">
                  <p style="margin: 0 0 8px; font-size: 12px; color: #71717a;">
                    You received this email because you have a ticket to this event.
                  </p>
                  <p style="margin: 0 0 12px; font-size: 12px; color: #71717a;">
                    To update your preferences or opt out of reminders, manage your <a href="https://tixnaija.name.ng/account?tab=notifications" style="color: #ea580c; text-decoration: underline;">Notification Settings</a> · <a href="https://tixnaija.name.ng/privacy" style="color: #ea580c; text-decoration: underline;">Privacy Policy</a>
                  </p>
                  <p style="margin: 0; font-size: 11px; color: #71717a;">
                    TixNaija · Independent Nigerian Ticketing Platform
                  </p>
                </div>
              </div>
            </div>
          `;

          try {
            await sendEmail({ to: { address: email, name }, subject, htmlBody });
            totalSent++;

            // Record sent reminder in event_reminders_log
            await supabase.from("event_reminders_log").insert({
              event_id: event.id,
              recipient_email: email,
              reminder_type: win.type,
            });
          } catch (err) {
            console.error(`Failed to send ${win.type} reminder to ${email}:`, err);
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
