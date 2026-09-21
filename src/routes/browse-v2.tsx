import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Search, MapPin, Flame, Frown, Grid, List, Tag, CalendarDays, ChevronDown, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
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

export const Route = createFileRoute("/browse-v2")({
  validateSearch: searchSchema,
  component: BrowseV2Page,
  head: () => ({
    meta: [
      { title: "Discover Events — TixNaija" },
      { name: "description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
    ],
  }),
});

async function fetchEvents(q: string, category: string, dateFilter: string) {
  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category, ticket_types(price_kobo)")
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
    delete ev.ticket_types; 
  }
  
  return { events: validEvents, minPrice };
}

function optimizeImage(url: string | null | undefined, width: number): string | undefined {
  if (!url) return undefined;
  if (url.includes("/storage/v1/object/public/")) {
    return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + `?width=${width}&format=webp`;
  }
  return url;
}

const CATEGORIES = ["All", "Concerts", "Comedy", "Conferences", "Parties", "Church", "Campus", "Tech"];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.5, delay: i * 0.05 },
  }),
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };

function BrowseV2Page() {
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
    staleTime: 1000 * 60 * 5,
  });

  const updateSearch = (updates: Partial<typeof searchSchema._type>) => {
    navigate({
      to: "/browse-v2",
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
      if (activePrice === "under_5k") return min > 0 && min <= 500000;
      if (activePrice === "under_20k") return min > 0 && min <= 2000000;
      return true;
    });
  }, [query.data, activePrice]);

  return (
    <div className="min-h-dvh bg-[#050505] text-white font-sans selection:bg-orange-500/30">
      <div className="relative z-50">
        <SiteNav />
      </div>
      
      {/* Search Header */}
      <section className="relative pt-24 pb-12 overflow-hidden border-b border-white/5 bg-[#0a0a0a]">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] bg-orange-600/10 rounded-full blur-[140px]" />
          <div className="absolute bottom-[-50%] right-[-10%] w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px]" />
        </div>
        
        <div className="mx-auto max-w-7xl px-4 relative z-10">
          <motion.div initial="hidden" animate="show" variants={stagger} className="max-w-3xl mb-8">
            <motion.h1 variants={fadeUp} className="font-display text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
              Discover <span style={{ background: "linear-gradient(110deg,#EA580C 0%,#F97316 40%,#FBBF24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Naija.</span>
            </motion.h1>
            <motion.form variants={fadeUp} onSubmit={(e) => { e.preventDefault(); updateSearch({ q: searchInput.trim() }); }} className="flex items-center gap-2 max-w-xl rounded-full border border-white/10 bg-white/5 backdrop-blur-md p-1.5 focus-within:border-orange-500/40 transition-colors">
              <div className="pl-4 text-white/40"><Search className="h-5 w-5" /></div>
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search events, artists, venues..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-white placeholder:text-white/30 text-base h-12 w-full"
              />
              <Button type="submit" className="rounded-full h-11 px-6 font-bold text-sm bg-white text-black hover:bg-white/90">
                Search
              </Button>
            </motion.form>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 [&::-webkit-scrollbar]:hidden">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); updateSearch({ c: cat }); }}
                  className={`shrink-0 flex items-center justify-center rounded-full px-5 h-10 text-sm font-semibold transition-all duration-200 border ${
                    activeCategory === cat
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="relative group">
                <select 
                  value={activeDate}
                  onChange={(e) => { setActiveDate(e.target.value as any); updateSearch({ date: e.target.value as any }); }}
                  className="appearance-none bg-white/5 border border-white/10 rounded-full pl-10 pr-10 h-10 text-sm font-medium text-white focus:outline-none hover:border-white/30 transition-colors cursor-pointer"
                >
                  <option value="all">Any Date</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
                <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>

              <div className="relative group hidden sm:block">
                <select 
                  value={activePrice}
                  onChange={(e) => { setActivePrice(e.target.value as any); updateSearch({ price: e.target.value as any }); }}
                  className="appearance-none bg-white/5 border border-white/10 rounded-full pl-10 pr-10 h-10 text-sm font-medium text-white focus:outline-none hover:border-white/30 transition-colors cursor-pointer"
                >
                  <option value="all">Any Price</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                  <option value="under_5k">Under ₦5k</option>
                  <option value="under_20k">Under ₦20k</option>
                </select>
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
              </div>

              <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-1 hidden lg:flex">
                <button 
                  onClick={() => { setActiveView("grid"); updateSearch({ view: "grid" }); }}
                  className={`p-1.5 rounded-full transition-all ${activeView === "grid" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => { setActiveView("list"); updateSearch({ view: "list" }); }}
                  className={`p-1.5 rounded-full transition-all ${activeView === "list" ? "bg-white text-black" : "text-white/40 hover:text-white"}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="mx-auto max-w-7xl px-4 py-12 min-h-[50vh]">
        <div className="mb-8 flex items-center justify-between">
          <h2 className="font-display text-2xl flex items-center gap-2 text-white/90">
            {!q && (!c || c === 'All') && date === 'all' && price === 'all' ? (
              <><Flame className="h-6 w-6 text-orange-500" /> Trending Now</>
            ) : (
              <span><span className="text-orange-500">{filteredEvents.length}</span> Results</span>
            )}
          </h2>
        </div>

        {query.isLoading && (
          <div className={activeView === "list" ? "flex flex-col gap-4" : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`animate-pulse rounded-[2rem] bg-white/5 border border-white/5 overflow-hidden flex ${activeView === "list" ? "flex-row h-40" : "flex-col h-[380px]"}`} />
            ))}
          </div>
        )}

        {query.error && (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-12 text-center max-w-2xl mx-auto">
            <Frown className="h-12 w-12 mx-auto mb-4 text-red-500/50" />
            <h3 className="font-display text-2xl mb-2 text-white">Something went wrong</h3>
            <p className="text-red-400/80 font-medium">{(query.error as Error).message}</p>
          </div>
        )}

        {query.data && filteredEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-[3rem] border border-dashed border-white/10 bg-white/5 py-24 px-4 text-center max-w-4xl mx-auto">
            <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-white/5">
              <Search className="h-10 w-10 text-white/30" />
            </div>
            <h3 className="font-display text-3xl md:text-4xl text-white mb-4">Nothing to see here.</h3>
            <p className="max-w-md text-white/50 text-lg mb-8 leading-relaxed">
              We couldn't find any events matching your filters. Try adjusting your search.
            </p>
            <Button size="lg" className="rounded-full h-12 px-8 bg-white text-black font-bold hover:bg-white/90" onClick={() => updateSearch({ q: undefined, c: "All", date: "all", price: "all" })}>
              Clear All Filters
            </Button>
          </div>
        )}

        {query.data && filteredEvents.length > 0 && (
          <motion.div 
            variants={stagger}
            initial="hidden"
            animate="show"
            className={activeView === "list" 
              ? "flex flex-col gap-4" 
              : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}
          >
            <AnimatePresence>
              {filteredEvents.map((ev, i) => {
                const min = query.data?.minPrice[ev.id];
                const isCancelled = ev.status === 'cancelled';
                const date = new Date(ev.start_datetime);

                const CardInner = (
                  <div className={`flex h-full w-full ${activeView === "list" ? "flex-col sm:flex-row sm:h-52" : "flex-col"}`}>
                    <div className={`relative overflow-hidden bg-white/5 ${activeView === "list" ? "h-48 sm:h-full sm:w-[35%] shrink-0" : "aspect-[4/3] w-full"}`}>
                      {ev.cover_image_url ? (
                        <img
                          src={optimizeImage(ev.cover_image_url, activeView === "list" ? 400 : 600)}
                          alt={ev.title}
                          loading="lazy"
                          className={`h-full w-full object-cover transition-transform duration-700 ${!isCancelled ? "group-hover:scale-105" : "opacity-50 grayscale"}`}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-900/40 to-amber-900/20" />
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />

                      <div className="absolute top-4 left-4 z-20">
                        {isCancelled ? (
                          <div className="rounded-full bg-red-600/90 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-widest backdrop-blur-md">
                            Cancelled
                          </div>
                        ) : null}
                      </div>

                      {/* Apple Wallet style date badge */}
                      {!isCancelled && activeView !== "list" && (
                        <div className="absolute top-4 right-4 flex flex-col items-center justify-center rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 w-12 h-14 shadow-xl z-20">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">{date.toLocaleString("en-NG", { month: "short" })}</span>
                          <span className="font-display text-lg leading-none text-white">{date.getDate()}</span>
                        </div>
                      )}
                    </div>

                    <div className={`flex flex-1 flex-col p-5 bg-white/5 backdrop-blur-md transition-colors group-hover:bg-white/10 ${activeView === "list" ? "justify-center" : ""}`}>
                      {activeView === "list" && (
                        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-orange-500">
                          {date.toLocaleString("en-NG", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                      )}
                      
                      <h3 className={`font-display text-xl leading-tight line-clamp-2 mb-3 ${!isCancelled ? "text-white group-hover:text-orange-300 transition-colors" : "text-white/40 line-through"}`}>
                        {ev.title}
                      </h3>

                      <div className="mt-auto flex items-end justify-between gap-4">
                        <div className="flex flex-col gap-1.5">
                          {ev.venue_name && (
                            <p className="text-xs text-white/40 font-medium flex items-center gap-1.5 line-clamp-1">
                              <MapPin className="h-3 w-3 text-white/30" />
                              {ev.venue_name}
                            </p>
                          )}
                        </div>
                        
                        {!isCancelled && (
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm font-bold text-white shadow-sm backdrop-blur-md">
                            {min !== undefined ? (min === 0 ? "Free" : formatNaira(min)) : "Free"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );

                if (isCancelled) {
                  return (
                    <motion.div key={ev.id} variants={fadeUp} custom={i} className="group relative flex overflow-hidden rounded-[2rem] bg-white/5 border border-white/5 opacity-70">
                      {CardInner}
                    </motion.div>
                  );
                }

                return (
                  <motion.div key={ev.id} variants={fadeUp} custom={i}>
                    <Link
                      to="/e-v2/$slug"
                      params={{ slug: ev.slug }}
                      className="group block relative h-full overflow-hidden rounded-[2rem] bg-white/5 border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/30 hover:bg-white/10 hover:shadow-2xl hover:shadow-orange-500/10"
                    >
                      {CardInner}
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}
