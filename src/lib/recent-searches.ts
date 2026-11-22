import { useCallback, useState } from "react";

export const RECENT_SEARCH_LIMIT = 5;

const STORAGE_KEY = "tixnaija:recent-searches";

function clean(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length === RECENT_SEARCH_LIMIT) break;
  }
  return out;
}

export function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return clean(JSON.parse(raw));
  } catch {
    return [];
  }
}

function write(list: string[]): string[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable; the in-memory list still works this session.
  }
  return list;
}

export function useRecentSearches() {
  // Read lazily on the client only — SSR has no localStorage, and a mismatch
  // between server and client markup would hydrate an empty list anyway.
  const [items, setItems] = useState<string[]>([]);

  const hydrate = useCallback(() => {
    setItems(readRecentSearches());
  }, []);

  const remember = useCallback((query: string) => {
    const value = query.trim();
    if (!value) return;
    const next = [value, ...readRecentSearches().filter((q) => q.toLowerCase() !== value.toLowerCase())].slice(
      0,
      RECENT_SEARCH_LIMIT,
    );
    setItems(write(next));
  }, []);

  const forget = useCallback((query: string) => {
    const next = readRecentSearches().filter((q) => q.toLowerCase() !== query.trim().toLowerCase());
    setItems(write(next));
  }, []);

  const clear = useCallback(() => {
    setItems(write([]));
  }, []);

  return { items, hydrate, remember, forget, clear };
}
