import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { CheckCircle2, Loader2, Mail, ArrowRight } from "lucide-react";
import { z } from "zod";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/otp")({
  validateSearch: z.object({
    email: z.string().email().optional(),
    redirect: z.string().optional(),
  }),
  component: OtpPage,
  head: () => ({
    meta: [
      { title: "Verify OTP — TixNaija" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type OtpState = "email_input" | "input" | "verifying" | "success";
const OTP_LENGTH = 8;
const RESEND_SECONDS = 60;

function OtpPage() {
  const { email: initialEmail, redirect } = Route.useSearch();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail || "");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [state, setState] = useState<OtpState>(initialEmail ? "input" : "email_input");
  const [countdown, setCountdown] = useState(initialEmail ? RESEND_SECONDS : 0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Send initial OTP if email is passed via URL ──────────────────────
  useEffect(() => {
    if (initialEmail && state === "input" && countdown === RESEND_SECONDS) {
      // Send OTP quietly when entering the page with an email
      supabase.auth.signInWithOtp({ email: initialEmail }).then(({ error }) => {
        if (error) {
          toast.error(error.message);
          setState("email_input");
        } else {
          toast.success("Verification code sent to your email!");
        }
      });
    }
  }, [initialEmail]);

  // ── Countdown timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const formatCountdown = (s: number) => {
    const m = String(Math.floor(s / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Digit input handling ─────────────────────────────────────────────
  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (state !== "input") return;
      const char = value.replace(/\D/g, "").slice(-1);
      setDigits((prev) => {
        const next = [...prev];
        next[index] = char;
        return next;
      });
      if (char && index < OTP_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [state],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (state !== "input") return;
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (!pasted) return;
      const arr = Array(OTP_LENGTH).fill("");
      pasted.split("").forEach((ch, i) => {
        arr[i] = ch;
      });
      setDigits(arr);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    },
    [state],
  );

  // ── Verification flow ────────────────────────────────────────────────
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
      toast.error(error.message);
      return;
    }

    toast.success("Verification code sent!");
    setState("input");
    setCountdown(RESEND_SECONDS);
  };

  const handleVerify = async () => {
    if (digits.some((d) => !d)) return;
    setState("verifying");
    setErrorMessage(null);

    const token = digits.join("");
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

    if (error) {
      setErrorMessage(error.message);
      toast.error(error.message);
      setState("input");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } else {
      setState("success");
      setTimeout(() => {
        navigate({ to: redirect || "/dashboard" });
      }, 2500);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      setErrorMessage(error.message);
      toast.error(error.message);
      return;
    }

    toast.success("Code resent to your email.");
    setErrorMessage(null);
    setDigits(Array(OTP_LENGTH).fill(""));
    setState("input");
    setCountdown(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  };

  const allFilled = digits.every((d) => d !== "");

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12">
        <div className="flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          <span className="h-px w-10 bg-border" aria-hidden />
          TixNaija / Account
        </div>

        {state === "success" ? (
          <div className="mt-8 rounded-lg border border-border/60 bg-card px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-foreground" aria-hidden />
            <h1 className="mt-4 font-display text-3xl leading-none text-foreground">Verified</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your code was accepted. Taking you to your account…
            </p>
          </div>
        ) : state === "email_input" ? (
          <>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-foreground">
              Sign in
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              Enter your email and we'll send a one-time code. No password to remember.
            </p>

            <form onSubmit={handleRequestOtp} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="otp-email"
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Email address
                </label>
                <div className="relative mt-2">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    id="otp-email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 w-full rounded-md border border-border/70 bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !email}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 press-sm disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <>
                    Send code <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-foreground">
              Check your email
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
              Enter the {OTP_LENGTH}-digit code sent to{" "}
              <strong className="font-semibold text-foreground">{email}</strong>.
            </p>

            <div
              className="mt-7 grid grid-cols-8 gap-1.5"
              onPaste={handlePaste}
              role="group"
              aria-label={`${OTP_LENGTH}-digit verification code`}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  autoComplete={idx === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  value={digit}
                  aria-label={`Digit ${idx + 1} of ${OTP_LENGTH}`}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  disabled={state === "verifying"}
                  className={cn(
                    "h-12 w-full rounded-md border bg-card text-center text-lg font-semibold text-foreground",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50",
                    digit ? "border-foreground/30" : "border-border/70",
                  )}
                />
              ))}
            </div>

            {errorMessage && (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <p className="mt-6 text-[13px] text-muted-foreground" aria-live="polite">
              Didn't get the code?{" "}
              {countdown > 0 ? (
                <span className="font-medium text-foreground">
                  Resend in {formatCountdown(countdown)}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Resend code
                </button>
              )}
            </p>

            <button
              type="button"
              onClick={handleVerify}
              disabled={!allFilled || state === "verifying"}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 press-sm disabled:opacity-50"
            >
              {state === "verifying" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Verifying…
                </>
              ) : (
                "Verify code"
              )}
            </button>
          </>
        )}
      </main>
    </div>
  );
}
