import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Search, Calendar, MapPin, Compass, SlidersHorizontal, Flame, Frown } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
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

  if (category && category.toLowerCase() !== "all") {
    query = query.eq("category", category.toLowerCase() as any);
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

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function BrowsePage() {
  const { q, c } = Route.useSearch();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [activeCategory, setActiveCategory] = useState(c ?? "All");

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
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 pt-6 w-full relative z-20">
        <BackButton />
      </div>

      {/* Premium Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-card/30 pb-12 pt-16 md:pt-24 md:pb-16">
        {/* Animated Background Orbs */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div 
            
            
            className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" 
          />
          <div 
            
            
            className="absolute top-20 -left-20 h-[300px] w-[300px] rounded-full bg-blue-500/20 blur-[100px]" 
          />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 text-center">
          <div 
            
            
            
            className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 mb-8 text-sm backdrop-blur-md text-primary font-medium shadow-sm"
          >
            <Compass className="h-4 w-4" />
            <span>Discover the best experiences</span>
          </div>

          <h1 
            
            
            
            className="font-display text-5xl md:text-6xl lg:text-7xl tracking-tight mb-6"
          >
            Find your next <span className="text-gradient-sunset relative inline-block">
              vibe.
              <span 
                
                
                
                className="absolute -bottom-2 left-0 h-1 bg-gradient-to-r from-primary to-purple-500 rounded-full"
              />
            </span>
          </h1>
          
          <p 
            
            
            
            className="mx-auto max-w-2xl text-muted-foreground text-lg md:text-xl mb-10 leading-relaxed"
          >
            Explore thousands of concerts, comedy shows, tech conferences, and exclusive parties happening across Nigeria.
          </p>

          {/* Search Bar */}
          <form
            
            
            
            className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-border/60 bg-background/90 p-2 shadow-2xl backdrop-blur-xl transition-all focus-within:ring-4 focus-within:ring-primary/20 focus-within:border-primary/50 group hover:border-primary/30"
            onSubmit={handleSearch}
          >
            <div className="pl-5 text-muted-foreground group-focus-within:text-primary transition-colors">
              <Search className="h-5 w-5" />
            </div>
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by event name, artist, or city..."
              className="h-14 border-0 bg-transparent px-4 text-base md:text-lg shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
            />
            <Button type="submit" size="lg" className="rounded-full gradient-sunset text-primary-foreground hover:shadow-lg hover:shadow-primary/25 transition-all px-8 h-12 text-base font-medium">
              Search
            </Button>
          </form>

          {/* Categories Pill Bar */}
          <div 
            
            
            
            className="mx-auto mt-12 flex max-w-4xl items-center justify-center relative"
          >
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-card/30 to-transparent z-10 pointer-events-none md:hidden" />
            <div className="flex gap-3 overflow-x-auto px-4 pb-4 pt-1 no-scrollbar hide-scrollbar snap-x w-full md:justify-center">
              {CATEGORIES.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryClick(cat)}
                    className={`relative shrink-0 snap-start rounded-full px-6 py-2.5 text-sm font-medium transition-all duration-300 overflow-hidden ${
                      isActive
                        ? "text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                        : "bg-card border border-border/50 text-muted-foreground hover:bg-secondary hover:text-foreground hover:border-border"
                    }`}
                  >
                    {isActive && (
                      <div 
                        layoutId="activeCategory" 
                        className="absolute inset-0 bg-primary z-0" 
                        
                      />
                    )}
                    <span className="relative z-10">{cat}</span>
                  </button>
                )
              })}
            </div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/30 to-transparent z-10 pointer-events-none md:hidden" />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:py-20 pb-24 min-h-[50vh]">
        {/* Results Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <h2 className="font-display text-2xl md:text-3xl flex items-center gap-3">
            {!q && (!c || c === 'All') ? (
              <><Flame className="h-7 w-7 text-primary" /> Trending Events</>
            ) : (
              <span>
                <span className="text-primary">{query.data?.events.length || 0}</span> Results found
              </span>
            )}
          </h2>
          <Button variant="outline" size="sm" className="hidden sm:flex rounded-full gap-2 items-center bg-card shadow-sm border-border/50 hover:bg-secondary">
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>

        {/* States */}
        {query.isLoading && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-3xl bg-card border border-border/40 overflow-hidden shadow-sm">
                <div className="h-56 bg-muted/60 relative overflow-hidden">
                   <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
                </div>
                <div className="p-6 space-y-4">
                  <div className="h-4 w-1/3 bg-muted/80 rounded-md"></div>
                  <div className="h-7 w-3/4 bg-muted/80 rounded-md"></div>
                  <div className="h-4 w-1/2 bg-muted/80 rounded-md"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {query.error && (
          <div 
             
             
            className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive max-w-2xl mx-auto"
          >
            <Frown className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <h3 className="font-medium text-lg mb-1">Oops, something went wrong</h3>
            <p className="text-destructive/80">{(query.error as Error).message}</p>
          </div>
        )}

        {query.data && query.data.events.length === 0 && (
          <div 
            
            
            className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/30 py-24 text-center backdrop-blur-sm max-w-3xl mx-auto"
          >
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-secondary/50 relative">
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-20" />
              <Search className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-display text-3xl text-foreground mb-3">No events found</h3>
            <p className="max-w-md text-muted-foreground text-lg mb-8">
              {q ? `We couldn't find any events matching "${q}".` : `There are no upcoming events in the ${c} category right now.`} Try adjusting your search or category filter.
            </p>
            <Button size="lg" className="rounded-full shadow-md" onClick={() => handleCategoryClick("All")}>
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Grid */}
        {query.data && query.data.events.length > 0 && (
          <div 
            
            initial="hidden"
            animate="show"
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-8"
          >
            
              {query.data.events.map((ev) => {
                const min = query.data.minPrice[ev.id];
                const isCancelled = ev.status === 'cancelled';

                const CardInner = (
                  <div className="flex h-full flex-col">
                    {/* Image Header */}
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/50">
                      {ev.cover_image_url ? (
                        <img
                          src={ev.cover_image_url}
                          alt={ev.title}
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover transition-all duration-700 ${!isCancelled ? "group-hover:scale-110 group-hover:rotate-1" : "opacity-75 grayscale"}`}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
                      )}

                      {/* Smooth dark gradient for text legibility */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent opacity-60" />

                      {/* Status/City Badges */}
                      <div className="absolute left-4 top-4 flex flex-col gap-2 z-20">
                        {isCancelled ? (
                          <div className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground shadow-lg backdrop-blur-md uppercase tracking-wider">
                            Cancelled
                          </div>
                        ) : ev.city ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md border border-border/50">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {ev.city}
                          </div>
                        ) : null}
                      </div>

                      {/* Price Badge */}
                      {!isCancelled && (
                        <div className="absolute bottom-4 right-4 z-20">
                          <div className="inline-flex items-center rounded-2xl bg-background/95 px-4 py-2 text-sm font-bold text-foreground shadow-xl backdrop-blur-xl border border-border/50 transition-transform group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                            {min !== undefined ? formatNaira(min) : "Free"}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content Body */}
                    <div className="flex flex-1 flex-col p-6 bg-card/80 backdrop-blur-md relative">
                      <div className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(ev.start_datetime).toLocaleString("en-NG", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </div>

                      <h3 className={`font-display text-2xl leading-tight line-clamp-2 mb-3 transition-colors ${!isCancelled ? "group-hover:text-primary" : "text-muted-foreground line-through"}`}>
                        {ev.title}
                      </h3>

                      {ev.venue_name && (
                        <p className="text-sm text-muted-foreground line-clamp-1 mt-auto font-medium">
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
                      className="group relative flex flex-col overflow-hidden rounded-3xl bg-card border border-border/40 opacity-80 shadow-sm"
                    >
                      {CardInner}
                    </div>
                  );
                }

                return (
                  <div  key={ev.id}>
                    <Link
                      to="/e/$slug"
                      params={{ slug: ev.slug }}
                      className="group block relative h-full overflow-hidden rounded-3xl bg-card border border-border/40 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30"
                    >
                      {CardInner}
                    </Link>
                  </div>
                );
              })}
            
          </div>
        )}
      </section>
    </div>
  );
}
