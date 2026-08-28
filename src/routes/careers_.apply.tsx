import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { z } from "zod";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  UploadCloud,
  FileText,
  CheckCircle,
  X,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const OPEN_ROLES = [
  "Customer Support",
  "Social Media / Content Manager",
  "Business Development / Partnerships",
] as const;

const searchSchema = z.object({
  role: z.string().optional(),
});

export const Route = createFileRoute("/careers_/apply")({
  ssr: false,
  validateSearch: searchSchema,
  component: ApplyPage,
  head: () => ({
    meta: [
      { title: "Apply — TixNaija Careers" },
      {
        name: "description",
        content: "Apply to join the TixNaija team. Send your CV and tell us why you'd be a great fit.",
      },
    ],
  }),
});

type FormState = {
  role: string;
  fullName: string;
  email: string;
  phone: string;
  coverMessage: string;
};

type UploadState =
  | { status: "idle" }
  | { status: "selected"; file: File }
  | { status: "uploading" }
  | { status: "done"; path: string; fileName: string }
  | { status: "error"; message: string };

function ApplyPage() {
  const { role: prefilledRole } = Route.useSearch();

  const [form, setForm] = useState<FormState>({
    role: OPEN_ROLES.includes(prefilledRole as any) ? (prefilledRole as string) : "",
    fullName: "",
    email: "",
    phone: "",
    coverMessage: "",
  });

  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "cv", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // ── File selection ──────────────────────────────────────────

  function handleFileSelect(file: File | null) {
    if (!file) return;

    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowed.includes(file.type)) {
      setUpload({ status: "error", message: "Only PDF or DOCX files are accepted." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUpload({ status: "error", message: "File must be under 5 MB." });
      return;
    }

    setUpload({ status: "selected", file });
    setErrors((e) => ({ ...e, cv: undefined }));
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFileSelect(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files?.[0] ?? null);
  }

  function clearFile() {
    setUpload({ status: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Upload CV to Supabase Storage ──────────────────────────

  async function uploadCV(file: File): Promise<string> {
    setUpload({ status: "uploading" });
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from("job-cvs").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      setUpload({ status: "error", message: error.message });
      throw error;
    }

    setUpload({ status: "done", path, fileName: file.name });
    return path;
  }

  // ── Validation ─────────────────────────────────────────────

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.role) errs.role = "Please select the role you're applying for.";
    if (!form.fullName.trim()) errs.fullName = "Full name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Please enter a valid email address.";
    if (!form.phone.trim()) errs.phone = "Phone number is required.";
    if (upload.status === "idle" || upload.status === "error")
      errs.cv = "Please upload your CV (PDF or DOCX, max 5 MB).";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Submit ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      let cvPath: string;

      if (upload.status === "selected") {
        cvPath = await uploadCV(upload.file);
      } else if (upload.status === "done") {
        cvPath = upload.path;
      } else {
        throw new Error("CV not ready.");
      }

      const { error } = await (supabase as any).from("job_applications").insert({
        role_applied_for: form.role,
        full_name: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        phone_number: form.phone.trim(),
        cover_message: form.coverMessage.trim() || null,
        cv_url: cvPath,
      });

      if (error) throw error;

      setSubmitted(true);
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────

  if (submitted) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-green-500">
              <CheckCircle className="h-10 w-10" />
            </div>
          </div>
          <h1 className="font-display text-4xl mb-4">Application sent!</h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            Thanks for applying! We'll review your application and reach out if it's a fit. Keep an eye on your inbox — we'll contact you at{" "}
            <span className="text-foreground font-medium">{form.email}</span>.
          </p>
          <Link
            to="/careers"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Opportunities
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────

  const isUploading = upload.status === "uploading";
  const isLoading = submitting || isUploading;

  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-2xl px-4 py-10 md:py-14">
          <Link
            to="/careers"
            className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition uppercase tracking-wider font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            All Opportunities
          </Link>
          <h1 className="font-display text-4xl md:text-6xl leading-[0.95] mb-3">
            Apply to Join TixNaija
          </h1>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            Fill in the form below and attach your CV. We read every application.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="mx-auto max-w-2xl px-4 py-12">
        <form onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* Role */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Role you're applying for <span className="text-destructive">*</span>
            </label>
            <select
              value={form.role}
              onChange={(e) => {
                setForm((f) => ({ ...f, role: e.target.value }));
                setErrors((er) => ({ ...er, role: undefined }));
              }}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition"
            >
              <option value="">Select a role…</option>
              {OPEN_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {errors.role && <p className="mt-1.5 text-xs text-destructive">{errors.role}</p>}
          </div>

          {/* Name + Email */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Full name <span className="text-destructive">*</span>
              </label>
              <Input
                value={form.fullName}
                onChange={(e) => {
                  setForm((f) => ({ ...f, fullName: e.target.value }));
                  setErrors((er) => ({ ...er, fullName: undefined }));
                }}
                placeholder="Chioma Okafor"
                className={errors.fullName ? "border-destructive" : ""}
              />
              {errors.fullName && <p className="mt-1.5 text-xs text-destructive">{errors.fullName}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Email address <span className="text-destructive">*</span>
              </label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => {
                  setForm((f) => ({ ...f, email: e.target.value }));
                  setErrors((er) => ({ ...er, email: undefined }));
                }}
                placeholder="chioma@example.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="mt-1.5 text-xs text-destructive">{errors.email}</p>}
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Phone number <span className="text-destructive">*</span>
            </label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => {
                setForm((f) => ({ ...f, phone: e.target.value }));
                setErrors((er) => ({ ...er, phone: undefined }));
              }}
              placeholder="+234 800 000 0000"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="mt-1.5 text-xs text-destructive">{errors.phone}</p>}
          </div>

          {/* Cover message */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Why do you want to work with us?{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={form.coverMessage}
              onChange={(e) => setForm((f) => ({ ...f, coverMessage: e.target.value }))}
              placeholder="Tell us a little about yourself and why this role excites you…"
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* CV Upload */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              CV / Resume <span className="text-destructive">*</span>{" "}
              <span className="text-muted-foreground font-normal">(PDF or DOCX, max 5 MB)</span>
            </label>

            {upload.status === "done" ? (
              /* File uploaded — show filename + remove button */
              <div className="flex items-center gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3">
                <FileText className="h-5 w-5 flex-shrink-0 text-green-500" />
                <span className="flex-1 text-sm text-foreground truncate">{upload.fileName}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : upload.status === "uploading" ? (
              /* Uploading spinner */
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
                <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Uploading CV…</span>
              </div>
            ) : upload.status === "selected" ? (
              /* File selected, not yet uploaded */
              <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <FileText className="h-5 w-5 flex-shrink-0 text-primary" />
                <span className="flex-1 text-sm text-foreground truncate">{upload.file.name}</span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* Drop zone */
              <div
                ref={dropZoneRef}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition ${
                  errors.cv
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition">
                  <UploadCloud className="h-6 w-6 text-muted-foreground group-hover:text-primary transition" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    Drag & drop your CV here, or{" "}
                    <span className="text-primary">browse files</span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">PDF or DOCX · Max 5 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleInputChange}
                  className="sr-only"
                />
              </div>
            )}

            {upload.status === "error" && (
              <p className="mt-1.5 text-xs text-destructive">{upload.message}</p>
            )}
            {errors.cv && upload.status !== "error" && (
              <p className="mt-1.5 text-xs text-destructive">{errors.cv}</p>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full gradient-sunset text-primary-foreground font-semibold py-3 rounded-xl shadow-sm hover:opacity-90 transition"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isUploading ? "Uploading CV…" : "Submitting…"}
                </span>
              ) : (
                "Submit Application"
              )}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Your personal information is handled in accordance with our{" "}
              <Link to="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

        </form>
      </div>
    </div>
  );
}
