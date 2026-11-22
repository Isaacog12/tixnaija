/**
 * Cities TixNaija sells in. `events.city` is free text, so this list is only
 * used to build the organizer dropdown and to resolve `?city=` slugs into a
 * readable label — the Discover filter builds its options from the cities that
 * actually have upcoming events.
 */
export const NIGERIAN_CITIES = [
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Kaduna",
  "Ibadan",
  "Kano",
  "Enugu",
  "Benin City",
  "Jos",
  "Owerri",
  "Abeokuta",
  "Warri",
  "Uyo",
  "Calabar",
  "Ilorin",
  "Akure",
] as const;

export const LAST_CITY_STORAGE_KEY = "tixnaija:last-city";

/** "Port Harcourt" -> "port-harcourt" */
export function citySlug(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Resolves a `?city=` slug back to a display name.
 *
 * Only slugs that correspond to a known city (either the fixed list or a city
 * that currently has events) resolve; anything else is treated as "all cities"
 * so a stale or hand-edited share link still shows results.
 */
export function cityNameFromSlug(
  slug: string | null | undefined,
  knownCities: readonly string[] = NIGERIAN_CITIES,
): string | null {
  if (!slug) return null;
  const target = citySlug(slug);
  if (!target) return null;
  for (const city of knownCities) {
    if (citySlug(city) === target) return city;
  }
  for (const city of NIGERIAN_CITIES) {
    if (citySlug(city) === target) return city;
  }
  return null;
}

export function readStoredCity(): string | null {
  try {
    const stored = window.localStorage.getItem(LAST_CITY_STORAGE_KEY);
    if (!stored) return null;
    return cityNameFromSlug(stored);
  } catch {
    return null;
  }
}

export function storeCity(city: string | null): void {
  try {
    if (city) window.localStorage.setItem(LAST_CITY_STORAGE_KEY, citySlug(city));
    else window.localStorage.removeItem(LAST_CITY_STORAGE_KEY);
  } catch {
    // Private mode / storage disabled: remembering is a nicety, never required.
  }
}
