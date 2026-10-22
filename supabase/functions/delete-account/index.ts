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

    // Verify user JWT
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

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Safety check: Check if organizer has active published upcoming events
    const { data: activeEvents, error: evErr } = await adminClient
      .from("events")
      .select("id, title")
      .eq("organizer_id", userId)
      .eq("status", "published")
      .gte("start_datetime", new Date().toISOString());

    if (evErr) {
      console.error("Error checking organizer events:", evErr);
    } else if (activeEvents && activeEvents.length > 0) {
      return new Response(
        JSON.stringify({
          error:
            "You cannot delete your account while you have active, published upcoming events. Please cancel or complete your events first to protect ticket holders.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 2. Anonymize personal profile data in public.profiles
    const { error: profileErr } = await adminClient
      .from("profiles")
      .update({
        full_name: "Deleted User",
        phone: null,
        avatar_url: null,
        bank_account_name: null,
        bank_account_number: null,
        bank_name: null,
        paystack_subaccount_code: null,
        is_organizer: false,
        is_verified_organizer: false,
        notification_preferences: {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileErr) {
      console.error("Error anonymizing profile:", profileErr);
      throw new Error("Failed to anonymize profile data.");
    }

    // 3. Remove uploaded ID documents from storage bucket
    try {
      const { data: files } = await adminClient.storage.from("id-photos").list(userId);
      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${f.name}`);
        await adminClient.storage.from("id-photos").remove(filePaths);
      }
    } catch (storageErr) {
      console.warn("Storage cleanup note:", storageErr);
    }

    // 4. Delete the user from auth.users via admin API
    const { error: deleteUserErr } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserErr) {
      console.error("Error deleting auth user:", deleteUserErr);
      throw new Error("Failed to delete user authentication record.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Your account and personal data have been permanently deleted.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Delete account error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to delete account." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
