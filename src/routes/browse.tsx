import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Calendar, MapPin } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/currency";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/browse")({
  ssr: false,
  validateSearch: searchSchema,
  component: BrowsePage,
  head: () => ({
    meta: [
      { title: "Browse events — TixNaija" },
      { name: "description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:title", content: "Browse events — TixNaija" },
      { property: "og:description", content: "Discover concerts, comedy shows, conferences and more happening across Nigeria." },
      { property: "og:type", content: "website" },
    ],
  }),
});

async function fetchEvents(q: string) {
  let query = supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, description, status, category")
    .in("status", ["published", "cancelled"])
    .order("start_datetime", { ascending: true })
    .limit(100);

  const cleaned = q.trim();
  if (cleaned) {
    // Escape characters that break PostgREST's .or() and ILIKE pattern:
    const safe = cleaned.replace(/[,()%_*"]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      const like = `"%${safe}%"`;
      query = query.or(
        `title.ilike.${like},description.ilike.${like},city.ilike.${like},venue_name.ilike.${like}`,
      );
    }
  } else {
    // If NO search query, only show upcoming/live events
    query = query.gte("start_datetime", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;

  const validEvents = data ?? [];

  // Fetch min price per event
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

function BrowsePage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q ?? "");
  const query = useQuery({
    queryKey: ["browse", q ?? ""],
    queryFn: () => fetchEvents(q ?? ""),
  });

  return (
    <div className="min-h-screen">
      <SiteNav />
      <section className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4 md:py-6 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
          <div>
            <h1 className="font-display text-2xl md:text-3xl">Browse events</h1>
            <p className="text-sm text-muted-foreground hidden md:block">Discover what's happening across Nigeria.</p>
          </div>
          
          <form
            className="flex w-full md:max-w-md items-center gap-2 rounded-full border border-border bg-card/60 px-2 py-1.5 focus-within:ring-1 focus-within:ring-primary shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/browse", search: { q: input.trim() || undefined } });
            }}
          >
            <Search className="ml-2 h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search events, artists, cities…"
              className="h-8 md:h-9 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 text-sm"
            />
            <Button type="submit" size="sm" className="rounded-full gradient-sunset text-primary-foreground hover:opacity-90 shrink-0 h-8 md:h-9">
              Search
            </Button>
          </form>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        {query.isLoading && <div className="text-sm text-muted-foreground">Loading events…</div>}
        {query.error && (
          <div className="text-sm text-destructive">{(query.error as Error).message}</div>
        )}
        {query.data && query.data.events.length === 0 && (
          <div className="border border-dashed border-border bg-card/40 p-12 text-center">
            <div className="font-display text-5xl text-muted-foreground/40">00</div>
            <p className="mt-4 text-sm text-muted-foreground">
              {q ? `No events found for "${q}".` : "No upcoming events yet. Check back soon."}
            </p>
          </div>
        )}
        {query.data && query.data.events.length > 0 && (
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 mt-6 sm:mt-8">
            {query.data.events.map((ev) => {
              const min = query.data.minPrice[ev.id];
              const isCancelled = ev.status === 'cancelled';
              
              const CardInner = (
                <>
                  <div className="relative aspect-[16/9] sm:aspect-[4/3] w-full overflow-hidden bg-secondary">
                    {ev.cover_image_url && (
                      <img
                        src={ev.cover_image_url}
                        alt={ev.title}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover transition-transform duration-500 ${!isCancelled ? "group-hover:scale-105" : "opacity-75 grayscale"}`}
                      />
                    )}
                    {isCancelled && (
                      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center z-10">
                        <div className="rounded-full bg-destructive px-4 py-1.5 text-sm font-bold text-destructive-foreground shadow-lg">
                          Cancelled
                        </div>
                      </div>
                    )}
                    {ev.city && (
                      <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-medium backdrop-blur-md z-20">
                        <MapPin className="h-3 w-3 text-primary" />
                        {ev.city}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Calendar className="h-3.5 w-3.5" />
                      {new Date(ev.start_datetime).toLocaleString("en-NG", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>
                    
                    <h3 className={`font-display text-xl leading-tight line-clamp-2 mb-2 ${!isCancelled ? "group-hover:text-primary" : "text-muted-foreground line-through"}`}>
                      {ev.title}
                    </h3>
                    
                    {ev.venue_name && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-4">
                        {ev.venue_name}
                      </p>
                    )}
                    
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-border/50">
                      <div className="text-xs text-muted-foreground">Tickets from</div>
                      <div className={`font-display text-lg ${isCancelled ? "text-muted-foreground" : "text-gradient-sunset"}`}>
                        {min !== undefined ? formatNaira(min) : "Free"}
                      </div>
                    </div>
                  </div>
                </>
              );

              if (isCancelled) {
                return (
                  <div
                    key={ev.id}
                    className="flex flex-col overflow-hidden rounded-2xl bg-card/40 border border-border/50 opacity-80"
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
                  className="group flex flex-col overflow-hidden rounded-2xl bg-card/60 transition-all hover:-translate-y-1 hover:shadow-glow border border-border/50 hover:border-primary/30"
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
