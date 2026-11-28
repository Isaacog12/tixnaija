/**
 * The client address an edge function can trust.
 *
 * `x-forwarded-for` is a comma-separated chain that a caller can prepend to:
 * the first entry is whatever the caller typed, and the gateway appends the
 * address it actually observed. Reading the first entry therefore keys every
 * IP-based rate limit on a value the attacker chooses, and a rotating header
 * bypasses the cap completely.
 *
 * This reads the LAST entry, which is the hop the gateway added. Every function
 * that rate-limits by address shares it so the rule cannot drift between them.
 */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const entries = forwarded
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return entries[entries.length - 1] || "unknown";
}

export function clientIp(req: Request): string {
  return clientIpFrom(req.headers);
}
