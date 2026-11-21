import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  User,
  Ticket,
  ShoppingBag,
  ExternalLink,
  ShieldAlert,
  Clock,
  CheckCircle,
  XCircle,
  Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/lib/toast";
import type { SupportLookupResult } from "@/lib/support-rpc-types";

interface SupportLookupTabProps {
  initialQuery?: string;
  onOpenOrder: (orderId: string) => void;
  onOpenCase: (caseId: string) => void;
}

export function SupportLookupTab({
  initialQuery = "",
  onOpenOrder,
  onOpenCase,
}: SupportLookupTabProps) {
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [executedQuery, setExecutedQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery) {
      setSearchTerm(initialQuery);
      setExecutedQuery(initialQuery);
    }
  }, [initialQuery]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["support-lookup", executedQuery],
    queryFn: async () => {
      if (!executedQuery || executedQuery.trim().length < 3) return null;
      const { data, error } = await supabase.rpc("support_lookup_customer", {
        p_query: executedQuery.trim(),
      });
      if (error) throw error;
      return data as SupportLookupResult | null;
    },
    enabled: Boolean(executedQuery && executedQuery.trim().length >= 3),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm || searchTerm.trim().length < 3) {
      toast.error("Please enter at least 3 characters for lookup");
      return;
    }
    setExecutedQuery(searchTerm.trim());
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const customers = data?.customers || [];
  const orders = data?.orders || [];
  const tickets = data?.tickets || [];

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Search className="h-5 w-5 text-emerald-500" />
            Universal Customer & Order Lookup
          </CardTitle>
          <CardDescription className="text-xs">
            Query across buyer emails, phone numbers, Paystack references, or ticket codes (e.g. TN-...).
            Every query is logged to immutable audit records. Throttled to 30 lookups/minute per agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter exact email, phone (+234...), reference (TIX-...), or ticket code (TN-...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 rounded-xl text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || searchTerm.trim().length < 3}
              className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6"
            >
              {isLoading ? "Searching..." : "Search"}
            </Button>
          </form>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>{error.message || "Search failed or rate limit exceeded"}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results View */}
      {executedQuery && !isLoading && (
        <div className="space-y-6">
          {/* Customers Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-500" />
                Matched Profiles ({customers.length})
              </h2>
            </div>

            {customers.length === 0 ? (
              <Card className="border-border/40 bg-card/30">
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  No registered profiles directly matching "{executedQuery}".
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customers.map((c: any) => (
                  <Card key={c.id} className="border-border/60 bg-card/50">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-base text-foreground">
                            {c.full_name || "Anonymous User"}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {c.masked_email || c.email}
                          </div>
                          {c.masked_phone && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {c.masked_phone}
                            </div>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          ID: {c.id?.slice(0, 8)}…
                        </Badge>
                      </div>

                      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Joined: {new Date(c.created_at).toLocaleDateString()}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(c.id, "User ID")}
                          className="h-7 text-[11px] gap-1 px-2"
                        >
                          <Copy className="h-3 w-3" />
                          Copy ID
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Orders Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-blue-500" />
                Matched Orders ({orders.length})
              </h2>
            </div>

            {orders.length === 0 ? (
              <Card className="border-border/40 bg-card/30">
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  No orders found matching "{executedQuery}".
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead>Order ID / Reference</TableHead>
                      <TableHead>Buyer Email</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((o: any) => (
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
                          {o.masked_buyer_email || o.buyer_email}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-foreground max-w-[200px] truncate">
                          {o.event_title || (o.event_id ? `Event #${o.event_id.slice(0, 8)}` : "Event")}
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
                            onClick={() => onOpenOrder(o.id)}
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
          </div>

          {/* Tickets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Ticket className="h-4 w-4 text-purple-500" />
                Matched Tickets ({tickets.length})
              </h2>
            </div>

            {tickets.length === 0 ? (
              <Card className="border-border/40 bg-card/30">
                <CardContent className="py-6 text-center text-xs text-muted-foreground">
                  No individual tickets found matching "{executedQuery}".
                </CardContent>
              </Card>
            ) : (
              <div className="rounded-xl border border-border/60 overflow-hidden bg-card/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30">
                      <TableHead>Ticket Code</TableHead>
                      <TableHead>Attendee Email</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Check-in Status</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-bold text-foreground">
                          {t.masked_ticket_code || t.ticket_code}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {t.masked_attendee_email || t.attendee_email || "N/A"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {t.order_id?.slice(0, 8)}…
                        </TableCell>
                        <TableCell>
                          {t.checked_in_at ? (
                            <Badge className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Checked In ({new Date(t.checked_in_at).toLocaleTimeString()})
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              Unused
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.order_id && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onOpenOrder(t.order_id)}
                              className="h-8 rounded-lg text-xs gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View Order
                            </Button>
                          )}
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
    </div>
  );
}
