import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle, Mail, MessageSquare, Copy, Check, Phone, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";
import { BUSINESS_DETAILS } from "@/lib/business";
import { toast } from "sonner";
import { z } from "zod";

const verifySearchSchema = z.object({
  reference: z.string().optional(),
  trxref: z.string().optional(),
});

const GUEST_TICKET_CREDENTIALS_PREFIX = "tixnaija:guest-ticket-credentials:";
const GUEST_CHECKOUT_PENDING_KEY = "tixnaija:guest-checkout-pending";

interface PendingGuestCheckout {
  email: string;
}

export const Route = createFileRoute("/checkout/verify")({
  validateSearch: verifySearchSchema,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: VerifyCheckoutPage,
});

function VerifyCheckoutPage() {
  const searchParams = Route.useSearch();
  const reference = searchParams.reference || searchParams.trxref;
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestEmail, setGuestEmail] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }

    // A guest checkout stores its email + reference right before the Paystack
    // redirect. If it is missing (new tab, shared link), we fall back to the
    // reference alone — it doubles as the ticket access code.
    let pendingGuest: PendingGuestCheckout | null = null;
    try {
      const raw = sessionStorage.getItem(GUEST_CHECKOUT_PENDING_KEY);
      pendingGuest = raw ? (JSON.parse(raw) as PendingGuestCheckout) : null;
    } catch {
      pendingGuest = null;
    }

    async function verify() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const guest = Boolean(pendingGuest) || !authData?.user;
        setIsGuest(guest);
        if (pendingGuest?.email) setGuestEmail(pendingGuest.email);

        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        const verifiedOrderId = (data?.order_id as string | undefined) ?? null;
        if (verifiedOrderId) setOrderId(verifiedOrderId);

        // Hand the guest straight into their tickets: the ticket page reads
        // these credentials from sessionStorage.
        if (guest && pendingGuest && verifiedOrderId) {
          try {
            sessionStorage.setItem(
              `${GUEST_TICKET_CREDENTIALS_PREFIX}${verifiedOrderId}`,
              JSON.stringify({ email: pendingGuest.email }),
            );
            sessionStorage.removeItem(GUEST_CHECKOUT_PENDING_KEY);
          } catch {
            // Storage blocked — the emailed link still unlocks the order.
          }
        }

        setStatus("success");
      } catch (err: any) {
        console.error("Verification error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Payment verification failed. If you were charged, please contact support.");
      }
    }

    verify();
  }, [reference]);

  function handleCopyReference() {
    if (!reference) return;
    navigator.clipboard.writeText(reference);
    setCopied(true);
    toast.success("Payment reference copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  const cleanPhone = BUSINESS_DETAILS.supportPhone.replace(/[^0-9]/g, "");
  const supportMessage = encodeURIComponent(
    reference
      ? `Hello TixNaija Support, I just completed checkout (Payment Ref: ${reference}) and haven't received my ticket email yet. Could you please assist?`
      : `Hello TixNaija Support, I just completed checkout and haven't received my ticket email yet. Could you please assist?`
  );
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${supportMessage}`;
  const smsUrl = `sms:${BUSINESS_DETAILS.supportPhone}?body=${supportMessage}`;
  const emailSubject = encodeURIComponent(
    reference ? `Ticket Email Support - Ref: ${reference}` : "Ticket Email Support - TixNaija"
  );
  const emailBody = encodeURIComponent(
    reference
      ? `Hello TixNaija Team,\n\nI purchased a ticket on TixNaija under Payment Reference: ${reference}, but I have not received the confirmation email.\n\nPlease check my order and assist in resending the tickets.\n\nThank you.`
      : `Hello TixNaija Team,\n\nI purchased a ticket on TixNaija, but I have not received the confirmation email.\n\nPlease check my order and assist in resending the tickets.\n\nThank you.`
  );
  const mailtoUrl = `mailto:${BUSINESS_DETAILS.supportEmail}?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 pt-6 w-full relative z-20">
        <BackButton />
      </div>
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="mb-6 h-16 w-16 animate-spin text-primary" />
            <h1 className="font-display text-3xl">Verifying Payment...</h1>
            <p className="mt-2 text-muted-foreground">Please wait while we confirm your transaction.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mb-5 h-16 w-16 text-green-500" />
            <h1 className="font-display text-3xl sm:text-4xl">Payment Successful!</h1>
            
            <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md">
              {isGuest
                ? guestEmail
                  ? `Your tickets have been generated and emailed to ${guestEmail}.`
                  : "Your tickets have been generated and emailed to you."
                : "Your tickets have been generated and sent to your email. You can also view and download them right now in your account."}
            </p>

            {isGuest && (
              <div className="mt-5 w-full rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left">
                <p className="text-xs font-semibold text-foreground">Your tickets are in your inbox</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {guestEmail
                    ? `We emailed your tickets to ${guestEmail}. `
                    : "We emailed your tickets. "}
                  Open that email on any device to view or download them — no account or code needed.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Lost the email?{" "}
                  <Link to="/my-tickets" className="text-primary hover:underline">
                    Resend my tickets
                  </Link>
                </p>
              </div>
            )}

            <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
              {isGuest ? (
                orderId ? (
                  <Button asChild className="flex-1 gradient-sunset text-primary-foreground font-semibold press-sm shadow-md" size="lg">
                    <Link to="/orders/$orderId/tickets" params={{ orderId }}>
                      View My Tickets
                    </Link>
                  </Button>
                ) : (
                  <Button asChild className="flex-1 gradient-sunset text-primary-foreground font-semibold press-sm shadow-md" size="lg">
                    <Link to="/my-tickets">Resend My Tickets</Link>
                  </Button>
                )
              ) : (
                <>
                  <Button asChild className="flex-1 gradient-sunset text-primary-foreground font-semibold press-sm shadow-md" size="lg">
                    <Link to="/my-tickets">View My Tickets</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1 font-medium" size="lg">
                    <Link to="/notifications">Notifications</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Support Assistance Card for Missing Emails */}
            <div className="mt-8 w-full rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-5 text-left shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <HelpCircle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">
                    Didn't receive your email?
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Ticket emails usually arrive within 1–2 minutes. Check your spam/junk folder. If you still don't see it, text or email our team directly and we'll resend it right away.
                  </p>

                  {reference && (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-1.5 border border-border/40">
                      <span className="text-xs text-muted-foreground truncate">
                        Ref: <span className="font-mono font-medium text-foreground">{reference}</span>
                      </span>
                      <button
                        onClick={handleCopyReference}
                        type="button"
                        aria-label="Copy payment reference"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
                      >
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Copied" : "Copy Ref"}
                      </button>
                    </div>
                  )}

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      WhatsApp / Text
                    </a>

                    <a
                      href={smsUrl}
                      className="inline-flex sm:hidden items-center gap-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      SMS ({BUSINESS_DETAILS.supportPhone})
                    </a>

                    <a
                      href={mailtoUrl}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border px-3 py-1.5 text-xs font-medium transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Email ({BUSINESS_DETAILS.supportEmail})
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mb-5 h-16 w-16 text-destructive" />
            <h1 className="font-display text-3xl">Verification Failed</h1>
            <p className="mt-2 text-destructive">{errorMsg}</p>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1" variant="outline" size="lg">
                <Link to="/">Back to Home</Link>
              </Button>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground font-semibold px-4 py-2.5 text-sm shadow-sm hover:opacity-95 transition-opacity"
              >
                <MessageSquare className="h-4 w-4" />
                Contact Support
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
