// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let email = "";
    let category = "marketing_emails";
    let token = "";

    const url = new URL(req.url);
    if (req.method === "GET") {
      email = url.searchParams.get("email") || "";
      category = url.searchParams.get("category") || "marketing_emails";
      token = url.searchParams.get("token") || "";
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        email = body.email || url.searchParams.get("email") || "";
        category = body.category || url.searchParams.get("category") || "marketing_emails";
        token = body.token || url.searchParams.get("token") || "";
      } catch {
        email = url.searchParams.get("email") || "";
        category = url.searchParams.get("category") || "marketing_emails";
        token = url.searchParams.get("token") || "";
      }
    }

    if (!email || !token) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: email and token are required." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const isValid = await verifyUnsubscribeToken(email, category, token);
    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired unsubscribe token." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Lookup profile by email
    const { data: profile, error: fetchErr } = await supabase
      .from("profiles")
      .select("id, notification_preferences")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (profile) {
      let currentPrefs: any = {};
      if (typeof profile.notification_preferences === "string") {
        try {
          currentPrefs = JSON.parse(profile.notification_preferences);
        } catch {
          currentPrefs = {};
        }
      } else if (profile.notification_preferences) {
        currentPrefs = profile.notification_preferences;
      }

      currentPrefs[category] = false;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ notification_preferences: currentPrefs })
        .eq("id", profile.id);

      if (updateErr) throw updateErr;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `You have successfully unsubscribed ${email} from ${category.replace("_", " ")}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Unsubscribe error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process unsubscribe request." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
