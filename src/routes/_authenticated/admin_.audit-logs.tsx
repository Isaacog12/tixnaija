import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ShieldAlert,
  Search,
  CheckCircle2,
  Lock,
  Calendar,
  FileCode,
  User,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/back-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

export const Route = createFileRoute("/_authenticated/admin_/audit-logs")({
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
  component: AdminAuditLogsViewer,
});

function AdminAuditLogsViewer() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLog, setSelectedLog] = useState<any>(null);

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_audit_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        console.warn("fetch support_audit_logs:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  const filteredLogs = (logs || []).filter((l: any) => {
    const q = searchTerm.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.actor_email && l.actor_email.toLowerCase().includes(q)) ||
      (l.target_type && l.target_type.toLowerCase().includes(q)) ||
      (l.target_id && l.target_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-foreground">
              Append-Only Security Audit Trail
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Immutable log of all staff inquiries, role changes, customer lookups, and dual-control approvals.
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

      <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 flex items-start gap-3">
        <Lock className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-emerald-300">Irrevocable Audit Integrity:</span>
          <p className="leading-relaxed">
            Every support RPC and role mutation writes to this table. Database triggers and revoked permissions prevent any UPDATE, DELETE, or TRUNCATE statements even from service role keys.
          </p>
        </div>
      </div>

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-emerald-500" />
              Recent Audit Events ({filteredLogs.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Showing the most recent 100 logged platform actions.
            </CardDescription>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Filter by action, actor, target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl text-xs h-9"
            />
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading audit logs...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">No audit entries found</p>
              <p className="text-xs text-muted-foreground">
                No logs matched your search or the audit table is currently empty.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor Email</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target Type</TableHead>
                    <TableHead>Target ID</TableHead>
                    <TableHead className="text-right">Payload</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {new Date(l.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-medium text-foreground">
                        {l.actor_email || "system_service"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-bold font-mono">
                          {l.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {l.target_type}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[140px] truncate">
                        {l.target_id}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedLog(l)}
                          className="h-7 text-xs rounded-lg gap-1"
                        >
                          <FileCode className="h-3.5 w-3.5 text-blue-400" />
                          View
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

      {/* Payload JSON Inspector Dialog */}
      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5 text-blue-500" />
              Audit Payload Inspector
            </DialogTitle>
            <DialogDescription className="text-xs">
              Raw snapshot captured at timestamp {selectedLog ? new Date(selectedLog.created_at).toLocaleString() : ""}.
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border/50 text-xs space-y-1">
                <div>
                  <span className="text-muted-foreground">Action: </span>
                  <span className="font-mono font-bold">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Actor: </span>
                  <span className="font-mono">{selectedLog.actor_email || "system_service"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Target: </span>
                  <span className="font-mono">{selectedLog.target_type}:{selectedLog.target_id}</span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-black/60 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-80">
                <pre>{JSON.stringify(selectedLog.details, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
