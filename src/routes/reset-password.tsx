import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/back-button";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Set a new password — TixNaija" },
      { name: "description", content: "Choose a new password for your TixNaija account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const schema = z.object({
  password: z.string().min(6, "At least 6 characters").max(72),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Supabase sends users here from the reset email; the client picks up the
  // recovery token from the URL hash and creates a temporary session.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      toast.success("Password updated. You're signed in.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 gradient-sunset opacity-10" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mb-6 flex items-baseline justify-center">
          <span className="font-display text-3xl tracking-[0.02em]">TIX</span>
          <span className="font-display text-3xl font-light tracking-[0.02em] text-gradient-sunset">NAIJA</span>
        </Link>
        <div className="rounded-2xl border border-border/50 bg-card/80 p-6 shadow-2xl backdrop-blur">
          <div className="flex items-center gap-4">
            <BackButton />
            <h1 className="font-display text-2xl">Set a new password</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick something you'll remember this time.
          </p>

          {!ready ? (
            <div className="mt-6 rounded-lg border border-border bg-background/40 p-4 text-sm text-muted-foreground">
              Waiting for your reset link… Open this page from the email we sent you.
              If you got here by mistake,{" "}
              <Link to="/forgot-password" className="text-primary hover:underline">
                request a new link
              </Link>
              .
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 press-sm transition-all duration-[120ms]"
              >
                {busy ? "Saving…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
