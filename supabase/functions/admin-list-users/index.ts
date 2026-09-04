// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const allowedOrigins = [
  "https://tixnaija.vercel.app",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8080",
  "https://www.tixnaija.name.ng",
  "https://tixnaija.name.ng"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://tixnaija.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
};

function getCorsHeaders(req) {
  const origin = req?.headers?.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
  return {
    ...corsHeaders,
    "Access-Control-Allow-Origin": isAllowed ? origin : "https://tixnaija.vercel.app",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req), status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Verify the caller is an authenticated admin using their JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    // Use anon key to verify the caller's session
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized: not logged in");

    // Check admin role
    const { data: adminRole } = await callerClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRole) throw new Error("Unauthorized: admin access required");

    // 2. Use service role to list all auth users (includes emails)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listError) throw listError;

    // 3. Fetch all profiles + roles via service role (bypasses RLS)
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, created_at, suspended")
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: allRoles } = await adminClient
      .from("user_roles")
      .select("user_id, role");

    // 4. Merge: auth email + profile data + roles
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const roleMap = new Map<string, string[]>();
    for (const r of allRoles ?? []) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    }

    const users = authUsers.users.map((authUser: any) => {
      const profile = profileMap.get(authUser.id) ?? {};
      return {
        id: authUser.id,
        email: authUser.email ?? "",
        full_name: (profile as any).full_name ?? "",
        created_at: (profile as any).created_at ?? authUser.created_at,
        suspended: (profile as any).suspended ?? false,
        roles: roleMap.get(authUser.id) ?? ["attendee"],
      };
    });

    return new Response(JSON.stringify({ users }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      status: err.message.startsWith("Unauthorized") ? 403 : 500,
    });
  }
});



