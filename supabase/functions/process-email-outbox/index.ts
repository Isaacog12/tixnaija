// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // @ts-ignore
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  // @ts-ignore
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Claim a batch of pending emails using concurrency-safe lock-skip RPC
    const { data: batch, error: claimErr } = await supabase.rpc("claim_email_outbox_batch", {
      p_batch_size: 20,
    });

    let itemsToProcess = batch;

    // Fallback if RPC not yet created in schema cache
    if (claimErr || !itemsToProcess) {
      const { data: fallbackBatch } = await supabase
        .from("email_outbox")
        .select("*")
        .eq("status", "pending")
        .lt("retry_count", 3)
        .order("created_at", { ascending: true })
        .limit(20);

      itemsToProcess = fallbackBatch || [];
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of itemsToProcess) {
      try {
        let subject = "Notification from TixNaija";
        let htmlBody = "";

        if (item.template === "case_reply") {
          const caseSubject = item.payload?.subject || "Your Support Case";
          subject = `[TixNaija Support] Re: ${caseSubject}`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">TixNaija Customer Support</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">A member of our support team has replied to your request regarding <strong>${caseSubject}</strong>:</p>
              <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${item.payload?.reply || ""}</div>
              <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin-top: 24px;">
                You can reply directly in your customer account on TixNaija or view your active tickets at any time.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else if (item.template === "ticket_email_change_security_alert") {
          subject = `[Security Alert] Ticket Delivery Email Updated for Order`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #ef4444; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #dc2626;">TixNaija Security Notice</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                This is an important security notification. The recipient email address for your ticket order has been officially updated to:
              </p>
              <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 12px 16px; border-radius: 8px; font-family: monospace; font-size: 14px; color: #991b1b; margin-bottom: 20px;">
                ${item.payload?.new_email}
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 16px;">
                The previous ticket codes have been invalidated and reissued to the new recipient.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #dc2626; font-weight: 500;">
                If you did not authorize or request this change, please contact support@tixnaija.name.ng immediately.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else if (item.template === "ticket_confirmation") {
          // Re-trigger confirmation or dispatch notice
          subject = `Your TixNaija Tickets (Order Confirmed)`;
          const orderId = item.order_id || item.payload?.order_id;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">Your Reissued Tickets</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                Your tickets for order <strong>${orderId}</strong> are available.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://www.tixnaija.name.ng/orders/${orderId}/tickets" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
                  View & Download Tickets
                </a>
              </div>
              <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
                Keep your ticket codes and QR codes safe. Each ticket code is valid for one scan at the door.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else {
          subject = `[TixNaija] Update regarding your order`;
          htmlBody = `
            <div style="font-family: sans-serif; padding: 20px;">
              <p>${item.payload?.message || "You have an update regarding your TixNaija account."}</p>
            </div>
          `;
        }

        // Send through ZeptoMail
        await sendEmail({
          to: { address: item.recipient_email },
          subject,
          htmlBody,
        });

        // Mark as sent
        await supabase
          .from("email_outbox")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        successCount++;
      } catch (err: any) {
        console.error(`Failed to send outbox item ${item.id}:`, err);
        failCount++;

        const newRetryCount = (item.retry_count || 0) + 1;
        const newStatus = newRetryCount >= 3 ? "failed" : "pending";

        await supabase
          .from("email_outbox")
          .update({
            status: newStatus,
            retry_count: newRetryCount,
            error_message: err?.message || String(err),
          })
          .eq("id", item.id);
      }
    }

    return new Response(
      JSON.stringify({
        processed: itemsToProcess.length,
        success: successCount,
        failed: failCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
