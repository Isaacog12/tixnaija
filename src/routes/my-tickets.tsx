import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Search, Ticket, Calendar, MapPin, QrCode, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
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

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 bg-card/20 py-14 md:py-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl gradient-sunset shadow-glow">
            <Ticket className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-4xl md:text-5xl">View Your Tickets</h1>
          <p className="mt-3 text-base text-muted-foreground">
            Enter the email you used at checkout — no account needed.
          </p>
        </div>
      </section>

      {/* Lookup form */}
      <section className="mx-auto max-w-lg px-4 py-10">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card/50 p-6 space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guest-email" className="text-sm font-medium">
                Email Address
              </Label>
              <Input
                id="guest-email"
                type="email"
                placeholder="nneka@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="access-code" className="text-sm font-medium">
                Access PIN
              </Label>
              <div className="flex gap-2">
                <Input
                  id="access-code"
                  type="text"
                  placeholder="e.g. 12345"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="flex-1"
                  required
                />
                <Button
                  type="submit"
                  className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 shrink-0"
                  disabled={lookup.isPending || !email.trim() || !accessCode.trim()}
                >
                  {lookup.isPending ? (
                    <span className="flex items-center gap-1.5">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground/50 border-t-primary-foreground animate-spin" />
                      Checking…
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Search className="h-4 w-4" /> Find tickets
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy note:</strong> We only show tickets
            purchased with this exact email address. We never share your data.
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
                    className="group flex flex-col sm:flex-row overflow-hidden rounded-2xl border border-border/50 bg-card/60 hover:border-primary/30 hover:shadow-glow transition-all"
                  >
                    {/* Cover */}
                    <div className="h-36 sm:h-auto sm:w-40 shrink-0 bg-secondary overflow-hidden">
                      {order.event_cover ? (
                        <img
                          src={order.event_cover}
                          alt={order.event_title}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center opacity-30">
                          <Ticket className="h-8 w-8" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(order.event_start).toLocaleString("en-NG", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </div>
                        <h3 className="font-display text-xl leading-tight group-hover:text-primary">
                          {order.event_title}
                        </h3>
                        {order.event_city && (
                          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            {order.event_city}
                          </p>
                        )}
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4">
                        <div className="text-sm text-muted-foreground">
                          Paid <strong className="text-foreground">{formatNaira(order.total_kobo)}</strong>
                        </div>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="group-hover:border-primary/50 group-hover:text-primary"
                        >
                          <Link
                            to="/orders/$orderId/tickets"
                            params={{ orderId: order.id }}
                            search={{ email: submitted.email, accessCode: submitted.accessCode }}
                          >
                            <QrCode className="mr-1.5 h-3.5 w-3.5" />
                            View &amp; Download Tickets
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Upsell to create account */}
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm text-muted-foreground">
                  <strong className="text-foreground">Want easier access?</strong> Create a free account
                  with this email to see all your tickets in one place, request refunds, and get inbox notifications.
                  <div className="mt-3">
                    <Button asChild size="sm" className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
                      <Link to="/auth" search={{ mode: "signup" }}>Create free account</Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
