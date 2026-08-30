import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Ticket, Calendar, MapPin, QrCode, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatNaira } from "@/lib/currency";

export const Route = createFileRoute("/my-tickets")({
  component: GuestTicketsPage,
  head: () => ({
    meta: [
      { title: "View My Tickets — TixNaija" },
      {
        name: "description",
        content: "Enter your email to view and download your TixNaija tickets — no account needed.",
      },
    ],
  }),
});

interface GuestOrder {
  id: string;
  event_id: string;
  buyer_name: string;
  buyer_email: string;
  total_kobo: number;
  status: string;
  created_at: string;
  event_title: string;
  event_slug: string;
  event_city: string;
  event_cover: string | null;
  event_start: string;
}

function GuestTicketsPage() {
  const [email, setEmail] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitted, setSubmitted] = useState({ email: "", accessCode: "" });
  const [orders, setOrders] = useState<GuestOrder[] | null>(null);

  const lookup = useMutation({
    mutationFn: async ({ emailVal, accessCodeVal }: { emailVal: string, accessCodeVal: string }) => {
      const { data, error } = await supabase.rpc("get_guest_orders" as any, {
        p_email: emailVal.trim().toLowerCase(),
        p_access_code: accessCodeVal.trim(),
      });
      if (error) throw error;
      return (data ?? []) as GuestOrder[];
    },
    onSuccess: (data, variables) => {
      setOrders(data);
      setSubmitted({ email: variables.emailVal, accessCode: variables.accessCodeVal });
    },
    onError: () => {
      setOrders([]);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !accessCode.trim()) return;
    lookup.mutate({ emailVal: email.trim(), accessCodeVal: accessCode.trim() });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 pt-6 w-full relative z-20">
        <BackButton />
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-card/30 py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-background border border-border/50 shadow-sm backdrop-blur-sm">
            <Ticket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl tracking-tight font-semibold">Find Your Tickets</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Enter the email address you used at checkout to retrieve your tickets. No account needed.
          </p>
        </div>
      </section>

      {/* Lookup form */}
      <section className="mx-auto max-w-lg px-4 py-12">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-primary/5 space-y-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="guest-email" className="text-sm font-semibold">
                Email Address
              </Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="e.g. nneka@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 text-base bg-background"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="access-code" className="text-sm font-semibold">
                Access PIN
              </Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="access-code"
                  type="text"
                  placeholder="e.g. 12345"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="flex-1 h-12 text-base bg-background font-mono"
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full sm:w-auto px-8 font-semibold text-primary-foreground shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95"
                  disabled={lookup.isPending || !email.trim() || !accessCode.trim()}
                >
                  {lookup.isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/50 border-t-primary-foreground animate-spin" />
                      Checking…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Search className="h-4 w-4" /> Find tickets
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground text-center">
            <strong className="text-foreground">Privacy Note:</strong> We only show tickets
            purchased with this exact email address. Your data is secure.
          </div>
        </form>

        {/* Results */}
        {orders !== null && (
          <div className="mt-8">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-14 text-center">
                <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h3 className="mt-4 font-semibold">No tickets found</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                  No paid orders found for <strong>{submitted.email}</strong> with that PIN. Check your spelling or try another email.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Also check your inbox — your ticket QR codes were emailed to you at checkout.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Found <strong className="text-foreground">{orders.length}</strong> order
                  {orders.length !== 1 ? "s" : ""} for <strong className="text-foreground">{submitted.email}</strong>
                </p>
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="group flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm shadow-sm hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Cover */}
                    <div className="h-40 sm:h-auto sm:w-48 shrink-0 bg-secondary overflow-hidden relative">
                      {order.event_cover ? (
                        <img
                          src={order.event_cover}
                          alt={order.event_title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center opacity-30 bg-gradient-to-br from-primary/20 to-primary/5">
                          <Ticket className="h-10 w-10" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col justify-between p-6">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
                          <Calendar className="h-4 w-4" />
                          {new Date(order.event_start).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                        <h3 className="font-display text-2xl leading-tight group-hover:text-primary transition-colors">
                          {order.event_title}
                        </h3>
                        {order.event_city && (
                          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground font-medium">
                            <MapPin className="h-4 w-4" />
                            {order.event_city}
                          </p>
                        )}
                      </div>
                      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border/40 pt-4">
                        <div className="text-sm text-muted-foreground">
                          Paid <strong className="text-foreground text-base">{formatNaira(order.total_kobo)}</strong>
                        </div>
                        <Button
                          asChild
                          variant="default"
                          className="shadow-sm group-hover:shadow-md transition-shadow"
                        >
                          <Link
                            to="/orders/$orderId/tickets"
                            params={{ orderId: order.id }}
                            search={{ email: submitted.email, accessCode: submitted.accessCode }}
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            View Tickets
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Upsell to create account */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground block text-base mb-1">Want easier access?</strong>
                    Create a free account to see all your tickets in one place and easily request refunds.
                  </div>
                  <Button asChild size="sm" className="shrink-0 bg-background text-foreground border border-border/50 hover:bg-muted">
                    <Link to="/auth" search={{ mode: "signup" }}>Create Free Account</Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
