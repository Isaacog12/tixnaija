import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { user_ids, title, body, data } = await req.json();

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error("user_ids array is required");
    }

    // 1. Fetch push tokens for all provided users
    const { data: profiles, error } = await supabaseClient
      .from("profiles")
      .select("expo_push_token")
      .in("id", user_ids)
      .not("expo_push_token", "is", null);

    if (error) throw error;
    
    const pushTokens = profiles.map(p => p.expo_push_token);
    
    if (pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No push tokens found for users." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Prepare Expo Push messages
    const messages = [];
    for (let pushToken of pushTokens) {
      // Check that all your push tokens appear to be valid Expo push tokens
      if (!String(pushToken).includes("ExponentPushToken")) {
        continue;
      }
      
      messages.push({
        to: pushToken,
        sound: 'default',
        title: title || "New Notification",
        body: body,
        data: data || {},
      });
    }

    // 3. Send to Expo servers
    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    const expoData = await expoResponse.json();

    return new Response(
      JSON.stringify({ 
        message: `Sent ${messages.length} notifications`,
        expoData 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
