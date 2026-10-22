import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Search, Calendar, MapPin, Compass, Flame, Frown, Grid, List, Tag, CalendarDays, ChevronDown } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { BackButton } from "@/components/back-button";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/currency";

const searchSchema = z.object({
  q: z.string().optional(),
  c: z.string().optional(),
  date: z.enum(["all", "today", "week", "month"]).optional(),
  price: z.enum(["all", "free", "paid", "under_5k", "under_20k"]).optional(),
  view: z.enum(["grid", "list"]).optional()
});

export const Route = createFileRoute("/browse")({
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

async function fetchEvents(q: string, category: string, dateFilter: string) {
  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category, tags, ticket_types(price_kobo)")
    .in("status", ["published", "cancelled", "completed"])
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

  const now = new Date();
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
    const mappedCategory = 
      category === "Concerts" ? "music" :
      category === "Conferences" ? "conference" :
      category === "Parties" ? "party" :
      category === "Tech" ? "other" :
      category.toLowerCase();
    
    query = query.eq("category", mappedCategory as any);
  }

  const { data, error } = await query;
  if (error) throw error;

  const validEvents: any[] = data ?? [];

  let minPrice: Record<string, number> = {};
  for (const ev of validEvents) {
    if (ev.ticket_types && ev.ticket_types.length > 0) {
      minPrice[ev.id] = Math.min(...ev.ticket_types.map((t: any) => t.price_kobo));
    } else {
      minPrice[ev.id] = 0;
    }
    delete ev.ticket_types; // Keep original object shape clean
  }
  
  return { events: validEvents, minPrice };
}

// Helper for Supabase image transformations
function optimizeImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&format=webp`;
  }
  return url;
}

const CATEGORIES = ["All", "Concerts", "Comedy", "Conferences", "Parties", "Church", "Campus", "Tech"];

function BrowsePage() {
  const { q, c, date, price, view } = Route.useSearch();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [activeCategory, setActiveCategory] = useState(c ?? "All");
  const [activeDate, setActiveDate] = useState(date ?? "all");
  const [activePrice, setActivePrice] = useState(price ?? "all");
  const [activeView, setActiveView] = useState(view ?? "grid");

  useEffect(() => {
    setSearchInput(q ?? "");
    setActiveCategory(c ?? "All");
    setActiveDate(date ?? "all");
    setActivePrice(price ?? "all");
    setActiveView(view ?? "grid");
  }, [q, c, date, price, view]);

  const query = useQuery({
    queryKey: ["browse", q ?? "", c ?? "All", date ?? "all"],
    queryFn: () => fetchEvents(q ?? "", c ?? "All", date ?? "all"),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateSearch = (updates: Partial<typeof searchSchema._type>) => {
    navigate({
      to: "/browse",
      search: (prev: any) => ({
        ...prev,
        ...updates,
        q: updates.q !== undefined ? (updates.q || undefined) : prev.q,
        c: updates.c !== undefined ? (updates.c === "All" ? undefined : updates.c) : prev.c,
        date: updates.date !== undefined ? (updates.date === "all" ? undefined : updates.date) : prev.date,
        price: updates.price !== undefined ? (updates.price === "all" ? undefined : updates.price) : prev.price,
        view: updates.view !== undefined ? (updates.view === "grid" ? undefined : updates.view) : prev.view,
      })
    });
  };

  const filteredEvents = React.useMemo(() => {
    if (!query.data) return [];
    return query.data.events.filter(ev => {
      const min = query.data?.minPrice[ev.id] ?? 0;
      if (activePrice === "free") return min === 0;
      if (activePrice === "paid") return min > 0;
      if (activePrice === "under_5k") return min > 0 && min <= 500000; // 5k Naira
      if (activePrice === "under_20k") return min > 0 && min <= 2000000; // 20k Naira
      return true;
    });
  }, [query.data, activePrice]);

  return (
    <div className="min-h-dvh bg-background selection:bg-primary/20">
      <SiteNav />
      
      {/* Compact Hero & Sticky Filter Section */}
      <section className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-2xl shadow-sm pt-4 pb-4 mt-16 md:mt-0">
        <div className="mx-auto max-w-7xl px-4 md:pt-20">
          {/* Header Row */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-5">
             <div className="flex items-center gap-4">
               <BackButton />
            <h1 className="type-heading-md flex items-center gap-2 font-display">
               <Compass className="h-6 w-6 text-primary" />
               Discover
             </h1>
             </div>
             <form
               className="flex w-full md:max-w-md items-center gap-2 rounded-full border border-border/60 bg-card/80 px-2 py-1 shadow-inner focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all duration-[120ms] hover:border-primary/40"
                onSubmit={(e) => { e.preventDefault(); updateSearch({ q: searchInput.trim() }); }}
              >
                <div className="pl-3 text-muted-foreground"><Search className="h-4 w-4" /></div>
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search events, artists..."
                  className="h-10 border-0 bg-transparent px-2 text-sm shadow-none focus-visible:outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="sm" className="rounded-full gradient-sunset text-primary-foreground px-5 h-8 text-xs font-bold shadow-md shadow-primary/20 press-sm transition-transform duration-[120ms]">
                  Search
                </Button>
              </form>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            {/* Categories - Desktop Pills */}
            <div className="hidden md:flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-2 sm:pb-0 w-full sm:w-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); updateSearch({ c: cat }); }}
                   className={`shrink-0 flex items-center justify-center rounded-full px-5 h-11 md:h-8 text-base md:text-xs font-semibold transition-all duration-[120ms] border press-sm ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                      : "bg-card text-muted-foreground border-border/60 hover:bg-secondary hover:text-foreground hover:border-primary/30"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Categories - Mobile Dropdown */}
            <div className="md:hidden relative group w-full sm:w-auto shrink-0 mb-3 sm:mb-0">
              <select
                value={activeCategory}
                onChange={(e) => { setActiveCategory(e.target.value); updateSearch({ c: e.target.value }); }}
                className="w-full appearance-none bg-card border border-border/60 rounded-full pl-9 pr-9 h-11 md:h-9 text-base md:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/40 transition-colors cursor-pointer shadow-sm"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === "All" ? "All Categories" : cat}
                  </option>
                ))}
              </select>
              <Compass className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            </div>

            {/* Dropdown Filters & Layout */}
            <div className="flex items-center gap-2 shrink-0">
               {/* Date Filter */}
               <div className="relative group">
                 <select 
                   value={activeDate}
                   onChange={(e) => { setActiveDate(e.target.value as any); updateSearch({ date: e.target.value as any }); }}
                   className="appearance-none bg-card border border-border/60 rounded-full pl-9 pr-9 h-11 md:h-9 text-base md:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/40 transition-colors cursor-pointer shadow-sm"
                 >
                   <option value="all">Any Date</option>
                   <option value="today">Today</option>
                   <option value="week">This Week</option>
                   <option value="month">This Month</option>
                 </select>
                 <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
               </div>

               {/* Price Filter */}
               <div className="relative group">
                 <select 
                   value={activePrice}
                   onChange={(e) => { setActivePrice(e.target.value as any); updateSearch({ price: e.target.value as any }); }}
                   className="appearance-none bg-card border border-border/60 rounded-full pl-9 pr-9 h-11 md:h-9 text-base md:text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 hover:border-primary/40 transition-colors cursor-pointer shadow-sm"
                 >
                   <option value="all">Any Price</option>
                   <option value="free">Free</option>
                   <option value="paid">Paid</option>
                   <option value="under_5k">Under ₦5,000</option>
                   <option value="under_20k">Under ₦20,000</option>
                 </select>
                 <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none group-hover:text-primary transition-colors" />
                 <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
               </div>

               {/* Layout Toggle */}
               <div className="flex items-center rounded-full border border-border/60 bg-card p-0.5 shadow-sm ml-2 hidden md:flex">
                 <button 
                   onClick={() => { setActiveView("grid"); updateSearch({ view: "grid" }); }}
                   className={`p-2 md:p-1.5 rounded-full transition-all ${activeView === "grid" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                 >
                   <Grid className="h-4 w-4" />
                 </button>
                 <button 
                   onClick={() => { setActiveView("list"); updateSearch({ view: "list" }); }}
                   className={`p-2 md:p-1.5 rounded-full transition-all ${activeView === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                 >
                   <List className="h-4 w-4" />
                 </button>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="mx-auto max-w-7xl px-4 py-12 min-h-[60vh]">
        {/* Results Header */}
        <div className="mb-8">
          <h2 className="type-heading-md flex items-center gap-2">
            {!q && (!c || c === 'All') && date === 'all' && price === 'all' ? (
              <><Flame className="h-6 w-6 text-primary" /> Trending Events</>
            ) : (
              <span>
                <span className="text-primary">{filteredEvents.length}</span> Results found
              </span>
            )}
          </h2>
        </div>

        {/* States */}
        {query.isLoading && (
          <div className={activeView === "list" ? "flex flex-col gap-4" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`animate-pulse rounded-3xl bg-card border border-border/40 overflow-hidden shadow-sm flex ${activeView === "list" ? "flex-row h-40" : "flex-col h-[380px]"}`}>
                <div className={`bg-muted/60 relative overflow-hidden ${activeView === "list" ? "w-1/3" : "h-48 w-full"}`}>
                   <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
                </div>
                <div className="p-6 space-y-4 flex-1">
                  <div className="h-4 w-1/3 bg-muted/80 rounded-md"></div>
                  <div className="h-6 w-3/4 bg-muted/80 rounded-md"></div>
                  <div className="h-4 w-1/2 bg-muted/80 rounded-md mt-auto"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {query.error && (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-12 text-center text-destructive max-w-2xl mx-auto shadow-sm backdrop-blur-sm">
            <Frown className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="font-display text-2xl mb-2">Something went wrong. Please refresh the page or try again.</h3>
            <p className="text-destructive/80 font-medium">{(query.error as Error).message}</p>
          </div>
        )}

        {query.data && filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-border/60 bg-card/20 py-24 px-4 text-center backdrop-blur-sm max-w-4xl mx-auto">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-secondary/50 relative shadow-inner">
              <div className="absolute inset-0 bg-primary/10 rounded-full animate-ping opacity-30" />
              <Search className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-display text-3xl md:text-4xl text-foreground mb-4">Looks quiet in here.</h3>
            <p className="max-w-md text-muted-foreground text-lg mb-8 font-medium leading-relaxed">
              We couldn't find any events matching your filters. Try adjusting your search or dates.
            </p>
            <Button size="lg" className="rounded-full shadow-lg h-12 px-8 gradient-sunset" onClick={() => updateSearch({ q: undefined, c: "All", date: "all", price: "all" })}>
              Clear All Filters
            </Button>
          </div>
        )}

        {/* Grid/List View */}
        {query.data && filteredEvents.length > 0 && (
          <div 
            className={activeView === "list" 
              ? "flex flex-col gap-5" 
              : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}
          >
            {filteredEvents.map((ev) => {
              const min = query.data?.minPrice[ev.id];
              const isCancelled = ev.status === 'cancelled';

              const CardInner = (
                <div className={`flex h-full w-full ${activeView === "list" ? "flex-col sm:flex-row sm:h-56" : "flex-col"}`}>
                  {/* Image Header */}
                  <div className={`relative overflow-hidden bg-secondary/30 ${activeView === "list" ? "h-48 sm:h-full sm:w-2/5 shrink-0" : "aspect-[4/3] w-full"}`}>
                    {ev.cover_image_url ? (
                      <img
                        src={optimizeImage(ev.cover_image_url, activeView === "list" ? 400 : 600)}
                        alt={ev.title}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover transition-transform duration-700 ${!isCancelled ? "group-hover:scale-110 group-hover:-rotate-1" : "opacity-75 grayscale"}`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10" />
                    )}

                    {/* Smooth dark gradient for text legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent opacity-70 group-hover:opacity-80 transition-opacity" />

                    {/* Status Badges */}
                    <div className="absolute left-4 top-4 flex flex-col gap-2 z-20">
                      {isCancelled ? (
                        <div className="inline-flex items-center rounded-full bg-destructive px-3 py-1 text-xs font-bold text-destructive-foreground shadow-lg backdrop-blur-md uppercase tracking-wider">
                          Cancelled
                        </div>
                      ) : ev.city ? (
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-md border border-border/50">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {ev.city}
                        </div>
                      ) : null}
                    </div>

                    {/* Price Badge */}
                    {!isCancelled && (
                      <div className="absolute bottom-4 right-4 z-20">
                        <div className="inline-flex items-center rounded-full bg-background/90 px-4 py-1.5 text-sm font-bold text-foreground shadow-xl backdrop-blur-xl border border-border/50 transition-transform group-hover:scale-105 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                          {min !== undefined ? (min === 0 ? "Free" : formatNaira(min)) : "Free"}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Body */}
                  <div className={`flex flex-1 flex-col p-6 bg-card/40 backdrop-blur-sm relative transition-colors group-hover:bg-card/80 ${activeView === "list" ? "justify-center" : ""}`}>
                    <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                      <Calendar className="h-4 w-4" />
                      {new Date(ev.start_datetime).toLocaleString("en-NG", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>

                    <h3 className={`font-display text-2xl leading-tight line-clamp-2 mb-4 transition-colors ${!isCancelled ? "group-hover:text-primary" : "text-muted-foreground line-through"}`}>
                      {ev.title}
                    </h3>

                    {ev.venue_name && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-auto font-medium flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 opacity-70" />
                        {ev.venue_name}
                      </p>
                    )}
                    
                    {ev.tags && ev.tags.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-border/50">
                        {ev.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[10px] font-semibold text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
                            #{tag}
                          </span>
                        ))}
                        {ev.tags.length > 3 && (
                          <span className="text-[10px] font-semibold text-muted-foreground px-1 py-0.5">+{ev.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );

              if (isCancelled) {
                return (
                  <div
                    key={ev.id}
                    className="group relative flex overflow-hidden rounded-[2rem] bg-card border border-border/40 shadow-sm opacity-80"
                  >
                    {CardInner}
                  </div>
                );
              }

              return (
                <div key={ev.id}>
                  <Link
                    to="/e/$slug"
                    params={{ slug: ev.slug }}
                    className="group block relative h-full overflow-hidden rounded-[2rem] bg-card border border-border/40 shadow-sm transition-all duration-[350ms] ease-out hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-primary/15 hover:border-primary/35"
                  >
                    {CardInner}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
