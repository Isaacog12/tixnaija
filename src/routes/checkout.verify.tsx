import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/checkout/verify")({
  component: VerifyCheckoutPage,
});

function VerifyCheckoutPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const reference = searchParams.get("reference") || searchParams.get("trxref");
  
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id || null));
  }, []);

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      setErrorMsg("No payment reference found.");
      return;
    }

    async function verify() {
      try {
        if (reference!.startsWith("TEST_ORD_")) {
          // If it's a test order, it was already processed successfully via RPC
          setStatus("success");
        } else {
          const { data, error } = await supabase.functions.invoke("verify-payment", {
            body: { reference }
          });

          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          setStatus("success");
        }
      } catch (err: any) {
        console.error("Verification error:", err);
        setStatus("error");
        setErrorMsg(err.message || "Failed to verify payment");
      }
    }

    verify();
  }, [reference]);

  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
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
            
            {userId ? (
              <>
                <p className="mt-2 text-muted-foreground">
                  Your tickets have been generated. We've sent them to your inbox.
                </p>
                <Button asChild className="mt-8 w-full gradient-sunset" size="lg">
                  <Link to="/inbox">Go to Inbox</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="mt-2 text-muted-foreground">
                  Your tickets were emailed to you. You can also view and download them right here using your email and the <strong>Access PIN</strong> you just created.
                </p>
                <Button asChild className="mt-6 w-full gradient-sunset shadow-glow" size="lg">
                  <Link to="/my-tickets">View My Tickets</Link>
                </Button>
                <p className="mt-4 text-xs text-muted-foreground">
                  Want everything in one place?{" "}
                  <Link to="/auth" search={{ mode: "signup" }} className="text-primary hover:underline">
                    Create a free account
                  </Link>
                  {" "}with the email you used at checkout.
                </p>
              </>
            )}
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
