import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users, Calendar, BarChart3, Search, MoreVertical,
  Ban, CheckCircle2, ClipboardList, ExternalLink, ShieldOff, ShieldCheck, Trash2, Image as ImageIcon, RefreshCcw, Briefcase,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/admin")({
  // Real protection: query user_roles and redirect non-admins cleanly.
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw redirect({ to: "/dashboard" });
  },
  component: AdminDashboard,
});

// ── Data fetchers ────────────────────────────────────────────

async function fetchAdminStats() {
  const [
    { count: userCount },
    { count: eventCount },
    { data: orders },
    { count: pendingApps },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total_kobo").eq("status", "paid"),
    supabase.from("organizer_applications" as any).select("*", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const totalRevenueKobo = (orders ?? []).reduce((acc: number, o: any) => acc + (o.total_kobo || 0), 0);
  return {
    users: userCount ?? 0,
    events: eventCount ?? 0,
    revenueKobo: totalRevenueKobo,
    pendingApps: pendingApps ?? 0,
  };
}

async function fetchAdminUsers() {
  // Query all profiles (allowed via profiles_select_admin RLS policy)
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, suspended")
    .order("created_at", { ascending: false })
    .limit(100);
  if (profilesError) throw profilesError;

  // Query all user_roles (allowed via user_roles_select_admin policy using has_role())
  const { data: allRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (rolesError) throw rolesError;

  // Build a role map: userId -> string[]
  const roleMap = new Map<string, string[]>();
  for (const r of allRoles ?? []) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
    roleMap.get(r.user_id)!.push(r.role);
  }

  return (profiles ?? []).map((p: any) => ({
    id: p.id as string,
    full_name: (p.full_name ?? "") as string,
    created_at: p.created_at as string,
    suspended: (p.suspended ?? false) as boolean,
    roles: roleMap.get(p.id) ?? ["attendee"],
  }));
}


async function fetchAdminEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, status, created_at, organizer_id, profiles!events_organizer_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw error;
  return data ?? [];
}

async function fetchContactMessages() {
  const { data, error } = await supabase
    .from("contact_messages" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function fetchRefundRequests() {
  const { data, error } = await (supabase as any)
    .from("refund_requests")
    .select(`
      id, reason, other_reason, status, admin_note, created_at,
      buyer_email, buyer_name,
      events(title, slug)
    `)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as any[];
}

// ── Main Component ───────────────────────────────────────────

function AdminDashboard() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [takedownEvent, setTakedownEvent] = useState<{ id: string; title: string } | null>(null);

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const { data: events, isLoading: eventsLoading } = useQuery({ queryKey: ["admin-events"], queryFn: fetchAdminEvents });
  const { data: messages } = useQuery({ queryKey: ["admin-contact-messages"], queryFn: fetchContactMessages });
  const { data: refunds, isLoading: refundsLoading } = useQuery({ queryKey: ["admin-refund-requests"], queryFn: fetchRefundRequests });

  // ── Mutations ──────────────────────────────────────────────

  const takedownMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.rpc("admin_cancel_event" as any, {
        p_event_id: id,
        p_note: note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event has been taken down and buyers notified.");
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setTakedownEvent(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { error } = await supabase.rpc("admin_suspend_user" as any, {
        p_user_id: userId,
        p_suspended: suspend,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.suspend ? "User suspended." : "User unsuspended.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markMessageRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("contact_messages" as any) as any)
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-contact-messages"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("contact_messages" as any) as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message deleted.");
      qc.invalidateQueries({ queryKey: ["admin-contact-messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRefundMutation = useMutation({
    mutationFn: async ({ id, status, admin_note }: { id: string; status: string; admin_note?: string }) => {
      const { error } = await (supabase as any)
        .from("refund_requests")
        .update({ status, admin_note: admin_note || null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const labels: Record<string, string> = { approved: "approved", rejected: "rejected", processed: "marked as processed" };
      toast.success(`Refund request ${labels[vars.status] ?? vars.status}.`);
      qc.invalidateQueries({ queryKey: ["admin-refund-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Derived ────────────────────────────────────────────────

  const filteredUsers = (users ?? []).filter((u) => {
    const q = userSearch.toLowerCase();
    return !q || u.full_name.toLowerCase().includes(q);
  });

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Takedown Confirmation Dialog */}
      <AlertDialog open={!!takedownEvent} onOpenChange={() => setTakedownEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take down event?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>&ldquo;{takedownEvent?.title}&rdquo;</strong> will be cancelled immediately.
              All buyers with valid tickets will be notified. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                takedownEvent &&
                takedownMutation.mutate({
                  id: takedownEvent.id,
                  note: "Taken down by platform admin.",
                })
              }
              disabled={takedownMutation.isPending}
            >
              {takedownMutation.isPending ? "Taking down”¦" : "Yes, take down"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Admin Portal</h1>
        <p className="text-muted-foreground mt-1">Platform overview and moderation.</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-6 mb-10">
        <StatCard icon={Users} label="Total Users" value={stats?.users.toLocaleString() ?? "—"} />
        <StatCard icon={Calendar} label="Total Events" value={stats?.events.toLocaleString() ?? "—"} />
        <StatCard icon={BarChart3} label="Total Volume" value={formatNaira(stats?.revenueKobo ?? 0)} className="text-gradient-sunset" />
        <Link to="/admin/organizer-applications" className="group block cursor-pointer">
          <div className="rounded-2xl border border-amber-500/30 bg-card/60 p-6 flex items-start gap-4 shadow-sm hover:border-amber-500/60 transition h-full">
            <div className="rounded-xl bg-amber-500/10 p-3 text-amber-500 group-hover:bg-amber-500/20 transition">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Applications</p>
              <h3 className="mt-1 font-display text-3xl text-amber-500">{stats?.pendingApps ?? 0}</h3>
              <p className="mt-0.5 text-xs text-amber-500/70">Review now →</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/job-applications" className="group block cursor-pointer">
          <div className="rounded-2xl border border-violet-500/30 bg-card/60 p-6 flex items-start gap-4 shadow-sm hover:border-violet-500/60 transition h-full">
            <div className="rounded-xl bg-violet-500/10 p-3 text-violet-500 group-hover:bg-violet-500/20 transition">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Job CVs</p>
              <h3 className="mt-1 font-display text-3xl text-violet-500">New</h3>
              <p className="mt-0.5 text-xs text-violet-500/70">Review now →</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/banners" className="group block cursor-pointer">
          <div className="rounded-2xl border border-primary/30 bg-card/60 p-6 flex items-start gap-4 shadow-sm hover:border-primary/60 transition h-full">
            <div className="rounded-xl bg-primary/10 p-3 text-primary group-hover:bg-primary/20 transition">
              <ImageIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Banners</p>
              <h3 className="mt-1 font-display text-3xl text-foreground">Ads</h3>
              <p className="mt-0.5 text-xs text-primary">Manage slots →</p>
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
              <Input
                placeholder="Search by name or email”¦"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 w-52 pl-8 text-xs border-border/50 bg-background/50 focus-visible:ring-1"
              />
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto max-h-[420px]">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Roles</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {usersLoading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      Loading users”¦
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className={`hover:bg-muted/30 transition-colors ${u.suspended ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{u.full_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{u.id.slice(0, 8)}”¦</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {u.roles.includes("admin") && (
                            <Badge variant="default" className="text-xs h-5 px-1.5">Admin</Badge>
                          )}
                          {u.roles.includes("organizer") && (
                            <Badge variant="secondary" className="text-xs h-5 px-1.5">Organizer</Badge>
                          )}
                          {!u.roles.includes("admin") && !u.roles.includes("organizer") && (
                            <span className="text-xs text-muted-foreground">User</span>
                          )}
                          {u.suspended && (
                            <Badge variant="destructive" className="text-xs h-5 px-1.5">Suspended</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/dashboard" className="flex items-center gap-2">
                                <ExternalLink className="h-3.5 w-3.5" />
                                View full profile
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {u.suspended ? (
                              <DropdownMenuItem
                                className="text-green-500 focus:text-green-500"
                                onClick={() => suspendMutation.mutate({ userId: u.id, suspend: false })}
                              >
                                <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                                Unsuspend user
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => suspendMutation.mutate({ userId: u.id, suspend: true })}
                              >
                                <ShieldOff className="mr-2 h-3.5 w-3.5" />
                                Suspend user
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Event Moderation */}
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
                {eventsLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">
                      Loading events”¦
                    </td>
                  </tr>
                ) : (events ?? []).map((ev: any) => (
                  <tr key={ev.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground line-clamp-1">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        by {ev.profiles?.full_name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {ev.status === "published" ? (
                        <span className="inline-flex items-center gap-1 text-green-500 text-xs font-medium">
                          <CheckCircle2 className="h-3 w-3" /> Live
                        </span>
                      ) : ev.status === "cancelled" ? (
                        <span className="text-xs text-destructive font-medium">Cancelled</span>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium capitalize">{ev.status}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev.status !== "cancelled" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setTakedownEvent({ id: ev.id, title: ev.title })}
                        >
                          <Ban className="mr-1.5 h-3 w-3" /> Takedown
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Support / Contact Messages */}
      <section className="mt-10 flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/80">
          <h2 className="font-semibold">Support Messages</h2>
          <Badge variant="outline" className="font-mono text-xs">
            {(messages ?? []).filter((m) => !m.is_read).length} unread
          </Badge>
        </div>
        <div className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(messages ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full py-4 text-center">No messages yet.</p>
          ) : (
            (messages ?? []).map((msg: any) => (
              <div
                key={msg.id}
                className={`rounded-xl border bg-card p-4 shadow-sm flex flex-col gap-3 transition-colors hover:border-primary/40 cursor-pointer ${
                  msg.is_read ? "border-border opacity-70" : "border-primary/30"
                }`}
                onClick={() => !msg.is_read && markMessageRead.mutate(msg.id)}
                title={msg.is_read ? "" : "Click to mark as read"}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm truncate">{msg.name}</h3>
                    <a
                      href={`mailto:${msg.email}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-muted-foreground hover:text-primary transition truncate block"
                    >
                      {msg.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={msg.is_read ? "secondary" : "default"}
                      className="text-xs h-5 px-1.5"
                    >
                      {msg.is_read ? "Read" : "New"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMessage.mutate(msg.id);
                      }}
                      disabled={deleteMessage.isPending}
                      title="Delete message"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  {msg.topic && (
                    <span className="inline-block px-2 py-0.5 rounded bg-muted/50 text-xs font-semibold text-muted-foreground mb-2">
                      {msg.topic}
                    </span>
                  )}
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words line-clamp-4">{msg.message}</p>
                </div>
                <div className="mt-1 pt-3 border-t border-border/50 text-xs text-muted-foreground flex justify-between items-center gap-2">
                  <span className="truncate">{new Date(msg.created_at).toLocaleString()}</span>
                  {msg.phone && (
                    <a
                      href={`tel:${msg.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="hover:text-primary transition shrink-0"
                    >
                      {msg.phone}
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      {/* Refund Requests */}
      <section className="mt-10 flex flex-col rounded-2xl border border-border bg-card/40 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border bg-card/80">
          <div>
            <h2 className="font-semibold">Refund Requests</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Submitted by buyers via My Tickets page</p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {(refunds ?? []).filter((r: any) => r.status === "pending").length} pending
          </Badge>
        </div>
        <div className="overflow-x-auto">
          {refundsLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading refund requests…</p>
          ) : (refunds ?? []).length === 0 ? (
            <div className="p-8 text-center">
              <RefreshCcw className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">No refund requests yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {(refunds ?? []).map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-sm">{r.buyer_name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{r.buyer_email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.events ? (
                        <Link
                          to="/e/$slug"
                          params={{ slug: r.events.slug }}
                          className="text-primary hover:underline text-xs font-medium line-clamp-2"
                        >
                          {r.events.title}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unknown event</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs">{r.reason}</span>
                      {r.other_reason && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2" title={r.other_reason}>
                          {r.other_reason}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
                        <Badge variant="outline" className="text-amber-500 border-amber-500/40 bg-amber-500/10 text-xs">Pending</Badge>
                      )}
                      {r.status === "approved" && (
                        <Badge variant="outline" className="text-green-500 border-green-500/40 bg-green-500/10 text-xs">Approved</Badge>
                      )}
                      {r.status === "rejected" && (
                        <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/10 text-xs">Rejected</Badge>
                      )}
                      {r.status === "processed" && (
                        <Badge variant="secondary" className="text-xs">Processed</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-500 border-green-500/30 hover:bg-green-500/10"
                            disabled={updateRefundMutation.isPending}
                            onClick={() => updateRefundMutation.mutate({ id: r.id, status: "approved" })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            disabled={updateRefundMutation.isPending}
                            onClick={() => updateRefundMutation.mutate({ id: r.id, status: "rejected" })}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {r.status === "approved" && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs"
                          disabled={updateRefundMutation.isPending}
                          onClick={() => updateRefundMutation.mutate({ id: r.id, status: "processed" })}
                        >
                          Mark Processed
                        </Button>
                      )}
                      {(r.status === "rejected" || r.status === "processed") && (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: any;
  label: string;
  value: string;
  className?: string;
}) {
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
