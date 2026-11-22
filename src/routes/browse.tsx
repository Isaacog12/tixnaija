import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import {
  Search,
  CalendarDays,
  MapPin,
  Compass,
  Frown,
  LayoutGrid,
  Rows3,
  Tag,
  ChevronDown,
  ArrowRight,
  Radio,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { filterActiveEvents } from "@/lib/events";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/currency";
import { optimizeImage, imageSrcSet } from "@/lib/image";
import { cn } from "@/lib/utils";

type EventCategory = Database["public"]["Enums"]["event_category"];
type DateFilter = NonNullable<z.infer<typeof searchSchema>["date"]>;
type PriceFilter = NonNullable<z.infer<typeof searchSchema>["price"]>;

const searchSchema = z.object({
  q: z.string().optional(),
  c: z.string().optional(),
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
    deps: { q: "", c: "All", date: "all" },
    result: await fetchEvents("", "All", "all"),
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

async function fetchEvents(q: string, category: string, dateFilter: string) {
  const now = new Date();

  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category, tags, ticket_types(price_kobo)")
    .eq("status", "published")
    .gte("end_datetime", now.toISOString())
    .order("start_datetime", { ascending: true })
    .limit(100);

  const cleaned = q.trim();
  if (cleaned) {
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

  const { data, error } = await query;
  if (error) throw error;

  const validEvents = filterActiveEvents(data, now) as unknown as BrowseEvent[];

  const minPrice: Record<string, number> = {};
  for (const ev of validEvents) {
    const tiers = (ev as BrowseEvent & { ticket_types?: { price_kobo: number }[] | null }).ticket_types;
    minPrice[ev.id] = tiers && tiers.length > 0 ? Math.min(...tiers.map((t) => t.price_kobo)) : 0;
    delete (ev as { ticket_types?: unknown }).ticket_types; // Keep original object shape clean
  }

  return { events: validEvents, minPrice };
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

function formatEventDate(value: string) {
  const date = new Date(value);
  return {
    weekday: date.toLocaleString("en-NG", { weekday: "short" }),
    day: date.toLocaleString("en-NG", { day: "numeric" }),
    month: date.toLocaleString("en-NG", { month: "short" }),
    time: date.toLocaleString("en-NG", { hour: "numeric", minute: "2-digit" }),
  };
}

function priceLabel(kobo: number | undefined) {
  if (kobo === undefined || kobo === 0) return "Free";
  return formatNaira(kobo);
}

function BrowsePage() {
  const { q, c, date, price, view } = Route.useSearch();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [activeCategory, setActiveCategory] = useState(c ?? "All");
  const [activeDate, setActiveDate] = useState<DateFilter>(date ?? "all");
  const [activePrice, setActivePrice] = useState<PriceFilter>(price ?? "all");
  const [activeView, setActiveView] = useState(view ?? "grid");

  useEffect(() => {
    setSearchInput(q ?? "");
    setActiveCategory(c ?? "All");
    setActiveDate(date ?? "all");
    setActivePrice(price ?? "all");
    setActiveView(view ?? "grid");
  }, [q, c, date, price, view]);

  const loaderData = Route.useLoaderData();

  /**
   * The loader only ever fetched the unfiltered listing, so it may seed the
   * cache solely when no filters are active. With filters applied the query
   * fetches on the client exactly as before, keeping filter changes instant.
   */
  const loaderMatchesSearch =
    loaderData.deps.q === (q ?? "") &&
    loaderData.deps.c === (c ?? "All") &&
    loaderData.deps.date === (date ?? "all");

  const query = useQuery({
    queryKey: ["browse", q ?? "", c ?? "All", date ?? "all"],
    queryFn: () => fetchEvents(q ?? "", c ?? "All", date ?? "all"),
    staleTime: 1000 * 60 * 5,
    initialData: loaderMatchesSearch ? loaderData.result : undefined,
  });

  const updateSearch = (updates: Partial<typeof searchSchema._type>) => {
    navigate({
      to: "/browse",
      search: (prev) => ({
        ...prev,
        ...updates,
        q: updates.q !== undefined ? updates.q || undefined : prev.q,
        c: updates.c !== undefined ? (updates.c === "All" ? undefined : updates.c) : prev.c,
        date: updates.date !== undefined ? (updates.date === "all" ? undefined : updates.date) : prev.date,
        price: updates.price !== undefined ? (updates.price === "all" ? undefined : updates.price) : prev.price,
        view: updates.view !== undefined ? (updates.view === "grid" ? undefined : updates.view) : prev.view,
      }),
    });
  };

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
    !q && (!c || c === "All") && (!date || date === "all") && (!price || price === "all");
  // The spotlight is a grid-view affordance. In list view every result — including
  // the first — renders as a row, so the toggle always has a visible effect even
  // when a single event is listed.
  const spotlight = isUnfiltered && activeView === "grid" ? filteredEvents[0] : undefined;
  const gridEvents = spotlight ? filteredEvents.slice(1) : filteredEvents;
  const hasFilters = Boolean(q) || activeCategory !== "All" || activeDate !== "all" || activePrice !== "all";

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

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSearch({ q: searchInput.trim() });
              }}
              className="group w-full lg:max-w-md"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-[var(--duration-fast)]">
                <Search className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search events, artists, venues…"
                  aria-label="Search events"
                  className="h-10 flex-1 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/80"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 shrink-0 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-sm press-sm hover:bg-primary/90"
                >
                  Search
                </Button>
              </div>
            </form>
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

          {/* Mobile rail */}
          <div className="flex items-center gap-2 py-3 md:hidden">
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
            <p className="mt-2 text-[13px] text-muted-foreground">
              {query.isLoading
                ? "Loading events…"
                : isUnfiltered
                  ? "Curated from every published event on TixNaija."
                  : `${filteredEvents.length} ${filteredEvents.length === 1 ? "event" : "events"} match your filters.`}
            </p>
          </div>
          {hasFilters && (
            <button
              type="button"
              onClick={() => updateSearch({ q: undefined, c: "All", date: "all", price: "all" })}
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
                className="overflow-hidden rounded-3xl border border-border/50 bg-card"
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
          <div className="mx-auto max-w-xl rounded-2xl border border-destructive/25 bg-destructive/5 px-6 py-10 text-center">
            <Frown className="mx-auto mb-4 h-8 w-8 text-destructive/60" aria-hidden />
            <h3 className="font-display text-xl text-foreground">We couldn't load events.</h3>
            <p className="mt-2 text-sm text-muted-foreground">Please refresh the page or try again.</p>
          </div>
        )}

        {/* Empty */}
        {query.data && filteredEvents.length === 0 && (
          <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center">
            <Search className="mb-5 h-7 w-7 text-muted-foreground/50" aria-hidden />
            <h3 className="font-display text-2xl text-foreground">Nothing matches yet</h3>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
              No events fit those filters. Try a wider date range or a different category.
            </p>
            <Button
              variant="outline"
              className="mt-6 rounded-xl px-6 press-sm"
              onClick={() => updateSearch({ q: undefined, c: "All", date: "all", price: "all" })}
            >
              Clear filters
            </Button>
          </div>
        )}

        {query.data && filteredEvents.length > 0 && (
          <>
            {/* Spotlight */}
            {spotlight && (
              <Link
                to="/e/$slug"
                params={{ slug: spotlight.slug }}
                className="group mb-10 block overflow-hidden rounded-[28px] border border-border/60 bg-card transition-[border-color,box-shadow] duration-[var(--duration-default)] hover:border-border hover:shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]"
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
                      <span className="text-foreground">{priceLabel(query.data?.minPrice[spotlight.id])}</span>
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
                            !isCancelled && "group-hover:scale-[1.05]",
                            isCancelled && "opacity-70 grayscale",
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
                        <span className="absolute bottom-3 right-3 rounded-full bg-background/90 px-3 py-1 text-[12px] font-semibold text-foreground backdrop-blur-md">
                          {priceLabel(min)}
                        </span>
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
                  "group relative block h-full overflow-hidden rounded-3xl border border-border/60 bg-card",
                  "transition-[transform,border-color,box-shadow] duration-[var(--duration-default)] ease-[var(--ease-snappy)]",
                  !isCancelled &&
                    "hover:-translate-y-1 hover:border-border hover:shadow-[0_26px_60px_-32px_rgba(0,0,0,0.45)]",
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
        className="h-8 appearance-none rounded-full border border-border/70 bg-transparent pl-8 pr-8 text-[12px] font-medium text-foreground transition-colors hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
    <div className="relative min-w-0 flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-10 w-full appearance-none truncate rounded-xl border border-border/70 bg-card pl-9 pr-8 text-[12px] font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
