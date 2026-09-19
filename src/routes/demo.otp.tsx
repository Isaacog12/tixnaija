import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { KeyRound, ShieldCheck, Loader2, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { SuccessCheckmark } from "@/components/demo/success-checkmark";

export const Route = createFileRoute("/demo/otp")({
  component: DemoOtpPage,
  head: () => ({
    meta: [
      { title: "OTP Demo — TixNaija" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type OtpState = "input" | "verifying" | "success";
const OTP_LENGTH = 4;
const RESEND_SECONDS = 40;

function DemoOtpPage() {
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [state, setState] = useState<OtpState>("input");
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
      pasted.split("").forEach((ch, i) => { arr[i] = ch; });
      setDigits(arr);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    },
    [state],
  );

  // ── Verification flow ────────────────────────────────────────────────
  const handleVerify = () => {
    if (digits.some((d) => !d)) return;
    setState("verifying");
    setTimeout(() => setState("success"), 2200);
  };

  const handleResend = () => {
    if (countdown > 0) return;
    setDigits(Array(OTP_LENGTH).fill(""));
    setState("input");
    setCountdown(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  };

  const allFilled = digits.every((d) => d !== "");

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[oklch(0.08_0.01_40)] p-4 font-sans">
      {/* ── Animated background streaks ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Main ember streak */}
        <div
          className="absolute h-[200%] w-[120px] opacity-20"
          style={{
            background: "linear-gradient(180deg, transparent, oklch(0.66 0.22 40 / 0.6), oklch(0.85 0.15 85 / 0.3), transparent)",
            top: "-50%",
            left: "20%",
            animation: "ember-streak 6s linear infinite",
          }}
        />
        {/* Secondary streak */}
        <div
          className="absolute h-[200%] w-[80px] opacity-15"
          style={{
            background: "linear-gradient(180deg, transparent, oklch(0.85 0.15 85 / 0.5), oklch(0.66 0.22 40 / 0.2), transparent)",
            top: "-50%",
            left: "65%",
            animation: "ember-streak 8s linear 2s infinite",
          }}
        />
        {/* Warm ambient glow */}
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.66_0.22_40/0.05)] blur-[100px]" />
      </div>

      {/* ── Glass Card ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[400px] overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.13_0.02_40/0.7)] p-8 shadow-[0_8px_60px_-12px_oklch(0_0_0/0.5)] backdrop-blur-2xl sm:p-10"
      >
        {/* Top edge glow */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.66_0.22_40/0.3)] to-transparent" />

        <AnimatePresence mode="wait">
          {state === "success" ? (
            /* ── SUCCESS STATE ────────────────────────────────────── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              className="flex flex-col items-center text-center"
            >
              {/* Shield icon */}
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-[oklch(0.65_0.2_145/0.3)] bg-[oklch(0.65_0.2_145/0.1)]">
                <ShieldCheck className="h-6 w-6 text-[oklch(0.65_0.2_145)]" />
              </div>

              <h1 className="text-2xl font-bold text-white">
                Verified{" "}
                <span className="bg-gradient-to-r from-[oklch(0.65_0.2_145)] to-[oklch(0.75_0.18_160)] bg-clip-text text-transparent">
                  Successfully
                </span>
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Your security verification code has been confirmed.
              </p>

              {/* Animated checkmark */}
              <div className="my-8">
                <SuccessCheckmark show size={80} />
              </div>

              {/* Resend line (persists) */}
              <p className="mb-5 text-sm text-white/40">
                Didn't receive the code?{" "}
                <span className="font-semibold text-primary">
                  Resend in {formatCountdown(countdown)}
                </span>
              </p>

              {/* Success button */}
              <button className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[oklch(0.65_0.2_145)] font-semibold text-white shadow-[0_0_20px_oklch(0.65_0.2_145/0.25)] transition-all duration-200 hover:shadow-[0_0_28px_oklch(0.65_0.2_145/0.35)]">
                <Check className="h-4 w-4" />
                Verified & Secured
              </button>
            </motion.div>
          ) : (
            /* ── INPUT / VERIFYING STATE ──────────────────────────── */
            <motion.div
              key="input"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
              className="flex flex-col items-center text-center"
            >
              {/* Key icon */}
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                <KeyRound className="h-6 w-6 text-primary" />
              </div>

              <h1 className="text-2xl font-bold text-white">
                Verify{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.85_0.15_85)] bg-clip-text text-transparent">
                  OTP
                </span>
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Enter the {OTP_LENGTH}-digit security code sent to your device
              </p>

              {/* ── OTP Boxes ──────────────────────────────────────── */}
              <div className="my-8 flex gap-3 sm:gap-4" onPaste={handlePaste}>
                {digits.map((digit, idx) => (
                  <motion.div
                    key={idx}
                    animate={
                      digit
                        ? {
                            boxShadow: "0 0 12px 3px oklch(0.66 0.22 40 / 0.35)",
                            borderColor: "oklch(0.66 0.22 40 / 0.6)",
                          }
                        : {
                            boxShadow: "0 0 0px 0px oklch(0.66 0.22 40 / 0)",
                            borderColor: "oklch(1 0 0 / 0.1)",
                          }
                    }
                    transition={{ duration: 0.25 }}
                    className="rounded-xl border bg-white/5"
                  >
                    <input
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      disabled={state === "verifying"}
                      className="h-14 w-14 rounded-xl bg-transparent text-center text-2xl font-bold text-white outline-none transition-colors placeholder:text-white/15 disabled:opacity-50 sm:h-16 sm:w-16"
                      placeholder="·"
                    />
                  </motion.div>
                ))}
              </div>

              {/* Resend countdown */}
              <p className="mb-6 text-sm text-white/40">
                Didn't receive the code?{" "}
                {countdown > 0 ? (
                  <span className="font-semibold text-primary">
                    Resend in {formatCountdown(countdown)}
                  </span>
                ) : (
                  <button
                    onClick={handleResend}
                    className="font-semibold text-primary transition-colors hover:text-primary/80"
                  >
                    Resend now
                  </button>
                )}
              </p>

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={!allFilled || state === "verifying"}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-[oklch(0.12_0.02_40)] shadow-[0_0_20px_oklch(0.66_0.22_40/0.2)] transition-all duration-200 hover:shadow-[0_0_28px_oklch(0.66_0.22_40/0.3)] active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                style={{
                  background:
                    state === "verifying"
                      ? "oklch(0.66 0.22 40 / 0.7)"
                      : "linear-gradient(135deg, oklch(0.75 0.18 50) 0%, oklch(0.66 0.22 40) 50%, oklch(0.5 0.24 15) 100%)",
                }}
              >
                {state === "verifying" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span className="text-white">Verifying Code…</span>
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
