import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Loader2, User, AtSign } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { useRedirectIfAuthenticated } from "@/hooks/useRedirectIfAuthenticated";
import { useHashErrorHandler } from "@/hooks/useHashErrorHandler";
import { usePasswordVisibility } from "@/hooks/usePasswordVisibility";

import { AuthField } from "@/components/auth/AuthField";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Divider } from "@/components/auth/Divider";
import { SubmitButton } from "@/components/auth/SubmitButton";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const isSignUp = mode === "signup";

  useRedirectIfAuthenticated();
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
              <SignUpForm />
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
                <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">
                  Welcome Back
                </h1>
                <p className="text-sm text-zinc-500 dark:text-white/50">
                  Enter your credentials to access your secure account
                </p>
              </div>
              <SignInForm />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sign In Form
// -----------------------------------------------------------------------------

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
type SigninValues = z.infer<typeof signinSchema>;

function SignInForm() {
  const navigate = useNavigate();
  const { showPassword, togglePasswordVisibility } = usePasswordVisibility();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = async (data: SigninValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <AuthField
        id="signin-email"
        label="Email Address"
        icon={Mail}
        placeholder="name@domain.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <PasswordInput
        id="signin-password"
        label="Password"
        placeholder="••••••••"
        showPassword={showPassword}
        onToggleVisibility={togglePasswordVisibility}
        error={errors.password?.message}
        {...register("password")}
      />

      <div className="flex items-center justify-between text-sm pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember-me"
            checked={rememberMe}
            onCheckedChange={(checked) => setValue("rememberMe", checked === true)}
            className="border-black/20 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <label
            htmlFor="remember-me"
            className="text-zinc-600 dark:text-white/70 text-sm cursor-pointer select-none"
          >
            Remember me
          </label>
        </div>
        <Link
          to="/forgot-password"
          className="text-zinc-600 dark:text-white/70 hover:text-zinc-900 dark:hover:text-white transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      <SubmitButton isSubmitting={isSubmitting} text="Sign In" />

      <Divider />

      <SocialLogins mode="signin" />

      <p className="text-center text-sm text-zinc-500 dark:text-white/50 mt-8">
        Don't have an account?{" "}
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="text-zinc-900 dark:text-white hover:text-primary transition-colors font-medium"
        >
          Sign Up
        </Link>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Sign Up Form
// -----------------------------------------------------------------------------

const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(6, "At least 6 characters"),
    confirmPassword: z.string(),
    termsAccepted: z.boolean().refine((val) => val === true, {
      message: "You must agree to the Terms & Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type SignupValues = z.infer<typeof signupSchema>;

function SignUpForm() {
  const navigate = useNavigate();
  const { showPassword, togglePasswordVisibility: togglePassword } = usePasswordVisibility();
  const { showPassword: showConfirmPassword, togglePasswordVisibility: toggleConfirmPassword } =
    usePasswordVisibility();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
    },
  });

  const termsAccepted = watch("termsAccepted");

  const onSubmit = async (data: SignupValues) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: data.fullName, username: data.username },
        },
      });
      if (error) throw error;
      toast.success("Account created! You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <AuthField
        id="signup-name"
        label="Full Name"
        icon={User}
        placeholder="Alex Johnson"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      <AuthField
        id="signup-username"
        label="Username"
        icon={AtSign}
        placeholder="alexj"
        error={errors.username?.message}
        {...register("username")}
      />

      <AuthField
        id="signup-email"
        label="Email Address"
        icon={Mail}
        placeholder="name@domain.com"
        error={errors.email?.message}
        {...register("email")}
      />

      <div className="flex flex-col sm:flex-row gap-4">
        <PasswordInput
          id="signup-password"
          label="Password"
          placeholder="••••••••"
          showPassword={showPassword}
          onToggleVisibility={togglePassword}
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordInput
          id="signup-confirm"
          label="Confirm Password"
          placeholder="••••••••"
          showPassword={showConfirmPassword}
          onToggleVisibility={toggleConfirmPassword}
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />
      </div>

      <div className="flex items-start space-x-2 pt-2 pb-2">
        <Checkbox
          id="terms"
          checked={termsAccepted}
          onCheckedChange={(checked) =>
            setValue("termsAccepted", checked === true, { shouldValidate: true })
          }
          className="mt-0.5 border-black/20 dark:border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <div className="grid leading-tight">
          <label
            htmlFor="terms"
            className="text-sm text-zinc-600 dark:text-white/70 cursor-pointer select-none"
          >
            I agree to the Terms & Privacy Policy
          </label>
          {errors.termsAccepted && (
            <p className="text-xs text-red-400 mt-1">{errors.termsAccepted.message}</p>
          )}
        </div>
      </div>

      <SubmitButton
        isSubmitting={isSubmitting}
        disabled={!termsAccepted}
        text="Create Account"
        className="!mt-2"
      />

      <Divider />

      <SocialLogins mode="signup" termsAccepted={termsAccepted} />

      <p className="text-center text-sm text-zinc-500 dark:text-white/50 mt-8">
        Already have an account?{" "}
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="text-zinc-900 dark:text-white hover:text-primary transition-colors font-medium"
        >
          Sign In
        </Link>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Social Logins (Google & Apple)
// -----------------------------------------------------------------------------

function SocialLogins({
  mode,
  termsAccepted = true,
}: {
  mode: "signin" | "signup";
  termsAccepted?: boolean;
}) {
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);

  const handleOAuth = async (provider: "google") => {
    if (mode === "signup" && !termsAccepted) {
      toast.error("You must agree to the Terms & Privacy Policy.");
      return;
    }

    setIsGoogleBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (error: unknown) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {mode === "signin" && (
        <Link
          to="/otp"
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm dark:shadow-none font-semibold text-zinc-900 dark:text-white transition-all duration-200 hover:bg-zinc-50 dark:hover:bg-white/10 active:scale-[0.98]"
        >
          <Mail className="h-5 w-5 text-zinc-600 dark:text-white/70" />
          Sign in with Email OTP
        </Link>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => handleOAuth("google")}
        disabled={isGoogleBusy || (mode === "signup" && !termsAccepted)}
        className="w-full bg-white dark:bg-white/5 shadow-sm dark:shadow-none border-black/10 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20 text-zinc-900 dark:text-white rounded-xl h-12 transition-all"
      >
        {isGoogleBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Google
      </Button>
    </div>
  );
}
