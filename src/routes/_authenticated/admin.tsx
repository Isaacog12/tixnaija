import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Users, Calendar, BarChart3, Search, MoreVertical,
  Ban, CheckCircle, ClipboardList, ExternalLink, ShieldOff, ShieldCheck, Trash2, Image as ImageIcon, RefreshCcw, Briefcase,
  ShieldAlert, Mail, Pencil,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { toast } from "@/lib/toast";
import { BackButton } from "@/components/back-button";
import { EventDeleteDialog } from "@/components/admin/event-delete-dialog";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin")({
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

async function fetchAdminStats() {
  const [
    { count: userCount },
    { count: eventCount },
    { data: orders },
    { count: pendingApps },
    { count: pendingJobApps },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("total_kobo").eq("status", "paid"),
    supabase.from("organizer_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("job_applications").select("*", { count: "exact", head: true }).eq("status", "new"),
  ]);

  const totalRevenueKobo = (orders ?? []).reduce((acc: number, o: any) => acc + (o.total_kobo || 0), 0);
  return {
    users: userCount ?? 0,
    events: eventCount ?? 0,
    revenueKobo: totalRevenueKobo,
    pendingApps: pendingApps ?? 0,
    pendingJobApps: pendingJobApps ?? 0,
  };
}

async function fetchAdminUsers() {
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, created_at, suspended, is_verified_organizer, organizer_slug")
    .order("created_at", { ascending: false })
    .limit(100);
  if (profilesError) throw profilesError;

  const { data: allRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role");
  if (rolesError) throw rolesError;

  const roleMap = new Map<string, string[]>();
  for (const r of (allRoles as any[]) ?? []) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
    roleMap.get(r.user_id)!.push(r.role);
  }

  return (profiles ?? []).map((p: any) => ({
    id: p.id as string,
    full_name: (p.full_name ?? "") as string,
    created_at: p.created_at as string,
    suspended: (p.suspended ?? false) as boolean,
    is_verified_organizer: (p.is_verified_organizer ?? false) as boolean,
    organizer_slug: (p.organizer_slug ?? null) as string | null,
    roles: roleMap.get(p.id) ?? ["attendee"],
  }));
}

async function fetchAdminEvents() {
  const { data, error } = await supabase
    .from("events")
    .select("id, title, status, admin_cancelled, deleted_at, created_at, organizer_id, start_datetime, end_datetime, profiles!events_organizer_id_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data ?? [];
}

function AdminDashboard() {
  const qc = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [takedownEvent, setTakedownEvent] = useState<{ id: string; title: string } | null>(null);
  const [undoTakedownEvent, setUndoTakedownEvent] = useState<{ id: string; title: string } | null>(null);
  const [revokeUser, setRevokeUser] = useState<{ id: string; name: string } | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revokeEmail, setRevokeEmail] = useState("");
  const [revokeEmailReason, setRevokeEmailReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    purgeOnly?: boolean;
  } | null>(null);
  const [eventSearch, setEventSearch] = useState("");

  const { data: stats } = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats });
  const { data: users, isLoading: usersLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const { data: events, isLoading: eventsLoading } = useQuery({ queryKey: ["admin-events"], queryFn: fetchAdminEvents });

  const takedownMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase.rpc("admin_cancel_event", {
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

  const undoTakedownMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc("admin_undo_cancel_event", {
        p_event_id: id,
        p_note: "Platform admin has restored this event.",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event takedown has been undone.");
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      setUndoTakedownEvent(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ userId, suspend }: { userId: string; suspend: boolean }) => {
      const { error } = await supabase.rpc("admin_suspend_user", {
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

  const verifyMutation = useMutation({
    mutationFn: async ({ userId, verify }: { userId: string; verify: boolean }) => {
      const { error } = await supabase.rpc("admin_verify_organizer", {
        p_user_id: userId,
        p_verified: verify,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.verify ? "Organizer verified." : "Organizer verification removed.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_revoke_organizer", {
        p_user_id: userId,
        // p_reason is declared `text` without a default, so it must be sent.
        p_reason: (reason || null) as string,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organizer access revoked.");
      setRevokeUser(null);
      setRevokeReason("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeByEmailMutation = useMutation({
    mutationFn: async ({ email, reason }: { email: string; reason: string }) => {
      const { error } = await supabase.rpc("admin_revoke_organizer_by_email", {
        p_email: email,
        p_reason: reason || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Organizer access revoked successfully.");
      setRevokeEmail("");
      setRevokeEmailReason("");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const customerCareRoleMutation = useMutation({
    mutationFn: async ({ userId, grant }: { userId: string; grant: boolean }) => {
      const { error } = await supabase.rpc("admin_set_customer_care_role", {
        p_user_id: userId,
        p_grant: grant,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.grant ? "Customer Care role granted." : "Customer Care role revoked.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const filteredUsers = useMemo(() => {
    return (users ?? []).filter((u) => {
      const q = userSearch.toLowerCase();
      return !q || u.full_name.toLowerCase().includes(q);
    });
  }, [users, userSearch]);

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    return (events ?? []).filter((ev: any) => {
      if (!q) return true;
      return (
        (ev.title ?? "").toLowerCase().includes(q) ||
        (ev.profiles?.full_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, eventSearch]);

  const userColumnHelper = createColumnHelper<any>();
  const userColumns = useMemo(
    () => [
      userColumnHelper.accessor("full_name", {
        header: "User",
        cell: (info) => (
          <div>
            <div className="font-semibold text-foreground text-base mb-1">{info.getValue() || "Unknown"}</div>
            <div className="text-xs text-muted-foreground font-mono bg-secondary/50 inline-block px-2 py-0.5 rounded">{info.row.original.id.slice(0, 8)}…</div>
            <div className="text-xs text-muted-foreground mt-1">Joined {new Date(info.row.original.created_at).toLocaleDateString()}</div>
          </div>
        ),
      }),
      userColumnHelper.accessor("roles", {
        header: "Roles",
        cell: (info) => {
          const roles = info.getValue() as string[];
          const u = info.row.original;
          return (
            <div className="flex gap-2 flex-wrap">
              {roles.includes("admin") && <Badge className="uppercase tracking-wider text-[10px] font-bold">Admin</Badge>}
              {roles.includes("organizer") && <Badge variant="secondary" className="uppercase tracking-wider text-[10px] font-bold border-border/50">Organizer</Badge>}
              {roles.includes("customer_care") && <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white uppercase tracking-wider text-[10px] font-bold">Support</Badge>}
              {roles.includes("organizer") && u.is_verified_organizer && <Badge className="bg-blue-500 hover:bg-blue-600 text-white uppercase tracking-wider text-[10px] font-bold">Verified</Badge>}
              {!roles.includes("admin") && !roles.includes("organizer") && !roles.includes("customer_care") && <span className="text-xs text-muted-foreground font-medium">User</span>}
              {u.suspended && <Badge variant="destructive" className="uppercase tracking-wider text-[10px] font-bold">Suspended</Badge>}
            </div>
          );
        },
      }),
      userColumnHelper.display({
        id: "actions",
        header: () => <div className="text-right">Actions</div>,
        cell: (info) => {
          const u = info.row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl shadow-xl border-border/50 p-2">
                  {u.roles.includes("organizer") && u.organizer_slug ? (
                    <DropdownMenuItem asChild className="rounded-xl px-3 py-2 cursor-pointer focus:bg-secondary">
                      <Link to="/box-office/$organizerSlug" params={{ organizerSlug: u.organizer_slug }} className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">View box-office</span>
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem asChild className="rounded-xl px-3 py-2 cursor-pointer focus:bg-secondary opacity-50 cursor-not-allowed">
                      <div className="flex items-center gap-2 pointer-events-none">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">No public profile</span>
                      </div>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="mx-2" />
                  {u.roles.includes("organizer") && (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => setRevokeUser({ id: u.id, name: u.full_name || "Unknown" })}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      <span className="font-medium">Revoke Organizer</span>
                    </DropdownMenuItem>
                  )}
                  {u.roles.includes("organizer") && (
                    <DropdownMenuItem
                      className="text-blue-500 focus:text-blue-500 focus:bg-blue-500/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => verifyMutation.mutate({ userId: u.id, verify: !u.is_verified_organizer })}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      <span className="font-medium">{u.is_verified_organizer ? "Unverify Organizer" : "Verify Organizer"}</span>
                    </DropdownMenuItem>
                  )}

                  {/* Customer Care Staff Role Management */}
                  {u.roles.includes("customer_care") ? (
                    <DropdownMenuItem
                      className="text-amber-500 focus:text-amber-500 focus:bg-amber-500/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => customerCareRoleMutation.mutate({ userId: u.id, grant: false })}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      <span className="font-medium">Revoke Customer Care</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => customerCareRoleMutation.mutate({ userId: u.id, grant: true })}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <span className="font-medium">Grant Customer Care</span>
                    </DropdownMenuItem>
                  )}

                  {u.suspended ? (
                    <DropdownMenuItem
                      className="text-green-500 focus:text-green-500 focus:bg-green-500/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => suspendMutation.mutate({ userId: u.id, suspend: false })}
                    >
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      <span className="font-medium">Unsuspend user</span>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive focus:bg-destructive/10 rounded-xl px-3 py-2 cursor-pointer"
                      onClick={() => suspendMutation.mutate({ userId: u.id, suspend: true })}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      <span className="font-medium">Suspend user</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      }),
    ],
    []
  );

  const userTable = useReactTable({
    data: filteredUsers,
    columns: userColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const eventColumnHelper = createColumnHelper<any>();
  const eventColumns = useMemo(
    () => [
      eventColumnHelper.accessor("title", {
        header: "Event",
        cell: (info) => (
          <div>
            <div className="font-semibold text-foreground text-base mb-1 line-clamp-1">{info.getValue()}</div>
            <div className="text-xs text-muted-foreground font-medium">
              by {info.row.original.profiles?.full_name || "Unknown"}
            </div>
          </div>
        ),
      }),
      eventColumnHelper.accessor("status", {
        header: "Status",
        cell: (info) => {
          const ev = info.row.original;
          return (
            <div>
              {ev.deleted_at ? (
                <Badge variant="secondary" className="uppercase tracking-wider text-[10px] font-bold border-border/50">
                  Deleted
                </Badge>
              ) : ev.status === "cancelled" ? (
                <Badge variant="destructive" className="uppercase tracking-wider text-[10px] font-bold">Cancelled</Badge>
              ) : new Date(ev.end_datetime || ev.start_datetime) < new Date() ? (
                <Badge variant="secondary" className="uppercase tracking-wider text-[10px] font-bold border-border/50">Ended</Badge>
              ) : ev.status === "published" ? (
                <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-bold text-green-500 border-green-500/40 bg-green-500/10">Live</Badge>
              ) : (
                <Badge variant="outline" className="uppercase tracking-wider text-[10px] font-bold border-border/50 text-muted-foreground">{ev.status}</Badge>
              )}
            </div>
          );
        },
      }),
      eventColumnHelper.display({
        id: "actions",
        header: () => <div className="text-right">Action</div>,
        cell: (info) => {
          const ev = info.row.original;
          return (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!ev.deleted_at && (
                <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs font-semibold">
                  <Link to="/events/$eventId/edit" params={{ eventId: ev.id }}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                  </Link>
                </Button>
              )}
              {ev.deleted_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ id: ev.id, title: ev.title, purgeOnly: true })}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear permanently
                </Button>
              ) : ev.status !== "cancelled" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-destructive border-destructive/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  onClick={() => setTakedownEvent({ id: ev.id, title: ev.title })}
                >
                  <Ban className="mr-1.5 h-3.5 w-3.5" /> Takedown
                </Button>
              ) : (ev as any).admin_cancelled ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-green-600 border-green-600/30 hover:text-green-700 hover:bg-green-600/10 transition-colors"
                  onClick={() => setUndoTakedownEvent({ id: ev.id, title: ev.title })}
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" /> Undo Takedown
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground/40 font-medium">Org Cancelled</span>
              )}
              {!ev.deleted_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget({ id: ev.id, title: ev.title })}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              )}
            </div>
          );
        },
      }),
    ],
    []
  );

  const eventTable = useReactTable({
    data: filteredEvents,
    columns: eventColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 min-h-dvh">
      <EventDeleteDialog
        event={deleteTarget}
        purgeOnly={deleteTarget?.purgeOnly}
        onClose={() => setDeleteTarget(null)}
      />

      <AlertDialog open={!!takedownEvent} onOpenChange={() => setTakedownEvent(null)}>
        <AlertDialogContent className="rounded-3xl border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl text-destructive">Take down event?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 mt-2">
              <strong>&ldquo;{takedownEvent?.title}&rdquo;</strong> will be cancelled immediately.
              All buyers with valid tickets will be notified. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl h-12 font-bold"
              onClick={() =>
                takedownEvent &&
                takedownMutation.mutate({
                  id: takedownEvent.id,
                  note: "Taken down by platform admin.",
                })
              }
              disabled={takedownMutation.isPending}
            >
              {takedownMutation.isPending ? "Taking down…" : "Yes, take down"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!undoTakedownEvent} onOpenChange={() => setUndoTakedownEvent(null)}>
        <AlertDialogContent className="rounded-3xl border-border shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl">Undo Event Takedown?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 mt-2">
              <strong>&ldquo;{undoTakedownEvent?.title}&rdquo;</strong> will be restored to "Published" status.
              This will allow the organizer to manage it again and resume ticket sales.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6">
            <AlertDialogCancel className="rounded-xl h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-12 font-bold"
              onClick={() =>
                undoTakedownEvent &&
                undoTakedownMutation.mutate({
                  id: undoTakedownEvent.id,
                })
              }
              disabled={undoTakedownMutation.isPending}
            >
              {undoTakedownMutation.isPending ? "Restoring…" : "Yes, restore event"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!revokeUser} onOpenChange={() => { setRevokeUser(null); setRevokeReason(""); }}>
        <AlertDialogContent className="rounded-3xl border-destructive/20 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl text-destructive">Revoke Organizer Access?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-foreground/80 mt-2">
              Are you sure you want to revoke organizer access for <strong>{revokeUser?.name}</strong>?
              They will no longer be able to access the organizer dashboard or create new events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              placeholder="Optional reason for revocation..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="text-base rounded-xl h-12 border-border/60"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl h-12">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl h-12 font-bold"
              onClick={(e) => {
                e.preventDefault();
                if (!revokeUser) return;
                revokeMutation.mutate({ userId: revokeUser.id, reason: revokeReason });
              }}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? "Revoking..." : "Revoke Access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12 mt-12 md:mt-0"
      >
        <div className="flex items-center gap-4 mb-3">
          <BackButton />
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-foreground">Admin Portal</h1>
        </div>
        <p className="text-muted-foreground text-base max-w-2xl">Platform overview and moderation control center.</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 mb-12"
      >
        <StatCard icon={Users} label="Total Users" value={stats?.users.toLocaleString() ?? "—"} />
        <StatCard icon={Calendar} label="Total Events" value={stats?.events.toLocaleString() ?? "—"} />
        <StatCard icon={BarChart3} label="Total Volume" value={formatNaira(stats?.revenueKobo ?? 0)} className="text-gradient-sunset" />
        
        <LinkCard 
          to="/admin/organizer-applications"
          icon={ClipboardList}
          label="Org Apps"
          value={stats?.pendingApps ?? 0}
          subtext="Review now &rarr;"
          colorClass="amber"
        />
        <LinkCard 
          to="/admin/job-applications"
          icon={Briefcase}
          label="Job Apps"
          value={stats?.pendingJobApps ?? 0}
          subtext="Review now &rarr;"
          colorClass="blue"
        />
        <LinkCard 
          to="/admin/banners"
          icon={ImageIcon}
          label="Banners"
          value="Ads"
          subtext="Manage slots &rarr;"
          colorClass="primary"
        />
        <LinkCard 
          to="/support"
          icon={ShieldCheck}
          label="Support"
          value="Care"
          subtext="Support portal &rarr;"
          colorClass="emerald"
        />
        <LinkCard 
          to="/admin/email-changes"
          icon={Mail}
          label="Email Changes"
          value="Approvals"
          subtext="Dual-control &rarr;"
          colorClass="amber"
        />
        <LinkCard 
          to="/admin/audit-logs"
          icon={ShieldAlert}
          label="Audit Logs"
          value="Security"
          subtext="Audit trail &rarr;"
          colorClass="blue"
        />
      </motion.div>

      <div className="mb-12 rounded-3xl border border-destructive/20 bg-destructive/5 p-6">
        <h3 className="font-display text-xl text-destructive mb-2 flex items-center gap-2"><ShieldOff className="h-5 w-5" /> Revoke Organizer by Email</h3>
        <p className="text-sm text-foreground/80 mb-4">Quickly find a user by their email address and completely revoke their organizer access (forces them to reapply).</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input 
             placeholder="User Email (e.g. hello@example.com)" 
             value={revokeEmail} 
             onChange={(e) => setRevokeEmail(e.target.value)}
             className="max-w-sm bg-background border-destructive/20 focus-visible:ring-destructive/20"
          />
          <Input 
             placeholder="Reason (Optional)" 
             value={revokeEmailReason} 
             onChange={(e) => setRevokeEmailReason(e.target.value)}
             className="max-w-sm bg-background border-destructive/20 focus-visible:ring-destructive/20"
          />
          <Button 
             variant="destructive" 
             onClick={() => revokeByEmailMutation.mutate({ email: revokeEmail, reason: revokeEmailReason })}
             disabled={revokeByEmailMutation.isPending || !revokeEmail}
             className="rounded-xl font-bold press-sm transition-transform duration-[120ms]"
          >
            {revokeByEmailMutation.isPending ? "Revoking..." : "Revoke Access"}
          </Button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden h-[600px]">
          <div className="flex items-center justify-between p-6 border-b border-border/40 bg-card/50 backdrop-blur-sm z-10">
            <h2 className="font-display text-2xl">Recent Users</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-10 w-full sm:w-64 pl-9 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/80 backdrop-blur-md">
                {userTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs uppercase font-bold tracking-wider text-muted-foreground px-6 py-4">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-6 py-12 text-center text-muted-foreground">Loading users…</TableCell>
                  </TableRow>
                ) : userTable.getRowModel().rows.length ? (
                  userTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className={`hover:bg-muted/30 transition-colors ${row.original.suspended ? "opacity-50 grayscale" : ""}`}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No users found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-border/60 bg-card shadow-sm overflow-hidden h-[600px]">
          <div className="flex items-center justify-between p-6 border-b border-border/40 bg-card/50 backdrop-blur-sm z-10">
            <h2 className="font-display text-2xl">Event Moderation</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events…"
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                className="h-10 w-full sm:w-56 pl-9 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <Table>
              <TableHeader className="bg-muted/80 backdrop-blur-md">
                {eventTable.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="text-xs uppercase font-bold tracking-wider text-muted-foreground px-6 py-4">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {eventsLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-6 py-12 text-center text-muted-foreground">Loading events…</TableCell>
                  </TableRow>
                ) : eventTable.getRowModel().rows.length ? (
                  eventTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="px-6 py-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="px-6 py-12 text-center text-muted-foreground">No events found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
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
    <div className={`rounded-2xl border border-border/60 bg-card p-5 flex flex-col justify-between shadow-sm transition-all hover:shadow-md h-full ${className || ""}`}>
      <div className="flex items-start justify-between">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
        <h3 className={`font-display text-3xl tracking-tight ${className?.includes('text-gradient') ? '' : 'text-foreground'}`}>{value}</h3>
      </div>
    </div>
  );
}

function LinkCard({
  to,
  icon: Icon,
  label,
  value,
  subtext,
  colorClass,
}: {
  to: string;
  icon: any;
  label: string;
  value: string | number;
  subtext: string;
  colorClass: "amber" | "blue" | "emerald" | "primary";
}) {
  const colorStyles = {
    amber: "border-amber-500/30 text-amber-500 hover:border-amber-500/60 hover:shadow-amber-500/10 bg-amber-500/10 hover:bg-amber-500/20",
    blue: "border-blue-500/30 text-blue-500 hover:border-blue-500/60 hover:shadow-blue-500/10 bg-blue-500/10 hover:bg-blue-500/20",
    emerald: "border-emerald-500/30 text-emerald-500 hover:border-emerald-500/60 hover:shadow-emerald-500/10 bg-emerald-500/10 hover:bg-emerald-500/20",
    primary: "border-primary/30 text-primary hover:border-primary/60 hover:shadow-primary/10 bg-primary/10 hover:bg-primary/20",
  };

  const style = colorStyles[colorClass];
  const bgClass = style.split(" bg-")[0];
  const hoverBgClass = "bg-" + style.split(" bg-")[1];

  return (
    <Link to={to as any} className="group block cursor-pointer h-full">
      <div className={`rounded-2xl border flex flex-col justify-between shadow-sm transition-all h-full p-5 bg-card ${bgClass}`}>
        <div className="flex items-start justify-between">
          <div className={`rounded-xl p-2.5 transition-colors ${hoverBgClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{label}</p>
          <h3 className="font-display text-3xl tracking-tight mb-1">{value}</h3>
          <p className="text-xs font-medium opacity-80 group-hover:opacity-100 transition-opacity">{subtext}</p>
        </div>
      </div>
    </Link>
  );
}
