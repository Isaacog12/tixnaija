import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BackButton } from "@/components/back-button";

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
  const [isSignUp, setIsSignUp] = useState(mode === "signup");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // If already signed in, bounce to dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }: { data: any }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  // Listen for OAuth errors in the URL hash fragment
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.substring(1));
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        toast.error(errorDesc.replace(/\+/g, " "));
        // Clean the hash so it doesn't stay in the URL
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background/50 p-4 sm:p-8">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 gradient-sunset opacity-5" />
      
      {/* Main Container */}
      <div className="relative w-full max-w-[1000px] h-[650px] bg-card rounded-[2rem] border border-border/50 shadow-2xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Mobile View: Just a stacking card that toggles (hidden on md+) */}
        <div className="md:hidden flex-1 flex flex-col items-center justify-center p-6 w-full h-full overflow-y-auto">
          <Link to="/" className="mb-8 flex items-baseline justify-center">
            <span className="font-display text-4xl leading-none tracking-[0.02em]">TIX</span>
            <span className="font-display text-4xl leading-none font-light tracking-[0.02em] text-gradient-sunset">NAIJA</span>
          </Link>
          <div className="w-full max-w-sm">
            <div className="flex items-center gap-4 mb-2">
              <BackButton />
              <h1 className="text-2xl font-semibold tracking-tight">
                {isSignUp ? "Create Account" : "Sign In"}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {isSignUp ? "Enter your details to get started." : "Welcome back! Please enter your details."}
            </p>
            <EmailForm mode={isSignUp ? "signup" : "signin"} termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} />
            <div className="my-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
            </div>
            <GoogleButton mode={isSignUp ? "signup" : "signin"} termsAccepted={termsAccepted} />
            <div className="mt-8 text-center text-sm text-muted-foreground">
              {isSignUp ? (
                <>Already have an account? <button onClick={() => setIsSignUp(false)} className="font-medium text-primary hover:underline">Sign in</button></>
              ) : (
                <>Don't have an account? <button onClick={() => setIsSignUp(true)} className="font-medium text-primary hover:underline">Sign up</button></>
              )}
            </div>
          </div>
        </div>

        {/* Desktop View: Sliding Panels (hidden on mobile) */}
        
        {/* The Forms Container - Slides left or right */}
        <div 
          className={`hidden md:block absolute top-0 h-full w-1/2 transition-transform duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] z-10 bg-card
          ${isSignUp ? "translate-x-0" : "translate-x-full"}`}
        >
          {/* Sign Up Form (Left Side content) */}
          <div className={`absolute inset-0 flex flex-col justify-center p-12 lg:p-16 transition-all duration-[700ms] delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${isSignUp ? 'opacity-100 z-20 translate-x-0' : 'opacity-0 z-0 pointer-events-none -translate-x-12'}`}>
            <Link to="/" className="absolute top-8 left-8 flex items-baseline">
              <span className="font-display text-2xl leading-none tracking-[0.02em]">TIX</span>
              <span className="font-display text-2xl leading-none font-light tracking-[0.02em] text-gradient-sunset">NAIJA</span>
            </Link>
            <h2 className="text-3xl font-display mb-2">Create Account</h2>
            <p className="text-sm text-muted-foreground mb-8">Enter your details to get started.</p>
            
            <EmailForm mode="signup" termsAccepted={termsAccepted} setTermsAccepted={setTermsAccepted} />
            
            <div className="my-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
            </div>
            
            <GoogleButton mode="signup" termsAccepted={termsAccepted} />
          </div>

          {/* Sign In Form (Right Side content) */}
          <div className={`absolute inset-0 flex flex-col justify-center p-12 lg:p-16 transition-all duration-[700ms] delay-100 ease-[cubic-bezier(0.16,1,0.3,1)] ${!isSignUp ? 'opacity-100 z-20 translate-x-0' : 'opacity-0 z-0 pointer-events-none translate-x-12'}`}>
            <Link to="/" className="absolute top-8 right-8 flex items-baseline">
              <span className="font-display text-2xl leading-none tracking-[0.02em]">TIX</span>
              <span className="font-display text-2xl leading-none font-light tracking-[0.02em] text-gradient-sunset">NAIJA</span>
            </Link>
            <h2 className="text-3xl font-display mb-2">Welcome Back</h2>
            <p className="text-sm text-muted-foreground mb-8">Please enter your details to sign in.</p>
            
            <EmailForm mode="signin" />
            
            <div className="my-6 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or continue with <span className="h-px flex-1 bg-border" />
            </div>
            
            <GoogleButton mode="signin" />
          </div>
        </div>

        {/* The Illustration Overlay - Slides opposite to the forms */}
        <div 
          className={`hidden md:block absolute top-0 h-full w-1/2 transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] z-20 overflow-hidden shadow-2xl
          ${isSignUp ? "translate-x-full" : "translate-x-0"}`}
        >
          <div className="relative h-full w-full bg-muted">
            {/* The background image */}
            <img 
              src="/auth-illustration.png" 
              alt="Party scene" 
              className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isSignUp ? 'scale-100' : 'scale-110'}`} 
            />
            {/* Dark/color overlay for text readability */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div className="absolute inset-0 gradient-sunset mix-blend-multiply opacity-60" />
            
            {/* Text & Toggle Button for Sign In (Visible when signing up) */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white transition-all duration-[600ms] delay-200 ${isSignUp ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
              <h2 className="font-display text-4xl mb-4">Already a member?</h2>
              <p className="mb-8 text-white/80 max-w-sm">
                To keep connected with us and discover more amazing events, please log in with your personal info.
              </p>
              <Button 
                variant="outline" 
                size="lg"
                className="rounded-full border-white/50 text-white bg-white/10 backdrop-blur-md hover:bg-white hover:text-black transition-all px-12"
                onClick={() => setIsSignUp(false)}
              >
                Sign In
              </Button>
            </div>
            
            {/* Text & Toggle Button for Sign Up (Visible when signing in) */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 text-center text-white transition-all duration-[600ms] delay-200 ${!isSignUp ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
              <h2 className="font-display text-4xl mb-4">New here?</h2>
              <p className="mb-8 text-white/80 max-w-sm">
                Join thousands of Nigerians discovering and creating the best events across the country.
              </p>
              <Button 
                variant="outline"
                size="lg"
                className="rounded-full border-white/50 text-white bg-white/10 backdrop-blur-md hover:bg-white hover:text-black transition-all px-12"
                onClick={() => setIsSignUp(true)}
              >
                Sign Up
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
  fullName: z.string().trim().max(80).optional(),
});

function EmailForm({ mode, termsAccepted, setTermsAccepted }: { mode: "signin" | "signup", termsAccepted?: boolean, setTermsAccepted?: (val: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ email, password, fullName: mode === "signup" ? fullName : undefined });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    if (mode === "signup" && !termsAccepted) {
      toast.error("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.fullName ?? "" },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Chidera Okoye" />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {mode === "signin" && (
          <div className="pt-1 text-right">
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
              Forgot password?
            </Link>
          </div>
        )}
      </div>

      {mode === "signup" && setTermsAccepted && (
        <div className="flex items-start gap-2 border-t border-border pt-4 mt-2">
          <input 
            type="checkbox" 
            id="auth-terms" 
            required
            className="mt-1"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
          />
          <Label htmlFor="auth-terms" className="text-xs text-muted-foreground leading-relaxed">
            I agree to the <Link to="/terms" target="_blank" className="text-primary hover:underline">Terms of Service</Link> and <Link to="/privacy" target="_blank" className="text-primary hover:underline">Privacy Policy</Link>.
          </Label>
        </div>
      )}

      <Button
        type="submit"
        disabled={busy || (mode === "signup" && !termsAccepted)}
        className="w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 press-sm transition-all duration-[120ms]"
      >
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}

function GoogleButton({ mode, termsAccepted }: { mode: "signin" | "signup", termsAccepted?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function onGoogle() {
    if (mode === "signup" && !termsAccepted) {
      toast.error("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth`
        }
      });
      if (error) {
        toast.error(error.message ?? "Google sign-in failed");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button 
      variant="outline" 
      className="w-full bg-white text-black border-gray-300 hover:bg-gray-50 shadow-sm disabled:opacity-50 press-sm transition-transform duration-[120ms]" 
      onClick={onGoogle} 
      disabled={busy || (mode === "signup" && !termsAccepted)}
    >
      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      {busy ? "Opening Google…" : "Continue with Google"}
    </Button>
  );
}
