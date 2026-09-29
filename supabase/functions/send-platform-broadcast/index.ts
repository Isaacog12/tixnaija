import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendEmail } from "../_shared/zeptomail.ts";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { subject, htmlBody } = await req.json();
    if (!subject || !htmlBody) throw new Error("Missing subject or htmlBody");

    // Fetch all users using the Service Role Key to bypass RLS and Auth schema restrictions
    const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers();
    if (uErr) throw new Error("Failed to fetch users");

    // De-duplicate emails just in case
    const uniqueAttendees = new Map<string, string>();
    users.forEach(u => {
      if (u.email) {
        uniqueAttendees.set(u.email, u.user_metadata?.full_name || "TixNaija User");
      }
    });

    let successCount = 0;
    const emails = Array.from(uniqueAttendees.entries());
    
    for (const [email, name] of emails) {
      try {
        await sendEmail({
          to: { address: email, name },
          subject,
          htmlBody,
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err);
      }
    }

    return new Response(JSON.stringify({ message: "Broadcast sent successfully", total_sent: successCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Broadcast error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
