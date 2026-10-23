import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";
import { BackButton } from "@/components/back-button";

import { z } from "zod";

const verifySearchSchema = z.object({
  reference: z.string().optional(),
  trxref: z.string().optional(),
});

export const Route = createFileRoute("/checkout/verify")({
  validateSearch: verifySearchSchema,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
  component: VerifyCheckoutPage,
});

function VerifyCheckoutPage() {
  const searchParams = Route.useSearch();
  const reference = searchParams.reference || searchParams.trxref;
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");


  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }

    async function verify() {
      try {
        const { data, error } = await supabase.functions.invoke("verify-payment", {
          body: { reference }
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setStatus("success");
      } catch (err: any) {
        console.error("Verification error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Payment verification failed. If you were charged, please contact support.");
      }
    }

    verify();
  }, [reference]);

  return (
    <div className="min-h-dvh bg-background">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 pt-6 w-full relative z-20">
        <BackButton />
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-32 text-center">
        {status === "verifying" && (
          <>
            <Loader2 className="mb-6 h-16 w-16 animate-spin text-primary" />
            <h1 className="font-display text-3xl">Verifying Payment...</h1>
            <p className="mt-2 text-muted-foreground">Please wait while we confirm your transaction.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="mb-6 h-16 w-16 text-green-500" />
            <h1 className="font-display text-3xl">Payment Successful!</h1>
            
            <p className="mt-2 text-muted-foreground">
              Your tickets have been generated and sent to your email. You can also view and download them right now in your account.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full">
              <Button asChild className="flex-1 gradient-sunset text-primary-foreground press-sm transition-all duration-[120ms]" size="lg">
                <Link to="/my-tickets">View My Tickets</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1" size="lg">
                <Link to="/notifications">Notifications</Link>
              </Button>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="mb-6 h-16 w-16 text-destructive" />
            <h1 className="font-display text-3xl">Verification Failed</h1>
            <p className="mt-2 text-destructive">{errorMsg}</p>
            <Button asChild className="mt-8 w-full" variant="outline" size="lg">
              <Link to="/">Back to Home</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
