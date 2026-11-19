import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/csat/$token")({
  component: CsatPage,
});

interface CsatCase {
  case_number: string;
  subject: string;
  status: string;
  already_rated: boolean;
  rating: number | null;
}

const SCALE = [
  { value: 1, label: "Bad" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Excellent" },
];

function CsatPage() {
  const { token } = Route.useParams();
  const [detail, setDetail] = useState<CsatCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (supabase.rpc as any)("support_get_csat_case", { p_token: token })
      .then(({ data }: any) => {
        if (!cancelled) setDetail(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (!rating) {
      toast.error("Pick a rating first.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase.rpc as any)("support_submit_csat", {
        p_token: token,
        p_rating: rating,
        p_comment: comment.trim() || null,
      });
      if (error) throw error;
      if (!data?.success) {
        toast.error("This request has already been rated.");
        setDone(true);
        return;
      }
      setDone(true);
    } catch {
      toast.error("Could not save your rating. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60">
          <CardHeader>
            <CardTitle className="text-base">This link is not valid</CardTitle>
            <CardDescription className="text-xs">
              Rating links are single-use and tied to one support request. If you need help,
              reply to the email we sent you or contact support.tixnaija@gmail.com.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done || detail.already_rated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-border/60 text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">Thank you</CardTitle>
            <CardDescription className="text-xs">
              Your feedback on {detail.case_number} is recorded. It goes straight to the team
              that runs support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-emerald-500">
            <ShieldCheck className="h-4 w-4" />
            TixNaija Support
          </div>
          <CardTitle className="text-lg">How did we do?</CardTitle>
          <CardDescription className="text-xs">
            {detail.case_number} · {detail.subject}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {SCALE.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRating(option.value)}
                aria-pressed={rating === option.value}
                className={`rounded-xl border px-1 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  rating === option.value
                    ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:bg-secondary/60"
                }`}
              >
                <span className="block text-sm font-semibold">{option.value}</span>
                <span className="block text-[10px] leading-tight">{option.label}</span>
              </button>
            ))}
          </div>

          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Anything we should have done better? (optional)"
            rows={4}
            maxLength={1000}
            className="rounded-xl text-xs"
          />

          <Button
            onClick={submit}
            disabled={submitting || !rating}
            className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {submitting ? "Saving…" : "Send feedback"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
