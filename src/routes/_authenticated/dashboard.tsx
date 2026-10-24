import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Copy, MapPin, Plus, QrCode, Ticket, Zap, Users, BarChart2, Clock, XCircle, ArrowRight, FileEdit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNaira } from "@/lib/currency";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromoCodesTab } from "@/components/promo-codes-tab";
import { PromotersTab } from "@/components/promoters-tab";
import { PayoutsTab } from "@/components/payouts-tab";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

async function fetchMyEvents() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("is_organizer, is_admin, full_name, paystack_subaccount_code")
    .eq("id", userId)
    .maybeSingle()) as { data: any };

  const { data: roleRows } = (await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)) as { data: any[] | null };
  const userRoles = (roleRows ?? []).map((r: any) => r.role);
  const isAdmin = userRoles.includes("admin");
  const isCustomerCare = userRoles.includes("customer_care");

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
    .order("start_datetime", { ascending: true })) as { data: any[] | null, error: any };
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

  return {
    profile,
    isAdmin,
    isCustomerCare,
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
  const isCustomerCare = data?.isCustomerCare ?? false;
  const latestApp = data?.latestApp ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:py-12 min-h-dvh w-full max-w-[100vw] overflow-x-hidden">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-border pb-6">
        <div>
          <h1 className="type-heading-lg tracking-tight mb-2">Dashboard</h1>
          <p className="text-muted-foreground text-sm font-medium">
            Welcome back, {data?.profile?.full_name || "User"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {(isCustomerCare || isAdmin) && (
            <Button asChild variant="outline" className="h-11 md:h-9 px-4 rounded-md border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10">
              <Link to="/support">Support Portal</Link>
            </Button>
          )}
          {isAdmin && (
            <>
              <Button asChild variant="outline" className="h-11 md:h-9 px-4 rounded-md border-border text-foreground hover:bg-secondary">
                <Link to="/admin">Admin Panel</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 md:h-9 px-4 rounded-md border-border text-foreground hover:bg-secondary">
                <Link to="/admin/organizer-applications">Review Apps</Link>
              </Button>
            </>
          )}
          {isOrganizer && (
            <Button asChild className="h-11 md:h-9 px-5 rounded-full bg-primary text-primary-foreground font-semibold shadow-sm hover:bg-primary/90 press-sm transition-transform duration-[120ms]">
              <Link to="/events/new">
                <Plus className="mr-2 h-4 w-4" /> New Event
              </Link>
            </Button>
          )}
        </div>
      </div>

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

      {!isLoading && !error && (
        <>
          {isOrganizer ? (
            <Tabs defaultValue="events" className="space-y-6 w-full max-w-full">
              <TabsList className="bg-secondary/50 border border-border p-1 h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="events">Events</TabsTrigger>
                <TabsTrigger value="promo-codes">Promo Codes</TabsTrigger>
                <TabsTrigger value="promoters">Promoters</TabsTrigger>
                <TabsTrigger value="payouts">Payouts</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview">
                {renderOverview()}
              </TabsContent>
              <TabsContent value="events">
                {renderEvents()}
              </TabsContent>
              <TabsContent value="promo-codes">
                <PromoCodesTab events={data?.events || []} />
              </TabsContent>
              <TabsContent value="promoters">
                <PromotersTab events={data?.events || []} />
              </TabsContent>
              <TabsContent value="payouts">
                <PayoutsTab events={data?.events || []} statsByEvent={data?.statsByEvent || {}} hasPayoutAccount={!!data?.profile?.paystack_subaccount_code} />
              </TabsContent>
            </Tabs>
          ) : (
            renderOverview()
          )}
        </>
      )}
    </div>
  );

  function renderOverview() {
    return (
      <div className="space-y-12 mt-2">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-12 shadow-sm">
          <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary mb-6 shadow-sm">
                <Zap className="h-3.5 w-3.5" /> For creators
              </span>
               <h2 className="type-heading-lg mb-6">
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
                  <Button asChild size="lg" className="text-base px-8 gradient-sunset text-primary-foreground glow-primary press-sm transition-all duration-[120ms]">
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

            <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="h-40 w-full bg-secondary relative flex items-end p-6">
                  <span className="relative font-display text-sm uppercase tracking-[0.4em] text-secondary-foreground drop-shadow-md">Admit One</span>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-primary font-bold mb-1">Music · Lagos</p>
                      <h3 className="font-display text-xl leading-tight">Afrobeats Live 2025</h3>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary border border-primary/20">Live</span>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                    <CalendarDays className="h-3 w-3" /> Sat, Aug 23 · 7:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-4 mb-8">
            <h3 className="font-display text-2xl">Toolkit</h3>
            <div className="h-px flex-1 bg-border/60" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {[
              { icon: Ticket, title: "Ticket Tiers", desc: "Create Early Bird, VIP, and GA tiers with custom pricing." },
              { icon: BarChart2, title: "Live Analytics", desc: "Track sales, revenue, and capacity in real-time." },
              { icon: QrCode, title: "QR Scanning", desc: "Check in attendees instantly with our built-in scanner." },
              { icon: Users, title: "Comp Tickets", desc: "Issue free tickets to guests, press, or VIPs easily." },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="inline-flex rounded-lg bg-secondary p-3 mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderEvents() {
    if (data?.events.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/40 py-20 px-6 text-center shadow-sm max-w-4xl mx-auto mt-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/50 mb-6 relative">
            <Ticket className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="font-display text-3xl mb-3">Your stage is empty. Create your first event to get started.</h3>
          <p className="max-w-md text-muted-foreground text-base mb-8 leading-relaxed">
            Your dashboard is looking a little empty. Create your first event and start selling tickets globally.
          </p>
          <Button asChild className="h-11 rounded-md px-6 text-sm font-semibold">
            <Link to="/events/new">
              <Plus className="mr-2 h-4 w-4" /> Create your first event
            </Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden mb-8 mt-2">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-secondary/30 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold w-12"></th>
                <th className="px-5 py-3 font-semibold">Event</th>
                <th className="px-5 py-3 font-semibold">Date</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Sold</th>
                <th className="px-5 py-3 font-semibold text-right">Revenue</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data?.events.map((ev) => {
                const stats = data.statsByEvent[ev.id] ?? { sold: 0, revenueKobo: 0 };
                const evDate = new Date(ev.start_datetime);
                return (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="h-10 w-10 shrink-0 rounded bg-secondary border border-border overflow-hidden">
                        {ev.cover_image_url ? (
                          <img src={ev.cover_image_url} alt={ev.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-muted">
                            <Ticket className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-0.5">
                        <Link to="/events/$eventId/edit" params={{ eventId: ev.id }} className="font-semibold text-sm hover:text-primary transition-colors line-clamp-1">
                          {ev.title}
                        </Link>
                        {ev.event_series?.title && (
                          <div className="text-[10px] font-bold text-primary/80 uppercase tracking-wider">Series: {ev.event_series.title}</div>
                        )}
                        {ev.city && <div className="text-muted-foreground text-xs">{ev.city}</div>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {evDate.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" })}
                      <div className="text-[10px] mt-0.5">{evDate.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" })}</div>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="px-5 py-4 text-right font-medium">
                      {stats.sold}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-primary">
                      {formatNaira(stats.revenueKobo)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {ev.status === "published" && (
                          <>
                            <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors" title="Scan Tickets">
                              <Link to="/events/$eventId/scan" params={{ eventId: ev.id }}>
                                <QrCode className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded hover:bg-secondary transition-colors"
                              title="Copy public link"
                              onClick={() => {
                                const url = `${window.location.origin}/e/${ev.slug}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link copied", { icon: <Copy className="h-4 w-4" /> });
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Manage Attendees">
                          <Link to="/events/$eventId/attendees" params={{ eventId: ev.id }}>
                            <Users className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Analytics">
                          <Link to="/events/$eventId/analytics" params={{ eventId: ev.id }}>
                            <BarChart2 className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="icon" className="h-8 w-8 rounded hover:bg-secondary transition-colors" title="Edit Event">
                          <Link to="/events/$eventId/edit" params={{ eventId: ev.id }}>
                            <FileEdit className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
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
  return <Badge className={`font-semibold text-[10px] tracking-wider uppercase px-2 py-0.5 border ${cfg.className}`} variant="outline">{cfg.label}</Badge>;
}
