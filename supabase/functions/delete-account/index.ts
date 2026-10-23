// @ts-nocheck
declare const Deno: any;

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user strictly via verified JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseServiceKey;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = user.id; // User ID derived exclusively from verified JWT
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Ownership check: Block deletion if user owns ANY events or event series
    const { count: eventsCount, error: evErr } = await adminClient
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", userId);

    if (evErr) {
      console.error("[DELETE-ACCOUNT] Error checking organizer events:", evErr);
      return new Response(JSON.stringify({ error: "Failed to verify event ownership" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const { count: seriesCount, error: seriesErr } = await adminClient
      .from("event_series")
      .select("id", { count: "exact", head: true })
      .eq("organizer_id", userId);

    if (seriesErr) {
      console.error("[DELETE-ACCOUNT] Error checking event series:", seriesErr);
      return new Response(JSON.stringify({ error: "Failed to verify event series ownership" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if ((eventsCount && eventsCount > 0) || (seriesCount && seriesCount > 0)) {
      return new Response(
        JSON.stringify({
          error: "You have events on TixNaija. Contact support to close your account",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }

    // 3. Step (a): Delete user's files in id-photos and avatars buckets
    // If any step fails, stop and return an error; never continue to user deletion.
    const { data: idFiles, error: listIdErr } = await adminClient.storage
      .from("id-photos")
      .list(userId);

    if (listIdErr) {
      console.error("[DELETE-ACCOUNT] Failed to list id-photos:", listIdErr);
      return new Response(JSON.stringify({ error: "Failed to inspect identity verification files" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (idFiles && idFiles.length > 0) {
      const idPaths = idFiles.map((f) => `${userId}/${f.name}`);
      const { error: removeIdErr } = await adminClient.storage
        .from("id-photos")
        .remove(idPaths);

      if (removeIdErr) {
        console.error("[DELETE-ACCOUNT] Failed to delete id-photos:", removeIdErr);
        return new Response(JSON.stringify({ error: "Failed to delete identity verification files" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
    }

    const { data: avatarFiles, error: listAvatarErr } = await adminClient.storage
      .from("avatars")
      .list(userId);

    if (!listAvatarErr && avatarFiles && avatarFiles.length > 0) {
      const avatarPaths = avatarFiles.map((f) => `${userId}/${f.name}`);
      const { error: removeAvatarErr } = await adminClient.storage
        .from("avatars")
        .remove(avatarPaths);

      if (removeAvatarErr) {
        console.error("[DELETE-ACCOUNT] Failed to delete avatars:", removeAvatarErr);
        return new Response(JSON.stringify({ error: "Failed to delete avatar files" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        });
      }
    }

    // 4. Step (b): Delete waitlist_entries rows and null buyer_phone on orders
    const { error: waitlistErr } = await adminClient
      .from("waitlist_entries")
      .delete()
      .eq("user_id", userId);

    if (waitlistErr) {
      console.error("[DELETE-ACCOUNT] Failed to delete waitlist entries:", waitlistErr);
      return new Response(JSON.stringify({ error: "Failed to clear waitlist registrations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const { error: orderPhoneErr } = await adminClient
      .from("orders")
      .update({ buyer_phone: null })
      .eq("user_id", userId);

    if (orderPhoneErr) {
      console.warn("[DELETE-ACCOUNT] Notice: could not null buyer_phone on orders:", orderPhoneErr.message);
    }

    // 5. Step (c): Anonymize profile data via RPC
    const { error: rpcErr } = await adminClient.rpc("anonymize_deleted_user_profile", {
      p_user_id: userId,
    });

    if (rpcErr) {
      console.error("[DELETE-ACCOUNT] Failed to call anonymize_deleted_user_profile:", rpcErr);
      return new Response(JSON.stringify({ error: "Failed to anonymize personal profile record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // 6. Step (d): Delete auth user record
    const { error: deleteUserErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("[DELETE-ACCOUNT] Failed to delete auth user record:", deleteUserErr);
      return new Response(JSON.stringify({ error: "Failed to delete authentication credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your account and personal data have been permanently deleted.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[DELETE-ACCOUNT] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete account." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
