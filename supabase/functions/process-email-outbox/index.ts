// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/zeptomail.ts";
import { authorizeCronOrRoles } from "../_shared/cron-auth.ts";
import { escapeHtml } from "../_shared/html.ts";
import { isDeliverableEmail, normalizeEmail } from "../_shared/email-delivery.ts";
import { buildSupportAcknowledgement } from "../_shared/support-ack.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authorization = await authorizeCronOrRoles(req, ["admin", "customer_care"]);
  if (!authorization.ok) {
    return new Response(JSON.stringify({ error: authorization.error }), {
      status: authorization.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // @ts-ignore
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  // @ts-ignore
  const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Claim a batch of pending emails using concurrency-safe lock-skip RPC
    const { data: batch, error: claimErr } = await supabase.rpc("claim_email_outbox_batch", {
      p_batch_size: 20,
    });

    if (claimErr) {
      console.error("Could not atomically claim outbox batch:", claimErr);
      return new Response(JSON.stringify({ error: "Could not claim email batch safely." }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemsToProcess = batch || [];
    if (itemsToProcess.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (const item of itemsToProcess) {
      if (!isDeliverableEmail(item.recipient_email)) {
        console.error(`Refusing invalid outbox recipient ${item.id}`);
        failCount++;
        await supabase
          .from("email_outbox")
          .update({ status: "failed", error_message: "Invalid recipient email address" })
          .eq("id", item.id);
        continue;
      }

      const deliveryKey = `outbox:${item.id}`;
      const { data: claimStatus, error: deliveryClaimError } = await supabase.rpc(
        "claim_email_delivery",
        { p_delivery_key: deliveryKey },
      );

      if (deliveryClaimError) {
        console.error(`Could not claim outbox delivery ${item.id}:`, deliveryClaimError);
        failCount++;
        await supabase
          .from("email_outbox")
          .update({
            status: "pending",
            retry_count: (item.retry_count || 0) + 1,
            error_message: deliveryClaimError.message,
          })
          .eq("id", item.id);
        continue;
      }

      if (claimStatus === "sent") {
        await supabase
          .from("email_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);
        skippedCount++;
        continue;
      }
      if (claimStatus !== "claimed") {
        skippedCount++;
        continue;
      }

      try {
        let subject = "Notification from TixNaija";
        let htmlBody = "";

        if (item.template === "case_reply") {
          const caseSubject = String(item.payload?.subject || "Your Support Case").replace(/[\r\n]+/g, " ");
          subject = `[TixNaija Support] Re: ${caseSubject}`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">TixNaija Customer Support</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">A member of our support team has replied to your request regarding <strong>${escapeHtml(caseSubject)}</strong>:</p>
              <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(item.payload?.reply || "")}</div>
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
                ${escapeHtml(item.payload?.new_email || "")}
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 16px;">
                The previous ticket codes have been invalidated and reissued to the new recipient.
              </p>
              <p style="font-size: 14px; line-height: 1.6; color: #dc2626; font-weight: 500;">
                If you did not authorize or request this change, please contact support.tixnaija@gmail.com immediately.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else if (item.template === "ticket_confirmation") {
          subject = "Your TixNaija Tickets";
          const orderId = item.order_id || item.payload?.order_id;
          const safeOrderId = encodeURIComponent(String(orderId || ""));
          const recipient = normalizeEmail(item.recipient_email);
          const ticketLinks: Array<{ code: string; name: string }> = [];

          if (orderId) {
            const { data: orderItems } = await supabase
              .from("order_items")
              .select("id")
              .eq("order_id", orderId);
            const itemIds = (orderItems || []).map((orderItem: any) => orderItem.id);
            if (itemIds.length > 0) {
              const { data: tickets } = await supabase
                .from("tickets")
                .select("ticket_code, attendee_name, attendee_email")
                .in("order_item_id", itemIds)
                .eq("status", "valid");
              for (const ticket of tickets || []) {
                if (normalizeEmail(ticket.attendee_email) === recipient) {
                  ticketLinks.push({ code: ticket.ticket_code, name: ticket.attendee_name || "Attendee" });
                }
              }
            }
          }

          const ticketLinksHtml = ticketLinks.length
            ? ticketLinks.map((ticket) => {
                const ticketUrl = `https://tixnaija.name.ng/t/${encodeURIComponent(ticket.code)}`;
                return `<div style="border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin: 12px 0;">
                  <p style="margin: 0 0 10px; font-size: 14px;"><strong>${escapeHtml(ticket.name)}</strong> · ${escapeHtml(ticket.code.split("-")[0].toUpperCase())}</p>
                  <a href="${escapeHtml(ticketUrl)}" style="color: #047857; text-decoration: underline; font-weight: 600;">View ticket</a>
                  <span style="color: #6b7280;"> · </span>
                  <a href="${escapeHtml(`${ticketUrl}?download=true`)}" style="color: #047857; text-decoration: underline; font-weight: 600;">Download PDF</a>
                </div>`;
              }).join("")
            : "";

          const guestFragment = `#email=${encodeURIComponent(recipient)}`;
          const orderUrl = `https://tixnaija.name.ng/orders/${safeOrderId}/tickets${guestFragment}`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">Your TixNaija Tickets</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Your ticket access for order <strong>${escapeHtml(orderId || "")}</strong> is ready.</p>
              ${ticketLinksHtml}
              ${ticketLinks.length ? "" : `<div style="text-align: center; margin: 28px 0;"><a href="${escapeHtml(orderUrl)}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">View & Download Tickets</a></div>`}
              <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">Keep your ticket codes and QR codes safe. Each ticket code is valid for one scan at the door.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">TixNaija · Independent Nigerian Ticketing Platform</p>
            </div>
          `;
        } else if (item.template === "event_cancelled" || item.template === "event_postponed") {
          const cancelled = item.template === "event_cancelled";
          const eventTitle = String(item.payload?.event_title || "your event");
          const eventUrl = String(item.payload?.event_url || "https://tixnaija.name.ng/browse");
          const note = String(item.payload?.note || "");
          const rawNewStart = String(item.payload?.new_start || "");
          const parsedNewStart = rawNewStart ? new Date(rawNewStart) : null;
          const newStart = parsedNewStart && !Number.isNaN(parsedNewStart.getTime())
            ? parsedNewStart.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short", timeZone: "Africa/Lagos" })
            : rawNewStart;
          subject = cancelled
            ? `[TixNaija] Event cancelled: ${eventTitle}`
            : `[TixNaija] Event postponed: ${eventTitle}`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid ${cancelled ? "#dc2626" : "#d97706"}; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">${cancelled ? "Event Cancelled" : "Event Postponed"}</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello ${escapeHtml(item.payload?.recipient_name || "there")},</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;"><strong>${escapeHtml(eventTitle)}</strong> has been ${cancelled ? "cancelled" : "postponed"}.</p>
              ${cancelled ? "" : `<p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;"><strong>New date and time:</strong> ${escapeHtml(newStart || "to be announced")}</p>`}
              ${note ? `<div style="background: #f9fafb; border-left: 4px solid ${cancelled ? "#dc2626" : "#d97706"}; padding: 16px; margin-bottom: 24px; white-space: pre-wrap;">${escapeHtml(note)}</div>` : ""}
              <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">${cancelled ? "If you have questions about your order or refund options, contact support.tixnaija@gmail.com." : "Your existing ticket remains valid for the rescheduled event. Check the event page for updates."}</p>
              <p style="margin: 24px 0;"><a href="${escapeHtml(eventUrl)}" style="color: #047857; text-decoration: underline; font-weight: 600;">View event page</a></p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">TixNaija · Independent Nigerian Ticketing Platform</p>
            </div>
          `;
        } else if (item.template === "support_csat") {
          const caseNumber = escapeHtml(String(item.payload?.case_number || "your case"));
          const token = String(item.payload?.csat_token || "");
          const rateUrl = `https://tixnaija.name.ng/csat/${token}`;
          subject = `[TixNaija Support] How did we do with ${caseNumber}?`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #10b981; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">TixNaija Customer Support</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">Hello,</p>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
                Your support request <strong>${caseNumber}</strong> has been marked resolved.
                One question: how did we do?
              </p>
              <p style="margin-bottom: 24px;">
                <a href="${rateUrl}" style="background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Rate this support request</a>
              </p>
              <p style="font-size: 13px; color: #6b7280; line-height: 1.5;">
                It takes about ten seconds, and it tells us which parts of support to fix first.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else if (item.template === "support_escalation") {
          const caseNumber = String(item.payload?.case_number || "unassigned").replace(/[\r\n]+/g, " ");
          const customerEmail = String(item.payload?.customer_email || "not provided").replace(/[\r\n]+/g, " ");
          const intent = String(item.payload?.intent || "unknown").replace(/[\r\n]+/g, " ");
          // A typed address is not proof of ownership. Staff need to see that
          // before they treat the address as the customer's.
          const verified = item.payload?.contact_verified === true;
          const contactVerifiedLabel = verified ? "yes" : "no — typed address, unverified";
          subject = `[TixNaija] Urgent support question — ${caseNumber}`;
          htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
              <div style="margin-bottom: 24px; border-bottom: 2px solid #dc2626; padding-bottom: 12px;">
                <h1 style="font-size: 20px; font-weight: bold; margin: 0; color: #111827;">Customer question needs a human</h1>
              </div>
              <p style="font-size: 15px; line-height: 1.6; margin-bottom: 16px;">
                The TixNaija assistant could not answer a customer question and escalated it.
              </p>
              <table style="width: 100%; font-size: 14px; line-height: 1.6; margin-bottom: 20px; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; width: 130px;">Case</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(caseNumber)}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Customer email</td><td style="padding: 6px 0;">${escapeHtml(customerEmail)}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Contact verified</td><td style="padding: 6px 0; font-weight: 600; color: ${verified ? "#111827" : "#b45309"};">${escapeHtml(contactVerifiedLabel)}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280;">Detected topic</td><td style="padding: 6px 0;">${escapeHtml(intent)}</td></tr>
              </table>
              <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">What the customer asked:</p>
              <div style="background: #f9fafb; border-left: 4px solid #dc2626; padding: 16px; margin-bottom: 24px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(item.payload?.message || "")}</div>
              <p style="font-size: 14px; line-height: 1.6;">
                Open the case in the support dashboard to reply, or email the customer directly.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                TixNaija · Independent Nigerian Ticketing Platform
              </p>
            </div>
          `;
        } else if (item.template === "support_acknowledgement") {
          // Customer-facing receipt for a question the assistant escalated.
          //
          // It prints the case number and fixed wording and nothing else. The
          // customer's own text used to be echoed back here, which made this
          // template a way to send arbitrary words to any verified address from
          // our trusted sender. buildSupportAcknowledgement() has no message
          // parameter at all, so the echo cannot come back by accident.
          const acknowledgement = buildSupportAcknowledgement({
            caseNumber: String(item.payload?.case_number || "unassigned"),
            priority: item.payload?.priority ?? null,
          });
          subject = acknowledgement.subject;
          htmlBody = acknowledgement.html;
        } else {
          subject = `[TixNaija] Update regarding your order`;
          htmlBody = `
            <div style="font-family: sans-serif; padding: 20px;">
              <p>${escapeHtml(item.payload?.message || "You have an update regarding your TixNaija account.")}</p>
            </div>
          `;
        }

        await sendEmail({
          to: { address: item.recipient_email },
          subject,
          htmlBody,
        });

        const { error: completionError } = await supabase.rpc("complete_email_delivery", {
          p_delivery_key: deliveryKey,
          p_success: true,
        });
        if (completionError) {
          console.error(`Outbox item ${item.id} sent but ledger completion failed:`, completionError);
        }

        await supabase
          .from("email_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString(), error_message: null })
          .eq("id", item.id);

        successCount++;
      } catch (err: any) {
        console.error(`Failed to send outbox item ${item.id}:`, err);
        failCount++;

        try {
          await supabase.rpc("complete_email_delivery", {
            p_delivery_key: deliveryKey,
            p_success: false,
            p_error: err?.message || String(err),
          });
        } catch (completionError) {
          console.error(`Could not release outbox delivery claim ${deliveryKey}:`, completionError);
        }

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
        skipped: skippedCount,
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
