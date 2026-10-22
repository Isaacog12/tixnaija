import { useState, useEffect } from "react";
import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { z } from "zod";
import { CheckCircle2, AlertCircle, Loader2, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  email: z.string().optional().default(""),
  category: z.string().optional().default("marketing_emails"),
  token: z.string().optional().default(""),
});

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search) => searchSchema.parse(search),
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — TixNaija" },
      { name: "description", content: "Manage your email preferences and unsubscribe from TixNaija marketing communications." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function UnsubscribePage() {
  const { email, category, token } = useSearch({ from: "/unsubscribe" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    email && token ? "loading" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  const displayCategory = category.replace(/_/g, " ");

  useEffect(() => {
    if (!email || !token) {
      setStatus("idle");
      return;
    }

    let isMounted = true;

    async function doUnsubscribe() {
      try {
        const { data, error } = await supabase.functions.invoke("unsubscribe", {
          body: { email, category, token },
        });

        if (!isMounted) return;

        if (error || data?.error) {
          setStatus("error");
          setErrorMessage(error?.message || data?.error || "Could not process request.");
        } else {
          setStatus("success");
        }
      } catch (err: any) {
        if (!isMounted) return;
        setStatus("error");
        setErrorMessage(err.message || "An unexpected error occurred.");
      }
    }

    doUnsubscribe();

    return () => {
      isMounted = false;
    };
  }, [email, category, token]);

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground">
      <SiteNav />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xl text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MailX className="h-8 w-8" />
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Email Preferences
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {email ? (
                <span>
                  Managing updates for <strong className="text-foreground">{email}</strong>
                </span>
              ) : (
                "Update your communication preferences"
              )}
            </p>
          </div>

          {status === "loading" && (
            <div className="py-6 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Unsubscribing you from {displayCategory}...</p>
            </div>
          )}

          {status === "success" && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                <span>Successfully Unsubscribed</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                You will no longer receive {displayCategory} from TixNaija at this address. You will still receive essential transactional emails (like tickets you purchase).
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 space-y-3">
              <div className="flex items-center justify-center gap-2 text-destructive font-semibold text-sm">
                <AlertCircle className="h-5 w-5" />
                <span>Verification Failed</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage || "The link you used may be invalid or expired."}
              </p>
            </div>
          )}

          {status === "idle" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                No active token was detected in your link. If you have an account, you can manage your email preferences anytime directly in your profile.
              </p>
              <Button asChild className="w-full">
                <Link to="/auth" search={{ redirect: "/account?tab=notifications" }}>
                  Sign in to Manage Preferences
                </Link>
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-border/40 flex flex-col gap-2 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground underline">
              Return to TixNaija Home
            </Link>
            <Link to="/privacy" className="hover:text-foreground">
              Privacy Policy
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
