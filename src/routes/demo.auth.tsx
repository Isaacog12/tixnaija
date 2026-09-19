import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

export const Route = createFileRoute("/demo/auth")({
  component: DemoAuthPage,
  head: () => ({
    meta: [
      { title: "Auth Demo — TixNaija" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function DemoAuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[oklch(0.08_0.01_40)] p-4 font-sans">
      {/* ── Background ember glows ───────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Top-left subtle glow */}
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[oklch(0.66_0.22_40/0.08)] blur-[120px]" />
        {/* Bottom-right stronger glow */}
        <div className="absolute -bottom-24 -right-24 h-[400px] w-[400px] rounded-full bg-[oklch(0.5_0.24_15/0.12)] blur-[100px]" />
        {/* Center glow behind card */}
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.66_0.22_40/0.06)] blur-[80px]" />
      </div>

      {/* ── Split Card ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full max-w-[860px] overflow-hidden rounded-3xl border border-white/10 bg-[oklch(0.13_0.02_40/0.85)] shadow-[0_0_60px_-12px_oklch(0.66_0.22_40/0.15),0_0_0_1px_oklch(0.66_0.22_40/0.08)] backdrop-blur-2xl"
        style={{ minHeight: 480 }}
      >
        {/* Red/ember edge glow accent lines */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.66_0.22_40/0.4)] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[oklch(0.5_0.24_15/0.3)] to-transparent" />

        {/* ── Desktop: side-by-side panels ─────────────────────────── */}
        <div className="relative flex w-full flex-col md:flex-row">
          {/* GREETING PANEL */}
          <AnimatePresence mode="wait">
            <motion.div
              key={isSignUp ? "greeting-left" : "greeting-right"}
              initial={{ opacity: 0, x: isSignUp ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignUp ? 40 : -40 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              className={`flex flex-col items-center justify-center px-8 py-12 text-center md:w-1/2 ${
                isSignUp
                  ? "order-1 md:order-1"
                  : "order-1 md:order-2"
              }`}
              style={{
                background: isSignUp
                  ? "linear-gradient(135deg, oklch(0.22 0.08 30 / 0.9) 0%, oklch(0.16 0.06 35 / 0.95) 100%)"
                  : "linear-gradient(135deg, oklch(0.22 0.08 30 / 0.9) 0%, oklch(0.16 0.06 35 / 0.95) 100%)",
              }}
            >
              <motion.h2
                key={isSignUp ? "hello" : "welcome"}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl"
              >
                {isSignUp ? "HELLO, FRIEND!" : "WELCOME BACK!"}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="mt-4 max-w-[260px] text-sm leading-relaxed text-white/60"
              >
                {isSignUp
                  ? "Enter your personal details to start your journey with us."
                  : "To keep connected with us please login with your personal info."}
              </motion.p>
              {/* Toggle button on greeting panel */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                onClick={() => setIsSignUp(!isSignUp)}
                className="mt-8 rounded-full border border-white/20 px-8 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:border-white/40 hover:bg-white/5"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </motion.button>
            </motion.div>
          </AnimatePresence>

          {/* FORM PANEL */}
          <div
            className={`flex flex-1 items-center justify-center px-6 py-10 sm:px-10 md:w-1/2 ${
              isSignUp ? "order-2 md:order-2" : "order-2 md:order-1"
            }`}
          >
            <AnimatePresence mode="wait">
              {isSignUp ? (
                <motion.div
                  key="signup-form"
                  initial={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                  transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                  className="w-full max-w-[340px]"
                >
                  <h2 className="mb-1 text-center text-2xl font-bold text-white">
                    Sign Up
                  </h2>
                  <p className="mb-6 text-center text-sm text-white/40">
                    Create your TixNaija account
                  </p>
                  <SignUpForm />
                  <p className="mt-6 text-center text-sm text-white/40">
                    Already have an account?{" "}
                    <button
                      onClick={() => setIsSignUp(false)}
                      className="font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Login
                    </button>
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="login-form"
                  initial={{ opacity: 0, x: -30, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: 30, filter: "blur(4px)" }}
                  transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                  className="w-full max-w-[340px]"
                >
                  <h2 className="mb-1 text-center text-2xl font-bold text-white">
                    Login
                  </h2>
                  <p className="mb-6 text-center text-sm text-white/40">
                    Welcome back to TixNaija
                  </p>
                  <LoginForm />
                  <p className="mt-6 text-center text-sm text-white/40">
                    Don't have an account?{" "}
                    <button
                      onClick={() => setIsSignUp(true)}
                      className="font-medium text-primary transition-colors hover:text-primary/80"
                    >
                      Sign Up
                    </button>
                  </p>
                  <p className="mt-2 text-center">
                    <button className="text-sm text-primary/70 transition-colors hover:text-primary">
                      Forgot Password?
                    </button>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Login Form
// ─────────────────────────────────────────────────────────────────────────────

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Login successful! (Demo)");
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username / Email */}
      <div className="relative group">
        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-primary" />
        <input
          type="text"
          placeholder="Username"
          required
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Password */}
      <div className="relative group">
        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-primary" />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          required
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-11 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white outline-none"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white shadow-[0_0_20px_oklch(0.66_0.22_40/0.2)] transition-all duration-200 hover:shadow-[0_0_28px_oklch(0.66_0.22_40/0.3)] active:scale-[0.98] disabled:opacity-60 disabled:shadow-none"
        style={{
          background: "linear-gradient(135deg, oklch(0.75 0.18 50) 0%, oklch(0.66 0.22 40) 50%, oklch(0.5 0.24 15) 100%)",
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            Login <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </button>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sign Up Form
// ─────────────────────────────────────────────────────────────────────────────

function SignUpForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Account created! (Demo)");
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Username */}
      <div className="relative group">
        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-primary" />
        <input
          type="text"
          placeholder="Username"
          required
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Email */}
      <div className="relative group">
        <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-primary" />
        <input
          type="email"
          placeholder="Email"
          required
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
      </div>

      {/* Password */}
      <div className="relative group">
        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-primary" />
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          required
          className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-11 text-sm text-white placeholder:text-white/30 outline-none transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors hover:text-white outline-none"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="flex h-12 w-full items-center justify-center rounded-xl font-semibold text-white shadow-[0_0_20px_oklch(0.66_0.22_40/0.2)] transition-all duration-200 hover:shadow-[0_0_28px_oklch(0.66_0.22_40/0.3)] active:scale-[0.98] disabled:opacity-60 disabled:shadow-none"
        style={{
          background: "linear-gradient(135deg, oklch(0.75 0.18 50) 0%, oklch(0.66 0.22 40) 50%, oklch(0.5 0.24 15) 100%)",
        }}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center gap-2">
            Sign Up <ArrowRight className="h-4 w-4" />
          </span>
        )}
      </button>
    </form>
  );
}
