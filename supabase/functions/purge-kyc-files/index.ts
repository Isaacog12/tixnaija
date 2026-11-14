// @ts-nocheck
declare const Deno: any;

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const cronSecret = Deno.env.get("CRON_SECRET");

    // Authenticate: Must provide matching secret or service-role Bearer token
    const authHeader = req.headers.get("Authorization") || "";
    const customHeader = req.headers.get("x-cron-secret") || "";

    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;
    const isCronSecret = cronSecret && (customHeader === cronSecret || authHeader === `Bearer ${cronSecret}`);

    if (!isServiceRole && !isCronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized access to KYC purge routine" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Parse options (URL search params or JSON body)
    const url = new URL(req.url);
    let dryRun = url.searchParams.get("dry_run") === "true";
    let retentionDays = parseInt(url.searchParams.get("retention_days") || "30", 10);

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (typeof body.dry_run === "boolean") dryRun = body.dry_run;
        if (typeof body.retention_days === "number") retentionDays = body.retention_days;
      } catch {
        // Body optional
      }
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch eligible records
    const { data: records, error: fetchErr } = await adminClient.rpc(
      "get_expired_id_photos_for_cleanup",
      { p_retention_days: retentionDays }
    );

    if (fetchErr) {
      console.error("[PURGE-KYC] Failed to query expired KYC photos:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const totalEligible = records?.length || 0;

    // 2. Dry run mode: Return inventory without mutating storage or database
    if (dryRun) {
      console.log(`[PURGE-KYC-DRYRUN] Found ${totalEligible} records eligible for purge (retention: ${retentionDays}d).`);
      return new Response(
        JSON.stringify({
          dry_run: true,
          retention_days: retentionDays,
          eligible_count: totalEligible,
          records: (records || []).map((r: any) => ({
            application_id: r.application_id,
            id_photo_path: r.id_photo_path,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 3. Live deletion mode
    const successfulAppIds: string[] = [];
    let failedCount = 0;

    for (const record of records || []) {
      const rawPath = record.id_photo_path;
      if (!rawPath || rawPath.startsWith("DELETED")) continue;

      // Extract path within bucket
      const cleanPath = rawPath.replace(/^id-photos\//, "");

      const { error: storageErr } = await adminClient.storage
        .from("id-photos")
        .remove([cleanPath]);

      if (storageErr) {
        failedCount++;
      } else {
        successfulAppIds.push(record.application_id);
      }
    }

    // 4. Update database rows for successfully purged files
    if (successfulAppIds.length > 0) {
      const { error: markErr } = await adminClient.rpc("mark_id_photos_deleted", {
        p_application_ids: successfulAppIds,
      });

      if (markErr) {
        console.error("[PURGE-KYC] Error marking records as deleted:", markErr);
      }
    }

    // Log counts only (no personal data in logs)
    console.log(
      `[PURGE-KYC] Routine finished. Total eligible: ${totalEligible}. Successfully purged: ${successfulAppIds.length}. Failed: ${failedCount}.`
    );

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: false,
        total_eligible: totalEligible,
        purged_count: successfulAppIds.length,
        failed_count: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("[PURGE-KYC] Uncaught exception:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
