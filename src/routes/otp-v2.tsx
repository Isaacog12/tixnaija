import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { KeyRound, ShieldCheck, Loader2, Check, Mail, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { SuccessCheckmark } from "@/components/demo/success-checkmark";

export const Route = createFileRoute("/otp-v2")({
  validateSearch: z.object({
    email: z.string().email().optional(),
    redirect: z.string().optional(),
  }),
  component: OtpV2Page,
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

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.6, delay: i * 0.1 },
  }),
};

function OtpV2Page() {
  const { email: initialEmail, redirect } = Route.useSearch();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail || "");
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [state, setState] = useState<OtpState>(initialEmail ? "input" : "email_input");
  const [countdown, setCountdown] = useState(initialEmail ? RESEND_SECONDS : 0);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (initialEmail && state === "input" && countdown === RESEND_SECONDS) {
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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
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
    const token = digits.join("");
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    if (error) {
      toast.error(error.message);
      setState("input");
      setDigits(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } else {
      setState("success");
      setTimeout(() => navigate({ to: redirect || "/dashboard-v2" }), 2500);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Code resent to your email.");
    setDigits(Array(OTP_LENGTH).fill(""));
    setState("input");
    setCountdown(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  };

  const allFilled = digits.every((d) => d !== "");
  const variants = {
    initial: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
  };

  return (
    <div className="min-h-dvh flex bg-[#050505] text-white font-sans overflow-hidden">
      {/* LEFT: Cinematic Editorial Graphic (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 z-0">
          <img
            src="/hero-concert.jpg"
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover opacity-40 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a]/80 via-transparent to-[#0a0a0a]" />
          <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-orange-600/20 rounded-full blur-[140px]" />
        </div>
        
        <div className="relative z-10 flex items-center gap-2">
          <Link to="/v2" className="flex items-baseline gap-0 opacity-80 hover:opacity-100 transition-opacity">
            <span className="font-display text-2xl tracking-[0.02em] font-bold text-white">TIX</span>
            <span className="font-display text-2xl tracking-[0.02em] font-light text-white">NAIJA</span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.1 } } }}>
            <motion.h1 variants={fadeUp} className="font-display text-5xl leading-[1.05] tracking-tight text-white mb-6">
              Secure access.<br />
              <span className="text-white/40">Zero passwords.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-white/50 text-lg leading-relaxed">
              We use secure, one-time passcodes to keep your account safe and your sign-ins fast.
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT: OTP Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-[460px] relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-12">
            <Link to="/v2" className="flex items-baseline gap-0">
              <span className="font-display text-3xl tracking-[0.02em] font-bold text-white">TIX</span>
              <span className="font-display text-3xl tracking-[0.02em] font-light text-white">NAIJA</span>
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              {state === "success" ? (
                <motion.div
                  key="success"
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  className="flex flex-col items-center text-center p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-green-500/30 bg-green-500/10">
                    <ShieldCheck className="h-8 w-8 text-green-500" />
                  </div>
                  <h1 className="font-display text-3xl tracking-tight text-white mb-2">Verified Successfully</h1>
                  <p className="text-sm text-white/50 mb-8">Your security verification code has been confirmed.</p>
                  <SuccessCheckmark show size={80} />
                  <div className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-500/20 text-green-400 font-semibold">
                    <Check className="h-4 w-4" /> Secured
                  </div>
                </motion.div>
              ) : state === "email_input" ? (
                <motion.div
                  key="email_input"
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                  <div className="mb-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
                      <Mail className="h-5 w-5 text-orange-500" />
                    </div>
                    <h2 className="font-display text-3xl tracking-tight text-white mb-2">Sign in with OTP</h2>
                    <p className="text-white/50 text-sm">Enter your email address to receive a secure login code.</p>
                  </div>
                  <form onSubmit={handleRequestOtp} className="space-y-4">
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60 transition-colors group-focus-within:text-orange-500" />
                      <input
                        type="email"
                        placeholder="name@domain.com"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-white placeholder:text-white/60 outline-none transition-all duration-200 focus:border-orange-500/50"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !email}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-200 hover:from-orange-500 hover:to-orange-400 active:scale-[0.98] disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><ArrowRight className="h-4 w-4" /> Send Code</>}
                    </button>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="input"
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="p-8 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                  <div className="mb-8">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/10">
                      <KeyRound className="h-5 w-5 text-orange-500" />
                    </div>
                    <h2 className="font-display text-3xl tracking-tight text-white mb-2">Verify OTP</h2>
                    <p className="text-white/50 text-sm">
                      Enter the {OTP_LENGTH}-digit security code sent to <br/><strong className="text-white/80">{email}</strong>
                    </p>
                  </div>
                  <div className="mb-8 flex w-full justify-between gap-1 sm:gap-2" onPaste={handlePaste}>
                    {digits.map((digit, idx) => (
                      <motion.div
                        key={idx}
                        animate={digit ? { borderColor: "rgba(249,115,22,0.5)", backgroundColor: "rgba(249,115,22,0.1)" } : { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)" }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 rounded-lg border"
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
                          className="h-10 w-full sm:h-12 rounded-lg bg-transparent text-center text-lg sm:text-xl font-bold text-white outline-none placeholder:text-white/15 disabled:opacity-50"
                          placeholder="·"
                        />
                      </motion.div>
                    ))}
                  </div>
                  <p className="mb-6 text-sm text-white/40 text-center">
                    Didn't receive the code?{" "}
                    {countdown > 0 ? (
                      <span className="font-semibold text-orange-500">Resend in {formatCountdown(countdown)}</span>
                    ) : (
                      <button onClick={handleResend} className="font-semibold text-orange-500 transition-colors hover:text-orange-400">Resend now</button>
                    )}
                  </p>
                  <button
                    onClick={handleVerify}
                    disabled={!allFilled || state === "verifying"}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-200 hover:from-orange-500 hover:to-orange-400 active:scale-[0.98] disabled:opacity-50"
                  >
                    {state === "verifying" ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</> : "Verify Code"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
