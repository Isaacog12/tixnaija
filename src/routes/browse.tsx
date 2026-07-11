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
    .select("id, title, slug, city, venue_name, start_datetime, cover_image_url, description")
    .eq("status", "published")
    // Allow events from yesterday to show up, useful for testing
    .gte("start_datetime", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("start_datetime", { ascending: true })
    .limit(60);

  const cleaned = q.trim();
  if (cleaned) {
    // Escape characters that break PostgREST's .or() and ILIKE pattern:
    // commas separate filters, parens group them, % and _ are wildcards.
    const safe = cleaned.replace(/[,()%_*]/g, " ").replace(/\s+/g, " ").trim();
    if (safe) {
      const like = `%${safe}%`;
      query = query.or(
        `title.ilike.${like},description.ilike.${like},city.ilike.${like},venue_name.ilike.${like}`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw error;


  // Fetch min price per event
  const ids = (data ?? []).map((e) => e.id);
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
  return { events: data ?? [], minPrice };
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
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-6">
        <h1 className="font-display text-4xl md:text-5xl">Browse events</h1>
        <p className="text-sm text-muted-foreground">Upcoming events across Nigeria.</p>

        <form
          className="mt-6 flex max-w-xl items-center gap-2 border border-border bg-card/60 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/browse", search: { q: input.trim() || undefined } });
          }}
        >
          <Search className="ml-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search events, artists, cities…"
            className="border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" className="gradient-sunset text-primary-foreground hover:opacity-90">
            Search
          </Button>
        </form>
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
          <div className="grid gap-4 md:grid-cols-3">
            {query.data.events.map((ev) => {
              const min = query.data.minPrice[ev.id];
              return (
                <Link
                  key={ev.id}
                  to="/e/$slug"
                  params={{ slug: ev.slug }}
                  className="group overflow-hidden border border-border bg-card/60 transition hover:border-primary/50"
                >
                  <div
                    className="h-40 w-full bg-secondary bg-cover bg-center"
                    style={
                      ev.cover_image_url
                        ? { backgroundImage: `url(${ev.cover_image_url})` }
                        : undefined
                    }
                  />
                  <div className="p-5">
                    <h3 className="font-semibold leading-tight group-hover:text-primary">{ev.title}</h3>
                    <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(ev.start_datetime).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      {(ev.venue_name || ev.city) && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[ev.venue_name, ev.city].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    {min !== undefined && (
                      <div className="mt-4 border-t border-border pt-3 text-sm">
                        From{" "}
                        <span className="font-display text-lg text-gradient-sunset">
                          {formatNaira(min)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
