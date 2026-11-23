// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/zeptomail.ts";
import { filterOptedInEmails } from "../_shared/notification-preferences.ts";
import { generateUnsubscribeToken } from "../_shared/unsubscribe.ts";
import { escapeHtml } from "../_shared/html.ts";
import { buildEmailDeliveryKey, isDeliverableEmail } from "../_shared/email-delivery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = (Deno.env.get("APP_SECRET_KEY") ??
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const supabaseAnonKey =
      (Deno.env.get("APP_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")) ||
      supabaseKey;

    // 1. Verify caller identity: service_role key OR verified admin JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const isServiceRole = token === supabaseKey;

    if (!isServiceRole) {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      });
      const {
        data: { user },
        error: authErr,
      } = await authClient.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(supabaseUrl, supabaseKey);
      const { data: adminRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaignId, subject, htmlBody } = await req.json();
    if (typeof campaignId !== "string" || !/^[A-Za-z0-9._:-]{1,100}$/.test(campaignId.trim())) {
      throw new Error("A stable campaignId is required");
    }
    if (!subject || !htmlBody) throw new Error("Missing subject or htmlBody");
    const normalizedCampaignId = campaignId.trim();

    // Fetch all users with pagination using the Service Role Key
    const uniqueUsers = new Map<string, string>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error: uErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (uErr) throw new Error(`Failed to fetch users page ${page}: ${uErr.message}`);
      const pageUsers = data?.users || [];
      if (pageUsers.length === 0) break;

      pageUsers.forEach((u: any) => {
        if (u.email && isDeliverableEmail(u.email)) {
          uniqueUsers.set(
            u.email.trim().toLowerCase(),
            u.user_metadata?.full_name || "TixNaija Member",
          );
        }
      });

      if (pageUsers.length < perPage) break;
      page++;
    }

    const candidateEmails = Array.from(uniqueUsers.keys());
    if (candidateEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No users found", total_sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Only send to users who explicitly opted in to "marketing_emails" (default is false)
    const optedInEmails = await filterOptedInEmails(supabase, candidateEmails, "marketing_emails");

    let successCount = 0;
    let skippedCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const [email, name] of uniqueUsers.entries()) {
      if (!optedInEmails.has(email)) {
        skippedCount++;
        continue;
      }

      const deliveryKey = buildEmailDeliveryKey("platform-broadcast", normalizedCampaignId, email);
      const { data: claimStatus, error: claimError } = await supabase.rpc("claim_email_delivery", {
        p_delivery_key: deliveryKey,
      });
      if (claimError) {
        console.error(`Could not claim platform broadcast delivery for ${email}:`, claimError);
        failedCount++;
        continue;
      }
      if (claimStatus !== "claimed") {
        duplicateCount++;
        continue;
      }

      const unsubToken = await generateUnsubscribeToken(email, "marketing_emails");
      const unsubUrl = `https://tixnaija.name.ng/unsubscribe?email=${encodeURIComponent(email)}&category=marketing_emails&token=${unsubToken}`;
      const safeUnsubUrl = escapeHtml(unsubUrl);

      const fullHtmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
          ${htmlBody}
          <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 40px 0 20px;" />
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #71717a; margin-bottom: 8px;">
              You received this message because you opted in to marketing updates from TixNaija.
            </p>
            <p style="font-size: 12px; color: #71717a; margin-bottom: 12px;">
              <a href="${safeUnsubUrl}" style="color: #ea580c; text-decoration: underline;">Click here to unsubscribe instantly</a> · <a href="https://tixnaija.name.ng/account?tab=notifications" style="color: #ea580c; text-decoration: underline;">Notification Settings</a> · <a href="https://tixnaija.name.ng/privacy" style="color: #ea580c; text-decoration: underline;">Privacy Policy</a>
            </p>
            <p style="font-size: 11px; color: #a1a1aa; margin: 0; line-height: 1.4;">
              TixNaija · Independent Nigerian Ticketing Platform
            </p>
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: { address: email, name },
          subject,
          htmlBody: fullHtmlBody,
          headers: [
            {
              name: "List-Unsubscribe",
              value: `<${unsubUrl}>, <mailto:tixnaijaapp@gmail.com?subject=Unsubscribe>`,
            },
            { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
          ],
        });
        const { error: completionError } = await supabase.rpc("complete_email_delivery", {
          p_delivery_key: deliveryKey,
          p_success: true,
        });
        if (completionError) {
          console.error(
            `Platform broadcast sent but ledger completion failed for ${email}:`,
            completionError,
          );
        }
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
        failedCount++;
        try {
          await supabase.rpc("complete_email_delivery", {
            p_delivery_key: deliveryKey,
            p_success: false,
            p_error: err instanceof Error ? err.message : String(err),
          });
        } catch (completionError) {
          console.error(
            `Could not release platform broadcast claim for ${email}:`,
            completionError,
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: "Broadcast completed",
        campaign_id: normalizedCampaignId,
        total_sent: successCount,
        skipped_opted_out: skippedCount,
        skipped_duplicate: duplicateCount,
        failed: failedCount,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
