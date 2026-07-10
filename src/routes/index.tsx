import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

async function fetchUpcoming() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, cover_image_url")
    .eq("status", "published")
    .gte("start_datetime", new Date().toISOString())
    .order("start_datetime", { ascending: true })
    .limit(6);
  if (error) throw error;
  return data ?? [];
}

const CATEGORIES = ["Concerts", "Comedy", "Conferences", "Church", "Campus", "Parties"];

const VALUE_PROPS = [
  {
    title: "QR tickets, zero drama",
    body: "Every ticket has a unique code. Fast door scans, no double entries.",
  },
  {
    title: "Pay with Paystack",
    body: "Cards, transfers, USSD — the payment methods Naija actually uses.",
  },
  {
    title: "Sell tickets in minutes",
    body: "Create an event, add ticket tiers, share the link. That's it.",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const upcoming = useQuery({ queryKey: ["home-upcoming"], queryFn: fetchUpcoming });

  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex flex-col items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">
                Naija's Ticket Hub
              </span>
              <span aria-hidden className="h-px w-16 gradient-sunset" />
            </div>
            <h1 className="mt-6 font-display text-5xl leading-[0.95] md:text-7xl lg:text-8xl">
              Every big night
              <br />
              <span className="text-gradient-sunset">starts with a ticket.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              Concerts in Lagos. Comedy in Abuja. Church programs, campus jams, industry
              conferences — buy tickets in seconds and turn up with a scannable QR code.
            </p>

            <form
              className="mx-auto mt-10 flex max-w-xl items-center gap-2 border border-border bg-card/60 p-2"
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ to: "/browse", search: { q: query.trim() || undefined } });
              }}
            >
              <Search className="ml-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, artists, cities…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" className="gradient-sunset text-primary-foreground hover:opacity-90">
                Search
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map((label) => (
                <button
                  key={label}
                  onClick={() => navigate({ to: "/browse", search: { q: label } })}
                  className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value props — editorial numeral treatment, no decorative icons */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-px overflow-hidden border border-border bg-border md:grid-cols-3">
          {VALUE_PROPS.map(({ title, body }, i) => (
            <div key={title} className="bg-card/60 p-6 md:p-8">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-4xl leading-none text-gradient-sunset">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Organizer CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden border border-primary/30 p-8 md:p-14">
          <div className="absolute inset-0 gradient-sunset opacity-90" />
          <div className="relative grid gap-6 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-4xl leading-tight text-primary-foreground md:text-5xl">
                Selling tickets? Start with TixNaija.
              </h2>
              <p className="mt-3 max-w-md text-primary-foreground/90">
                Set up your event, publish, and get paid directly to your Nigerian bank account.
                No listing fees.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild size="lg" variant="secondary" className="bg-background text-foreground hover:bg-background/90">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create your event
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/dashboard">Organizer dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Coming up — real published events */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">Coming up</h2>
            <p className="text-sm text-muted-foreground">
              {upcoming.data && upcoming.data.length > 0
                ? "Grab your ticket before they're gone."
                : "Fresh events landing here soon."}
            </p>
          </div>
          <Link to="/browse" className="text-xs uppercase tracking-[0.2em] text-primary hover:underline">
            Browse all →
          </Link>
        </div>

        {upcoming.isLoading && (
          <div className="text-sm text-muted-foreground">Loading events…</div>
        )}

        {upcoming.data && upcoming.data.length === 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-dashed border-border bg-card/40 p-8">
                <div className="font-display text-5xl leading-none text-muted-foreground/40">
                  {String(i).padStart(2, "0")}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Be the first to list an event in this slot.
                </p>
              </div>
            ))}
          </div>
        )}

        {upcoming.data && upcoming.data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-3">
            {upcoming.data.map((ev) => (
              <Link
                key={ev.id}
                to="/e/$slug"
                params={{ slug: ev.slug }}
                className="group overflow-hidden border border-border bg-card/60 transition hover:border-primary/50"
              >
                <div
                  className="h-40 w-full bg-secondary bg-cover bg-center"
                  style={ev.cover_image_url ? { backgroundImage: `url(${ev.cover_image_url})` } : undefined}
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground md:flex-row">
          <div className="flex items-baseline gap-0">
            <span className="font-display text-xl leading-none tracking-[0.02em] text-foreground">TIX</span>
            <span className="font-display text-xl leading-none tracking-[0.02em] font-light text-gradient-sunset">NAIJA</span>
          </div>
          <p>© {new Date().getFullYear()} — Buy tickets. Turn up. Repeat.</p>
        </div>
      </footer>
    </div>
  );
}
