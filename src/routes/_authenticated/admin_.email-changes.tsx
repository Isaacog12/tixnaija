import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Mail,
  User,
  RefreshCw,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/_authenticated/admin_/email-changes")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw redirect({ to: "/dashboard" });
  },
  component: AdminEmailChangesQueue,
});

function AdminEmailChangesQueue() {
  const qc = useQueryClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch pending email change requests
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-changes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_email_change_requests")
        .select(`
          id,
          order_id,
          requested_by,
          old_email,
          new_email,
          reason,
          status,
          created_at,
          orders (
            id,
            payment_reference,
            total_kobo,
            events (
              title,
              start_datetime
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("fetch support_email_change_requests:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  // Review Mutation
  const reviewMutation = useMutation({
    mutationFn: async ({ requestId, approve }: { requestId: string; approve: boolean }) => {
      const { data, error } = await supabase.rpc("admin_review_email_change", {
        p_request_id: requestId,
        p_approve: approve,
      });
      if (error) throw error;

      // Approval queues the reissue and any necessary old-address security alert.
      // Dispatch only those outbox rows; a direct confirmation send would duplicate
      // the reissue notice.
      if (approve) {
        try {
          const { error: outboxError } = await supabase.functions.invoke("process-email-outbox");
          if (outboxError) console.warn("process-email-outbox error:", outboxError);
        } catch (e) {
          // Queued rows remain durable for the scheduled worker.
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.approve
          ? "Email change approved! Old tickets invalidated and new tickets dispatched."
          : "Email change request rejected."
      );
      setSelectedReq(null);
      setConfirmAction(null);
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to process review");
    },
  });

  const pendingRequests = (requests || []).filter((r) => r.status === "pending_admin");
  const pastRequests = (requests || []).filter((r) => r.status !== "pending_admin");

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-foreground">
              Dual-Control Email Change Approvals
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Review and approve ticket recipient modifications requested by customer care staff.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-9 rounded-xl text-xs gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Security Architecture Note */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start gap-3">
        <Lock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-amber-300">Dual-Control Security Protocol:</span>
          <p className="leading-relaxed">
            Support staff can submit requests, but an independent administrator must verify the justification before tickets rotate. The requester cannot approve their own submission. Approval automatically invalidates the existing QR codes, reissues fresh tickets to the new email, and dispatches a security warning to the previous address.
          </p>
        </div>
      </div>

      {/* Pending Queue Card */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Pending Admin Review ({pendingRequests.length})
            </CardTitle>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
              Awaiting Action
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading requests...
            </div>
          ) : pendingRequests.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Zero pending requests</p>
              <p className="text-xs text-muted-foreground">
                All email redirection claims have been resolved.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Order & Event</TableHead>
                    <TableHead>Current Email</TableHead>
                    <TableHead>Requested New Email</TableHead>
                    <TableHead>Staff Justification</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.map((r: any) => {
                    const isSelf = currentUserId && r.requested_by === currentUserId;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-semibold text-xs text-foreground">
                            {r.orders?.events?.title || "Event"}
                          </div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            Ref: {r.orders?.payment_reference || r.order_id?.slice(0, 8)}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-rose-400">
                          {r.old_email}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-emerald-400 font-bold">
                          {r.new_email}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {r.reason}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isSelf && (
                              <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px]">
                                Self-Requested
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedReq(r);
                                setConfirmAction("reject");
                              }}
                              className="h-8 rounded-lg text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedReq(r);
                                setConfirmAction("approve");
                              }}
                              className="h-8 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                            >
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Modal */}
      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmAction === "approve" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Approve Email Transfer
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-rose-500" />
                  Reject Email Transfer
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {confirmAction === "approve"
                ? "Approving will rotate all ticket QR codes, reissue tickets to the new email, and send an alert to the original address."
                : "Rejecting will leave existing tickets intact and record the decline in the audit logs."}
            </DialogDescription>
          </DialogHeader>

          {selectedReq && (
            <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 text-xs space-y-2 py-2">
              <div>
                <span className="text-muted-foreground">Original Email: </span>
                <span className="font-mono text-rose-400">{selectedReq.old_email}</span>
              </div>
              <div>
                <span className="text-muted-foreground">New Recipient: </span>
                <span className="font-mono text-emerald-400 font-bold">{selectedReq.new_email}</span>
              </div>
              <div className="pt-2 border-t border-border/40">
                <span className="text-muted-foreground">Staff Reason: </span>
                <p className="italic text-foreground mt-0.5">"{selectedReq.reason}"</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                selectedReq &&
                  confirmAction &&
                  reviewMutation.mutate({
                    requestId: selectedReq.id,
                    approve: confirmAction === "approve",
                  });
              }}
              disabled={reviewMutation.isPending}
              className={`rounded-xl text-xs font-semibold ${
                confirmAction === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-rose-600 hover:bg-rose-500 text-white"
              }`}
            >
              {reviewMutation.isPending ? "Processing..." : confirmAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
