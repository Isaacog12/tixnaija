import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BackButton } from "@/components/back-button";
import { Label } from "@/components/ui/label";
import { Instagram, Send, PhoneCall, Mail, AlertCircle, HelpCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About Us — TixNaija" },
      {
        name: "description",
        content:
          "TixNaija is an independent Nigerian ticketing platform built to make event creation seamless. We are a distinct company, not affiliated with Tix Africa.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "TixNaija",
          url: "https://www.tixnaija.name.ng",
          description: "TixNaija is a proudly independent Nigerian ticketing platform built to make event creation and attendance seamless.",
          foundingDate: "2026",
          founder: { "@type": "Person", "name": "Ogbomo Isaac" },
          sameAs: ["https://www.instagram.com/tixnaija/"]
        }),
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

function AboutPage() {
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
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number (at least 10 digits).");
      return;
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      toast.error("Please enter a message (at least 10 characters).");
      return;
    }

    setBusy(true);
    
    const { error } = await supabase.from("contact_messages" as any).insert({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      topic: form.topic || "Other",
      message: form.message.trim(),
    } as any);

    setBusy(false);

    if (error) {
      toast.error("Failed to send message. Please try again.");
      console.error(error);
      return;
    }

    setSent(true);
  }

  return (
    <div className="min-h-dvh relative overflow-hidden">
      <SiteNav />
      <div className="mx-auto max-w-7xl px-4 pt-6 w-full relative z-20">
        <BackButton />
      </div>
      
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

      {/* ── Hero ── */}
      <div className="relative border-b border-border/40 py-16 md:py-24 overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />
        <div 
          className="mx-auto max-w-6xl px-4 text-center md:text-left relative z-10"
        >
          <h1 className="type-heading-xl mb-6">
            About <span className="text-gradient-sunset">Us</span>
          </h1>
          <p  className="text-muted-foreground text-lg md:text-2xl max-w-2xl font-medium leading-relaxed mx-auto md:mx-0">
            TixNaija is a proudly independent Nigerian ticketing platform built to make event creation and attendance seamless.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-16 items-start">

        <div className="space-y-12">
          
          <div>
            <h2 className="font-display text-3xl md:text-4xl mb-4 tracking-tight">Who owns TixNaija?</h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-4">
              TixNaija is an independent platform founded by Ogbomo Isaac in 2026. Our goal is to simplify event ticketing for organizers and attendees across Nigeria.
            </p>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 mt-6 mb-12">
              <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Not affiliated with Tix Africa
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Please note that TixNaija is a completely standalone platform and is <strong>not connected, affiliated, or associated with Tix Africa</strong> in any way. 
              </p>
              <div className="bg-background/60 rounded-xl p-4 border border-border/40">
                <h4 className="font-semibold text-foreground mb-1">Is TixNaija the same as Tix Africa?</h4>
                <p className="text-sm text-muted-foreground">
                  No. TixNaija is a distinct and completely separate company, founded independently by Ogbomo Isaac in 2026.
                </p>
              </div>
            </div>

            <h2 className="font-display text-3xl md:text-4xl mb-4 tracking-tight mt-12">Get in touch</h2>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-xl">
              Whether you're an attendee with a ticket problem or an organizer needing support, our team is ready to help you succeed.
            </p>
          </div>

          {/* Direct contact */}
          <div  className="grid sm:grid-cols-2 gap-4">
            <a
              
              href="tel:+2349011275275"
              className="flex items-center gap-5 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 transition-all duration-[350ms] ease-out hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 press-sm group hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <PhoneCall className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Call / WhatsApp</p>
                <p className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">+234 901 127 5275</p>
              </div>
            </a>

            <a
              
              href="mailto:tixnaijaapp@gmail.com"
              className="flex items-center gap-5 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 transition-all duration-[350ms] ease-out hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 press-sm group hover:-translate-y-0.5"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Mail className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Email us</p>
                <p className="text-base font-semibold text-foreground group-hover:text-primary transition-colors truncate w-full" title="tixnaijaapp@gmail.com">tixnaijaapp@gmail.com</p>
              </div>
            </a>

            <a
              
              href="https://www.instagram.com/tixnaija/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-5 rounded-3xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 transition-all duration-[350ms] ease-out hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 press-sm group hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1"
            >
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Instagram className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">Follow us</p>
                <p className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">@tixnaija</p>
              </div>
            </a>
          </div>

          <div  className="grid sm:grid-cols-2 gap-4">
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
                desc: "Please note that all ticket sales are final and non-refundable.",
                icon: "🚫",
              },
              {
                label: "Fraud Reports",
                desc: "Spotted a fake event? Report it and we'll investigate.",
                icon: "🚨",
              },
            ].map(({ label, desc, icon }) => (
              <div
                
                key={label}
                className="rounded-3xl border border-border/60 bg-card/40 p-6 transition-colors hover:border-primary/30 hover:bg-card/80"
              >
                <span className="text-3xl block mb-4">{icon}</span>
                <p className="font-bold text-lg mb-2">{label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div  className="pt-8 border-t border-border/40 flex flex-wrap gap-6 text-sm font-semibold text-muted-foreground">
            <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/careers" className="hover:text-primary transition-colors">Careers</Link>
          </div>
        </div>

        {/* Right — form card */}
        <div 
          
          
          
          className="rounded-[2.5rem] border border-border/40 bg-card/80 p-8 md:p-10 shadow-2xl shadow-primary/5 backdrop-blur-xl sticky top-28"
        >
          
            {sent ? (
              <div 
                key="success"
                
                
                
                className="flex flex-col items-center text-center py-12 gap-6"
              >
                <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-green-500/10 text-green-500 mb-2">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping opacity-50" />
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <div>
                  <h2 className="font-display text-4xl mb-3 text-foreground">Message sent!</h2>
                  <p className="text-muted-foreground text-lg max-w-xs mx-auto leading-relaxed">
                    Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""}! We've received your message and
                    will get back to you within <strong className="text-foreground">1-2 business days</strong>.
                  </p>
                </div>
                <div className="flex flex-col gap-3 mt-6 w-full">
                  <Button asChild className="gradient-sunset text-primary-foreground hover:opacity-90 rounded-xl h-12 w-full text-base font-semibold shadow-lg shadow-primary/25">
                    <Link to="/">Back to events</Link>
                  </Button>
                  <Button
                    onClick={() => { setSent(false); setForm({ name: "", email: "", phone: "", topic: "", message: "" }); }}
                    variant="outline"
                    className="border-border/60 hover:border-primary hover:text-primary rounded-xl h-12 w-full text-base font-medium"
                  >
                    Send another message
                  </Button>
                </div>
              </div>
            ) : (
              <form 
                key="form"
                
                
                
                onSubmit={onSubmit} 
                className="space-y-6" 
                noValidate
              >
                <div className="mb-8">
                  <h2 className="font-display text-3xl md:text-4xl leading-tight mb-2 tracking-tight">Drop a message</h2>
                  <p className="text-sm text-muted-foreground font-medium">
                    All fields marked <span className="text-primary font-bold">*</span> are required.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                    Full name <span className="text-primary">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Chidera Okoye"
                    autoComplete="name"
                    required
                    className="h-12 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
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
                    className="h-12 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-phone" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                    Phone number (Optional)
                  </Label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+234 800 000 0000"
                    autoComplete="tel"
                    className="h-12 rounded-xl border-border/60 bg-background/50 focus-visible:ring-primary/20 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-topic" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">Topic</Label>
                  <select
                    id="contact-topic"
                    value={form.topic}
                    onChange={(e) => update("topic", e.target.value)}
                    className="w-full h-12 rounded-xl border border-border/60 bg-background/50 px-4 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: `right 1rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.5em 1.5em` }}
                  >
                    <option value="" disabled className="text-muted-foreground">Select a topic...</option>
                    {TOPICS.map((t) => (
                      <option key={t} value={t} className="bg-background text-foreground">{t}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-message" className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                    Message <span className="text-primary">*</span>
                  </Label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => update("message", e.target.value)}
                    placeholder="Tell us what's going on and we'll be in touch..."
                    required
                    className="w-full rounded-xl border border-border/60 bg-background/50 p-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  We use your information solely to reply to your inquiry in line with our{" "}
                  <Link to="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full h-14 rounded-xl gradient-sunset text-primary-foreground glow-primary shadow-lg press-md transition-all hover:-translate-y-0.5 text-lg font-bold mt-4"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send message <Send className="h-5 w-5 ml-1" />
                    </span>
                  )}
                </Button>
              </form>
            )}
          
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
