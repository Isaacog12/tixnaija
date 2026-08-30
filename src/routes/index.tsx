import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, MapPin, ChevronRight, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";


export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingPage,
});

async function fetchUpcoming() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, status")
    .in("status", ["published", "cancelled", "completed"])
    .gte("start_datetime", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("start_datetime", { ascending: true })
    .limit(20);
  if (error) throw error;

  const now = new Date();
  const validEvents = (data ?? []).filter(ev => {
    const start = new Date(ev.start_datetime);
    const end = ev.end_datetime ? new Date(ev.end_datetime) : start;
    return end >= now;
  });

  return validEvents.slice(0, 3);
}

async function fetchBanners() {
  const { data, error } = await supabase
    .from("sponsored_banners" as any)
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  
  const now = new Date();
  return (data ?? []).filter((b: any) => {
    if (b.starts_at && new Date(b.starts_at) > now) return false;
    if (b.ends_at && new Date(b.ends_at) < now) return false;
    return true;
  });
}

const CATEGORIES = ["Concerts", "Comedy", "Conferences", "Church", "Campus", "Parties"];

const VALUE_PROPS = [
  {
    title: "QR tickets, zero drama",
    body: "Every ticket has a unique code. Fast door scans, no double entries, just pure vibes.",
  },
  {
    title: "Pay with ease",
    body: "Cards, transfers, USSD — we support all the payment methods Naija actually uses.",
  },
  {
    title: "Sell in minutes",
    body: "Create your event, add ticket tiers, and share the link. Selling out has never been this easy.",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

function LandingPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const upcoming = useQuery({ queryKey: ["home-upcoming"], queryFn: fetchUpcoming });
  const banners = useQuery({ queryKey: ["home-banners"], queryFn: fetchBanners });

  const handleBannerClick = async (banner: any) => {
    supabase.rpc("increment_banner_click" as any, { banner_id: banner.id }).then();
    if (banner.link_url) {
      if (banner.link_url.startsWith("http")) {
        window.open(banner.link_url, "_blank", "noopener,noreferrer");
      } else {
        navigate({ to: banner.link_url });
      }
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SiteNav />

      {/* Decorative Backgrounds */}
      <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute top-[30%] left-[-10%] w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* ── Banners Section ── */}
      
        {banners.data && banners.data.length > 0 && (
          <div 
            
            
            
            className="mx-auto max-w-7xl px-4 pt-6"
          >
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x no-scrollbar">
              {banners.data.map((banner: any) => (
                <div 
                  
                  
                  key={banner.id}
                  onClick={() => handleBannerClick(banner)}
                  className={`relative h-48 sm:h-64 md:h-72 min-w-[85vw] sm:min-w-[600px] md:min-w-[700px] shrink-0 rounded-[2rem] overflow-hidden snap-center group shadow-xl border border-border/50 ${banner.link_url ? "cursor-pointer" : ""}`}
                >
                  <img 
                    src={banner.image_url} 
                    alt={banner.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-4 right-4 px-3 py-1.5 bg-background/80 backdrop-blur-md text-foreground text-xs font-bold tracking-wider uppercase rounded-full shadow-sm pointer-events-none">
                    Sponsored
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      

      {/* ── Hero ── */}
      <section className="relative pt-16 pb-20 md:pt-28 md:pb-32">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
        
        <div 
          initial="hidden" animate="visible" 
          className="mx-auto max-w-5xl px-4 text-center relative z-10"
        >
          <div  className="inline-flex items-center gap-3 mb-8 bg-secondary/50 border border-border/50 backdrop-blur-md rounded-full px-5 py-2 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
              Naija's Premier Ticket Hub
            </span>
          </div>
          
          <h1  className="font-display text-6xl leading-[0.9] md:text-8xl lg:text-[7rem] tracking-tight mb-8">
            Buy tickets.
            <br />
            <span className="text-gradient-sunset inline-block mt-2">Turn up.</span>
          </h1>
          
          <p  className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-2xl leading-relaxed font-medium mb-12">
            Discover concerts, comedy shows, and premium events across Nigeria. Buy your tickets in seconds and enter with a scannable QR code.
          </p>

          <form
            
            className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-border/60 bg-card/80 p-2 shadow-2xl backdrop-blur-xl"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/browse", search: { q: query.trim() || undefined } });
            }}
          >
            <div className="pl-4">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, artists, cities..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base h-12"
            />
            <Button type="submit" className="rounded-full h-12 px-8 gradient-sunset text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40 font-bold text-base transition-all hover:-translate-y-0.5">
              Search
            </Button>
          </form>

          <div  className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {CATEGORIES.map((label) => (
              <button
                key={label}
                onClick={() => navigate({ to: "/browse", search: { q: label } })}
                className="rounded-full border border-border/60 bg-card/50 px-5 py-2 text-sm font-semibold transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Value Props ── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:pb-32">
        <div 
          initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
          
          className="grid gap-6 md:grid-cols-3"
        >
          {VALUE_PROPS.map(({ title, body }, i) => (
            <div 
              
              key={title} 
              className="group rounded-[2.5rem] border border-border/60 bg-card/40 p-8 md:p-10 hover:bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5"
            >
              <div className="flex items-start gap-4 mb-8">
                <span className="font-display text-5xl md:text-6xl leading-none text-muted-foreground/20 group-hover:text-primary/30 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="h-px flex-1 bg-border/60 mt-6 group-hover:bg-primary/20 transition-colors" />
              </div>
              <h3 className="text-2xl font-display tracking-tight mb-3 group-hover:text-primary transition-colors">{title}</h3>
              <p className="text-base text-muted-foreground leading-relaxed font-medium">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Organizer CTA ── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:pb-32">
        <div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} 
          className="relative overflow-hidden rounded-[3rem] border border-primary/20 p-10 md:p-16 shadow-2xl"
        >
          <div className="absolute inset-0 gradient-sunset opacity-95" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl leading-tight text-primary-foreground mb-4">
                Selling tickets? Start here.
              </h2>
              <p className="text-primary-foreground/90 text-lg font-medium leading-relaxed max-w-md">
                Set up your event, publish instantly, and get paid directly to your Nigerian bank account. No listing fees, no hassle.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 md:justify-end">
              <Button asChild size="lg" className="rounded-full bg-background text-foreground hover:bg-background/90 shadow-xl h-14 px-8 text-lg font-bold hover:scale-105 transition-transform border-0">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create your event
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-2 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 h-14 px-8 text-lg font-bold transition-colors"
              >
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="mx-auto max-w-7xl px-4 pb-32">
        <div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} 
          className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6"
        >
          <div>
            <h2 className="font-display text-4xl md:text-5xl mb-2">Coming up next</h2>
            <p className="text-lg text-muted-foreground font-medium">
              {upcoming.data && upcoming.data.length > 0
                ? "Grab your tickets before they're gone."
                : "Fresh events landing here soon."}
            </p>
          </div>
          <Link to="/browse" className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-5 py-2.5 text-sm font-semibold hover:border-primary hover:text-primary transition-all shadow-sm">
            Browse all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {upcoming.isLoading && (
          <div className="grid gap-6 md:grid-cols-3">
             {[1, 2, 3].map((i) => (
               <div key={i} className="animate-pulse rounded-[2rem] bg-card border border-border/40 overflow-hidden shadow-sm h-[380px]">
                 <div className="h-56 bg-muted/60 relative overflow-hidden">
                   <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
                 </div>
                 <div className="p-6 space-y-4">
                   <div className="h-5 w-2/3 bg-muted/80 rounded-md" />
                   <div className="h-4 w-1/3 bg-muted/80 rounded-md" />
                   <div className="h-4 w-1/2 bg-muted/80 rounded-md mt-4" />
                 </div>
               </div>
             ))}
          </div>
        )}

        {upcoming.data && upcoming.data.length === 0 && (
          <div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} 
            className="grid gap-6 md:grid-cols-3"
          >
            {[1, 2, 3].map((i) => (
              <div  key={i} className="rounded-[2.5rem] border border-dashed border-border/60 bg-card/30 p-10 flex flex-col items-center justify-center text-center">
                <div className="font-display text-7xl text-muted-foreground/20 mb-6">
                  {String(i).padStart(2, "0")}
                </div>
                <p className="text-base text-muted-foreground font-medium max-w-[200px]">
                  Be the first to list an event in this slot.
                </p>
              </div>
            ))}
          </div>
        )}

        {upcoming.data && upcoming.data.length > 0 && (
          <div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-50px" }}
            
            className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3"
          >
            {upcoming.data.map((ev) => {
              const isCancelled = ev.status === 'cancelled';
              return (
                <div  key={ev.id}>
                  <Link
                    to="/e/$slug"
                    params={{ slug: ev.slug }}
                    className="group relative flex flex-col overflow-hidden rounded-[2.5rem] bg-card border border-border/60 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 h-full"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                      {ev.cover_image_url ? (
                        <img
                          src={ev.cover_image_url}
                          alt={ev.title}
                          loading="lazy"
                          decoding="async"
                          className={`h-full w-full object-cover transition-transform duration-700 ${!isCancelled ? "group-hover:scale-110" : "opacity-75 grayscale"}`}
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20" />
                      )}
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-40 group-hover:opacity-70 transition-opacity duration-300 z-10" />

                      {isCancelled && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-md flex items-center justify-center z-20">
                          <div className="rounded-full bg-destructive px-6 py-2 text-base font-bold text-destructive-foreground shadow-xl uppercase tracking-widest border-2 border-destructive-foreground/20">
                            Cancelled
                          </div>
                        </div>
                      )}
                      {ev.city && (
                        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm backdrop-blur-md z-20 border border-border/50 uppercase tracking-wider">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {ev.city}
                        </div>
                      )}
                    </div>
                  
                  <div className="flex flex-1 flex-col p-6 lg:p-8 bg-card/80 backdrop-blur-sm z-20 relative -mt-6 rounded-t-[2rem] border-t border-white/5">
                    <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                      <Calendar className="h-4 w-4" />
                      {new Date(ev.start_datetime).toLocaleString("en-NG", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit"
                      })}
                    </div>
                    
                    <h3 className="font-display text-2xl lg:text-3xl leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-3">
                      {ev.title}
                    </h3>
                    
                    {ev.venue_name && (
                      <p className="mt-auto text-sm text-muted-foreground font-medium line-clamp-1 border-t border-border/60 pt-4">
                        {ev.venue_name}
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            )})}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-card/30 py-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 px-4 md:flex-row">
          <Link to="/" className="flex items-baseline gap-0 hover:opacity-80 transition-opacity">
            <span className="font-display text-2xl leading-none tracking-wide text-foreground">TIX</span>
            <span className="font-display text-2xl leading-none tracking-wide font-light text-gradient-sunset">NAIJA</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-semibold text-muted-foreground">
            <Link to="/how-it-works" className="hover:text-primary transition-colors">Guide</Link>
            <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
            <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/careers" className="hover:text-primary transition-colors">Careers</Link>
          </div>
          <p className="text-sm font-medium text-muted-foreground/70">© {new Date().getFullYear()} — Buy tickets. Turn up. Repeat.</p>
        </div>
      </footer>
    </div>
  );
}
