import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const { data: abandonedOrders, error } = await supabase
      .from("orders")
      .select("id, buyer_email, buyer_name, events ( title )")
      .eq("status", "pending")
      .lt("created_at", oneHourAgo.toISOString())
      .gt("created_at", twoHoursAgo.toISOString());

    if (error) throw error;
    if (!abandonedOrders || abandonedOrders.length === 0) {
      return new Response(JSON.stringify({ message: "No abandoned orders found" }), { status: 200 });
    }

    let count = 0;
    for (const order of abandonedOrders) {
      if (!order.buyer_email) continue;
      
      // Ignore if it's already fully processed
      const eventTitle = order.events?.title || "your event";
      const subject = `Complete your purchase for ${eventTitle}`;
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f9fafb; padding: 40px 20px; text-align: center;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; padding: 40px 32px; text-align: left; border: 1px solid #e5e7eb;">
            
            <div style="margin-bottom: 32px;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ea580c; letter-spacing: -0.5px;">TixNaija</h1>
            </div>
            
            <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px; color: #111827;">
              Did you forget something?
            </h2>
            <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">Hi ${order.buyer_name || 'there'},</p>
            
            <div style="background-color: #f3f4f6; border-left: 4px solid #ea580c; padding: 16px; margin-bottom: 24px; border-radius: 0 4px 4px 0;">
              <p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">You left tickets for:</p>
              <p style="margin: 0; color: #111827; font-size: 16px; font-weight: 600;">${eventTitle}</p>
            </div>
            
            <p style="margin: 0 0 32px; color: #4b5563; font-size: 16px; line-height: 1.6;">
              They won't be held forever! Complete your checkout before they sell out.
            </p>
            
            <a href="https://tixnaija.name.ng/" style="display: inline-block; background-color: #ea580c; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">Return to Checkout</a>
            
            <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 40px 0 24px;" />
            
            <p style="margin: 0; font-size: 13px; color: #9ca3af;">TixNaija — Buy tickets. Turn up. Repeat.</p>
          </div>
        </div>
      `;

      try {
        await sendEmail({ to: { address: order.buyer_email, name: order.buyer_name }, subject, htmlBody });
        count++;
      } catch (err) {
        console.error("Failed to send abandoned cart email to", order.buyer_email, err);
      }
    }

    return new Response(JSON.stringify({ success: true, sent: count }), { status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});



