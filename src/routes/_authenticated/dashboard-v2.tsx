import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays, Copy, MapPin, Plus, QrCode, Ticket,
  Zap, Users, BarChart2, Clock, XCircle, ArrowRight, FileEdit, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/currency";
import { useState } from "react";
import { PromoCodesTab } from "@/components/promo-codes-tab";

export const Route = createFileRoute("/_authenticated/dashboard-v2")({
  component: DashboardV2,
});

async function fetchMyEvents() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_organizer, is_admin, full_name")
    .eq("id", userId)
    .maybeSingle()) as { data: any };

  const { data: adminRole } = (await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle()) as { data: any };

  const { data: latestApp } = (await supabase
    .from("organizer_applications")
    .select("status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: any };

  const { data: events, error } = (await supabase
    .from("events")
    .select("id, title, slug, city, start_datetime, status, cover_image_url, event_series(title)")
    .eq("organizer_id", userId)
    .order("start_datetime", { ascending: true })) as { data: any[] | null; error: any };
  if (error) throw error;

  const eventIds = (events ?? []).map((e: any) => e.id);
  let statsByEvent: Record<string, { sold: number; revenueKobo: number }> = {};
  if (eventIds.length) {
    const { data: types } = (await supabase
      .from("ticket_types")
      .select("event_id, quantity_sold")
      .in("event_id", eventIds)) as { data: any[] | null };
    const { data: orders } = (await supabase
      .from("orders")
      .select("event_id, total_kobo")
      .in("event_id", eventIds)
      .eq("status", "paid")) as { data: any[] | null };
    for (const t of types ?? []) {
      const s = statsByEvent[t.event_id] ?? { sold: 0, revenueKobo: 0 };
      s.sold += t.quantity_sold;
      statsByEvent[t.event_id] = s;
    }
    for (const o of orders ?? []) {
      const s = statsByEvent[o.event_id] ?? { sold: 0, revenueKobo: 0 };
      s.revenueKobo += o.total_kobo || 0;
      statsByEvent[o.event_id] = s;
    }
  }

  return { profile, isAdmin: !!adminRole, latestApp, events: events ?? [], statsByEvent };
}

// Spring variants
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.5, delay: i * 0.06 },
  }),
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

type Tab = "overview" | "events" | "promo-codes";

function DashboardV2() {
  const { data, isLoading, error } = useQuery({ queryKey: ["my-events-v2"], queryFn: fetchMyEvents });
  const [activeTab, setActiveTab] = useState<Tab>("events");

  const isOrganizer = data?.profile?.is_organizer ?? false;
  const isAdmin = data?.isAdmin ?? false;
  const latestApp = data?.latestApp ?? null;

  // Aggregate stats
  const totalSold = data ? Object.values(data.statsByEvent).reduce((s, v) => s + v.sold, 0) : 0;
  const totalRevKobo = data ? Object.values(data.statsByEvent).reduce((s, v) => s + v.revenueKobo, 0) : 0;
  const liveEvents = data?.events.filter((e: any) => e.status === "published").length ?? 0;

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white">


      <div className="mx-auto max-w-7xl px-4 py-8 md:py-12">
        {/* ── Header ── */}
        <motion.div variants={stagger} initial="hidden" animate="show"
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-500 mb-1">
              {isLoading ? "Loading..." : `Welcome back, ${data?.profile?.full_name?.split(" ")[0] || "Organizer"}`}
            </p>
            <h1 className="font-display text-3xl md:text-4xl leading-tight tracking-[-0.02em] text-white">
              Dashboard
            </h1>
          </motion.div>
          <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-3 shrink-0">
            {isAdmin && (
              <>
                <Button asChild variant="outline"
                  className="h-10 px-4 rounded-full border-white/12 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-sm font-semibold">
                  <Link to="/admin">Admin Panel</Link>
                </Button>
                <Button asChild variant="outline"
                  className="h-10 px-4 rounded-full border-white/12 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 text-sm font-semibold">
                  <Link to="/admin/organizer-applications">Review Apps</Link>
                </Button>
              </>
            )}
            {isOrganizer && (
              <Button asChild
                className="h-10 px-5 rounded-full font-bold text-sm text-white active:scale-[0.97] transition-transform duration-100"
                style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                <Link to="/events/new">
                  <Plus className="mr-1.5 h-4 w-4" /> New Event
                </Link>
              </Button>
            )}
          </motion.div>
        </motion.div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-28 rounded-[1.5rem] bg-white/4 border border-white/6" />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center text-red-400 max-w-2xl mx-auto mt-8">
            <XCircle className="h-10 w-10 mx-auto mb-4 opacity-50" />
            <h3 className="font-semibold text-lg mb-1">Failed to load dashboard</h3>
            <p className="text-red-400/70 text-sm">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* ── Stat cards ── */}
            {isOrganizer && (
              <motion.div variants={stagger} initial="hidden" animate="show"
                className="grid gap-4 sm:grid-cols-3 mb-8">
                {[
                  {
                    label: "Total tickets sold",
                    value: totalSold.toLocaleString("en-NG"),
                    icon: Ticket,
                    accent: "#EA580C",
                    sub: "All events combined",
                  },
                  {
                    label: "Total revenue",
                    value: formatNaira(totalRevKobo),
                    icon: TrendingUp,
                    accent: "#22C55E",
                    sub: "Paid orders only",
                  },
                  {
                    label: "Live events",
                    value: String(liveEvents),
                    icon: Zap,
                    accent: "#3B82F6",
                    sub: "Currently published",
                  },
                ].map((card, i) => (
                  <motion.div key={card.label} variants={fadeUp} custom={i}
                    className="relative overflow-hidden rounded-[1.5rem] border border-white/8 bg-white/4 p-6 hover:bg-white/6 transition-colors duration-300">
                    {/* Subtle glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-20 pointer-events-none"
                      style={{ background: card.accent }} />
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-[0.12em]">{card.label}</p>
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/8"
                        style={{ background: `${card.accent}18` }}>
                        <card.icon className="h-4 w-4" style={{ color: card.accent }} />
                      </div>
                    </div>
                    <p className="font-display text-3xl tracking-[-0.02em] text-white mb-1">{card.value}</p>
                    <p className="text-[11px] text-white/30 font-medium">{card.sub}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* ── Non-organizer CTA ── */}
            {!isOrganizer && (
              <motion.div variants={stagger} initial="hidden" animate="show"
                className="rounded-[2rem] border border-white/8 bg-white/4 p-8 md:p-12 mb-8">
                <motion.div variants={fadeUp} className="max-w-lg">
                  <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-orange-400 mb-6">
                    <Zap className="h-3 w-3" /> For creators
                  </span>
                  <h2 className="font-display text-3xl md:text-4xl leading-tight tracking-[-0.02em] text-white mb-4">
                    Start selling<br /><span className="text-orange-400">in minutes.</span>
                  </h2>
                  <p className="text-white/40 leading-relaxed mb-8">
                    Create your event, set ticket tiers, track sales in real-time, and scan attendees at the door.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {latestApp?.status === "pending" ? (
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-400">
                        <Clock className="h-4 w-4" /> Application pending review
                      </div>
                    ) : latestApp?.status === "rejected" ? (
                      <>
                        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-400">
                          <XCircle className="h-4 w-4" /> Application not approved
                        </div>
                        <Button asChild className="rounded-full h-11 px-6 font-bold text-sm text-white"
                          style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                          <Link to="/account">Apply again</Link>
                        </Button>
                      </>
                    ) : (
                      <Button asChild className="rounded-full h-11 px-8 font-bold text-sm text-white"
                        style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                        <Link to="/account">Become an Organizer</Link>
                      </Button>
                    )}
                    <Button asChild variant="outline"
                      className="rounded-full h-11 px-8 font-bold text-sm border-white/12 bg-white/5 text-white hover:bg-white/10 group">
                      <Link to="/browse">Explore events <ArrowRight className="ml-1.5 h-4 w-4 transition-transform group-hover:translate-x-0.5" /></Link>
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── Organizer tabs ── */}
            {isOrganizer && (
              <motion.div variants={fadeUp} initial="hidden" animate="show">
                {/* Tab bar */}
                <div className="flex items-center gap-1 p-1 rounded-full border border-white/8 bg-white/3 w-fit mb-8">
                  {(["overview", "events", "promo-codes"] as Tab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className="relative px-5 py-2 rounded-full text-sm font-semibold transition-colors duration-200"
                      style={{
                        color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
                        background: activeTab === tab ? "rgba(255,255,255,0.1)" : "transparent",
                      }}
                    >
                      {tab === "overview" ? "Overview" : tab === "events" ? "Events" : "Promo Codes"}
                    </button>
                  ))}
                </div>

                {/* Overview tab */}
                {activeTab === "overview" && (
                  <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
                    {[
                      { icon: Ticket, title: "Ticket Tiers", desc: "Create Early Bird, VIP, and GA tiers with custom pricing." },
                      { icon: BarChart2, title: "Live Analytics", desc: "Track sales, revenue, and capacity in real-time." },
                      { icon: QrCode, title: "QR Scanning", desc: "Check in attendees instantly with our built-in scanner." },
                      { icon: Users, title: "Comp Tickets", desc: "Issue free tickets to guests, press, or VIPs easily." },
                    ].map((f, i) => (
                      <motion.div key={f.title} variants={fadeUp} custom={i}
                        className="rounded-[1.5rem] border border-white/8 bg-white/4 p-6 hover:bg-white/6 transition-colors duration-300">
                        <div className="inline-flex rounded-xl bg-orange-500/10 border border-orange-500/15 p-3 mb-4">
                          <f.icon className="h-5 w-5 text-orange-400" />
                        </div>
                        <h3 className="font-semibold text-base text-white mb-1.5">{f.title}</h3>
                        <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Events tab */}
                {activeTab === "events" && (
                  data?.events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/10 bg-white/2 py-20 px-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/5 border border-white/8 mb-6">
                        <Ticket className="h-8 w-8 text-white/20" />
                      </div>
                      <h3 className="font-display text-2xl text-white mb-3">Your stage is empty.</h3>
                      <p className="max-w-md text-white/40 text-sm mb-8 leading-relaxed">
                        Create your first event and start selling tickets.
                      </p>
                      <Button asChild className="rounded-full h-11 px-6 font-bold text-sm text-white"
                        style={{ background: "linear-gradient(135deg,#EA580C 0%,#F97316 100%)" }}>
                        <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create your first event</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-[1.5rem] border border-white/8 bg-white/3 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead>
                            <tr className="border-b border-white/6">
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em] w-12" />
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em]">Event</th>
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em]">Date</th>
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em]">Status</th>
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em] text-right">Sold</th>
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em] text-right">Revenue</th>
                              <th className="px-5 py-3.5 font-semibold text-white/40 text-xs uppercase tracking-[0.1em] text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/4">
                            {data?.events.map((ev: any) => {
                              const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
                              const evDate = new Date(ev.start_datetime);
                              return (
                                <tr key={ev.id} className="group hover:bg-white/3 transition-colors duration-150">
                                  <td className="px-5 py-4">
                                    <div className="h-10 w-10 shrink-0 rounded-xl overflow-hidden border border-white/8">
                                      {ev.cover_image_url
                                        ? <img src={ev.cover_image_url} alt={ev.title} className="h-full w-full object-cover" />
                                        : <div className="h-full w-full flex items-center justify-center bg-white/5"><Ticket className="h-4 w-4 text-white/20" /></div>}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4">
                                    <div className="flex flex-col gap-0.5">
                                      <Link to="/events/$eventId/edit" params={{ eventId: ev.id }}
                                        className="font-semibold text-white text-sm hover:text-orange-400 transition-colors line-clamp-1">
                                        {ev.title}
                                      </Link>
                                      {ev.city && <div className="text-white/30 text-xs">{ev.city}</div>}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 text-white/40 text-xs">
                                    {evDate.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                                    <div className="text-[10px] mt-0.5 text-white/25">
                                      {evDate.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4"><StatusBadge status={ev.status} /></td>
                                  <td className="px-5 py-4 text-right text-white font-medium">{stats.sold}</td>
                                  <td className="px-5 py-4 text-right font-medium text-orange-400">{formatNaira(stats.revenueKobo)}</td>
                                  <td className="px-5 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                                      {ev.status === "published" && (
                                        <>
                                          <button
                                            title="Scan Tickets"
                                            onClick={() => {}}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 text-white/40 hover:text-orange-400 hover:border-orange-500/30 hover:bg-orange-500/10 transition-all duration-150">
                                            <Link to="/events/$eventId/scan" params={{ eventId: ev.id }}>
                                              <QrCode className="h-3.5 w-3.5" />
                                            </Link>
                                          </button>
                                          <button
                                            title="Copy public link"
                                            onClick={() => {
                                              navigator.clipboard.writeText(`${window.location.origin}/e/${ev.slug}`);
                                              toast.success("Link copied", { icon: <Copy className="h-4 w-4" /> });
                                            }}
                                            className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/8 transition-all duration-150">
                                            <Copy className="h-3.5 w-3.5" />
                                          </button>
                                        </>
                                      )}
                                      <Link to="/events/$eventId/attendees" params={{ eventId: ev.id }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/8 transition-all duration-150" title="Attendees">
                                        <Users className="h-3.5 w-3.5" />
                                      </Link>
                                      <Link to="/events/$eventId/edit" params={{ eventId: ev.id }}
                                        className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/8 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/8 transition-all duration-150" title="Edit">
                                        <FileEdit className="h-3.5 w-3.5" />
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                )}

                {/* Promo codes tab */}
                {activeTab === "promo-codes" && (
                  <PromoCodesTab events={data?.events || []} />
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft: { label: "Draft", color: "rgba(255,255,255,0.4)", bg: "rgba(255,255,255,0.06)" },
    published: { label: "Live", color: "#22C55E", bg: "rgba(34,197,94,0.1)" },
    cancelled: { label: "Cancelled", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
    completed: { label: "Ended", color: "rgba(255,255,255,0.3)", bg: "rgba(255,255,255,0.04)" },
  };
  const cfg = map[status] ?? map.draft;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-current/20"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      {cfg.label}
    </span>
  );
}
