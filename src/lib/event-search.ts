import { supabase } from "@/integrations/supabase/client";

/**
 * `search_events` is defined in
 * supabase/migrations/20261122090000_search_events_and_stock.sql and is not in
 * the generated Database types yet, so the client is widened once here instead
 * of hand-editing src/integrations/supabase/types.ts.
 *
 * The cast keeps the call as `client.rpc(...)` — detaching the method
 * (`const rpc = supabase.rpc`) loses its `this` and throws before any request
 * is sent.
 */
interface SearchEventsClient {
  rpc: (
    fn: "search_events",
    args: { q: string; p_limit?: number },
  ) => PromiseLike<{ data: unknown; error: unknown }>;
}

const client = supabase as unknown as SearchEventsClient;

export interface SearchHit {
  event_id: string;
  score: number;
}

/**
 * Returns matching event ids, most relevant first.
 *
 * `null` means the RPC is not deployed yet — the caller falls back to a plain
 * ILIKE search so the page keeps working before the migration is applied.
 */
export async function searchEventIds(query: string, limit = 100): Promise<string[] | null> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const { data, error } = await client.rpc("search_events", { q: trimmed, p_limit: limit });
  if (error) return null;

  return ((data ?? []) as SearchHit[]).map((hit) => hit.event_id).filter(Boolean);
}
