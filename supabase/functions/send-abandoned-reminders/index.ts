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
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2>Did you forget something?</h2>
          <p>Hi ${order.buyer_name || 'there'},</p>
          <p>We noticed you left tickets for <strong>${eventTitle}</strong> in your cart.</p>
          <p>They won't be held forever! Complete your checkout before they sell out.</p>
          <a href="https://tixnaija.name.ng/" style="display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; margin-top: 15px;">Return to TixNaija</a>
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


