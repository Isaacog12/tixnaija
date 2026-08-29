import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find events starting in exactly 24-25 hours (assuming cron runs hourly)
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);

    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select("id, title, start_datetime, venue_name")
      .gte("start_datetime", in24Hours.toISOString())
      .lt("start_datetime", in25Hours.toISOString());

    if (eventsError) throw eventsError;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: "No upcoming events found" }), { status: 200 });
    }

    let count = 0;
    for (const event of events) {
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          order_items (
            tickets (
              attendee_name,
              attendee_email
            )
          )
        `)
        .eq("event_id", event.id)
        .eq("status", "paid");

      if (!orders) continue;

      const dateStr = new Date(event.start_datetime).toLocaleDateString();
      const subject = `Reminder: ${event.title} is happening tomorrow!`;

      const sentEmails = new Set();

      for (const order of orders) {
        const tickets = order.order_items?.flatMap((item: any) => item.tickets || []) || [];
        
        for (const ticket of tickets) {
          const email = ticket.attendee_email;
          const name = ticket.attendee_name || 'Attendee';

          if (!email || sentEmails.has(email)) continue;
          sentEmails.add(email);

          const htmlBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Your event is tomorrow!</h2>
              <p>Hi ${name},</p>
              <p>This is a quick reminder that <strong>${event.title}</strong> is happening tomorrow.</p>
              <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <strong>Date:</strong> ${dateStr}<br>
                <strong>Location:</strong> ${event.venue_name || 'Online'}<br>
              </div>
              <p>Don't forget to have your tickets ready!</p>
            </div>
          `;

          try {
            await sendEmail({ to: { address: email, name }, subject, htmlBody });
            count++;
          } catch (err) {
            console.error("Failed to send reminder to", email, err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent: count }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
