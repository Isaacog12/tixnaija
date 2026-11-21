import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { BackButton } from "@/components/back-button";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  ShieldCheck,
  User as UserIcon,
  Clock,
  CheckCircle,
  XCircle,
  Upload,
  Loader2,
  Lock,
  Bell,
  LogOut,
  Camera,
  Eye,
  EyeOff,
  AlertTriangle,
  Trash2,
  Monitor,
  Mail,
  CalendarCheck,
  Megaphone,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
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
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchProfile(): Promise<{ userId: string; email: string; profile: any }> {
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
    .from("organizer_applications")
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
  username: z.string().trim().max(30).optional().nullable(),
  is_public: z.boolean().optional(),
  organizer_slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens").max(40).optional().nullable().or(z.literal("")),
  bio: z.string().trim().max(300).optional().nullable(),
  banner_url: z.string().trim().url().optional().nullable().or(z.literal("")),
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

const changePasswordSchema = z.object({
  newPassword: z.string().min(6, "At least 6 characters").max(72),
  confirmPassword: z.string(),
}).refine((v) => v.newPassword === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

type Tab = "general" | "security" | "notifications" | "organizer" | "payouts";

function AccountPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchProfile });
  const { data: myApp, isLoading: appLoading } = useQuery({
    queryKey: ["my-organizer-application"],
    queryFn: fetchMyApplication,
  });

  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== "undefined") {
      const param = new URLSearchParams(window.location.search).get("tab");
      if (param && ["general", "security", "notifications", "organizer", "payouts"].includes(param)) {
        return param as Tab;
      }
    }
    return "general";
  });

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const [form, setForm] = useState({
    full_name: "",
    username: "",
    is_public: true,
    organizer_slug: "",
    bio: "",
    banner_url: "",
    phone: "",
    city: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState("");

  // Avatar upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (data?.profile) {
      const autoSlug = data.profile.organizer_slug ||
        (data.profile.username || data.profile.full_name || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");

      setForm({
        full_name: data.profile.full_name ?? "",
        username: data.profile.username ?? "",
        is_public: data.profile.is_public ?? true,
        organizer_slug: autoSlug,
        bio: data.profile.bio ?? "",
        banner_url: data.profile.banner_url || data.profile.avatar_url || "",
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
      // FIX: Only auto-resolve if the account number or bank name is different from what's saved
      const isSavedAccount =
        data?.profile?.bank_account_number === form.bank_account_number &&
        data?.profile?.bank_name === form.bank_name;

      if (!isSavedAccount) {
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
            .then(({ data: resData, error }) => {
              if (error) {
                toast.error("Could not resolve account name. Check the account number.");
                setForm((prev) => ({ ...prev, bank_account_name: "" }));
              } else if (resData?.account_name) {
                setForm((prev) => ({ ...prev, bank_account_name: resData.account_name }));
                toast.success("Account name resolved!");
              }
              setResolvingAccount(false);
            });
        }
      }
    } else {
      setResolvingAccount(false);
    }
  }, [form.bank_account_number, form.bank_name, banks, data?.profile]);

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
        } as ProfileUpdate)
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
        .update(parsed.data as ProfileUpdate)
        .eq("id", data.userId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ id: data.userId, ...parsed.data } as ProfileInsert);
      error = insertError;
    }
    setSaving(false);
    if (error) {
      if (error.code === "23505" && error.message?.includes("profiles_organizer_slug_key")) {
        setSlugError("This URL is already taken — try a different one.");
        
        // The previous update failed atomically. We re-save without the slug so other fields succeed.
        const fallbackData = { ...parsed.data };
        delete fallbackData.organizer_slug;
        
        if (data.profile) {
          await supabase.from("profiles").update(fallbackData as ProfileUpdate).eq("id", data.userId);
        } else {
          await supabase.from("profiles").insert({ id: data.userId, ...fallbackData } as ProfileInsert);
        }
        
        toast.success("Other profile fields saved");
        qc.invalidateQueries({ queryKey: ["me"] });
      } else {
        toast.error("Something went wrong, please try again.");
      }
    } else {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["me"] });
    }
  }

  // Avatar upload handler
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${data.userId}/${Date.now()}-avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        // If "avatars" bucket doesn't exist, try event-covers as fallback
        // or just store the URL directly
        throw uploadError;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      
      await supabase
        .from("profiles")
        // @ts-ignore
        .update({ avatar_url: pub.publicUrl })
        .eq("id", data.userId);

      toast.success("Profile photo updated!");
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
      // Reset the input so the same file can be selected again
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  // Sign out handler
  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading account details…
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof UserIcon }[] = [
    { id: "general", label: "Personal Info", icon: UserIcon },
    { id: "security", label: "Security", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "organizer", label: "Organizer Status", icon: ShieldCheck },
    { id: "payouts", label: "Payout Account", icon: Landmark },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:py-16">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12"
      >
        <div className="flex items-center gap-4 mb-3">
          <BackButton />
          <h1 className="text-3xl md:text-4xl font-display font-semibold tracking-tight text-foreground">Account Settings</h1>
        </div>
        <p className="text-muted-foreground text-base max-w-2xl">
          Manage your personal profile, security, notifications, organizer verification, and bank details.
        </p>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Sidebar Nav */}
        <aside className="w-full lg:w-64 shrink-0">
          <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide relative">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-xl whitespace-nowrap lg:whitespace-normal ${
                    isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="account-tab-indicator"
                      className="absolute inset-0 bg-secondary/80 rounded-xl"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <tab.icon className={`relative z-10 h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}

            {/* Divider */}
            <div className="hidden lg:block my-2 border-t border-border/50" />

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="relative flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors rounded-xl whitespace-nowrap lg:whitespace-normal text-destructive/80 hover:text-destructive hover:bg-destructive/5"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </nav>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {activeTab === "general" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Personal Info</h2>
                  </div>
                  
                  <form
                    onSubmit={save}
                    className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm"
                  >
                    {/* Avatar Section */}
                    <div className="flex items-center gap-6 mb-10 pb-8 border-b border-border/50">
                      <div className="relative group">
                        <Avatar className="h-24 w-24 border-2 border-border/50 shadow-md">
                          <AvatarImage src={data?.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-2xl font-semibold bg-primary/10 text-primary">
                            {(data?.profile?.full_name || data?.email || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
                        >
                          {uploadingAvatar ? (
                            <Loader2 className="h-5 w-5 text-white animate-spin" />
                          ) : (
                            <Camera className="h-5 w-5 text-white" />
                          )}
                        </button>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleAvatarUpload}
                          className="sr-only"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium tracking-tight text-foreground">
                          {data?.profile?.full_name || "Your Profile"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">{data?.email}</p>
                        <button
                          type="button"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                        >
                          {uploadingAvatar ? "Uploading…" : "Change photo"}
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Full name">
                        <Input
                          className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        />
                      </Field>
                      <Field label="Username">
                        <Input
                          className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
                          placeholder="e.g. alexj"
                        />
                      </Field>
                      <Field label="Phone">
                        <Input
                          className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          placeholder="+2348012345678"
                        />
                      </Field>
                      <Field label="Email Address">
                         <Input className="h-12 bg-muted/50 border-border/50 rounded-xl" value={data?.email ?? ""} readOnly disabled />
                      </Field>
                      <Field label="City">
                        <Input
                          className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="Lagos"
                        />
                      </Field>
                    </div>

                    <div className="mt-8 p-6 rounded-2xl border border-border/50 bg-background/30 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium tracking-tight text-foreground">Privacy: Show me on Guest Lists</h3>
                        <p className="text-sm text-muted-foreground mt-1">If enabled, other attendees can see you on the event's guest list.</p>
                      </div>
                      <Switch
                        checked={form.is_public}
                        onCheckedChange={(c) => setForm({ ...form, is_public: c })}
                      />
                    </div>

                    {data?.profile?.is_organizer && (
                      <div className="mt-10 pt-8 border-t border-border/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                          <div>
                            <h3 className="text-xl font-medium tracking-tight text-foreground">Box Office Profile</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              Your public organizer page. Automatically carries your name and profile picture as the banner.
                            </p>
                          </div>
                          {form.organizer_slug && (
                            <a
                              href={`/box-office/${form.organizer_slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
                            >
                              Preview Box Office ↗
                            </a>
                          )}
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2">
                          <Field label="Box Office URL Slug">
                            <Input
                              className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                              value={form.organizer_slug}
                              onChange={(e) => {
                                setForm({ ...form, organizer_slug: e.target.value.toLowerCase() });
                                setSlugError("");
                              }}
                              placeholder="e.g. your-brand-name"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Public URL: <span className="font-mono text-foreground/80">tixnaija.name.ng/box-office/{form.organizer_slug || "..."}</span>
                            </p>
                            {slugError && <p className="text-sm font-medium text-destructive mt-2">{slugError}</p>}
                          </Field>
                          <Field label="Custom Banner Image URL (Optional)">
                            <Input
                              className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl"
                              value={form.banner_url}
                              onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                              placeholder="Leave blank to use profile photo"
                            />
                            <p className="text-xs text-muted-foreground mt-1.5">
                              Defaults automatically to your profile photo as an ambient backdrop.
                            </p>
                          </Field>
                          <div className="sm:col-span-2">
                            <Field label="Bio / About Organizer">
                              <textarea
                                className="flex min-h-[120px] w-full rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                                value={form.bio}
                                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                                placeholder="Tell attendees about yourself, your brand, or upcoming events..."
                              />
                            </Field>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-8 flex justify-end pt-8 border-t border-border/50">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit" 
                        disabled={saving} 
                        className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:scale-100"
                      >
                         {saving ? "Saving…" : "Save changes"}
                      </motion.button>
                    </div>
                  </form>
                </div>
              )}

              {activeTab === "security" && (
                <SecurityTab email={data?.email ?? ""} />
              )}

              {activeTab === "notifications" && (
                <NotificationsTab userId={data?.userId ?? ""} profile={data?.profile} />
              )}

              {activeTab === "organizer" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Organizer Status</h2>
                  </div>
                  
                  {appLoading ? (
                    <div className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 flex items-center justify-center gap-3 text-muted-foreground h-40">
                      <Loader2 className="h-5 w-5 animate-spin" /> Loading status…
                    </div>
                  ) : (
                    <div className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm">
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
                    </div>
                  )}
                </div>
              )}

              {activeTab === "payouts" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">Payout Account</h2>
                  </div>

                  <form
                    onSubmit={connectPayout}
                    className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm"
                  >
                    <div className="mb-8 flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-lg font-medium tracking-tight text-foreground">Bank Details</h3>
                        <p className="text-sm text-muted-foreground">Your payouts will be sent to this Nigerian bank account. A 10% platform fee applies.</p>
                      </div>
                      {data?.profile?.paystack_subaccount_code && (
                        <span className="inline-flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-500 border border-green-500/20">
                          <CheckCircle className="h-4 w-4" />
                          Connected
                        </span>
                      )}
                    </div>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <Field label="Bank name">
                        <Select
                          value={form.bank_name}
                          onValueChange={(v) => setForm({ ...form, bank_name: v })}
                        >
                          <SelectTrigger className="h-12 bg-background/50 border-border/50 rounded-xl">
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
                          className="h-12 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
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
                            className="h-12 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20 pr-24"
                            readOnly={resolvingAccount}
                            value={form.bank_account_name}
                            onChange={(e) =>
                              setForm({ ...form, bank_account_name: e.target.value })
                            }
                            placeholder="As shown on your bank statement"
                          />
                          {resolvingAccount && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground flex items-center gap-2">
                              <Loader2 className="h-3 w-3 animate-spin" /> Resolving
                            </div>
                          )}
                        </div>
                      </Field>
                    </div>

                    <div className="mt-8 flex justify-end pt-8 border-t border-border/50">
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={connectingPayout}
                        className={`inline-flex items-center justify-center h-12 px-8 rounded-full font-medium transition-all disabled:opacity-50 disabled:scale-100 ${
                          data?.profile?.paystack_subaccount_code 
                            ? "bg-secondary text-foreground border border-border" 
                            : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                        }`}
                      >
                        {connectingPayout
                          ? "Connecting…"
                          : data?.profile?.paystack_subaccount_code
                            ? "Update Account"
                            : "Connect Account"}
                      </motion.button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Security Tab
// ---------------------------------------------------------------------------

function SecurityTab({ email }: { email: string }) {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    const parsed = changePasswordSchema.safeParse({ newPassword, confirmPassword });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your input");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword });
      if (error) throw error;
      toast.success("Password updated successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message ?? "Could not update password");
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSignOutAllDevices() {
    setSigningOutAll(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) throw error;
      toast.success("Signed out from all devices");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not sign out from all devices");
    } finally {
      setSigningOutAll(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== "DELETE") return;
    setDeletingAccount(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account");
      let errorMsg = null;
      if (error) {
        try {
          const body = await error.context?.json?.();
          errorMsg = body?.error || error.message;
        } catch {
          errorMsg = error.message;
        }
      } else if (data?.error) {
        errorMsg = data.error;
      }

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      await supabase.auth.signOut();
      localStorage.removeItem("sb-bjijftxksykbjknbleul-auth-token");
      toast.success("Your account and personal data have been deleted. You have been signed out.");
      navigate({ to: "/", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not delete account");
    } finally {
      setDeletingAccount(false);
    }
  }

  // Password strength meter
  function getPasswordStrength(pw: string): { label: string; color: string; width: string } {
    if (!pw) return { label: "", color: "", width: "0%" };
    let score = 0;
    if (pw.length >= 6) score++;
    if (pw.length >= 10) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "20%" };
    if (score === 2) return { label: "Fair", color: "bg-orange-500", width: "40%" };
    if (score === 3) return { label: "Good", color: "bg-yellow-500", width: "60%" };
    if (score === 4) return { label: "Strong", color: "bg-green-500", width: "80%" };
    return { label: "Very strong", color: "bg-emerald-500", width: "100%" };
  }

  const strength = getPasswordStrength(newPassword);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground mt-1">Manage your password and account security.</p>
      </div>

      {/* Change Password */}
      <form
        onSubmit={handleChangePassword}
        className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium tracking-tight text-foreground">Change Password</h3>
            <p className="text-sm text-muted-foreground">Update your password to keep your account secure.</p>
          </div>
        </div>

        <div className="grid gap-5 max-w-md">
          <Field label="New password">
            <div className="relative">
              <Input
                className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl pr-12"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Password strength indicator */}
            {newPassword && (
              <div className="mt-2 space-y-1">
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${strength.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: strength.width }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Password strength: <span className="font-medium text-foreground">{strength.label}</span>
                </p>
              </div>
            )}
          </Field>
          <Field label="Confirm new password">
            <div className="relative">
              <Input
                className="h-12 bg-background/50 border-border/50 focus-visible:ring-primary/20 rounded-xl pr-12"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Passwords do not match</p>
            )}
          </Field>
        </div>

        <div className="mt-6 flex justify-start">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={changingPassword || !newPassword || !confirmPassword}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:scale-100 text-sm"
          >
            {changingPassword ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              "Update password"
            )}
          </motion.button>
        </div>
      </form>

      {/* Active Sessions / Sign Out All */}
      <div className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
            <Monitor className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium tracking-tight text-foreground">Active Sessions</h3>
            <p className="text-sm text-muted-foreground">Sign out from all devices if you suspect unauthorized access.</p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl border border-border/50 bg-background/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Current session</p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <span className="text-xs font-medium text-green-500 bg-green-500/10 px-2 py-1 rounded-full">Active</span>
        </div>

        <div className="mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleSignOutAllDevices}
            disabled={signingOutAll}
            className="rounded-xl"
          >
            {signingOutAll ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" /> Sign out all devices
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Delete Account */}
      <div className="rounded-[2rem] border border-destructive/20 bg-destructive/[0.02] backdrop-blur-xl p-8 sm:p-10 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h3 className="text-lg font-medium tracking-tight text-destructive">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">Permanently delete your account and all associated data.</p>
          </div>
        </div>

        <div className="mt-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Once you delete your account, all your data will be permanently removed. This includes your profile, tickets, events (if you're an organizer), and payout history. <strong className="text-foreground">This action cannot be undone.</strong>
          </p>
        </div>

        <div className="mt-6">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">Delete your account?</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <span className="block">
                    This will permanently delete your TixNaija account and all associated data. You will lose access to your tickets, events, and payout history.
                  </span>
                  <span className="block font-medium text-foreground">
                    Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-destructive">DELETE</span> below to confirm:
                  </span>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="Type DELETE to confirm"
                    className="mt-2"
                  />
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deletingAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {deletingAccount ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    "Permanently delete account"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications Tab
// ---------------------------------------------------------------------------

function NotificationsTab({ userId, profile }: { userId: string; profile: any }) {
  const qc = useQueryClient();
  
  // Notification preferences (stored locally until backend supports it)
  const [prefs, setPrefs] = useState({
    ticket_confirmations: true,
    event_reminders: true,
    organizer_updates: true,
    marketing_emails: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load saved preferences from profile or localStorage
  useEffect(() => {
    if (profile?.notification_preferences) {
      try {
        const saved = typeof profile.notification_preferences === "string" 
          ? JSON.parse(profile.notification_preferences) 
          : profile.notification_preferences;
        // Ticket delivery is transactional and cannot be disabled, so a legacy
        // "false" stored on this row is normalised on load.
        setPrefs((prev) => ({ ...prev, ...saved, ticket_confirmations: true }));
      } catch { /* use defaults */ }
    } else {
      // Try localStorage fallback
      try {
        const stored = localStorage.getItem(`notif_prefs_${userId}`);
        if (stored) setPrefs((prev) => ({ ...prev, ...JSON.parse(stored) }));
      } catch { /* use defaults */ }
    }
  }, [profile, userId]);

  async function savePrefs() {
    setSavingPrefs(true);
    try {
      // Try saving to profile first
      const { error } = await supabase
        .from("profiles")
        // @ts-ignore — notification_preferences may not be typed yet
        .update({ notification_preferences: { ...prefs, ticket_confirmations: true } } as any)
        .eq("id", userId);
      
      // Always save to localStorage as backup
      localStorage.setItem(`notif_prefs_${userId}`, JSON.stringify(prefs));

      if (error) {
        // If column doesn't exist, just save to localStorage
        toast.success("Notification preferences saved locally");
      } else {
        toast.success("Notification preferences updated!");
        qc.invalidateQueries({ queryKey: ["me"] });
      }
    } catch {
      localStorage.setItem(`notif_prefs_${userId}`, JSON.stringify(prefs));
      toast.success("Notification preferences saved");
    } finally {
      setSavingPrefs(false);
    }
  }

  const notifOptions = [
    {
      key: "ticket_confirmations" as const,
      icon: Mail,
      label: "Ticket Confirmations",
      description: "Purchase receipts and your tickets are always emailed — this can't be turned off.",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      key: "event_reminders" as const,
      icon: CalendarCheck,
      label: "Event Reminders",
      description: "Get reminded 24 hours and 1 hour before events you have tickets for.",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      key: "organizer_updates" as const,
      icon: Info,
      label: "Organizer Updates",
      description: "Receive updates when event organizers send announcements or change event details.",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      key: "marketing_emails" as const,
      icon: Megaphone,
      label: "Marketing & Promotions",
      description: "Hear about featured events, special offers, and TixNaija news. You can unsubscribe anytime.",
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Notifications</h2>
        <p className="text-sm text-muted-foreground mt-1">Choose what emails you'd like to receive from TixNaija.</p>
      </div>

      <div className="rounded-[2rem] border border-border/50 bg-card/30 backdrop-blur-xl p-8 sm:p-10 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-medium tracking-tight text-foreground">Email Notifications</h3>
            <p className="text-sm text-muted-foreground">Manage which emails we send you.</p>
          </div>
        </div>

        <div className="space-y-4">
          {notifOptions.map((opt, i) => (
            <motion.div
              key={opt.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="p-5 rounded-2xl border border-border/50 bg-background/30 flex items-start justify-between gap-4 hover:border-border/80 transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${opt.bgColor} shrink-0 mt-0.5`}>
                  <opt.icon className={`h-5 w-5 ${opt.color}`} />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-foreground">{opt.label}</h4>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{opt.description}</p>
                </div>
              </div>
              {opt.key === "ticket_confirmations" ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Always on</span>
                  <Switch checked disabled aria-label="Ticket confirmations are always on" />
                </div>
              ) : (
                <Switch
                  checked={prefs[opt.key]}
                  onCheckedChange={(checked) => setPrefs((prev) => ({ ...prev, [opt.key]: checked }))}
                  className="shrink-0"
                />
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex justify-end pt-6 border-t border-border/50">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={savePrefs}
            disabled={savingPrefs}
            className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:scale-100 text-sm"
          >
            {savingPrefs ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save preferences"
            )}
          </motion.button>
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
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6 flex items-start gap-4">
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15 text-green-500">
          <CheckCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-green-600 dark:text-green-500">You're an approved organizer</h3>
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
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 flex items-start gap-4">
        <div className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold text-amber-600 dark:text-amber-500">Application under review</h3>
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
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-4">
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
          <Button onClick={() => setShowForm(true)}>
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
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-medium text-foreground">Submit Application</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Apply to unlock event creation and ticket sales.
                Applications are reviewed within 3 business days.
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} className="flex-shrink-0">
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
        .from("organizer_applications")
        .insert({
          user_id: user.id,
          full_name: parsed.data.full_name,
          phone_number: parsed.data.phone_number,
          email: userEmail,
          social_media_link: parsed.data.social_media_link || null,
          reason: parsed.data.reason,
          id_photo_url: path,
          status: "pending",
        } as any);
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
      className="rounded-lg border border-border bg-card p-6 space-y-5"
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
        </Field>

        <Field label="Email address" className="sm:col-span-2">
          <Input value={userEmail} readOnly className="opacity-60 cursor-not-allowed bg-muted" />
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
          ID Photo (selfie holding a government-issued ID/NIN) *
        </Label>
        <div className="mt-2 rounded-md border-2 border-dashed border-border bg-muted/20 p-5">
          <div className="flex flex-col items-center gap-3 text-center">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="ID preview"
                className="max-h-52 w-full object-contain rounded-md"
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
              className="cursor-pointer rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {photoPreview ? "Change photo" : "Choose file"}
            </label>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-border bg-muted/50 p-4 text-xs text-muted-foreground leading-relaxed space-y-2">
          <p>
            <strong className="text-foreground">Privacy Notice (Identity Verification):</strong> We collect your identity photo solely to verify organizer identity, prevent ticket fraud, and ensure platform safety in compliance with the Nigeria Data Protection Act 2023 (NDPA).
          </p>
          <p>
            Your document is stored in a private, access-restricted storage bucket accessible only to authorized administrators reviewing your application. It is never made public or used for marketing. Uploaded identity files are retained for 30 days after review, after which they are permanently deleted. For details on how we protect your information, see our{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
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
