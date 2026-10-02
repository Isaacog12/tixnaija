import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { motion, AnimatePresence } from "motion/react";

import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { useHashErrorHandler } from "@/hooks/useHashErrorHandler";

import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode, redirect } = Route.useSearch();
  const isSignUp = mode === "signup";

  useRedirectIfAuthenticated(redirect);
  useHashErrorHandler();

  // Liquid Transition Settings
  const variants = {
    initial: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-zinc-50/50 dark:bg-background p-4 sm:p-8 pt-safe pb-safe overflow-hidden font-sans">
      {/* Background Cinematic Glows */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 w-[500px] h-[500px] bg-blue-500/10 dark:bg-white/5 rounded-full blur-[100px] dark:blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 w-[400px] h-[400px] bg-purple-500/10 dark:bg-primary/10 rounded-full blur-[80px] dark:blur-[100px]" />

      {/* True Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[460px] p-8 sm:p-10 shadow-[0_8px_40px_rgb(0,0,0,0.04)] dark:shadow-2xl rounded-[2.5rem] bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl border border-white dark:border-white/10"
      >
        <AnimatePresence mode="wait">
          {isSignUp ? (
            <motion.div
              key="signup"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight mb-2">
                  Create Account
                </h1>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Join us today to access your secure workspace
                </p>
              </div>
              <SignUpForm redirectUrl={redirect} />
            </motion.div>
          ) : (
            <motion.div
              key="signin"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.35, ease: "easeInOut" }}
            >
              <div className="mb-8 text-center">
                <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white tracking-tight mb-2">
                  Welcome Back
                </h1>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Enter your credentials to access your secure account
                </p>
              </div>
              <SignInForm redirectUrl={redirect} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
