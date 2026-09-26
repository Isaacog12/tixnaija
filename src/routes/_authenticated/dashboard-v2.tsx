import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Plus, QrCode, Ticket, Users, FileEdit, Copy, Tag, Zap, ArrowRight, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { optimizeImage } from "@/lib/image";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PromoCodesTab } from "@/components/promo-codes-tab";
import { PromotersTab } from "@/components/promoters-tab";

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

function DashboardV2() {
  const { data, isLoading, error } = useQuery({ queryKey: ["my-events-v2"], queryFn: fetchMyEvents });

  const isOrganizer = data?.profile?.is_organizer ?? false;
  const isAdmin = data?.isAdmin ?? false;
  const latestApp = data?.latestApp ?? null;

  const totalSold = data ? Object.values(data.statsByEvent).reduce((s, v) => s + v.sold, 0) : 0;
  const totalRevKobo = data ? Object.values(data.statsByEvent).reduce((s, v) => s + v.revenueKobo, 0) : 0;
  const liveEvents = data?.events.filter((e: any) => e.status === "published").length ?? 0;

  if (error) {
    return (
      <div className="min-h-dvh bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="font-display text-2xl text-red-400 mb-2">Error loading dashboard</p>
          <p className="text-red-400/60">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#050505] text-white selection:bg-orange-500/30 selection:text-orange-200 pb-32">
      
      {/* ── Structural Header ── */}
      <header className="border-b border-white/5 bg-[#050505] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-display text-xl font-medium tracking-tight">Overview</h1>
            <div className="h-4 w-px bg-white/10" />
            <p className="text-sm text-white/50">
              {isLoading ? "Loading..." : data?.profile?.full_name || "Organizer"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <Link to="/admin" className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-sm font-medium transition-colors">
                Admin
              </Link>
            )}
            {isOrganizer && (
              <>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-sm font-medium transition-colors">
                      <Tag className="w-4 h-4" /> Promo Codes
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl bg-[#0A0A0A] border-white/10 text-white p-0">
                    <DialogHeader className="p-6 border-b border-white/10">
                      <DialogTitle>Promo Codes</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                      <PromoCodesTab events={data?.events || []} />
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <button className="h-9 px-4 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-2 text-sm font-medium transition-colors">
                      <Users className="w-4 h-4" /> Promoters
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-3xl bg-[#0A0A0A] border-white/10 text-white p-0">
                    <DialogHeader className="p-6 border-b border-white/10">
                      <DialogTitle>Promoters</DialogTitle>
                    </DialogHeader>
                    <div className="p-6 overflow-y-auto max-h-[70vh]">
                      <PromotersTab events={data?.events || []} />
                    </div>
                  </DialogContent>
                </Dialog>

                <Link to="/events/new" className="h-9 px-4 rounded-md bg-white text-black hover:bg-white/90 flex items-center gap-2 text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" /> New Event
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12">
        {/* ── Architectural Metrics Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-sm font-medium text-white/50 mb-4">Total Revenue</p>
            <p className="font-display text-4xl tracking-tight">
              {isLoading ? "-" : formatNaira(totalRevKobo)}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-sm font-medium text-white/50 mb-4">Tickets Sold</p>
            <p className="font-display text-4xl tracking-tight">
              {isLoading ? "-" : totalSold.toLocaleString("en-NG")}
            </p>
          </div>
          <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
            <p className="text-sm font-medium text-white/50 mb-4">Live Events</p>
            <p className="font-display text-4xl tracking-tight">
              {isLoading ? "-" : liveEvents}
            </p>
          </div>
        </div>

        {/* ── Non-organizer Onboarding ── */}
        {!isLoading && !isOrganizer && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-12 text-center max-w-2xl mx-auto">
            <h2 className="font-display text-2xl font-medium tracking-tight mb-3">Become an Organizer</h2>
            <p className="text-white/60 mb-8 max-w-md mx-auto">
              Create your events, set up ticketing pages, and track revenue instantly with TixNaija.
            </p>
            {latestApp?.status === "pending" ? (
              <div className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 h-10 px-6 text-sm font-medium text-amber-400">
                Review in Progress
              </div>
            ) : latestApp?.status === "rejected" ? (
              <Link to="/account" className="inline-flex items-center justify-center gap-2 rounded-md bg-red-500/10 border border-red-500/30 text-red-400 h-10 px-6 text-sm font-medium hover:bg-red-500/20 transition-colors">
                Application Denied • Apply Again
              </Link>
            ) : (
              <Link to="/account" className="inline-flex items-center justify-center rounded-md bg-white text-black h-10 px-6 text-sm font-medium hover:bg-white/90 transition-colors">
                Apply as Organizer
              </Link>
            )}
          </div>
        )}

        {/* ── Event Grid ── */}
        {!isLoading && isOrganizer && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-lg font-medium tracking-tight">Events</h2>
            </div>
            
            {data?.events.length === 0 ? (
              <div className="rounded-xl border border-white/10 border-dashed bg-white/[0.01] p-12 text-center">
                <Ticket className="h-8 w-8 text-white/20 mx-auto mb-4" />
                <p className="text-white/60 text-sm">No events created yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {data?.events.map((ev: any) => {
                  const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
                  const evDate = new Date(ev.start_datetime);
                  const isLive = ev.status === "published";

                  return (
                    <div key={ev.id} className="group flex flex-col rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden hover:border-white/20 transition-colors">
                      {/* Event Cover */}
                      <div className="aspect-[16/9] relative bg-white/5 border-b border-white/10">
                        {ev.cover_image_url ? (
                          <img 
                            src={optimizeImage(ev.cover_image_url, 600)} 
                            alt={ev.title} 
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Ticket className="h-8 w-8 text-white/10" />
                          </div>
                        )}
                        <div className="absolute top-3 left-3 flex gap-2">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md border ${
                            isLive 
                              ? 'bg-green-500/20 border-green-500/30 text-green-400' 
                              : 'bg-black/50 border-white/20 text-white/80'
                          }`}>
                            {ev.status === "published" ? "Live" : ev.status}
                          </span>
                        </div>
                      </div>

                      {/* Event Info */}
                      <div className="p-5 flex-1 flex flex-col">
                        <p className="text-white/50 text-xs font-medium mb-1">
                          {evDate.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                        <h3 className="font-display text-lg font-medium leading-tight mb-4">
                          {ev.title}
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4 mt-auto pt-4 border-t border-white/5">
                          <div>
                            <p className="text-white/50 text-xs font-medium mb-1">Sold</p>
                            <p className="font-medium text-sm">{stats.sold}</p>
                          </div>
                          <div>
                            <p className="text-white/50 text-xs font-medium mb-1">Revenue</p>
                            <p className="font-medium text-sm">{formatNaira(stats.revenueKobo)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Explicit Action Buttons */}
                      <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between gap-2">
                        {isLive && (
                          <Link to="/events/$eventId/scan" params={{ eventId: ev.id }} className="flex-1 h-9 flex items-center justify-center gap-2 rounded-md bg-white text-black text-xs font-medium hover:bg-white/90 transition-colors">
                            <QrCode className="w-3.5 h-3.5" /> Scan
                          </Link>
                        )}
                        <Link to="/events/$eventId/edit" params={{ eventId: ev.id }} className="flex-1 h-9 flex items-center justify-center gap-2 rounded-md bg-white/5 border border-white/10 text-white text-xs font-medium hover:bg-white/10 transition-colors">
                          <FileEdit className="w-3.5 h-3.5" /> Edit
                        </Link>
                        
                        {/* More Actions Dropdown (or quick links) */}
                        <div className="flex gap-1 ml-auto">
                          <Link to="/events/$eventId/attendees" params={{ eventId: ev.id }} className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Attendees">
                            <Users className="w-4 h-4" />
                          </Link>
                          {isLive && (
                            <button onClick={() => {
                              navigator.clipboard.writeText(`${window.location.origin}/e-v2/${ev.slug}`);
                              toast.success("Link copied!");
                            }} className="w-9 h-9 flex items-center justify-center rounded-md bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors" title="Copy Link">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
