// @ts-nocheck
// supabase/functions/_shared/unsubscribe.ts
//
// Cryptographically signed token utility for one-click, session-less unsubscriptions.

export async function generateUnsubscribeToken(
  email: string,
  category: string = "marketing_emails"
): Promise<string> {
  const secret = Deno.env.get("UNSUBSCRIBE_HMAC_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) {
    throw new Error("Missing HMAC secret for unsubscribe token generation; failing closed.");
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = `${email.trim().toLowerCase()}:${category}`;
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyUnsubscribeToken(
  email: string,
  category: string,
  token: string
): Promise<boolean> {
  try {
    const expected = await generateUnsubscribeToken(email, category);
    return expected === token;
  } catch (err) {
    console.error("Token verification error:", err);
    return false;
  }
}
