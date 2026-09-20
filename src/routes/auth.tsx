import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2, AtSign } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const isSignUp = mode === "signup";

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session) navigate({ to: "/dashboard", replace: true });
      })
      .catch((err: unknown) => {
        console.error("Failed to check session:", err);
        toast.error(getAuthErrorMessage(err));
      });
  }, [navigate]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        toast.error(getAuthErrorMessage(errorDesc.replace(/\+/g, " ")));
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  // Liquid Transition Settings
  const variants = {
    initial: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, scale: 0.96, filter: "blur(4px)" },
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4 sm:p-8 pt-safe pb-safe overflow-hidden font-sans">
      {/* Background Cinematic Glows */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      {/* True Glassmorphism Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[460px] p-8 sm:p-10 shadow-2xl rounded-[2.5rem] bg-white/[0.03] backdrop-blur-2xl border border-white/10"
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
                <h1 className="text-3xl font-semibold text-white tracking-tight mb-2">
                  Create Account
                </h1>
                <p className="text-sm text-white/50">Join us today to access your secure workspace</p>
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
                <p className="text-sm text-white/50">Enter your credentials to access your secure account</p>
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
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<SigninValues>({
    resolver: zodResolver(signinSchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const rememberMe = watch("rememberMe");

  const onSubmit = async (data: SigninValues) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password: data.password });
      if (error) throw error;
      toast.success("Welcome back!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: unknown) {
      toast.error(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email" className="text-white/70 text-xs uppercase tracking-wider ml-1">Email Address</Label>
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
          <Input 
            id="signin-email" 
            placeholder="name@domain.com" 
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-red-400 ml-1">{errors.email.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signin-password" className="text-white/70 text-xs uppercase tracking-wider ml-1">Password</Label>
        <div className="relative group">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
          <Input 
            id="signin-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••" 
            className="pl-11 pr-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors outline-none"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-red-400 ml-1">{errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between text-sm pt-2">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="remember-me" 
            checked={rememberMe}
            onCheckedChange={(checked) => setValue("rememberMe", checked === true)} 
            className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <label htmlFor="remember-me" className="text-white/70 text-sm cursor-pointer select-none">
            Remember me
          </label>
        </div>
        <Link to="/forgot-password" className="text-white/70 hover:text-white transition-colors">
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-12 mt-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all"
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center text-base">
            Sign In <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        )}
      </Button>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-white/40">OR CONTINUE WITH</span>
        </div>
      </div>

      <SocialLogins mode="signin" />

      <p className="text-center text-sm text-white/50 mt-8">
        Don't have an account?{" "}
        <Link to="/auth" search={{ mode: "signup" }} className="text-white hover:text-primary transition-colors font-medium">
          Sign Up
        </Link>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Sign Up Form
// -----------------------------------------------------------------------------

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
  username: z.string().trim().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine((val) => val === true, {
    message: "You must agree to the Terms & Privacy Policy",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
type SignupValues = z.infer<typeof signupSchema>;

function SignUpForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", username: "", email: "", password: "", confirmPassword: "", termsAccepted: false },
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
      <div className="space-y-1.5">
        <Label htmlFor="signup-name" className="text-white/70 text-xs uppercase tracking-wider ml-1">Full Name</Label>
        <div className="relative group">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
          <Input 
            id="signup-name" 
            placeholder="Alex Johnson" 
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
            {...register("fullName")}
          />
        </div>
        {errors.fullName && <p className="text-xs text-red-400 ml-1">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-username" className="text-white/70 text-xs uppercase tracking-wider ml-1">Username</Label>
        <div className="relative group">
          <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
          <Input 
            id="signup-username" 
            placeholder="alexj" 
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
            {...register("username")}
          />
        </div>
        {errors.username && <p className="text-xs text-red-400 ml-1">{errors.username.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="signup-email" className="text-white/70 text-xs uppercase tracking-wider ml-1">Email Address</Label>
        <div className="relative group">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
          <Input 
            id="signup-email" 
            placeholder="name@domain.com" 
            className="pl-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-red-400 ml-1">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="signup-password" className="text-white/70 text-xs uppercase tracking-wider ml-1">Password</Label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
            <Input 
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••" 
              className="pl-11 pr-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors outline-none"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-red-400 ml-1">{errors.password.message}</p>}
        </div>

        <div className="flex-1 space-y-1.5">
          <Label htmlFor="signup-confirm" className="text-white/70 text-xs uppercase tracking-wider ml-1">Confirm Password</Label>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 group-focus-within:text-white transition-colors" />
            <Input 
              id="signup-confirm"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••" 
              className="pl-11 pr-11 h-12 bg-white/5 border-white/10 rounded-xl text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:border-white/30 transition-all"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors outline-none"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-red-400 ml-1">{errors.confirmPassword.message}</p>}
        </div>
      </div>

      <div className="flex items-start space-x-2 pt-2 pb-2">
        <Checkbox 
          id="terms" 
          checked={termsAccepted}
          onCheckedChange={(checked) => setValue("termsAccepted", checked === true, { shouldValidate: true })}
          className="mt-0.5 border-white/20 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        />
        <div className="grid leading-tight">
          <label htmlFor="terms" className="text-sm text-white/70 cursor-pointer select-none">
            I agree to the Terms & Privacy Policy
          </label>
          {errors.termsAccepted && <p className="text-xs text-red-400 mt-1">{errors.termsAccepted.message}</p>}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !termsAccepted}
        className="w-full h-12 mt-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl shadow-[0_0_20px_hsl(var(--primary)/0.2)] transition-all disabled:opacity-50 disabled:shadow-none"
      >
        {isSubmitting ? (
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        ) : (
          <span className="flex items-center text-base">
            Create Account <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        )}
      </Button>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-3 text-white/40">OR CONTINUE WITH</span>
        </div>
      </div>

      <SocialLogins mode="signup" termsAccepted={termsAccepted} />

      <p className="text-center text-sm text-white/50 mt-8">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "signin" }} className="text-white hover:text-primary transition-colors font-medium">
          Sign In
        </Link>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Social Logins (Google & Apple)
// -----------------------------------------------------------------------------

function SocialLogins({ mode, termsAccepted = true }: { mode: "signin" | "signup", termsAccepted?: boolean }) {
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
          className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 font-semibold text-white transition-all duration-200 hover:bg-white/10 active:scale-[0.98]"
        >
          <Mail className="h-5 w-5 text-white/70" />
          Sign in with Email OTP
        </Link>
      )}

      <Button 
        type="button"
        variant="outline" 
        onClick={() => handleOAuth("google")}
        disabled={isGoogleBusy || (mode === "signup" && !termsAccepted)}
        className="w-full bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl h-12 transition-all"
      >
        {isGoogleBusy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        Google
      </Button>
    </div>
  );
}
