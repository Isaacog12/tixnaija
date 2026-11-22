import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  MapPin,
  ArrowRight,
  QrCode,
  CreditCard,
  Ticket,
  CalendarDays,
  ArrowUpRight,
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
import { RecentSearches } from "@/components/recent-searches";
import { useRecentSearches } from "@/lib/recent-searches";

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

const CATEGORIES = ["Concerts", "Comedy", "Conferences", "Nightlife", "Festivals"];

function formatEventDate(iso: string) {
  const date = new Date(iso);
  return {
    day: date.toLocaleString("en-NG", { weekday: "short", day: "numeric", month: "short" }),
    time: date.toLocaleString("en-NG", { hour: "numeric", minute: "2-digit" }),
  };
}

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const {
    items: recentItems,
    hydrate: hydrateRecent,
    remember: rememberSearch,
    forget: forgetSearch,
    clear: clearSearches,
  } = useRecentSearches();
  const loaderData = Route.useLoaderData();

  useEffect(() => {
    hydrateRecent();
  }, [hydrateRecent]);

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

  // The soonest published event is the hero feature.
  const featured = upcoming.data?.[0];

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />

      {/* ── Hero: copy + the next event, side by side ─────────────────── */}
      <section className="border-b border-border/60">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pb-14 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:px-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-px w-10 bg-border" aria-hidden />
              Ticketing for Nigeria
            </div>

            <h1 className="mt-5 font-display text-[clamp(2.5rem,6.5vw,4.75rem)] leading-[1.02] tracking-[-0.03em] text-foreground">
              Buy tickets.
              <br />
              <span className="text-gradient-sunset">Turn up.</span>
            </h1>

            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
              Concerts, comedy and premium events across Nigeria — booked in seconds, scanned at the
              door.
            </p>

            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) rememberSearch(query);
                navigate({ to: "/browse", search: { q: query.trim() || undefined } });
              }}
              className="mt-8 flex w-full max-w-xl flex-col gap-2 rounded-2xl border border-border/70 bg-card p-2 transition-colors duration-[var(--duration-fast)] focus-within:border-border sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 items-center gap-3 px-3">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
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

            {searchFocused && !query.trim() && recentItems.length > 0 && (
              <RecentSearches
                items={recentItems}
                onPick={(value) => {
                  setQuery(value);
                  rememberSearch(value);
                  navigate({ to: "/browse", search: { q: value } });
                }}
                onRemove={forgetSearch}
                onClear={clearSearches}
                onDismiss={() => setSearchFocused(false)}
                className="mt-2 w-full max-w-xl overflow-hidden rounded-lg border border-border/60 bg-card text-left"
              />
            )}

            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {CATEGORIES.map((category, i) => (
                <span key={category} className="flex items-center gap-3">
                  {i > 0 && <span className="h-3 w-px bg-border" aria-hidden />}
                  <Link
                    to="/browse"
                    className="transition-colors hover:text-foreground"
                  >
                    {category}
                  </Link>
                </span>
              ))}
            </div>
          </div>

          {/* Featured: the soonest event */}
          <div className="min-w-0">
            {featured ? (
              <Link
                to="/e/$slug"
                params={{ slug: featured.slug }}
                className="group block overflow-hidden rounded-2xl border border-border/70 bg-card transition-[border-color,transform] duration-[var(--duration-fast)] hover:-translate-y-0.5 hover:border-border"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/50">
                  {featured.cover_image_url ? (
                    <img
                      src={optimizeImage(featured.cover_image_url, 900)}
                      srcSet={imageSrcSet(featured.cover_image_url, [500, 900])}
                      sizes="(max-width: 1024px) 100vw, 520px"
                      alt={featured.title}
                      width={900}
                      height={675}
                      loading="eager"
                      decoding="async"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-secondary/60" />
                  )}
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-semibold text-foreground backdrop-blur">
                    <CalendarDays className="h-3 w-3" aria-hidden />
                    Next up
                  </span>
                </div>

                <div className="p-5 md:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {formatEventDate(featured.start_datetime).day} ·{" "}
                    {formatEventDate(featured.start_datetime).time}
                  </p>
                  <h2 className="mt-2 line-clamp-2 font-display text-[24px] leading-snug tracking-[-0.01em] text-foreground transition-colors group-hover:text-primary">
                    {featured.title}
                  </h2>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-4 text-[13px] text-muted-foreground">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">
                        {featured.venue_name || featured.city || "Nigeria"}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground">
                      View <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="flex aspect-[4/3] flex-col justify-between rounded-2xl border border-dashed border-border/70 bg-card/40 p-6 md:p-8">
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Next up
                </span>
                <div>
                  <p className="font-display text-[26px] leading-tight tracking-[-0.02em] text-foreground">
                    The calendar is open.
                  </p>
                  <p className="mt-2 max-w-[16rem] text-[14px] leading-relaxed text-muted-foreground">
                    New events land here the moment organizers publish them.
                  </p>
                  <Link
                    to="/browse"
                    className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary/50"
                  >
                    Browse events <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Sponsored banners ────────────────────────────────────────── */}
      {banners.data && banners.data.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
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
                    className={`group relative aspect-[16/6] w-full overflow-hidden rounded-2xl border border-border/60 bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      banner.link_url ? "cursor-pointer" : ""
                    }`}
                  >
                    <img
                      src={optimizeImage(banner.image_url, 1600)}
                      srcSet={imageSrcSet(banner.image_url, [800, 1200, 1600])}
                      sizes="(max-width: 1024px) 100vw, 1200px"
                      alt={banner.title || ""}
                      width={1600}
                      height={600}
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

      {/* ── Why TixNaija: numbered rules, not cards ──────────────────── */}
      <section className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <h2 className="max-w-xl font-display text-[clamp(1.9rem,3.5vw,2.6rem)] leading-tight tracking-[-0.02em] text-foreground">
            Less friction, more turnout.
          </h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
            The seams — discovery, payment, entry — are the parts we removed.
          </p>
        </div>

        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {VALUE_PROPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="border-t border-border/60 pt-6">
              <div className="flex items-center justify-between">
                <Icon className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
                <span className="font-display text-sm text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <h3 className="mt-6 text-[16px] font-semibold leading-snug text-foreground">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
