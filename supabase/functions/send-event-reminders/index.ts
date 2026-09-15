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
      .select("id, title, start_datetime, venue_name, address, city, state")
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
      const location = [event.venue_name, event.address, event.city, event.state].filter(Boolean).join(", ") || "Online";

      const sentEmails = new Set();

      for (const order of orders) {
        const tickets = order.order_items?.flatMap((item: any) => item.tickets || []) || [];
        
        for (const ticket of tickets) {
          const email = ticket.attendee_email;
          const name = ticket.attendee_name || 'Attendee';

          if (!email || sentEmails.has(email)) continue;
          sentEmails.add(email);

          const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; text-align: center;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px 32px; text-align: left; border: 1px solid #e5e7eb;">
                
                <div style="margin-bottom: 32px;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px;">TixNaija</h1>
                </div>
                
                <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px; color: #111827;">
                  Your event is tomorrow!
                </h2>
                <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">Hi ${name},</p>
                
                <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                  This is a quick reminder that <strong>${event.title}</strong> is happening tomorrow.
                </p>
                
                <div style="background-color: #f3f4f6; border-left: 4px solid #ea580c; padding: 16px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
                  <p style="margin: 0 0 8px; color: #4b5563; font-size: 15px;"><strong style="color: #111827;">Date:</strong> ${dateStr}</p>
                  <p style="margin: 0; color: #4b5563; font-size: 15px;"><strong style="color: #111827;">Location:</strong> ${location}</p>
                </div>
                
                <p style="margin: 0 0 32px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                  Don't forget to have your tickets ready!
                </p>
                
                <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 40px 0 24px;" />
                
                <p style="margin: 0; font-size: 13px; color: #9ca3af;">TixNaija — Buy tickets. Turn up. Repeat.</p>
              </div>
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



