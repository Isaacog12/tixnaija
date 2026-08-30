import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, MapPin, Plus, QrCode, Ticket, Zap, Users, BarChart2, Clock, XCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

async function fetchMyEvents() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_organizer, is_admin, full_name")
    .eq("id", userId)
    .maybeSingle();

  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const { data: latestApp } = await supabase
    .from("organizer_applications" as any)
    .select("status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: events, error } = await supabase
    .from("events")
    .select("id, title, slug, city, start_datetime, status, cover_image_url")
    .eq("organizer_id", userId)
    .order("start_datetime", { ascending: true });
  if (error) throw error;

  const eventIds = (events ?? []).map((e) => e.id);
  let statsByEvent: Record<string, { sold: number; revenueKobo: number }> = {};
  if (eventIds.length) {
    const { data: types } = await supabase
      .from("ticket_types")
      .select("event_id, quantity_sold")
      .in("event_id", eventIds);
      
    const { data: orders } = await supabase
      .from("orders")
      .select("event_id, total_kobo")
      .in("event_id", eventIds)
      .eq("status", "paid");

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

  return {
    profile,
    isAdmin: !!adminRole,
    latestApp: latestApp as { status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string } | null,
    events: events ?? [],
    statsByEvent,
  };
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-events"],
    queryFn: fetchMyEvents,
  });

  const isOrganizer = data?.profile?.is_organizer ?? false;
  const isAdmin = data?.isAdmin ?? false;
  const latestApp = data?.latestApp ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:py-20 min-h-screen">
      <div className="mb-12 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-5xl md:text-6xl tracking-tight mb-2">
            Hey <span className="text-primary">{data?.profile?.full_name?.split(" ")[0] || "there"}</span>.
          </h1>
          <p className="text-muted-foreground text-lg">
            {isOrganizer ? "Welcome back to your command center." : "Ready to discover your next experience?"}
          </p>
        </div>
        <div className="flex w-full flex-col sm:w-auto sm:flex-row sm:items-center gap-3 shrink-0">
          {isAdmin && (
            <>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto border-primary/20 text-primary shadow-sm hover:bg-primary/5">
                <Link to="/admin">Admin Panel</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shadow-sm">
                <Link to="/admin/organizer-applications">Review Applications</Link>
              </Button>
            </>
          )}
          {isOrganizer && (
            <Button asChild size="lg" className="w-full sm:w-auto shadow-sm">
              <Link to="/events/new">
                <Plus className="mr-2 h-5 w-5" /> New Event
              </Link>
            </Button>
          )}
        </div>
      </div>

      {!isOrganizer && !isLoading && (
        <div className="space-y-12">
          {/* Hero CTA */}
          <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 md:p-16 shadow-sm">
            <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-6 shadow-sm">
                  <Zap className="h-3.5 w-3.5" /> For creators
                </span>
                <h2 className="font-display text-5xl leading-tight md:text-6xl tracking-tight mb-6">
                  Start selling<br />
                  <span className="text-primary">in minutes.</span>
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mb-8 max-w-md">
                  Create your event, set ticket tiers, track sales in real-time, and scan attendees seamlessly at the door.
                </p>
                
                <div className="flex flex-col sm:flex-row flex-wrap gap-4">
                  {latestApp?.status === "pending" ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-semibold text-amber-500">
                      <Clock className="h-4 w-4" />
                      Application pending review
                    </div>
                  ) : latestApp?.status === "rejected" ? (
                    <div className="flex flex-col gap-3">
                      <div className="inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-5 py-3 text-sm font-semibold text-destructive">
                        <XCircle className="h-4 w-4" />
                        Application not approved
                      </div>
                      <Button asChild size="lg" className="w-fit">
                        <Link to="/account">Apply again</Link>
                      </Button>
                    </div>
                  ) : (
                    <Button asChild size="lg" className="text-base px-8">
                      <Link to="/account">Become an Organizer</Link>
                    </Button>
                  )}
                  <Button asChild size="lg" variant="outline" className="border-border/60 hover:bg-secondary text-base px-8 group">
                    <Link to="/browse">
                      Explore events <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Sample event card mock */}
              <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
                <div className="rounded-[2rem] border border-border bg-card shadow-sm overflow-hidden">
                  <div className="h-48 w-full bg-secondary relative flex items-end p-6">
                    <span className="relative font-display text-sm uppercase tracking-[0.4em] text-secondary-foreground drop-shadow-md">Admit One</span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-primary font-bold mb-1.5">Music · Lagos</p>
                        <h3 className="font-display text-2xl leading-tight">Afrobeats Live 2025</h3>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary border border-primary/20">Live</span>
                    </div>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                      <CalendarDays className="h-4 w-4" /> Sat, Aug 23 · 7:00 PM
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature grid */}
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h3 className="font-display text-2xl">Toolkit</h3>
              <div className="h-px flex-1 bg-border/60" />
            </div>
            
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Ticket,
                  title: "Ticket Tiers",
                  desc: "Create Early Bird, VIP, and GA tiers with custom pricing.",
                },
                {
                  icon: BarChart2,
                  title: "Live Analytics",
                  desc: "Track sales, revenue, and capacity in real-time.",
                },
                {
                  icon: QrCode,
                  title: "QR Scanning",
                  desc: "Check in attendees instantly with our built-in scanner.",
                },
                {
                  icon: Users,
                  title: "Comp Tickets",
                  desc: "Issue free tickets to guests, press, or VIPs easily.",
                },
              ].map((f) => (
                <div 
                  key={f.title}
                  className="rounded-[1.5rem] border border-border bg-card p-6 shadow-sm"
                >
                  <div className="inline-flex rounded-2xl bg-secondary p-3 mb-4">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8">
           {[1, 2, 3].map((i) => (
             <div key={i} className="animate-pulse rounded-[2rem] bg-card border border-border/40 overflow-hidden shadow-sm h-[400px]">
               <div className="h-48 bg-muted/60" />
               <div className="p-6 space-y-4">
                 <div className="h-5 w-2/3 bg-muted/80 rounded-md" />
                 <div className="h-4 w-1/3 bg-muted/80 rounded-md" />
                 <div className="pt-6 mt-6 border-t border-border/40 flex justify-between">
                   <div className="h-10 w-24 bg-muted/80 rounded-lg" />
                   <div className="h-10 w-24 bg-muted/80 rounded-lg" />
                 </div>
               </div>
             </div>
           ))}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 text-center text-destructive max-w-2xl mx-auto mt-8">
          <XCircle className="h-10 w-10 mx-auto mb-4 opacity-50" />
          <h3 className="font-medium text-lg mb-1">Failed to load dashboard</h3>
          <p className="text-destructive/80">{(error as Error).message}</p>
        </div>
      )}

      {isOrganizer && data && data.events.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-[2.5rem] border border-dashed border-border/60 bg-card/40 py-24 px-6 text-center shadow-sm max-w-4xl mx-auto mt-8">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary/50 mb-8 relative">
            <Ticket className="h-12 w-12 text-muted-foreground/50" />
          </div>
          <h3 className="font-display text-4xl mb-4">No events yet</h3>
          <p className="max-w-md text-muted-foreground text-lg mb-8 leading-relaxed">
            Your dashboard is looking a little empty. Create your first event and start selling tickets globally.
          </p>
          <Button asChild size="lg" className="h-14 rounded-full px-8 text-base">
            <Link to="/events/new">
              <Plus className="mr-2 h-5 w-5" /> Create your first event
            </Link>
          </Button>
        </div>
      )}

      {isOrganizer && data && data.events.length > 0 && (
        <div className="grid gap-6 mt-8">
          {data.events.map((ev) => {
            const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
            return (
              <div
                key={ev.id}
                className="group flex flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-sm md:flex-row"
              >
                <Link to="/events/$eventId/edit" params={{ eventId: ev.id }} className="flex flex-1 flex-col md:flex-row">
                  <div
                    className="h-56 w-full shrink-0 bg-secondary bg-cover bg-center md:h-auto md:w-72 relative overflow-hidden"
                  >
                    {ev.cover_image_url && (
                       <img src={ev.cover_image_url} alt={ev.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-2xl font-display leading-tight group-hover:text-primary transition-colors">
                          {ev.title}
                        </h3>
                        <div className="shrink-0">
                          <StatusBadge status={ev.status} />
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground font-medium">
                        <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          {new Date(ev.start_datetime).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                        {ev.city && (
                          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
                            <MapPin className="h-4 w-4 text-primary" /> {ev.city}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mt-8 flex flex-wrap items-center gap-6 sm:gap-12 border-t border-border pt-6">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Tickets Sold</div>
                        <div className="font-display text-3xl">{stats.sold}</div>
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue</div>
                        <div className="font-display text-3xl text-primary">
                          {formatNaira(stats.revenueKobo)}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                
                {ev.status === "published" && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 border-t border-border bg-muted/20 p-6 md:w-56 md:flex-col md:items-stretch md:justify-center md:border-t-0 md:border-l">
                    <Button asChild className="w-full rounded-xl bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary h-12 shadow-none font-semibold">
                      <Link to="/events/$eventId/scan" params={{ eventId: ev.id }}>
                        <QrCode className="mr-2 h-5 w-5" /> Scan Tickets
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-xl h-12 font-medium hover:bg-secondary"
                      onClick={() => {
                        const url = `${window.location.origin}/e/${ev.slug}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Public link copied", { icon: <Copy className="h-4 w-4" /> });
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copy link
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-muted text-muted-foreground border-transparent" },
    published: { label: "Live", className: "bg-primary/10 text-primary border-primary/20" },
    cancelled: { label: "Cancelled", className: "bg-destructive/10 text-destructive border-destructive/20" },
    postponed: { label: "Postponed", className: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
    completed: { label: "Ended", className: "bg-secondary text-secondary-foreground border-transparent" },
  };
  const cfg = map[status] ?? map.draft;
  return <Badge className={`font-bold tracking-wide uppercase px-3 py-1 border ${cfg.className}`} variant="outline">{cfg.label}</Badge>;
}
