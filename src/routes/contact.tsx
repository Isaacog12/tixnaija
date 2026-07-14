import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact Us — TixNaija" },
      {
        name: "description",
        content:
          "Get in touch with the TixNaija team. Whether you're a buyer with a ticket issue or an organizer with a question, we're here to help.",
      },
    ],
  }),
});

const TOPICS = [
  "Ticket / Purchase Issue",
  "Event Organizer Support",
  "Refund Request",
  "Account & Login Help",
  "Report a Fraudulent Event",
  "Partnership / Business Enquiry",
  "Other",
];

function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    topic: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (!form.phone.trim() || form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number.");
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      toast.error("Please enter a message (at least 10 characters).");
      return;
    }

    setBusy(true);
    // Simulate network request — swap with a real endpoint / Supabase edge function when ready
    await new Promise((r) => setTimeout(r, 1200));
    setBusy(false);
    setSent(true);
  }

  return (
    <div className="min-h-screen">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 gradient-sunset opacity-10 pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.25em] text-muted-foreground hover:text-primary transition mb-8"
          >
            ← Back to TixNaija
          </Link>
          <div className="flex items-baseline gap-0 mb-4">
            <span className="font-display text-3xl leading-none tracking-[0.02em] text-foreground">TIX</span>
            <span className="font-display text-3xl leading-none tracking-[0.02em] text-gradient-sunset">NAIJA</span>
          </div>
          <h1 className="font-display text-5xl md:text-7xl leading-[0.95] mb-3">
            Contact Us
          </h1>
          <p className="text-muted-foreground max-w-lg mt-3">
            Got a question, issue, or just want to say hi? Fill in the form below
            and we'll get back to you as soon as possible.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-4 py-12 md:py-16 grid grid-cols-1 md:grid-cols-[1fr_400px] gap-12 items-start">

        <div className="space-y-5">
          <div>
            <h2 className="font-display text-2xl md:text-3xl mb-1">We'd love to hear from you</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Whether you're an attendee with a ticket problem or an organizer
              needing support, our team is ready to help.
            </p>
          </div>

          {/* Direct contact */}
          <div className="flex flex-col gap-3">
            <a
              href="tel:+2349011275275"
              className="flex items-center gap-4 rounded-lg border border-border bg-card/60 p-4 transition hover:border-primary/50 hover:bg-card group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-sunset shadow-glow text-primary-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Call / WhatsApp</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">+234 901 127 5275</p>
              </div>
            </a>

            <a
              href="mailto:tixnaijaapp@gmail.com"
              className="flex items-center gap-4 rounded-lg border border-border bg-card/60 p-4 transition hover:border-primary/50 hover:bg-card group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full gradient-sunset shadow-glow text-primary-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z" />
                  <path d="M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                </svg>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Email</p>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">tixnaijaapp@gmail.com</p>
              </div>
            </a>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mt-2">
            {[
              {
                label: "Buyers & Attendees",
                desc: "Missing ticket? Wrong details? We'll sort it fast.",
                icon: "🎟️",
              },
              {
                label: "Event Organizers",
                desc: "Questions about payouts, listings, or check-in tools.",
                icon: "🎤",
              },
              {
                label: "Refunds",
                desc: "Event cancelled? We'll guide you through the process.",
                icon: "💸",
              },
              {
                label: "Fraud Reports",
                desc: "Spotted a fake event? Report it and we'll investigate.",
                icon: "🚨",
              },
            ].map(({ label, desc, icon }) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-card/60 p-5 transition hover:border-primary/40"
              >
                <span className="text-2xl">{icon}</span>
                <p className="mt-3 font-semibold text-sm">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-6 border-t border-border/40 flex gap-6 text-xs text-muted-foreground">
            <Link to="/terms" className="hover:text-primary transition">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-primary transition">Privacy Policy</Link>
          </div>
        </div>

        {/* Right — form card */}
        <div className="rounded-2xl border border-border bg-card/80 p-6 md:p-8 shadow-glow backdrop-blur">
          {sent ? (
            <SuccessState name={form.name} onReset={() => { setSent(false); setForm({ name: "", email: "", phone: "", topic: "", message: "" }); }} />
          ) : (
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              <div>
                <h2 className="font-display text-2xl leading-tight">Send us a message</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  All fields marked <span className="text-primary">*</span> are required.
                </p>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="contact-name">
                  Full name <span className="text-primary">*</span>
                </Label>
                <Input
                  id="contact-name"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  placeholder="Chidera Okoye"
                  autoComplete="name"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="contact-email">
                  Email address <span className="text-primary">*</span>
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="contact-phone">
                  Phone number <span className="text-primary">*</span>
                </Label>
                <Input
                  id="contact-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  placeholder="+234 800 000 0000"
                  autoComplete="tel"
                  required
                />
              </div>

              {/* Topic */}
              <div className="space-y-1.5">
                <Label htmlFor="contact-topic">Topic</Label>
                <select
                  id="contact-topic"
                  value={form.topic}
                  onChange={(e) => update("topic", e.target.value)}
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a topic…</option>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <Label htmlFor="contact-message">
                  Message <span className="text-primary">*</span>
                </Label>
                <textarea
                  id="contact-message"
                  rows={5}
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  placeholder="Tell us what's going on and we'll be in touch…"
                  required
                  className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full gradient-sunset text-primary-foreground shadow-glow hover:opacity-90 transition"
              >
                {busy ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending…
                  </span>
                ) : (
                  "Send message"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SuccessState({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-8 gap-5">
      {/* Animated checkmark */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full gradient-sunset shadow-glow">
        <svg className="h-9 w-9 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <div>
        <h2 className="font-display text-3xl">Message sent!</h2>
        <p className="text-muted-foreground text-sm mt-2 max-w-xs leading-relaxed">
          Thanks{name ? `, ${name.split(" ")[0]}` : ""}! We've received your message and
          will get back to you within <strong className="text-foreground">1–2 business days</strong>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-2">
        <Button
          onClick={onReset}
          variant="outline"
          className="border-border hover:border-primary hover:text-primary"
        >
          Send another message
        </Button>
        <Button asChild className="gradient-sunset text-primary-foreground hover:opacity-90">
          <Link to="/">Back to events</Link>
        </Button>
      </div>
    </div>
  );
}
