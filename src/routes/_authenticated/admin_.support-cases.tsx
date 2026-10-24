import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AlertTriangle,
  Inbox,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin_/support-cases" as any)({
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
  component: AdminEscalatedCases,
});

function AdminEscalatedCases() {
  const qc = useQueryClient();

  const { data: escalatedCases, isLoading, refetch } = useQuery({
    queryKey: ["admin-escalated-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_cases" as any)
        .select(`
          id,
          case_number,
          subject,
          category,
          status,
          priority,
          is_escalated,
          escalated_at,
          escalated_reason,
          created_at,
          customer_id
        `)
        .eq("is_escalated", true)
        .order("escalated_at", { ascending: false });

      if (error) {
        console.warn("fetch escalated cases:", error.message);
        return [];
      }
      return (data as any[]) || [];
    },
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-foreground">
              Escalated Support Cases
            </h1>
          </div>
          <p className="text-xs md:text-sm text-muted-foreground">
            Inquiries and disputes that require administrator executive review, legal escalation, or financial intervention.
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

      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-500" />
            Escalated Queue ({escalatedCases?.length || 0})
          </CardTitle>
          <CardDescription className="text-xs">
            Cases flagged as urgent by customer care staff with attached justifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading escalated cases...
            </div>
          ) : !escalatedCases || escalatedCases.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-foreground">No escalated cases</p>
              <p className="text-xs text-muted-foreground">
                Customer care team is managing all active cases without administrative escalations.
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
                    <TableHead>Escalation Justification</TableHead>
                    <TableHead>Escalated Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalatedCases.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        {c.case_number}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-foreground max-w-[200px] truncate">
                        {c.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {c.category?.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-rose-400 max-w-[240px] truncate font-medium">
                        {c.escalated_reason}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.escalated_at ? new Date(c.escalated_at).toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "open" ? "default" : "secondary"}
                          className="text-[10px] uppercase font-bold"
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg text-xs gap-1.5"
                        >
                          <Link to={"/support" as any} search={{ tab: "cases", caseId: c.id } as any}>
                            <ExternalLink className="h-3.5 w-3.5" />
                            Open Thread
                          </Link>
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
    </div>
  );
}
