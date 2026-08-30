import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Calendar, MapPin, ChevronRight, ArrowRight, QrCode, CreditCard, Ticket, Zap, Flame, Compass } from "lucide-react";
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
      <section className="relative pt-16 pb-20 md:pt-32 md:pb-40 overflow-visible">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        {/* Animated glowing orbs */}
        <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-primary/20 rounded-full blur-[100px] mix-blend-screen animate-[spin_20s_linear_infinite] pointer-events-none" />
        <div className="absolute top-[10%] right-[15%] w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-[spin_25s_linear_infinite_reverse] pointer-events-none" />

        <div className="mx-auto max-w-5xl px-4 text-center relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div className="inline-flex items-center gap-3 mb-10 bg-background/50 border border-primary/20 backdrop-blur-xl rounded-full px-5 py-2 shadow-lg shadow-primary/5 ring-1 ring-white/10">
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-foreground/90">
              Naija's Premier Ticket Hub
            </span>
          </div>
          
          <h1 className="font-display text-6xl leading-[0.85] md:text-8xl lg:text-[8rem] tracking-tighter mb-8 drop-shadow-2xl">
            Buy tickets.
            <br />
            <span className="bg-gradient-to-br from-primary via-orange-500 to-purple-600 bg-clip-text text-transparent inline-block mt-4 pb-2 filter drop-shadow-lg">Turn up.</span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl leading-relaxed font-medium mb-12 max-w-[600px]">
            Discover concerts, comedy shows, and premium events across Nigeria. Secure your spot in seconds and enter with a scannable QR code.
          </p>

          <form
            className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-[2rem] border border-white/10 bg-black/40 p-3 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all hover:border-primary/30 hover:shadow-primary/20 hover:bg-black/50 group"
            onSubmit={(e) => {
              e.preventDefault();
              navigate({ to: "/browse", search: { q: query.trim() || undefined } });
            }}
          >
            <div className="pl-5 flex items-center justify-center bg-white/5 rounded-full w-12 h-12 shrink-0 group-hover:bg-primary/10 transition-colors">
              <Search className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for events, artists, venues..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-base md:text-lg h-14 placeholder:text-muted-foreground/60 w-full font-medium"
            />
            <Button type="submit" className="rounded-full h-14 px-8 md:px-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_30px_-5px_var(--theme-primary)] font-bold text-base transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_0_var(--theme-primary)] shrink-0">
              Find Events
            </Button>
          </form>


        </div>
      </section>

      {/* ── Value Props Bento Box ── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:pb-40">
        <div className="text-center mb-16 relative z-10">
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl mb-6">Why TixNaija?</h2>
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">We've eliminated the friction from ticketing. Experience the most seamless way to discover and host events in Nigeria.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:grid-rows-2 md:h-[600px] relative z-10">
          {/* Card 1: Wide */}
          <div className="group relative overflow-hidden rounded-[3rem] border border-white/10 bg-card/60 backdrop-blur-xl p-10 md:col-span-2 shadow-2xl hover:border-primary/40 transition-colors duration-500 flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute right-0 bottom-0 w-64 h-64 bg-primary/20 rounded-full blur-[80px] -z-10 group-hover:bg-primary/30 transition-colors" />
            
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-8 border border-primary/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <QrCode className="h-8 w-8 text-primary" />
            </div>
            
            <div className="relative z-10">
              <h3 className="text-3xl md:text-4xl font-display tracking-tight mb-4 group-hover:text-primary transition-colors">QR tickets, zero drama</h3>
              <p className="text-lg text-muted-foreground leading-relaxed font-medium max-w-md">Every ticket generates a unique, secure cryptographic QR code. Fast door scans, absolutely no double entries, just pure vibes and smooth access control.</p>
            </div>
          </div>

          {/* Card 2: Tall */}
          <div className="group relative overflow-hidden rounded-[3rem] border border-white/10 bg-card/60 backdrop-blur-xl p-10 md:row-span-2 shadow-2xl hover:border-purple-500/40 transition-colors duration-500 flex flex-col justify-between">
            <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-500/20 rounded-full blur-[80px] -z-10 group-hover:bg-purple-500/30 transition-colors" />
            
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-8 border border-purple-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
              <CreditCard className="h-8 w-8 text-purple-500" />
            </div>
            
            <div className="relative z-10 mt-auto">
              <h3 className="text-3xl md:text-4xl font-display tracking-tight mb-4 group-hover:text-purple-400 transition-colors">Pay with ease</h3>
              <p className="text-lg text-muted-foreground leading-relaxed font-medium">Cards, bank transfers, USSD — we support all the payment methods Naija actually uses via our secure Paystack integration.</p>
            </div>
          </div>

          {/* Card 3: Standard */}
          <div className="group relative overflow-hidden rounded-[3rem] border border-white/10 bg-card/60 backdrop-blur-xl p-10 shadow-2xl hover:border-orange-500/40 transition-colors duration-500 flex flex-col justify-between md:col-span-2">
            <div className="absolute inset-0 bg-gradient-to-tl from-orange-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute right-10 top-10 w-32 h-32 bg-orange-500/20 rounded-full blur-[60px] -z-10 group-hover:bg-orange-500/30 transition-colors" />
            
            <div className="flex justify-between items-start">
              <div className="relative z-10">
                <h3 className="text-3xl md:text-4xl font-display tracking-tight mb-4 group-hover:text-orange-400 transition-colors">Sell in minutes</h3>
                <p className="text-lg text-muted-foreground leading-relaxed font-medium max-w-lg">Create your event, add ticket tiers, and share the link globally. Selling out has never been this ridiculously easy.</p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-orange-500/10 hidden sm:flex items-center justify-center border border-orange-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500 shrink-0">
                <Ticket className="h-8 w-8 text-orange-500" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Organizer Breakout CTA ── */}
      <section className="relative py-32 overflow-hidden my-16 border-y border-white/5 bg-background/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        
        {/* Animated grid lines behind */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50 pointer-events-none" />

        <div className="mx-auto max-w-6xl px-4 relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border border-primary/30 mb-8 shadow-[0_0_50px_0_var(--theme-primary)]">
            <Zap className="h-10 w-10 text-primary" />
          </div>
          
          <h2 className="font-display text-5xl md:text-7xl leading-tight text-foreground mb-6 drop-shadow-xl">
            Selling tickets? <span className="text-gradient-sunset">Start here.</span>
          </h2>
          <p className="text-muted-foreground text-xl md:text-2xl font-medium leading-relaxed max-w-2xl mx-auto mb-12">
            Set up your event, publish instantly, and get paid directly to your Nigerian bank account. Zero listing fees, zero hassle.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button asChild size="lg" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_40px_-10px_var(--theme-primary)] h-16 px-10 text-xl font-bold hover:scale-105 transition-all duration-300 w-full sm:w-auto">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your event
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-2 border-white/10 bg-white/5 backdrop-blur-md text-foreground hover:bg-white/10 hover:border-white/20 h-16 px-10 text-xl font-bold transition-all duration-300 hover:-translate-y-1 w-full sm:w-auto"
            >
              <Link to="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Upcoming Events ── */}
      <section className="mx-auto max-w-7xl px-4 pb-32">
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border/40 pb-6">
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
          <div className="grid gap-6 md:grid-cols-3">
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
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.data.map((ev) => {
              const isCancelled = ev.status === 'cancelled';
              const startDate = new Date(ev.start_datetime);
              return (
                <div key={ev.id}>
                  <Link
                    to="/e/$slug"
                    params={{ slug: ev.slug }}
                    className="group relative flex flex-col overflow-hidden rounded-[2.5rem] bg-card border border-white/5 shadow-lg transition-all duration-500 hover:-translate-y-3 hover:shadow-2xl hover:shadow-primary/20 hover:border-primary/40 h-full"
                  >
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary/50">
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
                      
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-500 z-10" />

                      {/* Floating Date Badge */}
                      <div className="absolute right-4 top-4 z-20 flex flex-col items-center justify-center bg-background/90 backdrop-blur-xl border border-white/10 rounded-2xl w-14 h-16 shadow-2xl group-hover:bg-primary group-hover:border-primary group-hover:text-primary-foreground transition-all duration-300">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-70 group-hover:opacity-100">{startDate.toLocaleString("en-NG", { month: "short" })}</span>
                        <span className="text-xl font-display leading-none">{startDate.getDate()}</span>
                      </div>

                      {isCancelled && (
                        <div className="absolute inset-0 bg-background/60 backdrop-blur-md flex items-center justify-center z-20">
                          <div className="rounded-full bg-destructive px-6 py-2 text-base font-bold text-destructive-foreground shadow-xl uppercase tracking-widest border-2 border-destructive-foreground/20">
                            Cancelled
                          </div>
                        </div>
                      )}
                    </div>
                  
                    {/* Ticket Body */}
                    <div className="flex flex-1 flex-col p-6 lg:p-8 bg-card/80 backdrop-blur-xl z-20 relative -mt-4 rounded-t-[2rem] border-t border-white/10">
                      <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                        <Calendar className="h-4 w-4" />
                        {startDate.toLocaleString("en-NG", {
                          hour: "numeric",
                          minute: "2-digit"
                        })}
                      </div>
                      
                      <h3 className="font-display text-2xl lg:text-3xl leading-tight group-hover:text-primary transition-colors line-clamp-2 mb-4 drop-shadow-sm">
                        {ev.title}
                      </h3>
                      
                      {ev.city && (
                        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-5 text-sm text-muted-foreground font-medium group-hover:text-foreground/80 transition-colors">
                          <div className="flex items-center gap-2 line-clamp-1 pr-2">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <span className="line-clamp-1">{ev.venue_name || ev.city}</span>
                          </div>
                          
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              );
            })}
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
