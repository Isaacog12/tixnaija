import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export function SupportRefundsTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRefund, setSelectedRefund] = useState<any>(null);
  const [recommendStatus, setRecommendStatus] = useState<string>("needs_admin_review");
  const [recommendNote, setRecommendNote] = useState<string>("");

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["current-user-is-admin"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return Boolean(data);
    },
  });

  // Fetch refund requests via support_get_refund_requests
  const { data: refundRequests, isLoading, refetch } = useQuery({
    queryKey: ["support-refund-requests", statusFilter],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_refund_requests", {
        p_status: statusFilter === "all" ? null : statusFilter,
      });
      if (error) {
        console.warn("support_get_refund_requests:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  // Recommend status mutation
  const recommendMutation = useMutation({
    mutationFn: async ({
      refundId,
      newStatus,
      note,
    }: {
      refundId: string;
      newStatus: string;
      note: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("support_recommend_refund", {
        p_refund_request_id: refundId,
        p_new_status: newStatus,
        p_note: note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Refund recommendation logged and updated.");
      setSelectedRefund(null);
      setRecommendNote("");
      qc.invalidateQueries({ queryKey: ["support-refund-requests"] });
      qc.invalidateQueries({ queryKey: ["support-overview-stats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit recommendation");
    },
  });

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Refund Requests & Review Queue
            </CardTitle>
            <CardDescription className="text-xs">
              Examine ticket refund requests. To safeguard funds, customer care agents cannot debit payments or approve refunds directly; agents review and recommend cases for administrator settlement.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px] rounded-xl text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending Initial Triage</SelectItem>
                <SelectItem value="needs_admin_review">Needs Admin Review</SelectItem>
                <SelectItem value="customer_contacted">Customer Contacted</SelectItem>
                <SelectItem value="approved">Approved (Finalized)</SelectItem>
                <SelectItem value="rejected">Rejected (Finalized)</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="h-9 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading refund requests...
            </div>
          ) : !refundRequests || refundRequests.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mx-auto">
                <RotateCcw className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No refund requests in queue</p>
              <p className="text-xs text-muted-foreground">
                There are no open refund claims matching this filter.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Event</TableHead>
                    <TableHead>Buyer Name & Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refundRequests.map((rr: any) => (
                    <TableRow key={rr.id}>
                      <TableCell className="font-semibold text-xs text-foreground max-w-[180px] truncate">
                        {rr.event_title || "Event #" + rr.event_id?.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-xs text-foreground">{rr.buyer_name || "Buyer"}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{rr.buyer_email}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {rr.reason === "other" ? rr.other_reason : rr.reason}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            rr.status === "approved"
                              ? "default"
                              : rr.status === "rejected"
                              ? "destructive"
                              : "secondary"
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {rr.status?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(rr.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedRefund(rr);
                            setRecommendStatus(
                              rr.status === "customer_contacted"
                                ? "customer_contacted"
                                : "needs_admin_review"
                            );
                            setRecommendNote("");
                          }}
                          className="h-8 rounded-lg text-xs gap-1.5"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-400" />
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review & Recommendation Dialog */}
      <Dialog open={Boolean(selectedRefund)} onOpenChange={(open) => !open && setSelectedRefund(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-500" />
              Triage Refund Claim
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log staff communication and submit status recommendations to the administrative approval queue.
            </DialogDescription>
          </DialogHeader>

          {selectedRefund && (
            <div className="space-y-4 py-2">
              <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/50 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-foreground text-sm">{selectedRefund.event_title}</div>
                    <div className="text-muted-foreground font-mono">{selectedRefund.buyer_email}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    ID: {selectedRefund.id?.slice(0, 8)}…
                  </Badge>
                </div>

                <div className="pt-2 border-t border-border/40 space-y-1">
                  <div>
                    <span className="text-muted-foreground">Stated Reason: </span>
                    <span className="font-semibold text-foreground capitalize">
                      {selectedRefund.reason?.replace(/_/g, " ")}
                    </span>
                  </div>
                  {selectedRefund.other_reason && (
                    <div className="bg-background/60 p-2 rounded-lg border border-border/40 mt-1 italic text-muted-foreground">
                      "{selectedRefund.other_reason}"
                    </div>
                  )}
                  {selectedRefund.admin_note && (
                    <div className="mt-2 text-amber-400">
                      <span className="font-semibold">Existing Note: </span>
                      {selectedRefund.admin_note}
                    </div>
                  )}
                </div>
              </div>

              {/* Recommendation Controls */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Action / Recommendation:
                  </label>
                  <Select
                    value={recommendStatus}
                    onValueChange={(val: any) => setRecommendStatus(val)}
                  >
                    <SelectTrigger className="rounded-xl text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="needs_admin_review">
                        Needs Admin Review (Recommend Refund)
                      </SelectItem>
                      <SelectItem value="customer_contacted">
                        Customer Contacted (Gathering Info / Denied by Organizer Policy)
                      </SelectItem>
                      {isAdmin && (
                        <>
                          <SelectItem value="approved" className="text-emerald-400 font-medium">
                            ✓ Approve Refund (Final Decision & Ticket Invalidation)
                          </SelectItem>
                          <SelectItem value="rejected" className="text-rose-400 font-medium">
                            ✕ Reject Claim (Final Decision)
                          </SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Support Staff / Admin Justification Note:
                  </label>
                  <Textarea
                    placeholder="e.g. Organizer postponed date by 2 weeks; buyer cannot attend. Recommending approval under platform policy."
                    value={recommendNote}
                    onChange={(e) => setRecommendNote(e.target.value)}
                    rows={3}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedRefund(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!recommendNote.trim() || recommendNote.trim().length < 5) {
                  toast.error("Please enter a detailed recommendation note");
                  return;
                }
                recommendMutation.mutate({
                  refundId: selectedRefund.id,
                  newStatus: recommendStatus,
                  note: recommendNote.trim(),
                });
              }}
              disabled={recommendMutation.isPending}
              className={`rounded-xl text-xs text-white ${
                recommendStatus === "approved"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : recommendStatus === "rejected"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-blue-600 hover:bg-blue-500"
              }`}
            >
              {recommendMutation.isPending
                ? "Submitting..."
                : recommendStatus === "approved"
                ? "Approve Refund"
                : recommendStatus === "rejected"
                ? "Reject Claim"
                : "Save Recommendation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
