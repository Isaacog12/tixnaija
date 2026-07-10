import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, MapPin, Search, Sparkles, TicketCheck, Zap } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const CATEGORIES = [
  { label: "Concerts", emoji: "🎤" },
  { label: "Comedy", emoji: "🎭" },
  { label: "Conferences", emoji: "🎯" },
  { label: "Church", emoji: "⛪" },
  { label: "Campus", emoji: "🎓" },
  { label: "Parties", emoji: "🕺" },
];

function LandingPage() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs uppercase tracking-widest text-primary">
              <Sparkles className="h-3 w-3" /> Naija's ticket hub
            </span>
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
              className="mx-auto mt-10 flex max-w-xl items-center gap-2 rounded-full border border-border bg-card/60 p-2 shadow-glow backdrop-blur"
              onSubmit={(e) => e.preventDefault()}
            >
              <Search className="ml-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events, artists, cities…"
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
              />
              <Button type="submit" className="rounded-full gradient-sunset text-primary-foreground hover:opacity-90">
                Search
              </Button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.label}
                  className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs transition hover:border-primary hover:text-primary"
                >
                  <span className="mr-1">{c.emoji}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: TicketCheck,
              title: "QR tickets, zero drama",
              body: "Every ticket has a unique code. Fast door scans, no double entries.",
            },
            {
              icon: Zap,
              title: "Pay with Paystack",
              body: "Cards, transfers, USSD — the payment methods Naija actually uses.",
            },
            {
              icon: Calendar,
              title: "Sell tickets in minutes",
              body: "Create an event, add ticket tiers, share the link. That's it.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/40"
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Organizer CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 p-8 md:p-14">
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

      {/* Empty state / coming events */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl md:text-4xl">Coming up</h2>
            <p className="text-sm text-muted-foreground">Fresh events landing here soon.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="group overflow-hidden rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center"
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
                <MapPin className="h-6 w-6" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Be the first to list an event in this slot.
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} TixNaija. Made for Naija.</p>
          <p>Buy tickets. Turn up. Repeat.</p>
        </div>
      </footer>
    </div>
  );
}
