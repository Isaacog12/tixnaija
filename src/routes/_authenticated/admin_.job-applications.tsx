import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  User,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/admin_/job-applications"
)({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/auth" });

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) throw redirect({ to: "/dashboard" });
  },
  component: JobApplicationsPage,
});

type JobAppStatus = "new" | "reviewed" | "rejected" | "hired";

interface JobApp {
  id: string;
  role_applied_for: string;
  full_name: string;
  email: string;
  phone_number: string;
  cover_message: string | null;
  cv_url: string;
  status: JobAppStatus;
  admin_note: string | null;
  created_at: string;
}

const TABS: { key: JobAppStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "reviewed", label: "Reviewed" },
  { key: "rejected", label: "Rejected" },
  { key: "hired", label: "Hired" },
];

const STATUS_COLORS: Record<JobAppStatus, string> = {
  new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  reviewed: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  hired: "bg-green-500/10 text-green-500 border-green-500/20",
};

// ── Data fetchers ─────────────────────────────────────────────

async function fetchJobApplications(): Promise<Record<JobAppStatus, JobApp[]>> {
  const { data, error } = await (supabase as any)
    .from("job_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const all = (data ?? []) as JobApp[];
  return {
    new: all.filter((a) => a.status === "new"),
    reviewed: all.filter((a) => a.status === "reviewed"),
    rejected: all.filter((a) => a.status === "rejected"),
    hired: all.filter((a) => a.status === "hired"),
  };
}

async function getCvSignedUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from("job-cvs")
    .createSignedUrl(path, 60 * 60); // 1 hour
  return data?.signedUrl ?? "";
}

// ── Page ─────────────────────────────────────────────────────

function JobApplicationsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<JobAppStatus>("new");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-job-applications"],
    queryFn: fetchJobApplications,
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      adminNote,
    }: {
      id: string;
      status: JobAppStatus;
      adminNote: string;
    }) => {
      const { error } = await (supabase as any)
        .from("job_applications")
        .update({ status, admin_note: adminNote || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      const labels: Record<JobAppStatus, string> = {
        new: "marked as New",
        reviewed: "marked as Reviewed",
        rejected: "rejected",
        hired: "marked as Hired 🎉",
      };
      toast.success(`Application ${labels[vars.status]}.`);
      qc.invalidateQueries({ queryKey: ["admin-job-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-muted-foreground">
        Loading applications…
      </div>
    );
  if (error)
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );

  const list = data![activeTab];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">Job Applications</h1>
        <p className="mt-2 text-muted-foreground">
          Review applications from candidates who've applied to join TixNaija.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const count = data![key].length;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  activeTab === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-12 text-center">
          <Clock className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No {activeTab} applications.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              isActioning={updateMutation.isPending}
              onUpdateStatus={(id, status, adminNote) =>
                updateMutation.mutate({ id, status, adminNote })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Application Card ─────────────────────────────────────────

function ApplicationCard({
  app,
  isActioning,
  onUpdateStatus,
}: {
  app: JobApp;
  isActioning: boolean;
  onUpdateStatus: (id: string, status: JobAppStatus, adminNote: string) => void;
}) {
  const [expanded, setExpanded] = useState(app.status === "new");
  const [note, setNote] = useState(app.admin_note ?? "");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<JobAppStatus>(app.status);

  async function handleDownloadCv() {
    if (cvUrl) {
      window.open(cvUrl, "_blank");
      return;
    }
    setCvLoading(true);
    try {
      const url = await getCvSignedUrl(app.cv_url);
      if (!url) {
        toast.error("Could not generate CV link. Try again.");
        return;
      }
      setCvUrl(url);
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to load CV.");
    } finally {
      setCvLoading(false);
    }
  }

  function handleSave() {
    onUpdateStatus(app.id, selectedStatus, note);
  }

  const cvFileName = app.cv_url.split("/").pop() ?? "cv";

  return (
    <div className="rounded-2xl border border-border bg-card/60 shadow-sm overflow-hidden transition hover:border-primary/30">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
      >
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">{app.full_name}</span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_COLORS[app.status]}`}
              >
                {app.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {app.role_applied_for} ·{" "}
              {new Date(app.created_at).toLocaleDateString("en-NG", {
                dateStyle: "medium",
              })}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 flex-shrink-0 text-muted-foreground mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground mt-1" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4 space-y-5">
          {/* Contact info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={app.email} />
            <InfoRow icon={Phone} label="Phone" value={app.phone_number} />
            <InfoRow icon={Briefcase} label="Role" value={app.role_applied_for} />
          </div>

          {/* Cover message */}
          {app.cover_message && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Cover message
              </div>
              <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {app.cover_message}
              </p>
            </div>
          )}

          {/* CV download */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              CV / Resume
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadCv}
              disabled={cvLoading}
              className="flex items-center gap-2"
            >
              {cvLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {cvLoading ? "Generating link…" : `Download CV`}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              {cvFileName} · Signed link valid for 1 hour
            </p>
          </div>

          {/* Admin actions */}
          <div className="border-t border-border pt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Update status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as JobAppStatus)
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
                >
                  {TABS.map(({ key, label }) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Internal note (optional)
              </label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. 'Strong candidate, schedule a call' or 'Not a fit for this cycle'"
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isActioning || selectedStatus === app.status && note === (app.admin_note ?? "")}
              className="gradient-sunset text-primary-foreground font-semibold"
            >
              {isActioning ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </span>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Row ─────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <span className="text-sm text-foreground break-all">{value}</span>
      </div>
    </div>
  );
}
