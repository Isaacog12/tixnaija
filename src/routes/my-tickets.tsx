import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail, Send, Ticket, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/my-tickets")({
  component: GuestTicketsPage,
  head: () => ({
    meta: [
      { title: "Email My Tickets — TixNaija" },
      {
        name: "description",
        content:
          "Bought tickets without an account? Enter your email and we'll send your ticket links right away — no account or code needed.",
      },
    ],
  }),
});

function GuestTicketsPage() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: async (emailValue: string) => {
      const { data, error } = await supabase.functions.invoke("resend-ticket-links", {
        body: { email: emailValue },
      });
      if (error) {
        // Map the transport failures we can act on; anything else is surfaced as-is.
        const status = (error as any)?.context?.status;
        if (status === 404) {
          throw new Error("Ticket email service is unavailable right now. Please contact support.");
        }
        if (status === 429) {
          throw new Error("Too many requests. Please wait a few minutes and try again.");
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as { ok: boolean; sent?: number };
    },
    onSuccess: (_data, emailValue) => {
      setSubmittedEmail(emailValue.trim().toLowerCase());
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmittedEmail(null);
    send.mutate(email.trim());
  }

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border bg-card/30 pb-14 pt-6 md:pb-20">
        <div className="mx-auto max-w-7xl px-4 w-full relative z-20 mb-8 md:mb-14">
          <BackButton />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.05),transparent_60%)]" />
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-background border border-border/50 shadow-sm backdrop-blur-sm">
            <Ticket className="h-8 w-8 text-primary" />
          </div>
          <h1 className="type-heading-lg tracking-tight font-semibold">Email My Tickets</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Enter the email you used at checkout and we'll send your ticket links straight to your
            inbox. No account needed.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-lg px-4 py-12">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-border/80 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-primary/5 space-y-6"
        >
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
            <p className="text-xs text-muted-foreground">
              Use the exact address your tickets were sent to.
            </p>
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-12 w-full font-semibold text-primary-foreground shadow-md gradient-sunset press-sm transition-all duration-[120ms] hover:-translate-y-0.5"
            disabled={send.isPending || !email.trim()}
          >
            {send.isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/50 border-t-primary-foreground animate-spin" />
                Sending…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="h-4 w-4" /> Email my tickets
              </span>
            )}
          </Button>

          <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground text-center">
            <strong className="text-foreground">Privacy Note:</strong> We only email tickets that were
            bought with this exact address. Your data stays secure.
          </div>
        </form>

        {/* Result */}
        {(send.isError || submittedEmail) && (
          <div className="mt-8">
            {send.isError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 py-10 px-6 text-center">
                <AlertCircle className="mx-auto h-9 w-9 text-destructive/70" />
                <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                  We couldn't send your tickets
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {(send.error as Error)?.message ||
                    "Something went wrong. Please try again in a few minutes."}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-green-500/30 bg-green-500/5 py-10 px-6 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
                <h3 className="mt-4 font-display text-xl font-semibold text-foreground">
                  Check your inbox
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  If we found tickets for <strong className="text-foreground">{submittedEmail}</strong>,
                  the links are on their way. Emails usually arrive within a minute.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  Nothing yet? Check spam/junk, then try again in a few minutes. Still stuck?{" "}
                  <Link to="/contact" className="text-primary hover:underline">
                    Contact support
                  </Link>
                  .
                </p>
              </div>
            )}

            {/* Upsell to create account */}
            <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                <strong className="text-foreground block text-base mb-1">Want easier access?</strong>
                Create a free account and your tickets stay in one place — no digging through email.
              </div>
              <Button
                asChild
                size="sm"
                className="shrink-0 bg-background text-foreground border border-border/50 hover:bg-muted"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create Free Account
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
