import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = Date.now();
    // Set to 5 days from now
    const newEnd = new Date(now + 5 * 24 * 60 * 60 * 1000).toISOString();
    const newStart = new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: d1 } = await supabaseAdmin
      .from("events")
      .update({ start_datetime: newStart, end_datetime: newEnd })
      .in("title", ["Test 2", "Fire Bash"])
      .select();

    return new Response(JSON.stringify({ success: true, updated: d1 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
