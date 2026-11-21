import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  ArrowRight,
  QrCode,
  CreditCard,
  Ticket,
  CalendarDays,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { filterActiveEvents } from "@/lib/events";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { optimizeImage, imageSrcSet } from "@/lib/image";
import Autoplay from "embla-carousel-autoplay";

export const Route = createFileRoute("/")({
  /**
   * Runs on the server so the initial HTML already contains the events and
   * banners. Previously this page fetched client-side only, which meant
   * crawlers and slow connections saw an empty shell.
   *
   * Each query is failure-tolerant on its own — the landing page must still
   * render if one of them misbehaves.
   */
  loader: async () => {
    const [upcoming, banners] = await Promise.all([
      fetchUpcoming().catch(() => []),
      fetchBanners().catch(() => []),
    ]);
    return { upcoming, banners };
  },
  // The canonical URL is emitted by the root route for every page.
  component: LandingPage,
});

async function fetchUpcoming() {
  const now = new Date();
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, status")
    .eq("status", "published")
    .gte("end_datetime", now.toISOString())
    .order("start_datetime", { ascending: true })
    .limit(20);
  if (error) throw error;

  return filterActiveEvents(data, now).slice(0, 3);
}

async function fetchBanners() {
  const { data, error } = await supabase
    .from("sponsored_banners")
    .select("id, image_url, link_url, title, starts_at, ends_at")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const now = new Date();
  return (data ?? []).filter((b) => {
    if (b.starts_at && new Date(b.starts_at) > now) return false;
    if (b.ends_at && new Date(b.ends_at) < now) return false;
    return true;
  });
}

type Banner = Awaited<ReturnType<typeof fetchBanners>>[number];

const VALUE_PROPS = [
  {
    icon: QrCode,
    title: "QR tickets, zero drama",
    body: "Every ticket carries a unique, secure code. Fast door scans, no double entries, clean access control.",
  },
  {
    icon: CreditCard,
    title: "Pay with ease",
    body: "Cards, bank transfers, USSD — every payment method Naija actually uses, handled through Paystack.",
  },
  {
    icon: Ticket,
    title: "Sell in minutes",
    body: "Create your event, add ticket tiers, share the link. No listing fees, no setup ceremony.",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const loaderData = Route.useLoaderData();

  // `initialData` seeds the cache from the SSR loader so the client does not
  // immediately re-request what the server just fetched.
  const upcoming = useQuery({
    queryKey: ["home-upcoming"],
    queryFn: fetchUpcoming,
    initialData: loaderData.upcoming,
  });
  const banners = useQuery({
    queryKey: ["home-banners"],
    queryFn: fetchBanners,
    initialData: loaderData.banners,
  });

  const handleBannerClick = async (banner: Banner) => {
    void supabase.rpc("increment_banner_click", { banner_id: banner.id });
    if (banner.link_url) {
      if (banner.link_url.startsWith("http")) {
        window.open(banner.link_url, "_blank", "noopener,noreferrer");
      } else {
        navigate({ to: banner.link_url });
      }
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:px-8">
          <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            Ticketing for Nigeria
          </div>

          <h1 className="mt-5 max-w-4xl font-display text-[clamp(2.5rem,7vw,5rem)] leading-[1.02] tracking-[-0.03em] text-foreground">
            Buy tickets.
            <br />
            <span className="text-gradient-sunset">Turn up.</span>
          </h1>

          <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-muted-foreground">
            Discover concerts, comedy shows and premium events across Nigeria. Secure your spot in
            seconds and enter with a scannable QR code.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/browse", search: { q: query.trim() || undefined } });
            }}
            className="mt-9 flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-border/70 bg-card p-2 transition-colors duration-[var(--duration-fast)] focus-within:border-border sm:flex-row sm:items-center"
          >
            <div className="flex flex-1 items-center gap-3 px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events, artists, venues..."
                aria-label="Search events"
                className="h-11 border-0 bg-transparent px-0 text-[15px] shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
              />
            </div>
            <Button
              type="submit"
              className="h-11 shrink-0 rounded-xl px-6 text-[14px] font-semibold press-sm"
            >
              Find events
            </Button>
          </form>
        </div>
      </section>

      {/* ── Sponsored banners ────────────────────────────────────────── */}
      {banners.data && banners.data.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 pt-10 sm:px-6 lg:px-8">
          <Carousel
            opts={{ align: "start", loop: true }}
            plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
            className="w-full"
          >
            <CarouselContent className="-ml-3">
              {banners.data.map((banner, index) => (
                <CarouselItem key={banner.id} className="basis-full pl-3">
                  <div
                    onClick={() => handleBannerClick(banner)}
                    onKeyDown={(e) => {
                      if (banner.link_url && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        handleBannerClick(banner);
                      }
                    }}
                    role={banner.link_url ? "link" : undefined}
                    tabIndex={banner.link_url ? 0 : undefined}
                    aria-label={banner.link_url ? banner.title || "Sponsored banner" : undefined}
                    className={`group relative aspect-[16/7] w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      banner.link_url ? "cursor-pointer" : ""
                    }`}
                  >
                    <img
                      src={optimizeImage(banner.image_url, 1600)}
                      srcSet={imageSrcSet(banner.image_url, [800, 1200, 1600])}
                      sizes="(max-width: 1024px) 100vw, 1152px"
                      alt={banner.title || ""}
                      width={1600}
                      height={700}
                      loading={index === 0 ? "eager" : "lazy"}
                      decoding="async"
                      fetchPriority={index === 0 ? "high" : "auto"}
                      className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                    <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur-md">
                      Sponsored
                    </span>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        </section>
      )}

      {/* ── Why TixNaija ─────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid gap-6 border-b border-border/60 pb-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              Why TixNaija
            </p>
            <h2 className="mt-4 max-w-xl font-display text-[clamp(1.9rem,3.5vw,2.6rem)] leading-tight tracking-[-0.02em] text-foreground">
              Less friction, more turnout.
            </h2>
          </div>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            The most seamless way to discover and host events in Nigeria — from the first search to
            the door scan.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex flex-col rounded-2xl border border-border/60 bg-card p-6 transition-colors hover:border-border"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-secondary/70 text-foreground">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <h3 className="mt-6 text-[16px] font-semibold leading-snug text-foreground">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Organizer CTA ────────────────────────────────────────────── */}
      <section className="border-y border-border/60 bg-secondary/20">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-14 sm:px-6 md:flex-row md:items-end md:justify-between md:py-20 lg:px-8">
          <div>
            <h2 className="max-w-xl font-display text-[clamp(1.9rem,3.5vw,2.6rem)] leading-tight tracking-[-0.02em] text-foreground">
              Selling tickets? Start here.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Set up your event, publish instantly, and get paid directly to your Nigerian bank
              account. Zero listing fees.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row md:shrink-0">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-primary-foreground press-sm transition-colors hover:bg-primary/90"
            >
              Create your event <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border/70 bg-card px-6 text-[15px] font-semibold text-foreground press-sm transition-colors hover:bg-secondary/50"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ── Upcoming events ──────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              On the calendar
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,3.5vw,2.6rem)] leading-tight tracking-[-0.02em] text-foreground">
              Coming up next
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {upcoming.data && upcoming.data.length > 0
                ? "Grab your tickets before they're gone."
                : "Fresh events landing here soon."}
            </p>
          </div>
          <Link
            to="/browse"
            className="inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-border/70 bg-card px-5 text-[14px] font-semibold text-foreground transition-colors hover:bg-secondary/50 press-sm sm:self-auto"
          >
            Browse all <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {upcoming.isLoading && (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse overflow-hidden rounded-2xl border border-border/60 bg-card"
              >
                <div className="aspect-[16/10] bg-secondary/60" />
                <div className="space-y-3 p-5">
                  <div className="h-4 w-2/3 rounded bg-secondary/80" />
                  <div className="h-3 w-1/2 rounded bg-secondary/60" />
                </div>
              </div>
            ))}
          </div>
        )}

        {upcoming.data && upcoming.data.length === 0 && (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/40 px-6 py-14 text-center"
              >
                <span className="font-display text-4xl text-muted-foreground/30">
                  {String(i).padStart(2, "0")}
                </span>
                <p className="mt-4 max-w-[200px] text-[14px] text-muted-foreground">
                  Be the first to list an event in this slot.
                </p>
              </div>
            ))}
          </div>
        )}

        {upcoming.data && upcoming.data.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.data.map((ev) => {
              const isCancelled = ev.status === "cancelled";
              const startDate = new Date(ev.start_datetime);
              const dateLabel = startDate.toLocaleString("en-NG", {
                weekday: "short",
                day: "numeric",
                month: "short",
              });
              const timeLabel = startDate.toLocaleString("en-NG", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <Link
                  key={ev.id}
                  to="/e/$slug"
                  params={{ slug: ev.slug }}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card transition-[border-color,transform] duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:border-border"
                >
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary/50">
                    {ev.cover_image_url ? (
                      <img
                        src={optimizeImage(ev.cover_image_url, 600)}
                        srcSet={imageSrcSet(ev.cover_image_url, [400, 600, 800])}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        alt={ev.title}
                        width={600}
                        height={375}
                        loading="lazy"
                        decoding="async"
                        className={`h-full w-full object-cover transition-transform duration-700 ${
                          isCancelled ? "opacity-60 grayscale" : "group-hover:scale-[1.03]"
                        }`}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-secondary/60" />
                    )}

                    <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur">
                      <CalendarDays className="h-3 w-3" aria-hidden />
                      {dateLabel}
                    </span>

                    {isCancelled && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
                        <span className="rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">
                          Cancelled
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      {timeLabel}
                    </p>
                    <h3 className="mt-2 line-clamp-2 font-display text-[20px] leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                      {ev.title}
                    </h3>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{ev.venue_name || ev.city || "Nigeria"}</span>
                      </span>
                      <ArrowRight
                        className="h-4 w-4 shrink-0 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
