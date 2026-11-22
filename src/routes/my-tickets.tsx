import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, AlertCircle, CheckCircle2 } from "lucide-react";
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
        const status = (error as { context?: { status?: number } })?.context?.status;
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

      <section className="border-b border-border/60">
        <div className="mx-auto max-w-2xl px-4 pb-8 pt-6 sm:px-6 md:pb-10">
          <BackButton />
          <div className="mt-6 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-px w-10 bg-border" aria-hidden />
            TixNaija / Tickets
          </div>
          <h1 className="mt-4 font-display text-4xl leading-none tracking-[-0.02em] text-foreground">
            Email my tickets
          </h1>
          <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted-foreground">
            Enter the email you used at checkout and we'll send your ticket links straight to your
            inbox. No account needed.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-md px-4 py-10 sm:px-6">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-border/60 bg-card p-6">
          <div className="space-y-2">
            <Label
              htmlFor="guest-email"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Email address
            </Label>
            <Input
              id="guest-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-md text-base"
              autoComplete="email"
              required
            />
            <p className="text-[12px] text-muted-foreground">
              Use the exact address your tickets were sent to.
            </p>
          </div>

          <Button
            type="submit"
            className="h-12 w-full gap-2 rounded-md font-semibold press-sm"
            disabled={send.isPending || !email.trim()}
          >
            {send.isPending ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                  aria-hidden
                />
                Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" aria-hidden /> Email my tickets
              </>
            )}
          </Button>

          <p className="border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">Privacy:</span> we only email tickets
            bought with this exact address.
          </p>
        </form>

        {(send.isError || submittedEmail) && (
          <div className="mt-6 space-y-4">
            {send.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-destructive">
                  <AlertCircle className="h-4 w-4" aria-hidden />
                  Not sent
                </div>
                <h2 className="mt-3 font-display text-xl text-foreground">
                  We couldn't send your tickets
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {(send.error as Error)?.message ||
                    "Something went wrong. Please try again in a few minutes."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card p-6">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Sent
                </div>
                <h2 className="mt-3 font-display text-xl text-foreground">Check your inbox</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If we found tickets for{" "}
                  <strong className="font-semibold text-foreground">{submittedEmail}</strong>, the
                  links are on their way. Emails usually arrive within a minute.
                </p>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  Nothing yet? Check spam/junk, then try again in a few minutes. Still stuck?{" "}
                  <Link to="/contact" className="font-medium text-foreground underline underline-offset-4">
                    Contact support
                  </Link>
                  .
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-secondary/20 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="block font-semibold text-foreground">Want easier access?</span>
                Create a free account and your tickets stay in one place.
              </p>
              <Button asChild variant="outline" size="sm" className="shrink-0 rounded-md">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Create free account
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
