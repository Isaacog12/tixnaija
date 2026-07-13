import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { Landmark, ShieldCheck, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

async function fetchProfile() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return { userId, email: userData.user?.email ?? "", profile: data };
}

const profileSchema = z.object({
  full_name: z.string().trim().max(80).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(60).optional().nullable(),
  bank_name: z.string().trim().max(60).optional().nullable(),
  bank_account_number: z.string().trim().regex(/^\d{0,20}$/, "Numbers only").optional().nullable(),
  bank_account_name: z.string().trim().max(80).optional().nullable(),
});

function AccountPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: fetchProfile });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    bank_name: "",
    bank_account_number: "",
    bank_account_name: "",
  });
  const [organizerOn, setOrganizerOn] = useState(false);
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
      setOrganizerOn(!!data.profile.is_organizer);
    }
  }, [data]);

  const { data: banks } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("connect-payout-account", { method: "GET" });
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
        supabase.functions.invoke("connect-payout-account", {
          method: "POST",
          body: { action: "resolve", account_number: form.bank_account_number, bank_code: bank.code }
        }).then(({ data, error }) => {
          if (!error && data?.account_name) {
            setForm((prev) => ({ ...prev, bank_account_name: data.account_name }));
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
    const bank = banks?.find(b => b.name === form.bank_name);
    if (!bank) return toast.error("Invalid bank selected");

    setConnectingPayout(true);
    const { data: res, error } = await supabase.functions.invoke("connect-payout-account", {
      method: "POST",
      body: {
        bank_code: bank.code,
        account_number: form.bank_account_number,
        business_name: form.bank_account_name,
      }
    });

    if (error) {
      toast.error(error.message);
    } else if (res?.error) {
      toast.error(res.error);
    } else {
      toast.success("Payout account successfully connected!");
      // Save the inert profile fields too so they remain visible
      await supabase.from("profiles").update({
        bank_name: form.bank_name,
        bank_account_number: form.bank_account_number,
        bank_account_name: form.bank_account_name,
      }).eq("id", data!.userId);
      qc.invalidateQueries({ queryKey: ["me"] });
    }
    setConnectingPayout(false);
  }

  async function toggleOrganizer(next: boolean) {
    if (!data) return;
    setOrganizerOn(next);
    
    const { error } = await supabase.rpc("set_organizer_status", { is_org: next });
    
    if (error) {
      toast.error(error.message);
      setOrganizerOn(!next);
      return;
    }
    
    if (next) {
      toast.success("Organizer mode on. Create your first event!");
    } else {
      toast.success("Organizer mode off");
    }
    
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["my-events"] });
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
      const { error: updateError } = await supabase.from("profiles").update(parsed.data).eq("id", data.userId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("profiles").insert({ id: data.userId, ...parsed.data });
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
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl md:text-5xl">Account</h1>
      <p className="text-muted-foreground">Signed in as {data?.email}</p>

      {/* Organizer toggle */}
      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Organizer mode</h2>
              <p className="text-sm text-muted-foreground">
                Turn this on to create and sell tickets to your own events.
              </p>
            </div>
          </div>
          <Switch checked={organizerOn} onCheckedChange={toggleOrganizer} />
        </div>
      </section>

      {/* Profile */}
      <form onSubmit={save} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <div className="mb-4 flex items-center gap-3">
            <UserIcon className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Profile</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2348012345678" />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Lagos" />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="gradient-sunset text-primary-foreground shadow-glow hover:opacity-90">
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>

      {/* Payout Bank Account (Separate Form) */}
      <form onSubmit={connectPayout} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-border bg-card/60 p-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Landmark className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Payout bank account</h2>
            </div>
            {data?.profile?.paystack_subaccount_code && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Connected
              </span>
            )}
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Connect your Nigerian bank account to receive payouts automatically. 15% platform fee applies.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Bank name">
              <Select value={form.bank_name} onValueChange={(v) => setForm({ ...form, bank_name: v })}>
                <SelectTrigger><SelectValue placeholder="Select Bank" /></SelectTrigger>
                <SelectContent>
                  {banks?.map((b) => (
                    <SelectItem key={b.code} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Account number">
              <Input inputMode="numeric" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} placeholder="0123456789" />
            </Field>
            <Field label="Account name" className="md:col-span-2">
              <div className="relative">
                <Input readOnly={resolvingAccount} value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} placeholder="As shown on your bank statement" />
                {resolvingAccount && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    Resolving...
                  </div>
                )}
              </div>
            </Field>
          </div>
          
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={connectingPayout} variant={data?.profile?.paystack_subaccount_code ? "outline" : "default"}>
              {connectingPayout ? "Connecting…" : data?.profile?.paystack_subaccount_code ? "Update Payout Account" : "Connect Payout Account"}
            </Button>
          </div>
        </section>
      </form>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
