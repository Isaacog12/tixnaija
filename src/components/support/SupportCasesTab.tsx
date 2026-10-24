import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Inbox,
  Send,
  Lock,
  User,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldAlert,
  FileText,
  UserCheck,
  RefreshCw,
  Search,
  Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface SupportCasesTabProps {
  initialCaseId?: string | null;
  onOpenOrder?: (orderId: string) => void;
  onClearInitialCase?: () => void;
}

export function SupportCasesTab({
  initialCaseId = null,
  onOpenOrder,
  onClearInitialCase,
}: SupportCasesTabProps) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialCaseId);

  // Reply Composer State
  const [replyContent, setReplyContent] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [selectedMacro, setSelectedMacro] = useState<string>("");

  // Search Filter
  const [searchTerm, setSearchTerm] = useState("");

  // New Case Modal State
  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false);
  const [newCaseCustomerEmail, setNewCaseCustomerEmail] = useState("");
  const [newCaseSubject, setNewCaseSubject] = useState("");
  const [newCaseCategory, setNewCaseCategory] = useState("other");
  const [newCasePriority, setNewCasePriority] = useState("medium");
  const [newCaseMessage, setNewCaseMessage] = useState("");

  // Escalation Modal
  const [escalateModalOpen, setEscalateModalOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");

  useEffect(() => {
    if (initialCaseId) {
      setSelectedCaseId(initialCaseId);
    }
  }, [initialCaseId]);

  // Fetch Cases list
  const { data: casesList, isLoading: listLoading, refetch: refetchCases } = useQuery({
    queryKey: ["support-cases-list", statusFilter, categoryFilter],
    queryFn: async () => {
      let query = (supabase.from("support_cases" as any) as any)
        .select(`
          id,
          case_number,
          customer_id,
          order_id,
          subject,
          category,
          status,
          priority,
          assigned_to,
          is_escalated,
          escalated_reason,
          created_at,
          updated_at
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query.limit(50);
      if (error) {
        console.warn("fetch support_cases:", error.message);
        return [];
      }
      return data || [];
    },
  });

  // Fetch Macros for canned insertion
  const { data: macros } = useQuery({
    queryKey: ["support-macros-list"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("support_get_macros");
      if (error) return [];
      return (data as any[]) || [];
    },
  });

  // Fetch Case View via support_view_case
  const {
    data: caseView,
    isLoading: caseLoading,
    refetch: refetchCaseView,
  } = useQuery({
    queryKey: ["support-case-view", selectedCaseId],
    queryFn: async () => {
      if (!selectedCaseId) return null;
      const { data, error } = await (supabase.rpc as any)("support_view_case", {
        p_case_id: selectedCaseId,
      });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(selectedCaseId),
  });

  // Send Reply / Internal Note Mutation
  const replyMutation = useMutation({
    mutationFn: async ({
      caseId,
      content,
      isInternal,
    }: {
      caseId: string;
      content: string;
      isInternal: boolean;
    }) => {
      const { data, error } = await (supabase.rpc as any)("support_reply_case", {
        p_case_id: caseId,
        p_content: content,
        p_is_internal: isInternal,
      });
      if (error) throw error;

      if (!isInternal) {
        try {
          await supabase.functions.invoke("process-email-outbox");
        } catch (e) {
          console.warn("Trigger process-email-outbox:", e);
        }
      }

      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isInternal
          ? "Internal staff note recorded."
          : "Customer reply sent and queued to email outbox."
      );
      setReplyContent("");
      setIsInternalNote(false);
      setSelectedMacro("");
      refetchCaseView();
      refetchCases();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to submit reply");
    },
  });

  // Create Case Mutation
  const createCaseMutation = useMutation({
    mutationFn: async ({
      customerEmail,
      subject,
      category,
      priority,
      message,
    }: {
      customerEmail: string;
      subject: string;
      category: string;
      priority: string;
      message: string;
    }) => {
      const { data, error } = await (supabase.rpc as any)("support_create_case", {
        p_customer_email: customerEmail.trim() || null,
        p_subject: subject.trim(),
        p_category: category,
        p_priority: priority,
        p_initial_message: message.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (res: any) => {
      toast.success(`Support case ${res?.case_number || "created"} logged successfully.`);
      setNewCaseModalOpen(false);
      setNewCaseCustomerEmail("");
      setNewCaseSubject("");
      setNewCaseMessage("");
      refetchCases();
      if (res?.case_id) {
        setSelectedCaseId(res.case_id);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create support case");
    },
  });

  // Update Status / Priority Mutation
  const updateCaseMutation = useMutation({
    mutationFn: async ({
      caseId,
      status,
      priority,
      assignedTo,
    }: {
      caseId: string;
      status: string;
      priority: string;
      assignedTo?: string | null;
    }) => {
      const { data, error } = await (supabase.rpc as any)("support_update_case", {
        p_case_id: caseId,
        p_status: status,
        p_priority: priority,
        p_assigned_to: assignedTo || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Case updated successfully.");
      refetchCaseView();
      refetchCases();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update case");
    },
  });

  // Escalate Case Mutation
  const escalateMutation = useMutation({
    mutationFn: async ({ caseId, reason }: { caseId: string; reason: string }) => {
      const { data, error } = await (supabase.rpc as any)("support_escalate_case", {
        p_case_id: caseId,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Case escalated directly to the Administrator inbox.");
      setEscalateModalOpen(false);
      setEscalateReason("");
      refetchCaseView();
      refetchCases();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to escalate case");
    },
  });

  const activeCase = caseView?.case;
  const messages = caseView?.messages || [];

  return (
    <div className="space-y-6">
      {!selectedCaseId ? (
        /* Case Inbox View */
        <Card className="border-border/60 bg-card/60 backdrop-blur">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Inbox className="h-5 w-5 text-emerald-500" />
                Customer Support Cases
              </CardTitle>
              <CardDescription className="text-xs">
                Inquiries, ticket reissues, missing transfers, and customer tickets.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-44">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 rounded-xl text-xs h-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[125px] rounded-xl text-xs h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[130px] rounded-xl text-xs h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="missing_ticket">Missing Ticket</SelectItem>
                  <SelectItem value="refund">Refund</SelectItem>
                  <SelectItem value="event_inquiry">Event Inquiry</SelectItem>
                  <SelectItem value="account">Account</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchCases()}
                className="h-9 rounded-xl text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>

              <Button
                size="sm"
                onClick={() => setNewCaseModalOpen(true)}
                className="h-9 rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                New Case
              </Button>
            </div>
          </CardHeader>

          <CardContent>
            {listLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Loading support cases...
              </div>
            ) : !casesList || casesList.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-foreground">Inbox zero</p>
                <p className="text-xs text-muted-foreground">
                  No cases found under the selected filters.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead>Case #</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(casesList || [])
                      .filter((c: any) => {
                        if (!searchTerm.trim()) return true;
                        const q = searchTerm.toLowerCase();
                        return (
                          c.case_number?.toLowerCase().includes(q) ||
                          c.subject?.toLowerCase().includes(q)
                        );
                      })
                      .map((c: any) => (
                      <TableRow
                        key={c.id}
                        className={c.is_escalated ? "bg-amber-500/5 hover:bg-amber-500/10" : ""}
                      >
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {c.case_number}
                          {c.is_escalated && (
                            <Badge className="ml-2 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] uppercase">
                              Escalated
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground max-w-[260px] truncate">
                          {c.subject}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {c.category?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.priority === "urgent"
                                ? "destructive"
                                : c.priority === "high"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px] uppercase font-bold"
                          >
                            {c.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={c.status === "open" ? "default" : "secondary"}
                            className="text-[10px] uppercase font-bold"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedCaseId(c.id)}
                            className="h-8 rounded-lg text-xs gap-1"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open
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
      ) : (
        /* Case Detail & Conversation Thread View */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedCaseId(null);
                onClearInitialCase?.();
              }}
              className="text-xs gap-1.5 rounded-xl hover:bg-secondary"
            >
              ← Back to Inbox
            </Button>

            <div className="flex items-center gap-2">
              {activeCase && !activeCase.is_escalated && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEscalateModalOpen(true)}
                  className="h-8 rounded-xl text-xs gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Escalate to Admin
                </Button>
              )}
            </div>
          </div>

          {caseLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Loading conversation thread...
            </div>
          ) : !activeCase ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Case not found or access restricted.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Message Thread & Reply Box */}
              <div className="lg:col-span-2 space-y-6">
                {/* Case Subject Banner */}
                <Card className="border-border/60 bg-card/60 backdrop-blur">
                  <CardContent className="p-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {activeCase.case_number}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">
                          {activeCase.category?.replace(/_/g, " ")}
                        </Badge>
                        {activeCase.is_escalated && (
                          <Badge className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] uppercase font-bold">
                            Escalated to Admin
                          </Badge>
                        )}
                      </div>
                      <Badge
                        variant={activeCase.status === "open" ? "default" : "secondary"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {activeCase.status}
                      </Badge>
                    </div>

                    <h1 className="text-xl font-bold text-foreground">{activeCase.subject}</h1>

                    {activeCase.order_id && (
                      <div className="pt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">Associated Order:</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenOrder?.(activeCase.order_id)}
                          className="h-6 px-2 font-mono text-xs text-blue-400 hover:text-blue-300 gap-1"
                        >
                          {activeCase.order_id.slice(0, 8)}…
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Messages Timeline */}
                <div className="space-y-4">
                  {messages.map((msg: any) => {
                    const isInternal = msg.is_internal;
                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-2xl border transition-colors ${
                          isInternal
                            ? "bg-amber-500/10 border-amber-500/30 ml-6"
                            : "bg-card/70 border-border/60"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-foreground">
                              {msg.sender_name || "User"}
                            </span>
                            {isInternal ? (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] uppercase font-bold gap-1">
                                <Lock className="h-2.5 w-2.5" />
                                Staff Note Only
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] text-muted-foreground">
                                Customer Visible
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="text-xs md:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Composer */}
                <Card className="border-border/60 bg-card/60 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-emerald-500" />
                        Post a Reply or Internal Note
                      </span>

                      {/* Canned Macro Quick Inserter */}
                      {macros && macros.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Select
                            value={selectedMacro}
                            onValueChange={(val) => {
                              setSelectedMacro(val);
                              const found = macros.find((m: any) => m.id === val);
                              if (found) {
                                setReplyContent((prev) =>
                                  prev ? prev + "\n\n" + found.content : found.content
                                );
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px] rounded-xl text-xs h-8">
                              <SelectValue placeholder="Insert Canned Macro..." />
                            </SelectTrigger>
                            <SelectContent>
                              {macros.map((m: any) => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">
                                  {m.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder={
                        isInternalNote
                          ? "Write an internal note only visible to team staff and admins..."
                          : "Write a reply to the customer (will be dispatched directly via ZeptoMail)..."
                      }
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={5}
                      className={`rounded-xl text-xs md:text-sm ${
                        isInternalNote ? "border-amber-500/40 bg-amber-500/5" : ""
                      }`}
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="internal-switch"
                          checked={isInternalNote}
                          onCheckedChange={setIsInternalNote}
                        />
                        <Label
                          htmlFor="internal-switch"
                          className="text-xs font-medium cursor-pointer"
                        >
                          {isInternalNote ? (
                            <span className="text-amber-400 font-semibold flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Internal Staff Note (Hidden from Customer)
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Public Reply (Queues outbox email to customer)
                            </span>
                          )}
                        </Label>
                      </div>

                      <Button
                        size="sm"
                        disabled={replyMutation.isPending || !replyContent.trim()}
                        onClick={() => {
                          if (!replyContent.trim()) return;
                          replyMutation.mutate({
                            caseId: selectedCaseId,
                            content: replyContent.trim(),
                            isInternal: isInternalNote,
                          });
                        }}
                        className={`rounded-xl text-xs gap-1.5 px-5 ${
                          isInternalNote
                            ? "bg-amber-600 hover:bg-amber-500 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {replyMutation.isPending
                          ? "Sending..."
                          : isInternalNote
                          ? "Save Internal Note"
                          : "Send Customer Reply"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Case Controls & Metadata */}
              <div className="space-y-6">
                <Card className="border-border/60 bg-card/60 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">Case Details & Management</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-xs">
                    <div className="p-3 rounded-xl bg-secondary/40 border border-border/40 space-y-1.5">
                      <div>
                        <span className="text-muted-foreground">Customer: </span>
                        <span className="font-semibold text-foreground">
                          {activeCase.customer_name || "Buyer"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        <span className="font-mono text-foreground">
                          {activeCase.customer_email || "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Opened: </span>
                        <span>{new Date(activeCase.created_at).toLocaleString()}</span>
                      </div>
                      {activeCase.resolved_at && (
                        <div>
                          <span className="text-muted-foreground">Resolved: </span>
                          <span className="text-emerald-400">
                            {new Date(activeCase.resolved_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Status Select */}
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Status:</label>
                      <Select
                        value={activeCase.status}
                        onValueChange={(newStatus) => {
                          updateCaseMutation.mutate({
                            caseId: selectedCaseId,
                            status: newStatus,
                            priority: activeCase.priority,
                            assignedTo: activeCase.assigned_to,
                          });
                        }}
                      >
                        <SelectTrigger className="rounded-xl text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending Customer</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Priority Select */}
                    <div className="space-y-1.5">
                      <label className="font-medium text-foreground">Priority:</label>
                      <Select
                        value={activeCase.priority}
                        onValueChange={(newPriority) => {
                          updateCaseMutation.mutate({
                            caseId: selectedCaseId,
                            status: activeCase.status,
                            priority: newPriority,
                            assignedTo: activeCase.assigned_to,
                          });
                        }}
                      >
                        <SelectTrigger className="rounded-xl text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Escalate Dialog */}
          <Dialog open={escalateModalOpen} onOpenChange={setEscalateModalOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-500" />
                  Escalate Case to Admin
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Escalating marks this case as urgent and notifies platform administrators with your summary.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Escalation Justification:
                  </label>
                  <Textarea
                    placeholder="e.g. Suspected chargeback dispute, organizer unauthorized cancellation, or complex payment refund..."
                    value={escalateReason}
                    onChange={(e) => setEscalateReason(e.target.value)}
                    rows={4}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEscalateModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={escalateMutation.isPending || !escalateReason.trim()}
                  onClick={() => {
                    if (!escalateReason.trim() || escalateReason.trim().length < 5) {
                      toast.error("Please provide a clear justification reason");
                      return;
                    }
                    selectedCaseId &&
                      escalateMutation.mutate({
                        caseId: selectedCaseId,
                        reason: escalateReason.trim(),
                      });
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs"
                >
                  {escalateMutation.isPending ? "Escalating..." : "Confirm Escalation"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New Support Case Modal */}
          <Dialog open={newCaseModalOpen} onOpenChange={setNewCaseModalOpen}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Inbox className="h-5 w-5 text-emerald-500" />
                  Open New Support Case
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Log customer phone, email, or chat inquiries directly into the support queue.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Customer Email (optional):</label>
                  <Input
                    type="email"
                    placeholder="customer@example.com"
                    value={newCaseCustomerEmail}
                    onChange={(e) => setNewCaseCustomerEmail(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Subject:</label>
                  <Input
                    type="text"
                    placeholder="e.g. Cannot find ticket confirmation in inbox"
                    value={newCaseSubject}
                    onChange={(e) => setNewCaseSubject(e.target.value)}
                    className="rounded-xl text-xs h-9"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Category:</label>
                    <Select value={newCaseCategory} onValueChange={setNewCaseCategory}>
                      <SelectTrigger className="rounded-xl text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="missing_ticket">Missing Ticket</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="event_inquiry">Event Inquiry</SelectItem>
                        <SelectItem value="account">Account</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Priority:</label>
                    <Select value={newCasePriority} onValueChange={setNewCasePriority}>
                      <SelectTrigger className="rounded-xl text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Initial Inquiry / Message:</label>
                  <Textarea
                    placeholder="Details about customer problem, transaction reference, or caller notes..."
                    value={newCaseMessage}
                    onChange={(e) => setNewCaseMessage(e.target.value)}
                    rows={3}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewCaseModalOpen(false)}
                  className="rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={createCaseMutation.isPending}
                  onClick={() => {
                    if (!newCaseSubject.trim()) {
                      toast.error("Please enter a subject");
                      return;
                    }
                    createCaseMutation.mutate({
                      customerEmail: newCaseCustomerEmail,
                      subject: newCaseSubject,
                      category: newCaseCategory,
                      priority: newCasePriority,
                      message: newCaseMessage,
                    });
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs"
                >
                  {createCaseMutation.isPending ? "Creating..." : "Create Case"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}
