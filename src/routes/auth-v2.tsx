import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";

import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { useHashErrorHandler } from "@/hooks/useHashErrorHandler";

import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth-v2")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  head: () => ({
    meta: [{ title: "Welcome to TixNaija" }],
  }),
  component: AuthV2Page,
});

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, bounce: 0, duration: 0.6, delay: i * 0.1 },
  }),
};

function AuthV2Page() {
  const { mode, redirect } = Route.useSearch();
  const isSignUp = mode === "signup";

  useRedirectIfAuthenticated(redirect);
  useHashErrorHandler();

  const variants = {
    initial: { opacity: 0, x: 20, filter: "blur(4px)" },
    animate: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: { opacity: 0, x: -20, filter: "blur(4px)" },
  };

  return (
    <div className="min-h-dvh flex bg-[#050505] text-white font-sans overflow-hidden">
      
      {/* LEFT: Cinematic Editorial Graphic (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/5">
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1459749411175-04bf5292ceea?q=80&w=2070&auto=format&fit=crop"
            alt="Concert crowd"
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
              The stage is yours.<br />
              <span className="text-white/40">Step into the spotlight.</span>
            </motion.h1>
            <motion.p variants={fadeUp} className="text-white/50 text-lg leading-relaxed">
              Join thousands of creators and attendees powering the future of live events across Nigeria.
            </motion.p>
          </motion.div>
        </div>
      </div>

      {/* RIGHT: Form Container */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-[420px] relative z-10">
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
              {isSignUp ? (
                <motion.div
                  key="signup"
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                >
                  <div className="mb-8">
                    <h2 className="font-display text-3xl tracking-tight text-white mb-2">Create Account</h2>
                    <p className="text-white/50 text-sm">Join us today to access your secure workspace.</p>
                  </div>
                  {/* We wrap the existing form. Note: You may need to tweak the internal form's CSS to fit the dark theme perfectly. */}
                  <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:h-12 [&_input:focus]:border-orange-500/50 [&_button[type='submit']]:bg-orange-600 [&_button[type='submit']]:hover:bg-orange-500 [&_button[type='submit']]:text-white [&_button[type='submit']]:h-12 [&_button[type='submit']]:rounded-xl [&_p.text-muted-foreground]:text-white/40">
                    <SignUpForm redirectUrl={redirect} />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="signin"
                  variants={variants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                >
                  <div className="mb-8">
                    <h2 className="font-display text-3xl tracking-tight text-white mb-2">Welcome Back</h2>
                    <p className="text-white/50 text-sm">Enter your credentials to access your account.</p>
                  </div>
                  <div className="[&_label]:text-white/70 [&_input]:bg-white/5 [&_input]:border-white/10 [&_input]:text-white [&_input]:h-12 [&_input:focus]:border-orange-500/50 [&_button[type='submit']]:bg-orange-600 [&_button[type='submit']]:hover:bg-orange-500 [&_button[type='submit']]:text-white [&_button[type='submit']]:h-12 [&_button[type='submit']]:rounded-xl [&_p.text-muted-foreground]:text-white/40 [&_a]:text-orange-500 [&_a:hover]:text-orange-400">
                    <SignInForm redirectUrl={redirect} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          <div className="mt-8 text-center">
            {isSignUp ? (
              <p className="text-sm text-white/40">
                Already have an account?{" "}
                <Link to="/auth-v2" search={{ mode: "signin", redirect }} className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="text-sm text-white/40">
                Don't have an account?{" "}
                <Link to="/auth-v2" search={{ mode: "signup", redirect }} className="text-orange-500 hover:text-orange-400 font-medium transition-colors">
                  Sign up
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
