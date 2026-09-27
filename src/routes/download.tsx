import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Smartphone, ShieldAlert, ChevronRight, Package } from "lucide-react";

export const Route = createFileRoute("/download")({
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
const APK_DOWNLOAD_URL: string | null = "/Tixnaijav1.apk";
const APK_VERSION = "1.0.1"; // bump when you re-upload

function DownloadPage() {
  const hasApk = Boolean(APK_DOWNLOAD_URL);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.14_0.02_40)] via-[oklch(0.18_0.04_40)] to-[oklch(0.14_0.02_40)] border-b border-border">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full bg-primary/5 blur-2xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="mx-auto mb-6 w-20 h-20 rounded-2xl overflow-hidden shadow-lg ring-2 ring-primary/30">
            <img src="/icon-192.png" alt="TixNaija app icon" className="w-full h-full object-cover" />
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-foreground mb-4">
            TixNaija for Android
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            The full TixNaija experience — browse events, buy tickets, and show
            your QR code at the door — packaged as a native Android app.
          </p>

          {/* ── Download CTA ─────────────────────────────────────────────── */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            {hasApk ? (
              <a
                id="android-apk-download"
                href={APK_DOWNLOAD_URL!}
                download="tixnaija.apk"
                className="inline-flex items-center justify-center w-full sm:w-auto gap-3 h-14 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-lg hover:bg-primary/90 active:scale-95 transition-all duration-200"
              >
                <Download className="h-5 w-5 shrink-0" />
                Download APK
              </a>
            ) : (
              <div className="inline-flex items-center gap-3 h-14 px-8 rounded-xl bg-muted text-muted-foreground font-semibold text-base cursor-not-allowed select-none border border-border">
                <Package className="h-5 w-5 shrink-0" />
                APK coming soon
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground/60">Android only · Free download · v{APK_VERSION}</p>
        </div>
      </div>

      {/* ── Install guide ──────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            First-time install: allow unknown sources
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          Android blocks apps from outside the Play Store by default. You'll see
          a &ldquo;For your security&rdquo; warning the first time — this is
          normal. Follow these steps once, and installs will work instantly from
          then on.
        </p>

        <ol className="space-y-5">
          {[
            {
              step: 1,
              title: "Download the APK",
              body: "Tap the Download button above. Your browser will save tixnaija.apk to your Downloads folder.",
            },
            {
              step: 2,
              title: "Open the file",
              body: 'Tap the downloaded file in your notification bar, or open your Files app → Downloads → tixnaija.apk.',
            },
            {
              step: 3,
              title: 'Allow "Install unknown apps" for your browser',
              body: 'Android will show a prompt: "For your security, your phone is not allowed to install unknown apps from this source." Tap Settings on that prompt.',
            },
            {
              step: 4,
              title: "Toggle the permission on",
              body: 'On the settings screen that opens, toggle "Allow from this source" to ON, then tap the back button.',
            },
            {
              step: 5,
              title: "Tap Install",
              body: "Android will return to the install screen. Tap Install, wait a few seconds, then tap Open.",
            },
            {
              step: 6,
              title: "Done — find TixNaija on your home screen",
              body: "The app runs as a full-screen web experience. You can disable the 'unknown sources' permission again afterwards if you prefer.",
            },
          ].map(({ step, title, body }) => (
            <li key={step} className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm mt-0.5">
                {step}
              </div>
              <div>
                <p className="font-medium text-foreground text-sm">{title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* ── Play Protect note ───────────────────────────────────────────── */}
        <div className="mt-10 rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-start gap-3">
            <Smartphone className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">About the "not commonly downloaded" warning</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                Google Play Protect may flag the APK as "not commonly
                downloaded" on first install — this is automatic for any new
                APK and fades as install volume grows. It's not a malware
                warning. Tap <strong>Install anyway</strong> to proceed.
              </p>
            </div>
          </div>
        </div>

        {/* ── Updates note ────────────────────────────────────────────────── */}
        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-start gap-3">
            <Download className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Staying up to date</p>
              <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                There's no auto-update outside the Play Store. When a new version is
                released, return to this page and download the latest APK — Android
                will upgrade the existing install automatically.
              </p>
            </div>
          </div>
        </div>

        {/* ── Back to site ────────────────────────────────────────────────── */}
        <div className="mt-12 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            Back to TixNaija
          </Link>
        </div>
      </div>
    </div>
  );
}
