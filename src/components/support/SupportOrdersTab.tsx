import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingBag,
  ExternalLink,
  Mail,
  Send,
  UserCheck,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Calendar,
  Lock,
  RefreshCw,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";

interface SupportOrdersTabProps {
  initialOrderId?: string | null;
  onClearInitialOrder?: () => void;
}

export function SupportOrdersTab({
  initialOrderId = null,
  onClearInitialOrder,
}: SupportOrdersTabProps) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageOffset, setPageOffset] = useState<number>(0);
  const pageSize = 20;

  // Selected Order for Modal Inspector
  const [inspectOrderId, setInspectOrderId] = useState<string | null>(initialOrderId);

  // Email Change Request Modal
  const [emailChangeOpen, setEmailChangeOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeReason, setEmailChangeReason] = useState("");

  // Resend Modal
  const [resendConfirmOpen, setResendConfirmOpen] = useState(false);

  // Order Notes State
  const [newNote, setNewNote] = useState("");
  const [noteInputVisible, setNoteInputVisible] = useState(false);

  useEffect(() => {
    if (initialOrderId) {
      setInspectOrderId(initialOrderId);
    }
  }, [initialOrderId]);

  // Fetch Orders List via support_get_orders_list
  const { data: ordersList, isLoading: listLoading, refetch: refetchOrders } = useQuery({
    queryKey: ["support-orders-list", statusFilter, pageOffset],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_orders_list", {
        p_limit: pageSize,
        p_offset: pageOffset,
        p_status: statusFilter === "all" ? null : statusFilter,
      });
      if (error) {
        console.warn("support_get_orders_list:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  // Fetch Order Details via support_get_order_details
  const {
    data: orderDetails,
    isLoading: detailsLoading,
    refetch: refetchDetails,
  } = useQuery({
    queryKey: ["support-order-details", inspectOrderId],
    queryFn: async () => {
      if (!inspectOrderId) return null;
      const { data, error } = await (supabase.rpc as any)("support_get_order_details", {
        p_order_id: inspectOrderId,
      });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(inspectOrderId),
  });

  // Resend Ticket Email Mutation
  const resendMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await (supabase.rpc as any)("support_resend_ticket_email", {
        p_order_id: orderId,
      });
      if (error) throw error;

      // Invoke the Edge Function to dispatch tickets via ZeptoMail
      const { error: invokeErr } = await supabase.functions.invoke("send-ticket-confirmation", {
        body: { orderId },
      });
      if (invokeErr) {
        console.warn("send-ticket-confirmation error:", invokeErr);
      }

      // Also trigger process-email-outbox asynchronously
      try {
        await supabase.functions.invoke("process-email-outbox");
      } catch (e) {
        // non-blocking
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Ticket confirmation email sent successfully!");
      setResendConfirmOpen(false);
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to resend ticket email");
    },
  });

  // Request Email Change (Dual-Control) Mutation
  const emailChangeMutation = useMutation({
    mutationFn: async ({
      orderId,
      newEmail,
      reason,
    }: {
      orderId: string;
      newEmail: string;
      reason: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("support_request_email_change", {
        p_order_id: orderId,
        p_new_email: newEmail,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Email change submitted for dual-control administrator approval.");
      setEmailChangeOpen(false);
      setNewEmail("");
      setEmailChangeReason("");
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit email change request");
    },
  });

  // Add Internal Order Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ orderId, note }: { orderId: string; note: string }) => {
      const { data, error } = await (supabase.rpc as any)("support_add_order_note", {
        p_order_id: orderId,
        p_note: note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Staff note logged successfully.");
      setNewNote("");
      setNoteInputVisible(false);
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add note");
    },
  });

  const orderData = orderDetails?.order;
  const ticketsData = orderDetails?.tickets || [];
  const outboxData = orderDetails?.delivery_log || orderDetails?.outbox || [];
  const notesData = orderDetails?.notes || [];

  return (
    <div className="space-y-6">
      {/* List Header and Controls */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
              Customer Orders & Ticket Deliveries
            </CardTitle>
            <CardDescription className="text-xs">
              Inspect order transactions, view attendee tickets, trigger delivery resends, or propose dual-control recipient changes.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setPageOffset(0); }}>
              <SelectTrigger className="w-[140px] rounded-xl text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchOrders()}
              className="h-9 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {listLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading orders...
            </div>
          ) : !ordersList || ordersList.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No orders found</p>
              <p className="text-xs text-muted-foreground">
                No transactions match the selected filter criteria.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Order ID / Reference</TableHead>
                    <TableHead>Masked Buyer</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersList.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-mono text-xs font-semibold text-foreground">
                          {o.id?.slice(0, 8)}…
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {o.payment_reference}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {o.masked_buyer_email}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-foreground max-w-[200px] truncate">
                        {o.event_title || "Event"}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-emerald-400">
                        {formatNaira(o.total_kobo || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={o.status === "paid" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {o.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectOrderId(o.id)}
                          className="h-8 rounded-lg text-xs gap-1"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Inspect
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          <div className="flex items-center justify-between pt-4 text-xs text-muted-foreground">
            <span>Showing up to {pageSize} records (Offset: {pageOffset})</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageOffset === 0 || listLoading}
                onClick={() => setPageOffset((prev) => Math.max(0, prev - pageSize))}
                className="h-8 rounded-lg text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!ordersList || ordersList.length < pageSize || listLoading}
                onClick={() => setPageOffset((prev) => prev + pageSize)}
                className="h-8 rounded-lg text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Detail Inspector Dialog */}
      <Dialog
        open={Boolean(inspectOrderId)}
        onOpenChange={(open) => {
          if (!open) {
            setInspectOrderId(null);
            onClearInitialOrder?.();
          }
        }}
      >
        <DialogContent className="max-w-3xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-blue-500" />
              Order Detail & Ticket Inspector
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review transaction details, attendee tickets, and dispatch status.
            </DialogDescription>
          </DialogHeader>

          {detailsLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading order data...
            </div>
          ) : !orderData ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Order not found or access restricted.
            </div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Order Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-secondary/30 border border-border/50 text-xs">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Order ID: </span>
                    <span className="font-mono font-bold text-foreground">{orderData.id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reference: </span>
                    <span className="font-mono">{orderData.payment_reference}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyer Name: </span>
                    <span className="font-semibold">{orderData.buyer_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyer Email: </span>
                    <span className="font-mono font-medium">{orderData?.buyer_email || orderData?.masked_buyer_email || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Buyer Phone: </span>
                    <span className="font-mono">{orderData?.buyer_phone || orderData?.masked_buyer_phone || "N/A"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Event: </span>
                    <span className="font-semibold text-foreground">{orderData.event_title}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Event Start: </span>
                    <span>{new Date(orderData.start_datetime).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Venue: </span>
                    <span>{orderData.venue_name || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Paid: </span>
                    <span className="font-bold text-emerald-400">
                      {formatNaira(orderData.total_kobo || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge variant={orderData.status === "paid" ? "default" : "secondary"} className="text-[10px] uppercase font-bold">
                      {orderData.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Resend Ticket & Request Email Change */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-muted/40 border border-border/40">
                <div className="text-xs text-muted-foreground">
                  Support staff can resend confirmation emails or request dual-control recipient update.
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setNoteInputVisible((v) => !v)}
                    className="h-8 rounded-xl text-xs gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5 text-emerald-400" />
                    Add Note
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setResendConfirmOpen(true)}
                    className="h-8 rounded-xl text-xs gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5 text-blue-400" />
                    Resend Tickets
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEmailChangeOpen(true)}
                    className="h-8 rounded-xl text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-400" />
                    Request Email Change
                  </Button>
                </div>
              </div>

              {/* Note Input Box */}
              {noteInputVisible && (
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-emerald-500/20 space-y-2">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-400" />
                    Log Internal Staff Note
                  </div>
                  <Textarea
                    placeholder="Enter confidential internal note (e.g. Buyer called confirming name typo, ID verified)..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={2}
                    className="rounded-xl text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setNoteInputVisible(false)}
                      className="h-7 text-xs rounded-lg"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={addNoteMutation.isPending || !newNote.trim()}
                      onClick={() => {
                        if (!newNote.trim()) return;
                        inspectOrderId &&
                          addNoteMutation.mutate({
                            orderId: inspectOrderId,
                            note: newNote.trim(),
                          });
                      }}
                      className="h-7 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      {addNoteMutation.isPending ? "Saving..." : "Save Note"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Staff Notes History */}
              {notesData.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-emerald-400" />
                    Staff Audit Notes ({notesData.length})
                  </h3>
                  <div className="space-y-2">
                    {notesData.map((n: any) => (
                      <div
                        key={n.id}
                        className="p-3 rounded-xl bg-secondary/20 border border-border/40 text-xs space-y-1"
                      >
                        <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {n.author_name || "Support Staff"}
                          </span>
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-foreground/90 whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tickets List */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  Attendee Tickets ({ticketsData.length})
                </h3>
                <div className="rounded-xl border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-secondary/20">
                        <TableHead>Ticket Code</TableHead>
                        <TableHead>Attendee Email</TableHead>
                        <TableHead>Ticket Type</TableHead>
                        <TableHead>Check-in Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ticketsData.map((t: any) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-xs font-bold text-foreground">
                            {t.masked_ticket_code}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {t.masked_attendee_email || "N/A"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {t.ticket_type_name || "General"}
                          </TableCell>
                          <TableCell>
                            {t.checked_in_at ? (
                              <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Checked In ({new Date(t.checked_in_at).toLocaleTimeString()})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Unused
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Email Outbox History */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-emerald-400" />
                  Email Dispatch Log ({outboxData.length})
                </h3>
                {outboxData.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No recent asynchronous outbox emails recorded for this order.
                  </p>
                ) : (
                  <div className="rounded-xl border border-border/60 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/20">
                          <TableHead>Template</TableHead>
                          <TableHead>Recipient</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Sent At</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outboxData.map((o: any) => (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-xs font-medium">
                              {o.template}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {o.recipient_email}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={o.status === "sent" ? "default" : "secondary"}
                                className="text-[10px] uppercase font-bold"
                              >
                                {o.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {o.sent_at ? new Date(o.sent_at).toLocaleTimeString() : "Pending"}
                            </TableCell>
                            <TableCell className="text-xs text-rose-400">
                              {o.error_message || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setInspectOrderId(null);
                onClearInitialOrder?.();
              }}
              className="rounded-xl"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Confirmation Modal */}
      <Dialog open={resendConfirmOpen} onOpenChange={setResendConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-500" />
              Confirm Ticket Resend
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will re-dispatch the official ticket confirmation and QR codes to the buyer's registered email via the asynchronous outbox.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-xl bg-secondary/40 border border-border/50 text-xs space-y-1">
            <div>
              <span className="text-muted-foreground">Recipient Email: </span>
              <span className="font-mono font-semibold">{orderData?.buyer_email || orderData?.masked_buyer_email || "N/A"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Order Reference: </span>
              <span className="font-mono">{orderData?.payment_reference}</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResendConfirmOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => inspectOrderId && resendMutation.mutate(inspectOrderId)}
              disabled={resendMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs"
            >
              {resendMutation.isPending ? "Queuing..." : "Confirm & Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dual Control Email Change Modal */}
      <Dialog open={emailChangeOpen} onOpenChange={setEmailChangeOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-500" />
              Request Recipient Email Change
            </DialogTitle>
            <DialogDescription className="text-xs">
              To prevent account takeovers, support staff cannot immediately transfer tickets. Submitting this form creates a dual-control request requiring separate administrator approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
              <p className="font-semibold mb-1">Upon Admin Approval:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/80">
                <li>Existing ticket QR codes are instantly rotated and invalidated</li>
                <li>New tickets are queued to the new recipient</li>
                <li>A security warning is dispatched to the original buyer</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">New Recipient Email:</label>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Justification Reason:</label>
              <Textarea
                placeholder="e.g. Buyer typo during checkout (gmial.com). Identity verified with Paystack transaction ref..."
                value={emailChangeReason}
                onChange={(e) => setEmailChangeReason(e.target.value)}
                rows={3}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmailChangeOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!newEmail.trim() || !newEmail.includes("@")) {
                  toast.error("Please enter a valid email address");
                  return;
                }
                if (!emailChangeReason.trim() || emailChangeReason.trim().length < 5) {
                  toast.error("Please provide a detailed justification reason");
                  return;
                }
                inspectOrderId &&
                  emailChangeMutation.mutate({
                    orderId: inspectOrderId,
                    newEmail: newEmail.trim(),
                    reason: emailChangeReason.trim(),
                  });
              }}
              disabled={emailChangeMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs"
            >
              {emailChangeMutation.isPending ? "Submitting..." : "Submit to Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
