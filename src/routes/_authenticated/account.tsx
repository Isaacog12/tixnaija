import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import {
  Landmark,
  ShieldCheck,
  User as UserIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return { userId, email: userData.user?.email ?? "", profile: data };
}

async function fetchMyApplication() {
  const { data, error } = await supabase
    .from("organizer_applications" as any)
    .select("id, status, admin_note, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as {
    id: string;
    status: "pending" | "approved" | "rejected";
    admin_note: string | null;
    created_at: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  full_name: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
  bank_name: z.string().trim().max(60).optional().nullable(),
  bank_account_number: z
    .string()
    .trim()
    .regex(/^\d{0,20}$/, "Numbers only")
    .optional()
    .nullable(),
  bank_account_name: z.string().trim().max(80).optional().nullable(),
});

const applicationSchema = z.object({
  full_name: z.string().trim().min(2, "Full name is required"),
  phone_number: z.string().trim().min(7, "Phone number is required"),
  social_media_link: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
  reason: z
    .string()
    .trim()
    .min(30, "Please write at least 30 characters about your plans"),
});

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function AccountPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchProfile });
  const { data: myApp, isLoading: appLoading } = useQuery({
    queryKey: ["my-organizer-application"],
    queryFn: fetchMyApplication,
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      setForm({
        full_name: data.profile.full_name ?? "",
        phone: data.profile.phone ?? "",
        city: data.profile.city ?? "",
        bank_name: data.profile.bank_name ?? "",
        bank_account_number: data.profile.bank_account_number ?? "",
        bank_account_name: data.profile.bank_account_name ?? "",
      });
    }
  }, [data]);

  const { data: banks } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "connect-payout-account",
        { method: "GET" }
      );
      if (error) throw error;
      return (data || []) as { name: string; code: string }[];
    },
  });

  const [connectingPayout, setConnectingPayout] = useState(false);
  const [resolvingAccount, setResolvingAccount] = useState(false);

  useEffect(() => {
    if (form.bank_account_number.length === 10 && form.bank_name && banks) {
      const bank = banks.find((b) => b.name === form.bank_name);
      if (bank) {
        setResolvingAccount(true);
        supabase.functions
          .invoke("connect-payout-account", {
            method: "POST",
            body: {
              action: "resolve",
              account_number: form.bank_account_number,
              bank_code: bank.code,
            },
          })
          .then(({ data, error }) => {
            if (error) {
              toast.error("Could not resolve account name. Check the account number.");
              setForm((prev) => ({ ...prev, bank_account_name: "" }));
            } else if (data?.account_name) {
              setForm((prev) => ({ ...prev, bank_account_name: data.account_name }));
              toast.success("Account name resolved!");
            }
            setResolvingAccount(false);
          });
      }
    } else {
      setResolvingAccount(false);
    }
  }, [form.bank_account_number, form.bank_name, banks]);

  async function connectPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!form.bank_name || !form.bank_account_number || !form.bank_account_name) {
      return toast.error("Please fill in all payout details");
    }
    const bank = banks?.find((b) => b.name === form.bank_name);
    if (!bank) return toast.error("Invalid bank selected");

    setConnectingPayout(true);
    const { data: res, error } = await supabase.functions.invoke(
      "connect-payout-account",
      {
        method: "POST",
        body: {
          bank_code: bank.code,
          account_number: form.bank_account_number,
          business_name: form.bank_account_name,
        },
      }
    );

    if (error) {
      toast.error(error.message);
    } else if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Payout account successfully connected!");
      await supabase
        .from("profiles")
        .update({
          bank_name: form.bank_name,
          bank_account_number: form.bank_account_number,
          bank_account_name: form.bank_account_name,
        })
        .eq("id", data!.userId);
      qc.invalidateQueries({ queryKey: ["me"] });
    }
    setConnectingPayout(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setSaving(true);
    let error;
    if (data.profile) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update(parsed.data)
        .eq("id", data.userId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: data.userId, ...parsed.data });
      error = insertError;
    }
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-10">
        <h1 className="font-display text-4xl md:text-5xl">Account Settings</h1>
        <p className="mt-2 text-muted-foreground">Signed in as {data?.email}</p>
      </div>

      <div className="space-y-16">
        {/* Profile Section */}
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary" />
              Personal Info
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Update your personal details, phone number, and location.
            </p>
          </div>
          <div className="md:col-span-2">
            <form
              onSubmit={save}
              className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm"
            >
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name">
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+2348012345678"
                  />
                </Field>
                <Field label="City" className="sm:col-span-2">
                  <Input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="Lagos"
                  />
                </Field>
              </div>
              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
                >
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="h-px bg-border w-full" />

        {/* Organizer Application Section */}
        <div className="grid gap-8 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Organizer Status
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Become a verified organizer to create events and sell tickets on
              TixNaija.
            </p>
          </div>
          <div className="md:col-span-2">
            {appLoading ? (
              <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <OrganizerApplicationCard
                app={myApp ?? null}
                userEmail={data?.email ?? ""}
                profileFullName={data?.profile?.full_name ?? ""}
                profilePhone={data?.profile?.phone ?? ""}
                isOrganizer={!!data?.profile?.is_organizer}
                onSubmitted={() => {
                  qc.invalidateQueries({ queryKey: ["my-organizer-application"] });
                  qc.invalidateQueries({ queryKey: ["my-events"] });
                }}
              />
            )}
          </div>
        </div>

        <div className="h-px bg-border w-full" />

        {/* Payout Bank Account Section */}
        <div className="grid gap-8 md:grid-cols-3">
          {/* Organizer Application Flow */}
          <div className="md:col-span-1 mt-8 md:mt-0 pt-8 md:pt-0 border-t md:border-t-0 border-border">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Organizer Status
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Apply to become a verified organizer to create events and sell tickets.
            </p>
          </div>
          <div className="md:col-span-2 mt-4 md:mt-0">
            <OrganizerApplicationFlow
              app={myApp ?? null}
              userEmail={data?.user.email ?? ""}
              profileFullName={data?.profile?.full_name ?? ""}
              profilePhone={data?.profile?.phone ?? ""}
              onSubmitted={() => qc.invalidateQueries({ queryKey: ["my-organizer-application"] })}
            />
          </div>

          <div className="col-span-1 md:col-span-3">
            <hr className="my-2 border-border" />
          </div>

          <div className="md:col-span-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Payout Account
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect your Nigerian bank account to receive event payouts
              automatically.
            </p>
            <p className="mt-4 text-xs font-medium text-muted-foreground bg-primary/10 text-primary px-3 py-2 rounded-md">
              A 15% platform fee applies to all ticket sales.
            </p>
          </div>
          <div className="md:col-span-2">
            <form
              onSubmit={connectPayout}
              className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm"
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-medium text-foreground">Bank Details</h3>
                {data?.profile?.paystack_subaccount_code && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </span>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Bank name">
                  <Select
                    value={form.bank_name}
                    onValueChange={(v) => setForm({ ...form, bank_name: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks?.map((b) => (
                        <SelectItem key={b.code} value={b.name}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Account number">
                  <Input
                    inputMode="numeric"
                    value={form.bank_account_number}
                    onChange={(e) =>
                      setForm({ ...form, bank_account_number: e.target.value })
                    }
                    placeholder="0123456789"
                  />
                </Field>
                <Field label="Account name" className="sm:col-span-2">
                  <div className="relative">
                    <Input
                      readOnly={resolvingAccount}
                      value={form.bank_account_name}
                      onChange={(e) =>
                        setForm({ ...form, bank_account_name: e.target.value })
                      }
                      placeholder="As shown on your bank statement"
                    />
                    {resolvingAccount && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        Resolving...
                      </div>
                    )}
                  </div>
                </Field>
              </div>

              <div className="mt-6 flex justify-end border-t border-border pt-4">
                <Button
                  type="submit"
                  disabled={connectingPayout}
                  variant={
                    data?.profile?.paystack_subaccount_code ? "outline" : "default"
                  }
                  className={
                    data?.profile?.paystack_subaccount_code
                      ? ""
                      : "gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
                  }
                >
                  {connectingPayout
                    ? "Connecting…"
                    : data?.profile?.paystack_subaccount_code
                    ? "Update Account"
                    : "Connect Account"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Organizer Application Card
// ---------------------------------------------------------------------------

function OrganizerApplicationCard({
  app,
  userEmail,
  profileFullName,
  profilePhone,
  isOrganizer,
  onSubmitted,
}: {
  app: { id: string; status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string } | null;
  userEmail: string;
  profileFullName: string;
  profilePhone: string;
  isOrganizer: boolean;
  onSubmitted: () => void;
}) {
  const [showForm, setShowForm] = useState(false);

  // Already an organizer (approved + role granted)
  if (isOrganizer || app?.status === "approved") {
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6 shadow-sm flex items-start gap-4">
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15 text-green-500">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-green-500">You're an approved organizer</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account has organizer access. Head to your dashboard to create
            and manage events.
          </p>
        </div>
      </div>
    );
  }

  // Pending review
  if (app?.status === "pending") {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 shadow-sm flex items-start gap-4">
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-500">Application under review</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Your application was submitted on{" "}
            {new Date(app.created_at).toLocaleDateString("en-NG", { dateStyle: "medium" })}.
            We'll contact you within{" "}
            <strong>3 business days</strong> via phone or email.
          </p>
        </div>
      </div>
    );
  }

  // Rejected — show note + allow reapplication
  if (app?.status === "rejected") {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 shadow-sm flex items-start gap-4">
          <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-destructive">Application not approved</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              We couldn't approve your application at this time.
            </p>
            {app.admin_note && (
              <p className="mt-2 text-sm text-foreground/80 italic border-l-2 border-destructive/30 pl-3">
                "{app.admin_note}"
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              You're welcome to apply again with updated information.
            </p>
          </div>
        </div>
        {showForm ? (
          <ApplicationForm
            userEmail={userEmail}
            profileFullName={profileFullName}
            profilePhone={profilePhone}
            onSubmitted={() => { setShowForm(false); onSubmitted(); }}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <Button
            onClick={() => setShowForm(true)}
            className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
          >
            Apply again
          </Button>
        )}
      </div>
    );
  }

  // No application yet
  return (
    <div className="space-y-4">
      {!showForm ? (
        <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-medium text-foreground">Become a verified organizer</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Submit an application to unlock event creation and ticket sales.
                Applications are reviewed within 3 business days.
              </p>
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 flex-shrink-0"
            >
              Apply to become an organizer
            </Button>
          </div>
        </div>
      ) : (
        <ApplicationForm
          userEmail={userEmail}
          profileFullName={profileFullName}
          profilePhone={profilePhone}
          onSubmitted={() => { setShowForm(false); onSubmitted(); }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Application form
// ---------------------------------------------------------------------------

function ApplicationForm({
  userEmail,
  profileFullName,
  profilePhone,
  onSubmitted,
  onCancel,
}: {
  userEmail: string;
  profileFullName: string;
  profilePhone: string;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState({
    full_name: profileFullName,
    phone_number: profilePhone,
    social_media_link: "",
    reason: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsed = applicationSchema.safeParse(fields);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    if (!photoFile) {
      toast.error("Please upload a photo of yourself holding your government ID");
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      // Upload ID photo
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}-id.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("id-photos")
        .upload(path, photoFile, { upsert: false });
      if (uploadError) throw uploadError;

      // Insert application
      const { error: insertError } = await supabase
        .from("organizer_applications" as any)
        .insert({
          user_id: user.id,
          full_name: parsed.data.full_name,
          phone_number: parsed.data.phone_number,
          email: userEmail,
          social_media_link: parsed.data.social_media_link || null,
          reason: parsed.data.reason,
          id_photo_url: path,
          status: "pending",
        });
      if (insertError) throw insertError;

      toast.success(
        "Application submitted! We'll contact you within 3 business days."
      );
      onSubmitted();
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm space-y-5"
    >
      <div>
        <h3 className="font-semibold text-foreground">Organizer Application</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the details below. Our team reviews every application manually
          and will reach out within 3 business days.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name *">
          <Input
            value={fields.full_name}
            onChange={(e) => setFields({ ...fields, full_name: e.target.value })}
            placeholder="Adaeze Okonkwo"
          />
        </Field>

        <Field label="Phone number *">
          <Input
            value={fields.phone_number}
            onChange={(e) => setFields({ ...fields, phone_number: e.target.value })}
            placeholder="+2348012345678"
          />
          <p className="text-xs text-muted-foreground mt-1">
            This is how we'll contact you to confirm your application.
          </p>
        </Field>

        <Field label="Email address" className="sm:col-span-2">
          <Input value={userEmail} readOnly className="opacity-60 cursor-not-allowed" />
        </Field>

        <Field label="Social media link (optional)" className="sm:col-span-2">
          <Input
            value={fields.social_media_link}
            onChange={(e) =>
              setFields({ ...fields, social_media_link: e.target.value })
            }
            placeholder="https://instagram.com/youraccount"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Instagram, Twitter, TikTok, or any public page — helps us understand
            your community.
          </p>
        </Field>

        <Field label="What kind of events do you want to run? *" className="sm:col-span-2">
          <Textarea
            value={fields.reason}
            onChange={(e) => setFields({ ...fields, reason: e.target.value })}
            placeholder="Tell us about the events you plan to organise — the type, scale, how often, and your experience running events so far..."
            rows={4}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {fields.reason.length}/30 characters minimum
          </p>
        </Field>
      </div>

      {/* ID photo upload */}
      <div>
        <Label className="text-sm font-medium">
          ID Photo (selfie holding a government-issued ID) *
        </Label>
        <div className="mt-2 rounded-xl border-2 border-dashed border-border bg-muted/20 p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="ID preview"
                className="max-h-52 w-full object-contain rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Upload className="h-8 w-8 opacity-40" />
                <p className="text-sm font-medium">Click or drag to upload your photo</p>
              </div>
            )}
            <input
              id="id-photo-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhoto}
              className="sr-only"
            />
            <label
              htmlFor="id-photo-upload"
              className="cursor-pointer rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition"
            >
              {photoPreview ? "Change photo" : "Choose file"}
            </label>
          </div>
        </div>
        <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
          <strong>Why we ask for this:</strong> A selfie holding your government
          ID helps us verify that every organizer on TixNaija is a real person.
          This protects ticket buyers from fraud. Your photo is only seen by our
          review team and is never shared publicly.
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting}
          className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit application"
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
