// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;

  let difference = 0;
  for (let index = 0; index < leftBytes.length; index++) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function authorizeCronOrRoles(
  req: Request,
  allowedRoles: string[] = [],
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const suppliedSecret =
    req.headers.get("x-cron-secret") ??
    req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    "";

  if (cronSecret && suppliedSecret && timingSafeEqual(cronSecret, suppliedSecret)) {
    return { ok: true };
  }

  if (allowedRoles.length === 0) {
    return cronSecret
      ? { ok: false, status: 401, error: "Unauthorized" }
      : { ok: false, status: 503, error: "CRON_SECRET is not configured" };
  }

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = (Deno.env.get("APP_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")) ?? "";
  const serviceRoleKey = (Deno.env.get("APP_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) ?? "";

  if (!token || !supabaseUrl || !anonKey || !serviceRoleKey) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleRows, error: roleError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", allowedRoles);

  if (roleError || !roleRows?.length) {
    return { ok: false, status: 403, error: "Forbidden" };
  }

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("suspended")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.suspended) {
    return { ok: false, status: 403, error: "Suspended accounts cannot trigger background jobs" };
  }

  return { ok: true };
}
