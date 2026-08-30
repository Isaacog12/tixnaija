import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/back-button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset your password — TixNaija" },
      { name: "description", content: "Get a link to reset your TixNaija password." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email").max(255) });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Check your inbox for the reset link.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 gradient-sunset opacity-10" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-baseline justify-center">
          <span className="font-display text-3xl tracking-[0.02em]">TIX</span>
          <span className="font-display text-3xl font-light tracking-[0.02em] text-gradient-sunset">NAIJA</span>
        </Link>
        <div className="rounded-2xl border border-border bg-card/80 p-6 shadow-glow backdrop-blur">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="font-display text-2xl">Forgot password?</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we'll send you a reset link.
          </p>
          {sent ? (
            <div className="mt-6 rounded-lg border border-border bg-background/40 p-4 text-sm">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link is on its way.
              Check your spam folder too.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
              >
                {busy ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{" "}
            <Link to="/auth" className="text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
