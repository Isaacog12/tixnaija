import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, BarChart3, Search, MoreVertical, Ban, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    // Basic protection: Ensure user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({ to: "/auth" });
    }
    // Real protection happens in fetchAdminData where RLS enforces is_admin
  },
  component: AdminDashboard,
});

async function fetchAdminData() {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not logged in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userData.user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Fetch High-level Stats
  const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });
  
  const { data: orders } = await supabase.from("orders").select("total_kobo").eq("status", "paid");
  const totalRevenueKobo = (orders ?? []).reduce((acc, o) => acc + (o.total_kobo || 0), 0);

  // Fetch Users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email:id, is_organizer, is_admin, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  // Note: RLS policies might prevent viewing emails of other users without a service_role key.
  // In a real prod app, an edge function is used to fetch Auth users. For now, we use profiles.

  // Fetch Events Queue
  const { data: events } = await supabase
    .from("events")
    .select("id, title, status, created_at, profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    stats: {
      users: userCount ?? 0,
      events: eventCount ?? 0,
      revenueKobo: totalRevenueKobo,
    },
    users: profiles ?? [],
    events: events ?? [],
  };
}

function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminData,
  });

  if (isLoading) return <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-muted-foreground">Loading admin data…</div>;
  if (error) return <div className="mx-auto max-w-7xl px-4 py-10 text-sm text-destructive">{(error as Error).message}</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">Platform overview and moderation.</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-3 mb-10">
        <StatCard icon={Users} label="Total Users" value={data?.stats.users.toLocaleString() || "0"} />
        <StatCard icon={Calendar} label="Total Events" value={data?.stats.events.toLocaleString() || "0"} />
        <StatCard icon={BarChart3} label="Total Volume" value={formatNaira(data?.stats.revenueKobo || 0)} className="text-gradient-sunset" />
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* Users Table */}
        <section className="flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-card/80">
            <h2 className="font-semibold">Recent Users</h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search users..." className="h-8 w-48 pl-8 text-xs border-border/50 bg-background/50 focus-visible:ring-1" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data?.users.map((u) => (
                  <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{u.full_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 flex-wrap">
                        {u.is_admin && <Badge variant="default" className="text-[10px] h-5 px-1.5">Admin</Badge>}
                        {u.is_organizer && <Badge variant="secondary" className="text-[10px] h-5 px-1.5">Organizer</Badge>}
                        {!u.is_admin && !u.is_organizer && <span className="text-xs text-muted-foreground">User</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Events Queue */}
        <section className="flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-card/80">
            <h2 className="font-semibold">Event Moderation</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {data?.events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground line-clamp-1">{ev.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">by {ev.profiles?.full_name || "Unknown"}</div>
                    </td>
                    <td className="px-4 py-3">
                      {ev.status === "published" ? (
                        <span className="inline-flex items-center gap-1 text-green-500 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Live
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Ban className="mr-1.5 h-3 w-3" /> Takedown
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, className }: { icon: any; label: string; value: string; className?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-6 flex items-start gap-4 shadow-sm">
      <div className="rounded-xl bg-primary/10 p-3 text-primary">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <h3 className={`mt-1 font-display text-3xl ${className || "text-foreground"}`}>{value}</h3>
      </div>
    </div>
  );
}
