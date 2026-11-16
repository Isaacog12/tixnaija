import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Flag,
  DollarSign,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface SupportOverviewTabProps {
  onNavigateTab: (tab: string, param?: string) => void;
}

export function SupportOverviewTab({ onNavigateTab }: SupportOverviewTabProps) {
  const qc = useQueryClient();
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [flagNote, setFlagNote] = useState("");

  // Fetch overview stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["support-overview-stats"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_overview_stats");
      if (error) {
        console.warn("support_get_overview_stats:", error.message);
        return {
          open_cases: 0,
          unassigned_cases: 0,
          pending_refunds: 0,
          resolved_today: 0,
          unmatched_payments: 0,
        };
      }
      return data || {
        open_cases: 0,
        unassigned_cases: 0,
        pending_refunds: 0,
        resolved_today: 0,
        unmatched_payments: 0,
      };
    },
    refetchInterval: 30000,
  });

  // Fetch unmatched payments
  const { data: unmatchedPayments, isLoading: unmatchedLoading } = useQuery({
    queryKey: ["support-unmatched-payments"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_unmatched_payments");
      if (error) {
        console.warn("support_get_unmatched_payments:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
    refetchInterval: 30000,
  });

  // Flag payment mutation
  const flagMutation = useMutation({
    mutationFn: async ({ paymentId, note }: { paymentId: string; note: string }) => {
      const { data, error } = await (supabase.rpc as any)("support_flag_payment", {
        p_payment_event_id: paymentId,
        p_note: note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Payment flagged for administrator review.");
      setFlagModalOpen(false);
      setFlagNote("");
      setSelectedPayment(null);
      qc.invalidateQueries({ queryKey: ["support-unmatched-payments"] });
      qc.invalidateQueries({ queryKey: ["support-overview-stats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to flag payment");
    },
  });

  return (
    <div className="space-y-8">
      {/* Search Header Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-950/80 via-emerald-900/60 to-zinc-900 border border-emerald-500/20 p-6 md:p-8 shadow-xl">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            <span>Customer Care Operations Hub</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Support Overview & Queues
          </h1>
          <p className="text-emerald-100/70 text-sm leading-relaxed">
            Assist ticket buyers, inspect masked transactions, manage support inquiries, and escalate complex issues to administrators with full audit logging.
          </p>

          {/* Search lives in one place — the Universal Lookup tab. This is a
              shortcut to it, not a second search box that could drift from the
              real one. */}
          <div className="pt-2">
            <Button
              onClick={() => onNavigateTab("lookup")}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 gap-2"
            >
              <Search className="h-4 w-4" />
              Open Universal Lookup
            </Button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          onClick={() => onNavigateTab("cases")}
          className="cursor-pointer hover:border-emerald-500/40 transition-colors bg-card/60 backdrop-blur border-border/60"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Open Cases
            </CardTitle>
            <Inbox className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {statsLoading ? "—" : stats?.open_cases ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              Active tickets in queue <ArrowRight className="h-3 w-3" />
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onNavigateTab("cases")}
          className="cursor-pointer hover:border-amber-500/40 transition-colors bg-card/60 backdrop-blur border-border/60"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unassigned
            </CardTitle>
            <UserCheck className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {statsLoading ? "—" : stats?.unassigned_cases ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting staff pick-up</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => onNavigateTab("refunds")}
          className="cursor-pointer hover:border-blue-500/40 transition-colors bg-card/60 backdrop-blur border-border/60"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Pending Refunds
            </CardTitle>
            <RotateCcw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {statsLoading ? "—" : stats?.pending_refunds ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Requires recommendation</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Resolved Today
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-400">
              {statsLoading ? "—" : stats?.resolved_today ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Lagos timezone reset</p>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Unmatched Webhooks
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-500">
              {statsLoading ? "—" : stats?.unmatched_payments ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">&gt; 10m without order match</p>
          </CardContent>
        </Card>
      </div>

      {/* Unmatched Payments Reconciliation Queue */}
      <Card className="border-border/60 bg-card/50 backdrop-blur shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Unmatched Payment Events Queue
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Payments successfully charged on Paystack that could not be automatically reconciled to an order.
            </p>
          </div>
          <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
            {unmatchedPayments?.length || 0} Need Inspection
          </Badge>
        </CardHeader>
        <CardContent>
          {unmatchedLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading payment events...
            </div>
          ) : !unmatchedPayments || unmatchedPayments.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">Zero unmatched payments</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All successful incoming Paystack transactions have cleanly matched orders.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Reference</TableHead>
                    <TableHead>Customer Email</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Logged At</TableHead>
                    <TableHead>Status / Notes</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unmatchedPayments.map((pe: any) => (
                    <TableRow key={pe.id}>
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {pe.reference}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {pe.customer_email || "N/A"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-emerald-400">
                        {formatNaira((pe.amount_ngn || 0) * 100)}
                      </TableCell>
                      <TableCell className="text-xs uppercase text-muted-foreground">
                        {pe.channel || "paystack"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(pe.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {pe.resolution_note ? (
                          <span className="text-amber-400 font-medium">{pe.resolution_note}</span>
                        ) : (
                          <Badge variant="outline" className="border-rose-500/30 text-rose-400 text-[10px]">
                            Pending Action
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPayment(pe);
                            setFlagNote(pe.resolution_note?.replace("FLAGGED BY SUPPORT: ", "") || "");
                            setFlagModalOpen(true);
                          }}
                          className="h-8 rounded-lg text-xs gap-1.5"
                        >
                          <Flag className="h-3.5 w-3.5 text-amber-500" />
                          Flag for Admin
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

      {/* Flag Payment Modal */}
      <Dialog open={flagModalOpen} onOpenChange={setFlagModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-amber-500" />
              Flag Unmatched Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Leave a clear note for administrators detailing customer communication or suspected ticket order match.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Reference: </span>
                  <span className="font-mono font-semibold">{selectedPayment.reference}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount: </span>
                  <span className="font-semibold text-emerald-400">
                    {formatNaira((selectedPayment.amount_ngn || 0) * 100)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer Email: </span>
                  <span className="font-mono">{selectedPayment.customer_email || "N/A"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Support Note for Administrator:
                </label>
                <Textarea
                  placeholder="e.g. Customer emailed confirming bank transfer was debited. Order ID suspected: 0a1b2c..."
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  rows={4}
                  className="rounded-xl text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFlagModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!flagNote.trim()) {
                  toast.error("Please enter a note for the administrator");
                  return;
                }
                flagMutation.mutate({
                  paymentId: selectedPayment.id,
                  note: flagNote.trim(),
                });
              }}
              disabled={flagMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs"
            >
              {flagMutation.isPending ? "Submitting..." : "Save Flag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
