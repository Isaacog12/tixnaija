import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { supabase } from "@/integrations/supabase/client";
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

  // If already signed in, bounce to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        toast.error(errorDesc.replace(/\+/g, " "));
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background p-4 sm:p-8 pt-safe pb-safe overflow-hidden">
      {/* Subtle brand-colored ambient glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] opacity-70" />
      
      {/* Glass Card with clipped corners */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[480px] glass p-8 sm:p-10 shadow-2xl"
        style={{
          clipPath: "polygon(32px 0, 100% 0, 100% calc(100% - 32px), calc(100% - 32px) 100%, 0 100%, 0 32px)",
          border: "1px solid rgba(255, 255, 255, 0.08)"
        }}
      >
        {/* Corner accents to emphasize the clipped path */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/20 opacity-50" style={{ transform: "translate(-1px, -1px)" }} />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/20 opacity-50" style={{ transform: "translate(1px, 1px)" }} />

        {/* Form Container with animated mounting */}
        <AnimatePresence mode="wait">
          {isSignUp ? (
            <motion.div
              key="signup"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-display mb-2">
                  <span className="text-foreground">Create</span> <span className="text-primary">Account</span>
                </h1>
                <p className="text-sm text-muted-foreground">Join us today to access your secure workspace</p>
              </div>
              <SignUpForm />
            </motion.div>
          ) : (
            <motion.div
              key="signin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-display mb-2">
                  <span className="text-foreground">Welcome</span> <span className="text-primary">Back</span>
                </h1>
                <p className="text-sm text-muted-foreground">Enter your credentials to access your secure account</p>
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email Address</Label>
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            id="signin-email" 
            placeholder="name@domain.com" 
            className="pl-9 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <div className="relative group">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            id="signin-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••" 
            className="pl-9 pr-10 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:text-primary"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <div className="flex items-center justify-between text-sm pt-1">
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="remember-me" 
            checked={rememberMe}
            onCheckedChange={(checked) => setValue("rememberMe", checked === true)} 
          />
          <label htmlFor="remember-me" className="text-muted-foreground font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none">
            Remember me
          </label>
        </div>
        <Link to="/forgot-password" className="text-muted-foreground hover:text-primary transition-colors">
          Forgot password?
        </Link>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full mt-2 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 press-sm transition-all duration-300 font-medium h-11"
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </span>
        ) : (
          <span className="flex items-center">
            Sign In <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        )}
      </Button>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">OR CONTINUE WITH</span>
        </div>
      </div>

      <GoogleOAuthButton mode="signin" />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Don't have an account?{" "}
        <Link to="/auth" search={{ mode: "signup" }} className="text-primary hover:underline font-medium">
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
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "", confirmPassword: "", termsAccepted: false },
  });

  // Watch terms to disable button if unchecked (in addition to resolver validation)
  const termsAccepted = watch("termsAccepted");

  const onSubmit = async (data: SignupValues) => {
    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { full_name: data.fullName },
        },
      });
      if (error) throw error;
      toast.success("Account created! You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign up failed");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full Name</Label>
        <div className="relative group">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            id="signup-name" 
            placeholder="Alex Johnson" 
            className="pl-9 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
            {...register("fullName")}
          />
        </div>
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email Address</Label>
        <div className="relative group">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input 
            id="signup-email" 
            placeholder="name@domain.com" 
            className="pl-9 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 space-y-2">
          <Label htmlFor="signup-password">Password</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••" 
              className="pl-9 pr-10 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:text-primary"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div className="flex-1 space-y-2">
          <Label htmlFor="signup-confirm">Confirm Password</Label>
          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              id="signup-confirm"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••" 
              className="pl-9 pr-10 bg-background/50 border-white/10 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all"
              {...register("confirmPassword")}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:text-primary"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
      </div>

      <div className="flex items-start space-x-2 pt-2">
        <Checkbox 
          id="terms" 
          checked={termsAccepted}
          onCheckedChange={(checked) => setValue("termsAccepted", checked === true, { shouldValidate: true })}
          className="mt-1"
        />
        <div className="grid leading-tight">
          <label htmlFor="terms" className="text-sm text-muted-foreground font-medium cursor-pointer select-none">
            I agree to the Terms & Privacy Policy
          </label>
          {errors.termsAccepted && <p className="text-xs text-destructive mt-1">{errors.termsAccepted.message}</p>}
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !termsAccepted}
        className="w-full mt-2 gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 press-sm transition-all duration-300 font-medium h-11"
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </span>
        ) : (
          <span className="flex items-center">
            Create Account <ArrowRight className="ml-2 h-4 w-4" />
          </span>
        )}
      </Button>

      <div className="relative py-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">OR SIGN UP WITH</span>
        </div>
      </div>

      <GoogleOAuthButton mode="signup" termsAccepted={termsAccepted} />

      <p className="text-center text-sm text-muted-foreground mt-6">
        Already have an account?{" "}
        <Link to="/auth" search={{ mode: "signin" }} className="text-primary hover:underline font-medium">
          Sign In
        </Link>
      </p>
    </form>
  );
}

// -----------------------------------------------------------------------------
// Google OAuth Button
// -----------------------------------------------------------------------------

function GoogleOAuthButton({ mode, termsAccepted = true }: { mode: "signin" | "signup", termsAccepted?: boolean }) {
  const [isGoogleBusy, setIsGoogleBusy] = useState(false);

  const handleGoogleAuth = async () => {
    if (mode === "signup" && !termsAccepted) {
      toast.error("You must agree to the Terms & Privacy Policy.");
      return;
    }
    setIsGoogleBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`,
        },
      });
      if (error) {
        toast.error(error.message ?? "Google sign-in failed");
      }
    } finally {
      setIsGoogleBusy(false);
    }
  };

  return (
    <Button 
      type="button"
      variant="outline" 
      onClick={handleGoogleAuth}
      disabled={isGoogleBusy || (mode === "signup" && !termsAccepted)}
      className="w-full bg-background/30 border-white/10 hover:bg-background/50 hover:border-white/20 text-foreground transition-all duration-300 press-sm h-11"
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
  );
}
