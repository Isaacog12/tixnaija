import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 200 });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      throw new Error("Paystack secret key not configured");
    }

    if (req.method === "GET") {
      // Fetch banks from Paystack
      const response = await fetch("https://api.paystack.co/bank?country=nigeria", {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      });
      const data = await response.json();
      if (!data.status) throw new Error(data.message || "Failed to fetch banks");
      
      return new Response(JSON.stringify(data.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST") {
      const body = await req.json();

      if (body.action === "resolve") {
        const { bank_code, account_number } = body;
        if (!bank_code || !account_number) throw new Error("Missing bank details for resolution");
        
        const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${account_number}&bank_code=${bank_code}`, {
          headers: { Authorization: `Bearer ${paystackSecret}` },
        });
        const data = await response.json();
        if (!data.status) throw new Error(data.message || "Failed to resolve account");
        
        return new Response(JSON.stringify(data.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Setup Subaccount
      const { bank_code, account_number, business_name } = body;
      if (!bank_code || !account_number || !business_name) {
        throw new Error("Missing required fields");
      }

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Missing Authorization header");

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
      const supabaseAuth = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
      });

      const jwt = authHeader.replace('Bearer ', '');
      const { data: userData, error: userError } = await supabaseAuth.auth.getUser(jwt);
      if (userError || !userData?.user) {
        throw new Error(`Unauthorized: ${userError?.message || "No user found"}`);
      }

      const userId = userData.user.id;

      // Create Paystack Subaccount
      const response = await fetch("https://api.paystack.co/subaccount", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          business_name,
          settlement_bank: bank_code,
          account_number,
          percentage_charge: parseFloat(Deno.env.get("PLATFORM_FEE_PERCENTAGE") ?? "10"),
        }),
      });

      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to create subaccount");
      }

      const subaccount_code = data.data.subaccount_code;

      // Update Supabase profile using service role to bypass column-level grants
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          paystack_subaccount_code: subaccount_code,
          subaccount_created_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (profileError) {
        throw new Error(`Failed to save subaccount: ${profileError.message}`);
      }

      return new Response(JSON.stringify({ success: true, subaccount_code }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Method not allowed");
  } catch (error: any) {
    console.error("Connect payout account error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
