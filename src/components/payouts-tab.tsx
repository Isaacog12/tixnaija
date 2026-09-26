import React from "react";
import { formatNaira } from "@/lib/currency";
import { ExternalLink, Info, CheckCircle2, Building, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface PayoutsTabProps {
  events: any[];
  statsByEvent: Record<string, { sold: number; revenueKobo: number }>;
  hasPayoutAccount: boolean;
}

export function PayoutsTab({ events, statsByEvent, hasPayoutAccount }: PayoutsTabProps) {
  // Calculate total earnings
  const totalRevenueKobo = Object.values(statsByEvent).reduce((acc, curr) => acc + (curr.revenueKobo || 0), 0);
  const platformFeePercentage = 10; // Fixed platform fee assuming 10%
  const netEarningsKobo = Math.floor(totalRevenueKobo * (1 - (platformFeePercentage / 100)));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-semibold mb-1">Payouts & Earnings</h2>
          <p className="text-muted-foreground text-sm">
            Track your ticket sales revenue and automated bank settlements.
          </p>
        </div>
      </div>

      {!hasPayoutAccount ? (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/20 text-destructive-foreground">
          <Info className="h-5 w-5" />
          <AlertTitle className="text-destructive font-semibold">Missing Payout Account</AlertTitle>
          <AlertDescription>
            You have not connected a bank account for payouts yet. You must connect one in your Settings before you can publish paid events and receive earnings.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-primary/5 border-primary/20">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertTitle className="text-foreground font-semibold">Automated Settlements Active</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Your earnings are automatically settled directly to your connected bank account within 24-48 hours of ticket sales by Paystack. TixNaija does not hold your funds.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-secondary">
              <TrendingUp className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="font-medium text-sm">Gross Revenue</h3>
          </div>
          <div>
            <p className="text-3xl font-display font-bold">{formatNaira(totalRevenueKobo)}</p>
            <p className="text-xs text-muted-foreground mt-2">Total value of all tickets sold across events</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-3 text-muted-foreground mb-4">
            <div className="p-2 rounded-lg bg-secondary">
              <Building className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="font-medium text-sm">Estimated Net Payouts</h3>
          </div>
          <div>
            <p className="text-3xl font-display font-bold text-primary">{formatNaira(netEarningsKobo)}</p>
            <p className="text-xs text-muted-foreground mt-2">After ~10% platform fees. Sent straight to bank.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm">
        <div className="px-6 py-4 border-b border-border bg-muted/30">
          <h3 className="font-semibold text-lg">Earnings by Event</h3>
        </div>
        <div className="divide-y divide-border">
          {events.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No events found.</div>
          ) : (
            events.map((event) => {
              const stats = statsByEvent[event.id] || { sold: 0, revenueKobo: 0 };
              const netKobo = Math.floor(stats.revenueKobo * (1 - (platformFeePercentage / 100)));
              
              return (
                <div key={event.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 hover:bg-muted/10 transition-colors">
                  <div>
                    <h4 className="font-medium">{event.title}</h4>
                    <p className="text-sm text-muted-foreground mt-1 capitalize">{event.status}</p>
                  </div>
                  <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1">
                    <p className="font-semibold">{formatNaira(netKobo)} Net</p>
                    <Badge variant="secondary">{stats.sold} tickets sold</Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
