import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Search, MapPin, ArrowRight, Ticket, QrCode, CreditCard, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/v2")({
  head: () => ({
    meta: [{ title: "TixNaija v2 — Nigerian event tickets, sold fast" }],
  }),
  component: LandingV2,
});

async function fetchUpcoming() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, slug, city, venue_name, start_datetime, end_datetime, cover_image_url, status")
    .eq("status", "published")
    .gte("start_datetime", new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order("start_datetime", { ascending: true })
    .limit(6);
  if (error) throw error;
  const now = new Date();
  return ((data as any[]) ?? []).filter((ev: any) => {
    const end = ev.end_datetime ? new Date(ev.end_datetime) : new Date(ev.start_datetime);
    return end >= now;
  });
}

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.55, delay: i * 0.07 },
  }),
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function LandingV2() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const upcoming = useQuery({ queryKey: ["home-upcoming-v2"], queryFn: fetchUpcoming });
  const hero = upcoming.data?.[0] as any;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/browse", search: { q: query.trim() || undefined } });
  };

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white overflow-x-hidden">
      <div className="relative z-50"><SiteNav /></div>

      {/* HERO */}
      <section className="relative min-h-[100dvh] flex flex-col">
        {hero?.cover_image_url ? (
          <div className="absolute inset-0 z-0">
            <img
              src={hero.cover_image_url}
              alt={hero.title}
              className="w-full h-full object-cover"
              style={{ filter: "brightness(0.38) saturate(1.2)" }}
            />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#1a0a00] via-[#0d0d0d] to-[#050508]">
            <div className="absolute top-[20%] left-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-orange-600/20 rounded-full blur-[160px]" />
            <div className="absolute bottom-[10%] right-[5%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-amber-500/10 rounded-full blur-[140px]" />
          </div>
        )}
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/30 to-transparent" />

        <div className="relative z-20 flex-1 flex flex-col justify-end pb-10 md:pb-16 px-4">
          <div className="mx-auto w-full max-w-5xl">
            <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
              <motion.div variants={fadeUp}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 backdrop-blur-xl px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
                  Naija's premier ticket hub
                </span>
              </motion.div>
              <motion.h1 variants={fadeUp} className="font-display text-[clamp(3rem,10vw,7rem)] leading-[0.95] tracking-[-0.03em] text-white">
                Buy&nbsp;tickets.
                <br />
                <span style={{ background: "linear-gradient(110deg,#EA580C 0%,#F97316 40%,#FBBF24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                  Turn&nbsp;up.
                </span>
              </motion.h1>
              <motion.p variants={fadeUp} className="max-w-xl text-base md:text-lg text-white/55 leading-relaxed font-medium">
                Concerts, comedy, conferences and parties across Nigeria. Secure your spot in seconds and walk in with a QR code.
              </motion.p>
              <motion.form variants={fadeUp} onSubmit={handleSearch}
                className="flex items-center gap-2 max-w-2xl rounded-[1.5rem] border border-white/12 bg-white/8 backdrop-blur-2xl p-2 shadow-2xl shadow-black/40 focus-within:border-orange-500/40 transition-colors duration-300">
                <div className="pl-3 text-white/40 shrink-0"><Search className="h-5 w-5" /></div>
                <Input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search events, artists, venues..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-white placeholder:text-white/35 text-base h-12 font-medium w-full" />
                <Button type="submit" className="rounded-[1.1rem] h-12 px-6 md:px-8 font-bold text-sm shrink-0 text-white"
                  style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                  Search
                </Button>
              </motion.form>
              <motion.div variants={fadeUp} className="flex flex-wrap gap-2 pt-1">
                {["🎵 Music", "😂 Comedy", "🎤 Conference", "⛪ Church", "🎉 Party"].map((tag) => (
                  <button key={tag} type="button"
                    onClick={() => navigate({ to: "/browse", search: { q: tag.split(" ").slice(1).join(" ").toLowerCase() } })}
                    className="rounded-full border border-white/12 bg-white/6 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/15 hover:text-white active:scale-[0.97] transition-all duration-150">
                    {tag}
                  </button>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* UPCOMING EVENTS */}
      <section className="bg-[#0a0a0a] pt-16 pb-24 px-4">
        <div className="mx-auto max-w-6xl">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="flex items-end justify-between mb-10">
            <motion.div variants={fadeUp}>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500 mb-2">Happening soon</p>
              <h2 className="font-display text-3xl md:text-4xl leading-tight tracking-[-0.02em] text-white">Coming up next</h2>
            </motion.div>
            <motion.div variants={fadeUp}>
              <Link to="/browse" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white/50 hover:text-white transition-colors duration-150">
                Browse all <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </motion.div>
          </motion.div>

          {upcoming.isLoading && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="animate-pulse rounded-[2rem] bg-white/4 border border-white/6 h-[340px]" />)}
            </div>
          )}

          {upcoming.data && upcoming.data.length > 0 && (
            <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {upcoming.data.map((ev: any, i: number) => {
                const date = new Date(ev.start_datetime);
                return (
                  <motion.div key={ev.id} variants={fadeUp} custom={i}>
                    <Link to="/e/$slug" params={{ slug: ev.slug }}
                      className="group relative flex flex-col overflow-hidden rounded-[2rem] border border-white/8 bg-white/4 hover:border-orange-500/30 hover:bg-white/6 transition-all duration-300 h-[340px]">
                      <div className="relative flex-1 overflow-hidden">
                        {ev.cover_image_url
                          ? <img src={ev.cover_image_url} alt={ev.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                          : <div className="w-full h-full bg-gradient-to-br from-orange-900/40 to-amber-900/20" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/20 to-transparent" />
                        <div className="absolute top-4 right-4 flex flex-col items-center justify-center rounded-2xl bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 w-12 h-14 shadow-xl">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-orange-400">{date.toLocaleString("en-NG", { month: "short" })}</span>
                          <span className="font-display text-lg leading-none text-white">{date.getDate()}</span>
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h3 className="font-display text-xl leading-tight text-white line-clamp-2 mb-2 group-hover:text-orange-300 transition-colors duration-200">{ev.title}</h3>
                        {ev.city && (
                          <div className="flex items-center gap-1.5 text-white/40 text-xs font-medium">
                            <MapPin className="h-3 w-3 text-orange-500 shrink-0" />
                            {ev.venue_name || ev.city}
                          </div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
          {upcoming.data && upcoming.data.length === 0 && (
            <div className="py-20 text-center text-white/30 text-sm">Fresh events landing soon — stay tuned.</div>
          )}
        </div>
      </section>

      {/* WHY TIXNAIJA */}
      <section className="bg-[#0d0d0d] border-t border-white/5 py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }}>
            <motion.p variants={fadeUp} className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500 mb-4 text-center">The platform</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-[clamp(2rem,6vw,4rem)] leading-[1.05] tracking-[-0.025em] text-white text-center mb-16">
              Built for Nigeria.<br /><span className="text-white/30">Built for you.</span>
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-px bg-white/6 rounded-[2.5rem] overflow-hidden border border-white/6">
              {[
                { icon: QrCode, title: "QR tickets, zero drama", body: "Every ticket has a unique cryptographic QR code. Fast door scans, no double entries.", accent: "#EA580C" },
                { icon: CreditCard, title: "Pay how Naija pays", body: "Cards, bank transfers, USSD — all the payment methods Nigeria actually uses via Paystack.", accent: "#F97316" },
                { icon: Ticket, title: "Sell in minutes", body: "Create your event, add ticket tiers, share the link. Selling out has never been this easy.", accent: "#FBBF24" },
              ].map((card, i) => (
                <motion.div key={card.title} variants={fadeUp} custom={i} className="group bg-[#0d0d0d] p-8 md:p-10 hover:bg-white/3 transition-colors duration-300">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 border border-white/8" style={{ background: `${card.accent}18` }}>
                    <card.icon className="h-6 w-6" style={{ color: card.accent }} />
                  </div>
                  <h3 className="font-display text-xl text-white mb-3 group-hover:text-orange-300 transition-colors duration-200">{card.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed">{card.body}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ORGANIZER CTA */}
      <section className="relative overflow-hidden bg-[#0a0a0a] border-t border-white/5 py-24 md:py-32 px-4">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-orange-600/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-80px" }} className="space-y-8">
            <motion.p variants={fadeUp} className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500">For organizers</motion.p>
            <motion.h2 variants={fadeUp} className="font-display text-[clamp(2.2rem,7vw,5rem)] leading-[1.0] tracking-[-0.03em] text-white">
              Selling tickets?<br />
              <span style={{ background: "linear-gradient(110deg,#EA580C 0%,#FBBF24 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Start here.</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-white/40 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
              Set up your event, publish instantly, and get paid to your Nigerian bank account. Zero listing fees.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="rounded-full h-14 px-10 font-bold text-base text-white w-full sm:w-auto active:scale-[0.97] transition-transform duration-100"
                style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                <Link to="/auth" search={{ mode: "signup" }}>Create your event <ChevronRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline"
                className="rounded-full h-14 px-10 font-bold text-base border-white/12 bg-white/4 text-white hover:bg-white/8 hover:border-white/20 w-full sm:w-auto active:scale-[0.97] transition-all duration-150">
                <Link to="/how-it-works">How it works</Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
