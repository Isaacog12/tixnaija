import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { getAuthErrorMessage } from "@/utils/auth-errors";
import { Button } from "@/components/ui/button";

export function SocialLogins({
  mode,
  termsAccepted = true,
  redirectUrl,
}: {
  mode: "signin" | "signup";
  termsAccepted?: boolean;
  redirectUrl?: string;
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
        options: {
          redirectTo: redirectUrl
            ? `${window.location.origin}/auth?redirect=${encodeURIComponent(redirectUrl)}`
            : `${window.location.origin}/auth`,
        },
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
          search={redirectUrl ? { redirect: redirectUrl } : undefined}
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
