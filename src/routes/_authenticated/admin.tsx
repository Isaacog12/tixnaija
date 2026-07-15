import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Calendar, BarChart3, Search, MoreVertical, Ban, CheckCircle2, ClipboardList } from "lucide-react";
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

  // Check admin via user_roles (consistent with the rest of the app)
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!adminRole) {
    throw new Error("Unauthorized: Admin access required");
  }

  // Fetch High-level Stats
  const { count: userCount } = await supabase.from("profiles").select("*", { count: "exact", head: true });
  const { count: eventCount } = await supabase.from("events").select("*", { count: "exact", head: true });
  
  const { data: orders } = await supabase.from("orders").select("total_kobo").eq("status", "paid");
  const totalRevenueKobo = (orders ?? []).reduce((acc, o) => acc + (o.total_kobo || 0), 0);

  // Pending organizer applications count
  const { count: pendingAppsCount } = await supabase
    .from("organizer_applications" as any)
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

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

  // Fetch Contact Messages
  const { data: messages } = await supabase
    .from("contact_messages" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    stats: {
      users: userCount ?? 0,
      events: eventCount ?? 0,
      revenueKobo: totalRevenueKobo,
      pendingApps: pendingAppsCount ?? 0,
    },
    users: profiles ?? [],
    events: events ?? [],
    contactMessages: messages ?? [],
  };
}

function AdminDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: fetchAdminData,
  });

  const navigate = useNavigate();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading admin data…</div>;
  if (error) return <div className="p-8 text-center text-destructive">Error loading data.</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">Platform overview and moderation.</p>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-4 mb-10">
        <StatCard icon={Users} label="Total Users" value={data?.stats.users.toLocaleString() || "0"} />
        <StatCard icon={Calendar} label="Total Events" value={data?.stats.events.toLocaleString() || "0"} />
        <StatCard icon={BarChart3} label="Total Volume" value={formatNaira(data?.stats.revenueKobo || 0)} className="text-gradient-sunset" />
        <Link to="/admin/organizer-applications" className="group block cursor-pointer">
          <div className="rounded-2xl border border-amber-500/30 bg-card/60 p-6 flex items-start gap-4 shadow-sm hover:border-amber-500/60 transition h-full">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-500 group-hover:bg-amber-500/20 transition">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Applications</p>
              <h3 className="mt-1 font-display text-3xl text-amber-500">
                {data?.stats.pendingApps ?? 0}
              </h3>
              <p className="mt-0.5 text-xs text-amber-500/70">Review now →</p>
            </div>
          </div>
        </Link>
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

      {/* Support Messages */}
      <section className="mt-10 flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/80">
          <h2 className="font-semibold">Support Messages</h2>
          <Badge variant="outline" className="font-mono text-xs">{data?.contactMessages.length} total</Badge>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.contactMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full py-4 text-center">No messages yet.</p>
          ) : (
            data?.contactMessages.map((msg: any) => (
              <div key={msg.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3 transition-colors hover:border-primary/40">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm truncate" title={msg.name}>{msg.name}</h3>
                    <a href={`mailto:${msg.email}`} className="text-xs text-muted-foreground hover:text-primary transition truncate block" title={msg.email}>
                      {msg.email}
                    </a>
                  </div>
                  <Badge variant={msg.is_read ? "secondary" : "default"} className="text-[10px] h-5 shrink-0 px-1.5">
                    {msg.is_read ? "Read" : "New"}
                  </Badge>
                </div>
                
                <div className="flex-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-muted/50 text-[10px] font-semibold text-muted-foreground mb-2">
                    {msg.topic}
                  </span>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{msg.message}</p>
                </div>
                
                <div className="mt-1 pt-3 border-t border-border/50 text-[10px] text-muted-foreground flex justify-between items-center gap-2">
                  <span className="truncate">{new Date(msg.created_at).toLocaleString()}</span>
                  <a href={`tel:${msg.phone}`} className="hover:text-primary transition shrink-0">{msg.phone}</a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
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
