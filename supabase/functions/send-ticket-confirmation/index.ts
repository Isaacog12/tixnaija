import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orderId } = await req.json();
    if (!orderId) throw new Error("Missing orderId");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        events (
          title,
          start_datetime,
          venue_name
        ),
        order_items (
          quantity,
          ticket_types ( name )
        )
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order not found");

    const eventTitle = order.events?.title || "Event";
    const date = new Date(order.events?.start_datetime || "").toLocaleDateString();
    
    // Check if it's a gift
    const isGift = order.is_gift;
    const recipientName = order.recipient_name || order.buyer_name;
    const recipientEmail = order.recipient_email || order.buyer_email;

    const subject = isGift 
      ? `You received a gift for ${eventTitle} 🎁`
      : `Your tickets for ${eventTitle} are ready 🎟️`;

    const ticketUrl = `https://tixnaija.name.ng/orders/${order.id}/tickets?email=${encodeURIComponent(recipientEmail)}&accessCode=${order.access_code || ''}`;

    let htmlBody = `
      <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 20px; background-color: #fcfcfc; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.02em;">TIX<span style="color: #FF5A1F; font-weight: 300;">NAIJA</span></h1>
        </div>
        
        <div style="background: #fff; border: 1px solid #eaeaea; border-radius: 24px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <h2 style="margin-top: 0; font-size: 22px; color: #111;">${subject}</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #444;">Hi ${recipientName},</p>
    `;

    if (isGift) {
      htmlBody += `<p style="font-size: 16px; line-height: 1.5; color: #444;">You received a gift from <strong>${order.buyer_name}</strong>!</p>`;
      if (order.gift_message) {
        htmlBody += `<blockquote style="border-left: 4px solid #FF5A1F; margin: 20px 0; padding-left: 16px; font-style: italic; color: #666;">"${order.gift_message}"</blockquote>`;
      }
    } else {
      htmlBody += `<p style="font-size: 16px; line-height: 1.5; color: #444;">Thank you for your purchase! Your tickets for <strong>${eventTitle}</strong> are ready.</p>`;
    }

    htmlBody += `
          <div style="background: #f8f9fa; border: 1px solid #eee; padding: 20px; border-radius: 12px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 15px;"><strong style="color: #666; display: inline-block; width: 80px;">Date:</strong> ${date}</p>
            <p style="margin: 0; font-size: 15px;"><strong style="color: #666; display: inline-block; width: 80px;">Location:</strong> ${order.events?.venue_name || 'Online'}</p>
          </div>
          
          <p style="font-size: 16px; line-height: 1.5; color: #444; margin-bottom: 24px;">Click the button below to view, download, or scan your tickets at the door.</p>
          
          <div style="text-align: center;">
            <a href="${ticketUrl}" style="display: inline-block; background: linear-gradient(135deg, #FF5A1F 0%, #FF2A5F 100%); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 16px rgba(255,90,31,0.25);">View Tickets</a>
          </div>
        </div>
        
        <p style="text-align: center; font-size: 13px; color: #999; margin-top: 32px;">
          © ${new Date().getFullYear()} TixNaija. All rights reserved.
        </p>
      </div>
    `;

    await sendEmail({
      to: { address: recipientEmail, name: recipientName },
      subject,
      htmlBody,
    });

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 400 });
  }
});
