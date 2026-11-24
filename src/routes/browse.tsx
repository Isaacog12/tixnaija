import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  CalendarDays,
  MapPin,
  Compass,
  LayoutGrid,
  Rows3,
  Tag,
  ChevronDown,
  ArrowRight,
  Radio,
  X,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { filterActiveEvents } from "@/lib/events";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RecentSearches } from "@/components/recent-searches";
import { formatNaira } from "@/lib/currency";
import { optimizeImage, imageSrcSet } from "@/lib/image";
import { cn } from "@/lib/utils";
import { searchEventIds } from "@/lib/event-search";
import { getEventStock, type EventStock, type TicketStockTier } from "@/lib/ticket-stock";
import { cityNameFromSlug, citySlug, readStoredCity, storeCity } from "@/lib/cities";
import { useRecentSearches } from "@/lib/recent-searches";

type EventCategory = Database["public"]["Enums"]["event_category"];
type DateFilter = NonNullable<z.infer<typeof searchSchema>["date"]>;
type PriceFilter = NonNullable<z.infer<typeof searchSchema>["price"]>;

const searchSchema = z.object({
  q: z.string().optional(),
  c: z.string().optional(),
  city: z.string().optional(),
  date: z.enum(["all", "today", "week", "month"]).optional(),
  price: z.enum(["all", "free", "paid", "under_5k", "under_20k"]).optional(),
  view: z.enum(["grid", "list"]).optional(),
});

type BrowseEvent = {
  id: string;
  title: string;
  slug: string;
  city: string | null;
  venue_name: string | null;
  start_datetime: string;
  end_datetime: string | null;
  cover_image_url: string | null;
  description: string | null;
  status: string;
  category: EventCategory | null;
  tags: string[] | null;
};

type BrowseResult = {
  events: BrowseEvent[];
  minPrice: Record<string, number>;
  stock: Record<string, EventStock>;
};

const SEARCH_DEBOUNCE_MS = 250;

export const Route = createFileRoute("/browse")({
  validateSearch: searchSchema,
  /**
   * Server-renders the unfiltered listing only.
   *
   * Deliberately NOT keyed on the search params: if it were, every filter
   * change would block the navigation until the server answered, and the
   * category pills would feel broken. Filters stay client-driven and instant.
   * Crawlers land on /browse with no params, so this is what gets indexed.
   */
  loader: async () => ({
    deps: { q: "", c: "All", date: "all", city: null },
    result: await fetchEvents("", "All", "all", null),
  }),
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Discover Events — TixNaija" },
      { name: "description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:title", content: "Discover Events — TixNaija" },
      { property: "og:description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://tixnaija.name.ng/browse" },
    ],
    // The canonical URL is emitted by the root route for every page.
  }),
});

async function fetchEvents(
  q: string,
  category: string,
  dateFilter: string,
  cityName: string | null,
  signal?: AbortSignal,
): Promise<BrowseResult> {
  const now = new Date();
  const cleaned = q.trim();

  // Search relevance comes from the RPC; `null` means it is not deployed yet
  // and we fall back to the literal ILIKE search below.
  const matchedIds = cleaned.length >= 2 ? await searchEventIds(cleaned) : [];
  if (matchedIds && matchedIds.length === 0 && cleaned.length >= 2) {
    return { events: [], minPrice: {}, stock: {} };
  }

  let query = supabase
    .from("events")
    .select(
      "id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category, tags, ticket_types(price_kobo, quantity_available, quantity_sold, quantity_cancelled)",
    )
    .eq("status", "published")
    .gte("end_datetime", now.toISOString())
    .order("start_datetime", { ascending: true })
    .limit(100);

  if (signal) query = query.abortSignal(signal);

  if (matchedIds) {
    if (matchedIds.length > 0) query = query.in("id", matchedIds);
  } else if (cleaned) {
    const safe = cleaned.replace(/[,()%_*"]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      const like = `"%${safe}%"`;
      query = query.or(
        `title.ilike.${like},description.ilike.${like},city.ilike.${like},venue_name.ilike.${like}`,
      );
    }
  }

  if (dateFilter === "today") {
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    query = query.gte("start_datetime", now.toISOString()).lte("start_datetime", endOfDay.toISOString());
  } else if (dateFilter === "week") {
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    query = query.gte("start_datetime", now.toISOString()).lte("start_datetime", nextWeek.toISOString());
  } else if (dateFilter === "month") {
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);
    query = query.gte("start_datetime", now.toISOString()).lte("start_datetime", nextMonth.toISOString());
  }

  if (category && category !== "All") {
    const mappedCategory = CATEGORY_SLUG[category] ?? (category.toLowerCase() as EventCategory);
    query = query.eq("category", mappedCategory);
  }

  if (cityName) query = query.ilike("city", cityName);

  const { data, error } = await query;
  if (error) throw error;

  const validEvents = filterActiveEvents(data, now) as unknown as BrowseEvent[];

  const minPrice: Record<string, number> = {};
  const stock: Record<string, EventStock> = {};
  const rank = new Map((matchedIds ?? []).map((id, index) => [id, index]));

  for (const ev of validEvents) {
    const tiers = (ev as BrowseEvent & { ticket_types?: TicketStockTier[] | null }).ticket_types;
    const eventStock = getEventStock(tiers ?? []);
    stock[ev.id] = eventStock;
    minPrice[ev.id] = tiers && tiers.length > 0 ? Math.min(...tiers.map((t) => t.price_kobo)) : 0;
    delete (ev as { ticket_types?: unknown }).ticket_types; // Keep original object shape clean
  }

  // Sold-out events stay visible but sink below everything still buyable,
  // keeping relevance then date order inside each group.
  validEvents.sort((a, b) => {
    const aSold = stock[a.id]?.isSoldOut ? 1 : 0;
    const bSold = stock[b.id]?.isSoldOut ? 1 : 0;
    if (aSold !== bSold) return aSold - bSold;

    if (matchedIds && matchedIds.length > 0) {
      const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
    }

    return new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime();
  });

  return { events: validEvents, minPrice, stock };
}

const CATEGORY_SLUG: Record<string, EventCategory> = {
  Concerts: "music",
  Comedy: "comedy",
  Conferences: "conference",
  Parties: "party",
  Church: "church",
  Campus: "campus",
  Tech: "other",
};

const CATEGORIES = ["All", "Concerts", "Comedy", "Conferences", "Parties", "Church", "Campus", "Tech"];

const DATE_LABELS: Record<DateFilter, string> = {
  all: "Any date",
  today: "Today",
  week: "This week",
  month: "This month",
};

const PRICE_LABELS: Record<PriceFilter, string> = {
  all: "Any price",
  free: "Free",
  paid: "Paid",
  under_5k: "Under ₦5,000",
  under_20k: "Under ₦20,000",
};

/**
 * Event time is always Lagos time, on the server and in the browser.
 *
 * Without a fixed zone this formatted in the runtime's zone: the server (UTC)
 * and a visitor in WAT produced different text for the same event, which is a
 * hydration mismatch (React #418) for anything near midnight — and a delay for
 * anyone browsing from abroad.
 */
const EVENT_ZONE = "Africa/Lagos";

function formatEventDate(value: string) {
  const date = new Date(value);
  return {
    weekday: date.toLocaleString("en-NG", { weekday: "short", timeZone: EVENT_ZONE }),
    day: date.toLocaleString("en-NG", { day: "numeric", timeZone: EVENT_ZONE }),
    month: date.toLocaleString("en-NG", { month: "short", timeZone: EVENT_ZONE }),
    time: date.toLocaleString("en-NG", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: EVENT_ZONE,
    }),
  };
}

function priceLabel(kobo: number | undefined) {
  if (kobo === undefined || kobo === 0) return "Free";
  return formatNaira(kobo);
}

function BrowsePage() {
  const { q, c, city, date, price, view } = Route.useSearch();
  const navigate = useNavigate();
  const {
    items: recentItems,
    hydrate: hydrateRecent,
    remember: rememberSearch,
    forget: forgetSearch,
    clear: clearSearches,
  } = useRecentSearches();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState(c ?? "All");
  const [activeDate, setActiveDate] = useState<DateFilter>(date ?? "all");
  const [activePrice, setActivePrice] = useState<PriceFilter>(price ?? "all");
  const [activeView, setActiveView] = useState(view ?? "grid");
  const cityHydrated = useRef(false);

  /**
   * Filter and typing updates REPLACE the history entry. Otherwise every
   * debounced keystroke pause pushes an entry and Back walks through partial
   * queries. An explicit submit passes `push` so Back still returns to the
   * previous result set.
   */
  const updateSearch = (
    updates: Partial<z.infer<typeof searchSchema>>,
    options?: { push?: boolean },
  ) => {
    navigate({
      to: "/browse",
      replace: options?.push !== true,
      search: (prev) => ({
        ...prev,
        ...updates,
        q: updates.q !== undefined ? updates.q || undefined : prev.q,
        c: updates.c !== undefined ? (updates.c === "All" ? undefined : updates.c) : prev.c,
        city: updates.city !== undefined ? updates.city || undefined : prev.city,
        date: updates.date !== undefined ? (updates.date === "all" ? undefined : updates.date) : prev.date,
        price: updates.price !== undefined ? (updates.price === "all" ? undefined : updates.price) : prev.price,
        view: updates.view !== undefined ? (updates.view === "grid" ? undefined : updates.view) : prev.view,
      }),
    });
  };

  const loaderData = Route.useLoaderData();

  const cityOptions = React.useMemo(() => {
    const counts = new Map<string, { name: string; slug: string; count: number }>();
    for (const ev of loaderData.result.events) {
      if (!ev.city) continue;
      const slug = citySlug(ev.city);
      if (!slug) continue;
      const existing = counts.get(slug);
      if (existing) existing.count += 1;
      else counts.set(slug, { name: ev.city, slug, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [loaderData.result.events]);

  const knownCityNames = React.useMemo(() => cityOptions.map((option) => option.name), [cityOptions]);
  const activeCityName = cityNameFromSlug(city, knownCityNames);

  // A shared link can name a city that has no upcoming events, so it is not in
  // the dropdown; keep it selectable instead of rendering a blank control.
  const citySelectOptions = React.useMemo(() => {
    const entries: Array<[string, string]> = cityOptions.map((option) => [
      option.slug,
      `${option.name} (${option.count})`,
    ]);
    if (activeCityName) {
      const activeSlug = citySlug(activeCityName);
      if (!entries.some(([slug]) => slug === activeSlug)) entries.unshift([activeSlug, activeCityName]);
    }
    return { all: "All cities", ...Object.fromEntries(entries) };
  }, [cityOptions, activeCityName]);

  useEffect(() => {
    setSearchInput(q ?? "");
    setActiveCategory(c ?? "All");
    setActiveDate(date ?? "all");
    setActivePrice(price ?? "all");
    setActiveView(view ?? "grid");
  }, [q, c, date, price, view]);

  useEffect(() => {
    hydrateRecent();
  }, [hydrateRecent]);

  /**
   * The remembered city only fills in when the URL carries no city at all, and
   * only once per mount so choosing "All cities" does not snap back.
   */
  useEffect(() => {
    if (cityHydrated.current) return;
    cityHydrated.current = true;
    if (city) return;
    const stored = readStoredCity();
    if (stored) updateSearch({ city: citySlug(stored) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * The loader only ever fetched the unfiltered listing, so it may seed the
   * cache solely when no filters are active. With filters applied the query
   * fetches on the client exactly as before, keeping filter changes instant.
   */
  const loaderMatchesSearch =
    loaderData.deps.q === (q ?? "") &&
    loaderData.deps.c === (c ?? "All") &&
    loaderData.deps.date === (date ?? "all") &&
    loaderData.deps.city === null &&
    !city;

  const query = useQuery({
    queryKey: ["browse", q ?? "", c ?? "All", date ?? "all", activeCityName ?? ""],
    queryFn: ({ signal }) => fetchEvents(q ?? "", c ?? "All", date ?? "all", activeCityName, signal),
    staleTime: 1000 * 60 * 5,
    initialData: loaderMatchesSearch ? loaderData.result : undefined,
  });

  // Live search: only after two characters, paused for a beat, so typing is
  // never one request per keystroke. Submitting still searches immediately.
  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === (q ?? "")) return;
    if (trimmed.length === 1) return;
    const id = window.setTimeout(() => updateSearch({ q: trimmed }), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, q]);

  const filteredEvents = React.useMemo(() => {
    if (!query.data) return [];
    return query.data.events.filter((ev) => {
      const min = query.data?.minPrice[ev.id] ?? 0;
      if (activePrice === "free") return min === 0;
      if (activePrice === "paid") return min > 0;
      if (activePrice === "under_5k") return min > 0 && min <= 500000;
      if (activePrice === "under_20k") return min > 0 && min <= 2000000;
      return true;
    });
  }, [query.data, activePrice]);

  // Absent search params are the default view, not a filter. Comparing them
  // directly against "all" reads "no filters" as "filtered" and hides the
  // default listing behind a Results heading.
  const isUnfiltered =
    !q && (!c || c === "All") && (!date || date === "all") && (!price || price === "all") && !activeCityName;
  // The spotlight is a grid-view affordance. In list view every result — including
  // the first — renders as a row, so the toggle always has a visible effect even
  // when a single event is listed.
  const spotlight = isUnfiltered && activeView === "grid" ? filteredEvents[0] : undefined;
  const gridEvents = spotlight ? filteredEvents.slice(1) : filteredEvents;
  const hasFilters =
    Boolean(q) || activeCategory !== "All" || activeDate !== "all" || activePrice !== "all" || Boolean(activeCityName);
  const hasFilterBeyondCity = Boolean(q) || activeCategory !== "All" || activeDate !== "all" || activePrice !== "all";

  const resetFilters = () => {
    storeCity(null);
    updateSearch({ q: "", c: "All", city: "", date: "all", price: "all" });
  };

  const countText = query.isLoading
    ? "Loading events…"
    : (() => {
        const total = filteredEvents.length;
        const noun = `${total} ${total === 1 ? "event" : "events"}`;
        const scope = activeCityName ? ` in ${activeCityName}` : "";
        if (isUnfiltered) return "Curated from every published event on TixNaija.";
        const verb = total === 1 ? "matches" : "match";
        return `${noun}${scope}${hasFilterBeyondCity ? ` ${verb} your filters` : " happening soon"}.`;
      })();

  const emptyHeading = q
    ? `No events match “${q.trim()}”`
    : activeCityName && !hasFilterBeyondCity
      ? `Nothing in ${activeCityName} yet`
      : "Nothing matches those filters";

  const emptyCopy = (() => {
    const categoryLabel = activeCategory === "All" ? "events" : activeCategory.toLowerCase();
    const where = activeCityName ? ` in ${activeCityName}` : "";
    if (activeDate !== "all" && activePrice !== "all") {
      return `No ${categoryLabel}${where} on ${DATE_LABELS[activeDate].toLowerCase()} at that price.`;
    }
    if (activeDate !== "all") {
      return `No ${categoryLabel}${where} ${DATE_LABELS[activeDate].toLowerCase()}. Try any date.`;
    }
    if (activePrice !== "all") {
      return `No ${categoryLabel}${where} at ${PRICE_LABELS[activePrice].toLowerCase()}. Try any price.`;
    }
    if (activeCityName) {
      return `We have no upcoming ${categoryLabel} in ${activeCityName}. Other cities are worth a look.`;
    }
    return "No events fit those filters. Try a wider date range or a different category.";
  })();

  const primarySuggestion = (() => {
    if (activeDate !== "all") return { label: "Try any date", run: () => updateSearch({ date: "all" }) };
    if (activePrice !== "all") return { label: "Try any price", run: () => updateSearch({ price: "all" }) };
    if (activeCityName) return { label: "Search all cities", run: () => updateSearch({ city: "" }) };
    return { label: "Clear filters", run: resetFilters };
  })();

  const showRecents = searchFocused && !searchInput.trim() && recentItems.length > 0;

  return (
    <div className="min-h-dvh bg-background selection:bg-primary/20">
      <SiteNav />

      {/* ── Editorial header ─────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 md:pb-14 md:pt-16 lg:px-8">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            TixNaija / Discover
          </div>

          <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="type-heading-xl text-foreground">Discover</h1>
              <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
                Concerts, comedy, conferences and parties across Nigeria. Reserve a seat in
                seconds — your QR ticket arrives by email.
              </p>
            </div>

            <div className="w-full lg:max-w-md">
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = searchInput.trim();
                  if (value) rememberSearch(value);
                  updateSearch({ q: value }, { push: true });
                  setSearchFocused(false);
                }}
                className="group w-full"
              >
                <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card p-1.5 transition-colors duration-[var(--duration-fast)]">
                  <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                    placeholder="Search events, artists, venues…"
                    aria-label="Search events"
                    className="h-10 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/80"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        updateSearch({ q: "" });
                      }}
                      aria-label="Clear search"
                      className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    className="h-9 shrink-0 rounded-md bg-primary px-5 text-xs font-semibold text-primary-foreground press-sm hover:bg-primary/90"
                  >
                    Search
                  </Button>
                </div>
              </form>

              {showRecents && (
                <RecentSearches
                  items={recentItems}
                  onPick={(value) => {
                    setSearchInput(value);
                    rememberSearch(value);
                    updateSearch({ q: value }, { push: true });
                  }}
                  onRemove={forgetSearch}
                  onClear={clearSearches}
                  onDismiss={() => setSearchFocused(false)}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Sticky filter rail ───────────────────────────────────────── */}
      <div className="sticky top-16 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl sm:top-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Desktop rail */}
          <div className="hidden items-center justify-between gap-4 py-3 md:flex">
            <div className="-mx-1 flex flex-1 items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat);
                    updateSearch({ c: cat });
                  }}
                  aria-pressed={activeCategory === cat}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors duration-[var(--duration-micro)] press-sm",
                    activeCategory === cat
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <FilterSelect
                icon={<MapPin className="h-3.5 w-3.5" />}
                value={activeCityName ? citySlug(activeCityName) : "all"}
                onChange={(value) => {
                  const pick = value === "all" ? null : value;
                  storeCity(pick);
                  updateSearch({ city: pick ?? undefined });
                }}
                label={activeCityName ?? "All cities"}
                options={citySelectOptions}
              />
              <FilterSelect
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                value={activeDate}
                onChange={(value) => {
                  setActiveDate(value as DateFilter);
                  updateSearch({ date: value as DateFilter });
                }}
                label={DATE_LABELS[activeDate]}
                options={DATE_LABELS}
              />
              <FilterSelect
                icon={<Tag className="h-3.5 w-3.5" />}
                value={activePrice}
                onChange={(value) => {
                  setActivePrice(value as PriceFilter);
                  updateSearch({ price: value as PriceFilter });
                }}
                label={PRICE_LABELS[activePrice]}
                options={PRICE_LABELS}
              />

              <div className="ml-1 flex items-center rounded-full border border-border/70 p-0.5">
                <ViewToggle
                  active={activeView === "grid"}
                  onClick={() => {
                    setActiveView("grid");
                    updateSearch({ view: "grid" });
                  }}
                  label="Grid view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </ViewToggle>
                <ViewToggle
                  active={activeView === "list"}
                  onClick={() => {
                    setActiveView("list");
                    updateSearch({ view: "list" });
                  }}
                  label="List view"
                >
                  <Rows3 className="h-4 w-4" />
                </ViewToggle>
              </div>
            </div>
          </div>

          {/* Mobile rail: two rows of two so nothing gets squeezed at 360px */}
          <div className="grid grid-cols-2 gap-2 py-3 md:hidden">
            <MobileSelect
              icon={<Compass className="h-4 w-4" />}
              value={activeCategory}
              onChange={(value) => {
                setActiveCategory(value);
                updateSearch({ c: value });
              }}
              options={Object.fromEntries(CATEGORIES.map((cat) => [cat, cat === "All" ? "All categories" : cat]))}
              label={activeCategory === "All" ? "All categories" : activeCategory}
            />
            <MobileSelect
              icon={<MapPin className="h-4 w-4" />}
              value={activeCityName ? citySlug(activeCityName) : "all"}
              onChange={(value) => {
                const pick = value === "all" ? null : value;
                storeCity(pick);
                updateSearch({ city: pick ?? undefined });
              }}
              label={activeCityName ?? "All cities"}
              options={citySelectOptions}
            />
            <MobileSelect
              icon={<CalendarDays className="h-4 w-4" />}
              value={activeDate}
              onChange={(value) => {
                setActiveDate(value as DateFilter);
                updateSearch({ date: value as DateFilter });
              }}
              options={DATE_LABELS}
              label={DATE_LABELS[activeDate]}
            />
            <MobileSelect
              icon={<Tag className="h-4 w-4" />}
              value={activePrice}
              onChange={(value) => {
                setActivePrice(value as PriceFilter);
                updateSearch({ price: value as PriceFilter });
              }}
              options={PRICE_LABELS}
              label={PRICE_LABELS[activePrice]}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 md:pt-12 lg:px-8">
        {/* Results heading */}
        <div className="mb-8 flex items-end justify-between gap-4 border-b border-border/50 pb-5">
          <div>
            <h2 className="font-display text-2xl leading-none text-foreground md:text-[28px]">
              {isUnfiltered ? "Happening soon" : "Results"}
            </h2>
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-[13px] text-muted-foreground"
            >
              {countText}
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 text-[12px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Reset filters
            </button>
          )}
        </div>

        {/* Loading */}
        {query.isLoading && (
          <div className={activeView === "list" ? "flex flex-col gap-4" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-border/50 bg-card"
              >
                <div className="aspect-[16/10] animate-pulse bg-muted/70" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-muted/70" />
                  <div className="h-5 w-4/5 animate-pulse rounded-md bg-muted/70" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {query.error && (
          <div className="mx-auto max-w-xl rounded-lg border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
            <h3 className="font-display text-xl text-foreground">We couldn't load events.</h3>
            <p className="mt-2 text-sm text-muted-foreground">Please refresh the page or try again.</p>
          </div>
        )}

        {/* Empty */}
        {query.data && filteredEvents.length === 0 && (
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
            <Search className="mb-5 h-7 w-7 text-muted-foreground/50" aria-hidden />
            <h3 className="font-display text-2xl text-foreground">{emptyHeading}</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{emptyCopy}</p>

            {q && activeCityName && (
              <button
                type="button"
                onClick={() => updateSearch({ city: "" })}
                className="mt-4 text-[12px] font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Search all cities for “{q.trim()}”
              </button>
            )}

            {q && (
              <div className="mt-6 w-full border-t border-border/60 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Try a category
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {CATEGORIES.filter((cat) => cat !== "All")
                    .slice(0, 5)
                    .map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => updateSearch({ q: "", c: cat })}
                        className="rounded-full border border-border/70 px-3 py-1 text-[12px] font-medium text-foreground transition-colors hover:bg-secondary/60"
                      >
                        {cat}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" className="rounded-md px-5 press-sm" onClick={primarySuggestion.run}>
                {primarySuggestion.label}
              </Button>
              {hasFilters && primarySuggestion.label !== "Clear filters" && (
                <Button variant="ghost" className="rounded-md px-4 press-sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        )}

        {query.data && filteredEvents.length > 0 && (
          <>
            {/* Spotlight */}
            {spotlight && (
              <Link
                to="/e/$slug"
                params={{ slug: spotlight.slug }}
                className="group mb-10 block overflow-hidden rounded-xl border border-border/60 bg-card transition-colors duration-[var(--duration-default)] hover:border-border"
              >
                <div className="grid md:grid-cols-[1.2fr_1fr]">
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary/40 md:aspect-auto md:min-h-[340px]">
                    {spotlight.cover_image_url ? (
                      <img
                        src={optimizeImage(spotlight.cover_image_url, 1000)}
                        srcSet={imageSrcSet(spotlight.cover_image_url, [600, 900, 1200])}
                        sizes="(max-width: 768px) 100vw, 55vw"
                        alt={spotlight.title}
                        width={1000}
                        height={625}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-smooth)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-secondary/60" />
                    )}
                    <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-background/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-foreground backdrop-blur-md">
                      <Radio className="h-3 w-3 text-primary" aria-hidden />
                      Spotlight
                    </span>
                  </div>

                  <div className="flex flex-col justify-center gap-5 p-6 md:p-9">
                    <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                      {formatEventDate(spotlight.start_datetime).weekday}
                      <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
                      {formatEventDate(spotlight.start_datetime).day} {formatEventDate(spotlight.start_datetime).month}
                      <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
                      {formatEventDate(spotlight.start_datetime).time}
                    </div>

                    <h3 className="font-display text-3xl leading-[1.08] tracking-[-0.02em] text-foreground md:text-[38px]">
                      {spotlight.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {spotlight.venue_name && (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 opacity-70" aria-hidden />
                          {spotlight.venue_name}
                          {spotlight.city ? `, ${spotlight.city}` : ""}
                        </span>
                      )}
                      <span className="text-foreground">
                        {priceLabel(query.data?.minPrice[spotlight.id])}
                      </span>
                    </div>

                    <span className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                      View event
                      <ArrowRight className="h-4 w-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-1" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            )}

            <div
              className={
                activeView === "list"
                  ? "flex flex-col gap-4"
                  : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              }
            >
              {gridEvents.map((ev, index) => {
                const min = query.data?.minPrice[ev.id];
                const isCancelled = ev.status === "cancelled";
                const stock = query.data?.stock[ev.id];
                const isSoldOut = !isCancelled && Boolean(stock?.isSoldOut);
                const isFewLeft = !isCancelled && Boolean(stock?.isFewLeft);
                const isAboveFold = index < 4;

                const card = (
                  <div className={cn("flex h-full w-full", activeView === "list" ? "flex-col sm:flex-row" : "flex-col")}>
                    <div
                      className={cn(
                        "relative overflow-hidden bg-secondary/40",
                        activeView === "list"
                          ? "aspect-[16/10] w-full shrink-0 sm:aspect-auto sm:h-full sm:w-[280px]"
                          : "aspect-[16/10] w-full",
                      )}
                    >
                      {ev.cover_image_url ? (
                        <img
                          src={optimizeImage(ev.cover_image_url, activeView === "list" ? 600 : 700)}
                          srcSet={imageSrcSet(
                            ev.cover_image_url,
                            activeView === "list" ? [320, 480, 640] : [400, 600, 800],
                          )}
                          sizes={
                            activeView === "list"
                              ? "(max-width: 640px) 100vw, 280px"
                              : "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          }
                          alt={ev.title}
                          width={700}
                          height={438}
                          loading={isAboveFold ? "eager" : "lazy"}
                          decoding="async"
                          className={cn(
                            "h-full w-full object-cover transition-transform duration-[900ms] ease-[var(--ease-smooth)]",
                            !isCancelled && !isSoldOut && "group-hover:scale-[1.05]",
                            (isCancelled || isSoldOut) && "opacity-70",
                            isCancelled && "grayscale",
                          )}
                        />
                      ) : (
                        <div className="h-full w-full bg-secondary/60" />
                      )}

                      {ev.category && !isCancelled && (
                        <span className="absolute left-4 top-4 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground backdrop-blur-md">
                          {ev.category}
                        </span>
                      )}

                      {isCancelled && (
                        <span className="absolute left-4 top-4 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-destructive-foreground">
                          Cancelled
                        </span>
                      )}

                      {!isCancelled && (
                        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                          {isFewLeft && (
                            <span className="rounded-full border border-primary/40 bg-background/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary backdrop-blur-md">
                              Few left
                            </span>
                          )}
                          <span
                            className={cn(
                              "rounded-full bg-background/90 px-3 py-1 backdrop-blur-md",
                              isSoldOut
                                ? "text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
                                : "text-[12px] font-semibold text-foreground",
                            )}
                          >
                            {isSoldOut ? "Sold out" : priceLabel(min)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={cn("flex flex-1 flex-col p-5", activeView === "list" && "justify-center sm:p-7")}>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                        <span>{formatEventDate(ev.start_datetime).weekday}</span>
                        <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
                        <span>{formatEventDate(ev.start_datetime).day} {formatEventDate(ev.start_datetime).month}</span>
                        <span className="h-1 w-1 rounded-full bg-border" aria-hidden />
                        <span className="text-muted-foreground">{formatEventDate(ev.start_datetime).time}</span>
                      </div>

                      <h3
                        className={cn(
                          "mt-3 line-clamp-2 font-display text-[21px] leading-[1.15] tracking-[-0.01em] transition-colors duration-[var(--duration-micro)]",
                          isCancelled
                            ? "text-muted-foreground line-through"
                            : isSoldOut
                              ? "text-foreground/80"
                              : "text-foreground group-hover:text-primary",
                        )}
                      >
                        {ev.title}
                      </h3>

                      <div className="mt-auto flex items-center gap-1.5 pt-4 text-[13px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                        <span className="line-clamp-1">
                          {[ev.venue_name, ev.city].filter(Boolean).join(", ") || "Venue to be announced"}
                        </span>
                      </div>

                      {isSoldOut && (
                        <span className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                          Join waitlist
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </span>
                      )}

                      {ev.tags && ev.tags.length > 0 && activeView === "list" && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {ev.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );

                const cardClass = cn(
                  "group relative block h-full overflow-hidden rounded-lg border border-border/60",
                  isSoldOut ? "bg-card/70" : "bg-card",
                  "transition-colors duration-[var(--duration-default)]",
                  !isCancelled && "hover:border-border",
                  isCancelled && "opacity-75",
                );

                if (isCancelled) {
                  return (
                    <div key={ev.id} className={cardClass} aria-disabled="true">
                      {card}
                    </div>
                  );
                }

                return (
                  <Link key={ev.id} to="/e/$slug" params={{ slug: ev.slug }} className={cardClass}>
                    {card}
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

/** Compact pill select used in the desktop rail. */
function FilterSelect({
  icon,
  value,
  onChange,
  label,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Record<string, string>;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-8 max-w-[190px] appearance-none truncate rounded-full border border-border/70 bg-card pl-8 pr-8 text-[12px] font-medium text-foreground transition-colors [color-scheme:light] hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:[color-scheme:dark] [&>option]:bg-card [&>option]:text-foreground"
      >
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

/** Full-width select used on small screens, where pills do not fit. */
function MobileSelect({
  icon,
  value,
  onChange,
  label,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  label: string;
  options: Record<string, string>;
}) {
  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-10 w-full appearance-none truncate rounded-md border border-border/70 bg-card pl-9 pr-8 text-[12px] font-medium text-foreground [color-scheme:light] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:[color-scheme:dark] [&>option]:bg-card [&>option]:text-foreground"
      >
        {Object.entries(options).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "rounded-full p-1.5 transition-colors duration-[var(--duration-micro)] press-sm",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
