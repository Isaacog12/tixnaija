import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Search, Calendar, MapPin, Sparkles, SlidersHorizontal, Flame } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/currency";

const searchSchema = z.object({ 
  q: z.string().optional(),
  c: z.string().optional()
});

export const Route = createFileRoute("/browse")({
  ssr: false,
  validateSearch: searchSchema,
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Discover Events — TixNaija" },
      { name: "description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:title", content: "Discover Events — TixNaija" },
      { property: "og:description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:type", content: "website" },
    ],
  }),
});

async function fetchEvents(q: string, category: string) {
  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category")
    .in("status", ["published", "cancelled"])
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
  } else {
    query = query.gte("start_datetime", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  }

  if (category && category !== "all") {
    query = query.eq("category", category.toLowerCase());
  }

  const { data, error } = await query;
  if (error) throw error;

  const validEvents: any[] = data ?? [];

  const ids = validEvents.map((e) => e.id);
  let minPrice: Record<string, number> = {};
  if (ids.length) {
    const { data: tts } = await supabase
      .from("ticket_types")
      .select("event_id, price_kobo")
      .in("event_id", ids);
    for (const t of tts ?? []) {
      if (minPrice[t.event_id] === undefined || t.price_kobo < minPrice[t.event_id]) {
        minPrice[t.event_id] = t.price_kobo;
      }
    }
  }
  return { events: validEvents, minPrice };
}

const CATEGORIES = ["All", "Concerts", "Comedy", "Conferences", "Parties", "Church", "Campus", "Tech"];

function BrowsePage() {
  const { q, c } = Route.useSearch();
  const navigate = useNavigate();
  
  const [searchInput, setSearchInput] = useState(q ?? "");
  const [activeCategory, setActiveCategory] = useState(c ?? "All");
  
  // Update state if URL changes externally
  useEffect(() => {
    setSearchInput(q ?? "");
    setActiveCategory(c ?? "All");
  }, [q, c]);

  const query = useQuery({
    queryKey: ["browse", q ?? "", c ?? "All"],
    queryFn: () => fetchEvents(q ?? "", c ?? "All"),
  });

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    navigate({ 
      to: "/browse", 
      search: { 
        q: searchInput.trim() || undefined,
        c: activeCategory === "All" ? undefined : activeCategory
      } 
    });
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    navigate({ 
      to: "/browse", 
      search: { 
        q: searchInput.trim() || undefined,
        c: cat === "All" ? undefined : cat
      } 
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-card/30 pb-8 pt-12 md:pt-16 md:pb-12">
        {/* Abstract Background Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
          <div className="absolute top-20 -left-20 h-[300px] w-[300px] rounded-full bg-blue-500/10 blur-[80px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-3 py-1 mb-6 text-sm backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Discover the best experiences</span>
          </div>
          
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl tracking-tight mb-4">
            Find your next <span className="text-gradient-sunset">vibe.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-muted-foreground text-lg mb-8">
            Explore thousands of concerts, comedy shows, tech conferences, and exclusive parties happening across Nigeria.
          </p>

          {/* Search Bar */}
          <form
            className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-border bg-background/80 p-2 shadow-xl backdrop-blur-xl transition-all focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary/50"
            onSubmit={handleSearch}
          >
            <div className="pl-4">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by event name, artist, or city..."
              className="h-12 border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70"
            />
            <Button type="submit" size="lg" className="rounded-full gradient-sunset text-primary-foreground hover:opacity-90 px-8 h-12">
              Search
            </Button>
          </form>

          {/* Categories Pill Bar */}
          <div className="mx-auto mt-8 flex max-w-3xl items-center justify-center">
            <div className="flex gap-2 overflow-x-auto px-4 pb-4 pt-1 no-scrollbar hide-scrollbar snap-x w-full md:justify-center">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`shrink-0 snap-start rounded-full px-5 py-2 text-sm font-medium transition-all duration-300 ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground shadow-glow scale-105"
                      : "bg-card border border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-16 pb-24">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-display text-2xl flex items-center gap-2">
            {!q && (!c || c === 'All') ? (
              <><Flame className="h-6 w-6 text-primary" /> Trending Events</>
            ) : (
              `${query.data?.events.length || 0} Results found`
            )}
          </h2>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filter</span>
          </div>
        </div>

        {/* States */}
        {query.isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-card border border-border/50 overflow-hidden">
                <div className="h-48 bg-muted"></div>
                <div className="p-5 space-y-3">
                  <div className="h-4 w-1/3 bg-muted rounded"></div>
                  <div className="h-6 w-3/4 bg-muted rounded"></div>
                  <div className="h-4 w-1/2 bg-muted rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {query.error && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
            {(query.error as Error).message}
          </div>
        )}

        {query.data && query.data.events.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 py-20 text-center backdrop-blur-sm">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
              <Search className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="font-display text-2xl text-foreground mb-2">No events found</h3>
            <p className="max-w-md text-muted-foreground mb-6">
              {q ? `We couldn't find any events matching "${q}".` : `There are no upcoming events in the ${c} category right now.`} Try adjusting your search or category filter.
            </p>
            <Button variant="outline" onClick={() => handleCategoryClick("All")}>
              Clear Filters
            </Button>
          </div>
        )}

        {/* Grid */}
        {query.data && query.data.events.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.events.map((ev) => {
              const min = query.data.minPrice[ev.id];
              const isCancelled = ev.status === 'cancelled';
              
              const CardInner = (
                <div className="flex h-full flex-col">
                  {/* Image Header */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                    {ev.cover_image_url ? (
                      <img
                        src={ev.cover_image_url}
                        alt={ev.title}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover transition-transform duration-700 ${!isCancelled ? "group-hover:scale-105" : "opacity-75 grayscale"}`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
                    )}
                    
                    {/* Dark gradient overlay for text legibility if needed, or just let badges float */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                    {/* Status/City Badges */}
                    <div className="absolute left-3 top-3 flex flex-col gap-2 z-20">
                      {isCancelled ? (
                        <div className="inline-flex items-center rounded-full bg-destructive/90 px-3 py-1 text-xs font-bold text-white shadow-lg backdrop-blur-md">
                          Cancelled
                        </div>
                      ) : ev.city ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur-md border border-border/50">
                          <MapPin className="h-3 w-3 text-primary" />
                          {ev.city}
                        </div>
                      ) : null}
                    </div>

                    {/* Price Badge */}
                    {!isCancelled && (
                      <div className="absolute bottom-3 right-3 z-20">
                        <div className="inline-flex items-center rounded-xl bg-background/95 px-3 py-1.5 text-sm font-bold text-foreground shadow-lg backdrop-blur-md border border-border/50">
                          {min !== undefined ? formatNaira(min) : "Free"}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Content Body */}
                  <div className="flex flex-1 flex-col p-5 bg-card/80 backdrop-blur-sm">
                    <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(ev.start_datetime).toLocaleString("en-NG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>
                    
                    <h3 className={`font-display text-xl leading-tight line-clamp-2 mb-2 transition-colors ${!isCancelled ? "group-hover:text-primary" : "text-muted-foreground line-through"}`}>
                      {ev.title}
                    </h3>
                    
                    {ev.venue_name && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-auto">
                        {ev.venue_name}
                      </p>
                    )}
                  </div>
                </div>
              );

              if (isCancelled) {
                return (
                  <div
                    key={ev.id}
                    className="group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 opacity-80 shadow-sm"
                  >
                    {CardInner}
                  </div>
                );
              }

              return (
                <Link
                  key={ev.id}
                  to="/e/$slug"
                  params={{ slug: ev.slug }}
                  className="group relative flex flex-col overflow-hidden rounded-2xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20"
                >
                  {CardInner}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
