import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  User,
  Phone,
  Mail,
  Link2,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/admin/organizer-applications"
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
  component: OrganizerApplicationsPage,
});

type AppStatus = "pending" | "approved" | "rejected";

interface OrgApp {
  id: string;
  user_id: string;
  full_name: string;
  phone_number: string;
  email: string;
  social_media_link: string | null;
  reason: string;
  id_photo_url: string;
  status: AppStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

async function fetchApplications(): Promise<{
  pending: OrgApp[];
  reviewed: OrgApp[];
}> {
  const { data, error } = await supabase
    .from("organizer_applications" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const all = (data ?? []) as unknown as OrgApp[];
  return {
    pending: all.filter((a) => a.status === "pending"),
    reviewed: all.filter((a) => a.status !== "pending"),
  };
}

async function getSignedUrl(path: string): Promise<string> {
  const { data } = await supabase.storage
    .from("id-photos")
    .createSignedUrl(path, 60 * 60); // 1 hour
  return data?.signedUrl ?? "";
}

function OrganizerApplicationsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-org-applications"],
    queryFn: fetchApplications,
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      note,
    }: {
      id: string;
      note: string;
    }) => {
      const { error } = await supabase.rpc(
        "approve_organizer_application" as any,
        {
          p_application_id: id,
          p_note: note || null,
        }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application approved! The user has been notified.");
      qc.invalidateQueries({ queryKey: ["admin-org-applications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({
      id,
      note,
    }: {
      id: string;
      note: string;
    }) => {
      const { error } = await supabase.rpc(
        "reject_organizer_application" as any,
        {
          p_application_id: id,
          p_note: note || null,
        }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Application rejected. The user has been notified.");
      qc.invalidateQueries({ queryKey: ["admin-org-applications"] });
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

  const list = activeTab === "pending" ? data!.pending : data!.reviewed;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-4xl md:text-5xl">
          Organizer Applications
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review and action pending applications to become an organizer.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        {(["pending", "reviewed"] as const).map((tab) => {
          const count =
            tab === "pending"
              ? data!.pending.length
              : data!.reviewed.length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  activeTab === tab
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
            {activeTab === "pending"
              ? "No pending applications."
              : "No reviewed applications yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onApprove={(id, note) => approveMutation.mutate({ id, note })}
              onReject={(id, note) => rejectMutation.mutate({ id, note })}
              isPending={activeTab === "pending"}
              isActioning={
                approveMutation.isPending || rejectMutation.isPending
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({
  app,
  onApprove,
  onReject,
  isPending,
  isActioning,
}: {
  app: OrgApp;
  onApprove: (id: string, note: string) => void;
  onReject: (id: string, note: string) => void;
  isPending: boolean;
  isActioning: boolean;
}) {
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoAttempted, setPhotoAttempted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function loadPhoto() {
    if (photoUrl || photoLoading || photoAttempted) return;
    setPhotoLoading(true);
    const url = await getSignedUrl(app.id_photo_url);
    setPhotoUrl(url || null);
    setPhotoLoading(false);
    setPhotoAttempted(true);
  }

  function toggle() {
    setExpanded((prev) => !prev);
    if (!expanded) loadPhoto();
  }

  const statusColors: Record<AppStatus, string> = {
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    rejected: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 shadow-sm overflow-hidden transition hover:border-primary/30">
      {/* Header row — always visible */}
      <button
        onClick={toggle}
        className="w-full flex items-start justify-between gap-4 p-5 text-left"
      >
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">
                {app.full_name}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${statusColors[app.status]}`}
              >
                {app.status}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Applied {new Date(app.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}
              {app.reviewed_at && (
                <> · Reviewed {new Date(app.reviewed_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}</>
              )}
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
          {/* Contact info grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={app.email} />
            <InfoRow icon={Phone} label="Phone" value={app.phone_number} />
            {app.social_media_link && (
              <InfoRow
                icon={Link2}
                label="Social"
                value={app.social_media_link}
                isLink
              />
            )}
          </div>

          {/* Reason */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              What they plan to organise
            </div>
            <p className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {app.reason}
            </p>
          </div>

          {/* ID photo */}
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              ID Photo (selfie + government ID)
            </div>
            {photoLoading && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground">
                Loading photo…
              </div>
            )}
            {photoUrl && (
              <a href={photoUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={photoUrl}
                  alt="Applicant ID photo"
                  className="max-h-72 w-full rounded-xl border border-border object-contain bg-muted/20 hover:opacity-90 transition"
                />
              </a>
            )}
            {!photoLoading && !photoUrl && (
              <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 text-xs text-muted-foreground">
                Photo failed to load
              </div>
            )}
          </div>

          {/* Existing admin note (reviewed apps) */}
          {!isPending && app.admin_note && (
            <div>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Review Note
              </div>
              <p className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground/80 italic">
                {app.admin_note}
              </p>
            </div>
          )}

          {/* Action area — only for pending */}
          {isPending && (
            <div className="border-t border-border pt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Internal note (optional — sent to applicant on rejection, visible on approval)
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 'ID photo unclear, please reapply with a clearer image.'"
                  rows={2}
                  className="text-sm resize-none"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => onApprove(app.id, note)}
                  disabled={isActioning}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onReject(app.id, note)}
                  disabled={isActioning}
                  className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  isLink,
}: {
  icon: any;
  label: string;
  value: string;
  isLink?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        {isLink ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
          >
            {value}
            <ExternalLink className="h-3 w-3 flex-shrink-0" />
          </a>
        ) : (
          <span className="text-sm text-foreground break-all">{value}</span>
        )}
      </div>
    </div>
  );
}
