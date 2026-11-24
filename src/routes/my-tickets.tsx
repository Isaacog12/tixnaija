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
          "Bought tickets without an account? Enter your email and the date you bought them and we'll send those ticket links right away — no account or code needed.",
      },
    ],
  }),
});

/** Nigeria runs on WAT (UTC+1), which is how the date is interpreted server-side. */
const TODAY_IN_WAT = () => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);

/** Reads the `error` string a function returned with a non-2xx status, if any. */
async function readFunctionError(context?: Response) {
  if (!context || typeof context.clone !== "function") return "";
  try {
    const payload = await context.clone().json();
    return typeof payload?.error === "string" ? payload.error : "";
  } catch {
    return "";
  }
}

/** "2026-12-12" → "12 Dec 2026" without shifting a day across timezones. */
function formatPurchaseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function GuestTicketsPage() {
  const [email, setEmail] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [submitted, setSubmitted] = useState<{ email: string; purchaseDate: string } | null>(null);

  const send = useMutation({
    mutationFn: async (values: { email: string; purchaseDate: string }) => {
      const { data, error } = await supabase.functions.invoke("resend-ticket-links", {
        body: { email: values.email, purchaseDate: values.purchaseDate },
      });
      if (error) {
        // supabase-js replaces the function's JSON body with "Edge Function
        // returned a non-2xx status code", so read the reason from the response
        // itself before falling back to a status-based message.
        const context = (error as { context?: Response })?.context;
        const body = await readFunctionError(context);
        if (body) throw new Error(body);
        const status = context?.status;
        if (status === 429) {
          throw new Error("Too many requests. Please wait a few minutes and try again.");
        }
        if (status === 404) {
          throw new Error("Ticket email service is unavailable right now. Please contact support.");
        }
        throw error;
      }
      if (data?.error) throw new Error(data.error);
      return data as { ok: boolean; sent?: number };
    },
    onSuccess: (_data, values) => {
      setSubmitted({
        email: values.email.trim().toLowerCase(),
        purchaseDate: values.purchaseDate,
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !purchaseDate) return;
    setSubmitted(null);
    send.mutate({ email: email.trim(), purchaseDate });
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
            Enter the email you used at checkout and the day you bought the tickets. We'll email
            only that day's ticket links. No account needed.
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

          <div className="space-y-2">
            <Label
              htmlFor="guest-purchase-date"
              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
            >
              Date of purchase
            </Label>
            <Input
              id="guest-purchase-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              max={TODAY_IN_WAT()}
              className="h-12 rounded-md bg-card text-base text-foreground [color-scheme:light] dark:[color-scheme:dark]"
              required
            />
            <p className="text-[12px] text-muted-foreground">
              The day you paid — not the day of the event.
            </p>
          </div>

          <Button
            type="submit"
            className="h-12 w-full gap-2 rounded-md font-semibold press-sm"
            disabled={send.isPending || !email.trim() || !purchaseDate}
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
            bought with this exact address on this exact date.
          </p>
        </form>

        {(send.isError || submitted) && (
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
                  We found your tickets from{" "}
                  <strong className="font-semibold text-foreground">
                    {submitted ? formatPurchaseDate(submitted.purchaseDate) : ""}
                  </strong>{" "}
                  and emailed them to{" "}
                  <strong className="font-semibold text-foreground">{submitted?.email}</strong>. Emails
                  usually arrive within a minute.
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
