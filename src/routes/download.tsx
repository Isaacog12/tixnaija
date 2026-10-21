import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ShieldAlert, ChevronRight, Package, ArrowDown, RefreshCcw } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/integrations/supabase/client";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Route = createFileRoute("/download")({
  // Admin-only: redirect non-admins to the homepage.
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/" });

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Download TixNaija for Android" },
      {
        name: "description",
        content:
          "Download the TixNaija Android app (APK) and install it directly on your phone — no Play Store needed.",
      },
    ],
  }),
  component: DownloadPage,
});

// ── Replace this URL after running PWABuilder and uploading the APK ──────────
const APK_DOWNLOAD_URL: string | null = "https://www.dropbox.com/scl/fi/22trrqd8vclf0s3ouvt4j/application-ce0f4b69-e1af-482e-940d-2c0fde2fd9a7.apk?rlkey=mimyzpqx39oxu9wigon5ij7gx&st=pum7uev7&dl=1";
const APK_VERSION = "1.0.1"; // User requested strict 1.0.0 versioning for OTA

const STAGGER_CHILD: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0, duration: 0.8 } }
};

const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1
    }
  }
};

function DownloadPage() {
  const hasApk = Boolean(APK_DOWNLOAD_URL);
  const [hasRead, setHasRead] = useState(false);

  return (
    <div className="min-h-dvh bg-[#09090b] text-neutral-50 selection:bg-primary/30 font-sans overflow-hidden">
      {/* ── Background Ambience ── */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-start justify-center overflow-hidden">
        <div className="absolute -top-[20%] w-[1000px] h-[800px] bg-primary/10 rounded-[100%] blur-[120px] opacity-70 mix-blend-screen" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-24 sm:py-32">
        <motion.div
          variants={STAGGER_CONTAINER}
          initial="hidden"
          animate="show"
          className="flex flex-col items-center text-center mb-32"
        >
          {/* App Icon */}
          <motion.div 
            variants={STAGGER_CHILD}
            className="relative mb-10"
          >
            <div className="absolute inset-0 bg-primary/40 blur-3xl rounded-full scale-110" />
            <motion.div 
              whileHover={{ scale: 1.04, rotate: 2 }}
              transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 bg-black"
            >
              <img src="/icon-192.png" alt="TixNaija" className="w-full h-full object-cover" />
            </motion.div>
          </motion.div>

          <motion.h1 
            variants={STAGGER_CHILD}
            className="font-display text-5xl sm:text-7xl lg:text-[5.5rem] font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-8 leading-[1.1]"
          >
            TixNaija for Android.
          </motion.h1>

          <motion.p 
            variants={STAGGER_CHILD}
            className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-12 tracking-tight"
          >
            Browse events, secure tickets, and skip the line with offline QR codes. 
            Packaged as a lightning-fast native app.
          </motion.p>

          <motion.div variants={STAGGER_CHILD} className="flex flex-col items-center gap-5">
            <div 
              className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md cursor-pointer hover:bg-white/10 transition-colors" 
              onClick={() => setHasRead(!hasRead)}
            >
              <div className={cn("w-6 h-6 rounded-md border flex items-center justify-center transition-colors", hasRead ? "bg-white border-white text-black" : "border-white/20")}>
                {hasRead && <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              <span className="text-white/70 text-sm font-medium">
                I have read the <a href="#installation" className="text-white underline underline-offset-4 hover:text-white/80 transition-colors" onClick={(e) => { e.stopPropagation(); document.getElementById('installation')?.scrollIntoView({ behavior: 'smooth' }) }}>installation guide (readme)</a>
              </span>
            </div>

            {hasApk ? (
              <motion.a
                whileHover={hasRead ? { scale: 1.02 } : {}}
                whileTap={hasRead ? { scale: 0.98 } : {}}
                href={hasRead ? APK_DOWNLOAD_URL! : undefined}
                download={hasRead ? "tixnaija.apk" : undefined}
                onClick={(e) => {
                  if (!hasRead) {
                    e.preventDefault();
                  }
                }}
                className={cn(
                  "group relative inline-flex items-center justify-center gap-3 h-14 sm:h-16 px-10 rounded-full font-semibold text-lg overflow-hidden transition-all",
                  hasRead 
                    ? "bg-white text-black shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]" 
                    : "bg-white/10 text-white/30 cursor-not-allowed border border-white/5"
                )}
              >
                <span className="relative z-10 flex items-center gap-3">
                  Download APK
                  <ArrowDown className={cn("h-5 w-5 transition-transform", hasRead ? "text-black/50 group-hover:translate-y-0.5" : "text-white/20")} />
                </span>
              </motion.a>
            ) : (
              <div className="inline-flex items-center gap-3 h-14 sm:h-16 px-10 rounded-full bg-white/5 border border-white/10 text-white/50 font-semibold text-lg backdrop-blur-md">
                <Package className="h-5 w-5" />
                APK assembling...
              </div>
            )}
            <div className="flex items-center gap-3 text-sm font-medium text-white/30 tracking-wide uppercase">
              <span>Android 8.0+</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>v{APK_VERSION}</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Free</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Bento Box Installation Guide */}
        <motion.div 
          id="installation"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", bounce: 0, duration: 1 }}
          className="space-y-6"
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold tracking-tighter">Installation is instant</h2>
            <p className="text-white/40 mt-3 text-lg tracking-tight">Sideloading takes just 60 seconds.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <BentoCard 
              step="01" 
              title="Download & Open" 
              desc="Save the APK to your Downloads folder and tap the notification to open it immediately."
              className="md:col-span-2 lg:col-span-1"
            />
            <BentoCard 
              step="02" 
              title="Allow Unknown Sources" 
              desc="When prompted by Android, tap Settings and toggle 'Allow from this source' to ON. This is standard for all apps outside the Play Store."
              highlight
            />
            <BentoCard 
              step="03" 
              title="Install & Enjoy" 
              desc="Tap Install, wait just a few seconds, and you're ready to start exploring events." 
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6">
            <InfoCard 
              icon={ShieldAlert}
              title="Play Protect Warning"
              desc="Google Play Protect may flag new APKs as 'not commonly downloaded.' This is not a malware warning — it happens for all new apps. Tap Install Anyway to proceed safely."
            />
            <InfoCard 
              icon={RefreshCcw}
              title="Over-The-Air Updates"
              desc="TixNaija features built-in OTA updates. You'll automatically receive new features and bug fixes silently in the background — no need to redownload the APK ever again."
            />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-32 text-center pb-12"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-white/70 hover:text-white transition-all text-sm font-medium backdrop-blur-md group"
          >
            <ChevronRight className="h-4 w-4 rotate-180 text-white/40 group-hover:-translate-x-0.5 transition-transform" />
            Back to TixNaija
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function BentoCard({ step, title, desc, className, highlight }: { step: string, title: string, desc: string, className?: string, highlight?: boolean }) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-[2rem] p-8 sm:p-10 flex flex-col justify-between min-h-[260px]",
      "border border-white/[0.08] bg-white/[0.02] backdrop-blur-2xl",
      "transition-colors duration-500 hover:bg-white/[0.04]",
      highlight && "border-primary/20 bg-primary/[0.03]",
      className
    )}>
      {highlight && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50 pointer-events-none" />
      )}
      <div className="text-6xl font-display font-bold tracking-tighter text-white/5 mb-10">
        {step}
      </div>
      <div className="relative z-10">
        <h3 className={cn("text-xl sm:text-2xl font-semibold mb-3 tracking-tight", highlight ? "text-primary" : "text-white")}>{title}</h3>
        <p className="text-white/50 leading-relaxed text-sm sm:text-base">{desc}</p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="rounded-[2rem] p-8 sm:p-10 border border-white/[0.05] bg-white/[0.01] backdrop-blur-xl flex flex-col sm:flex-row gap-6 items-start">
      <div className="p-4 rounded-2xl bg-white/5 text-white/70 shadow-inner">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h3 className="text-lg sm:text-xl font-semibold mb-3 tracking-tight text-white/90">{title}</h3>
        <p className="text-white/40 leading-relaxed text-sm sm:text-base">{desc}</p>
      </div>
    </div>
  );
}
