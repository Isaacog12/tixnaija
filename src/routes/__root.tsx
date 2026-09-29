import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode, Component } from "react";
import appCss from "../styles.css?url";

import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { GlobalLoader } from "@/components/global-loader";
import { supabase } from "@/integrations/supabase/client";

// ── Render-phase crash boundary ────────────────────────────────────────────────
// Catches any JS error thrown during React render (e.g. a failed dynamic import
// or a bad hook call in a component) so users see a message instead of a blank
// screen. In dev mode the actual error is shown in an expanded panel.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background px-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Application Error</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Try refreshing — if it keeps happening, please contact us.
            </p>
            <div className="mt-6">
              <a
                href="/"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Reload app
              </a>
            </div>
            {import.meta.env.DEV && (
              <pre className="mt-6 text-left text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-4 overflow-auto max-h-48 whitespace-pre-wrap break-words">
                {(this.state.error as Error).message}
                {"\n"}
                {(this.state.error as Error).stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="relative max-w-lg text-center">
        <div className="relative mb-6">
          <h1 className="font-display text-[120px] leading-none md:text-[160px] font-bold text-foreground/5 select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">Page not found</h2>
          </div>
        </div>

        <p className="mt-4 text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">
          The event or page you're looking for doesn't exist, may have moved, or the link might be broken.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/browse"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-8 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Browse events
          </Link>
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-md border border-input bg-background px-8 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </Link>
        </div>

        {/* Secondary links */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground/60">
          <Link to="/faq" className="hover:text-foreground transition-colors">Help / FAQ</Link>
          <span className="text-border">·</span>
          <Link to="/about" className="hover:text-foreground transition-colors">Contact us</Link>
        </div>

        <div className="mt-12 flex items-baseline justify-center gap-0 opacity-50">
          <span className="font-display text-lg leading-none tracking-[0.02em] text-foreground">TIX</span>
          <span className="font-display text-lg leading-none tracking-[0.02em] font-light text-foreground">NAIJA</span>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    // Custom error logging could go here if needed in the future
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
           <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
           </svg>
        </div>
          <h1 className="font-display text-4xl mb-4 text-foreground">Something went wrong. Please refresh the page or try again.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We encountered an unexpected issue while loading this page.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-10 w-full sm:w-auto items-center justify-center rounded-md border border-input bg-background px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const canonicalUrl = `https://tixnaija.name.ng`;

    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" },
        { name: "strix-verification", content: "strix-verify-e1935f2afecbccf853fb503d5612f3ce" },
        { title: "TixNaija — Nigerian event tickets, sold fast" },
        {
          name: "description",
          content:
            "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija.",
        },
        { name: "author", content: "TixNaija" },
        { name: "theme-color", content: "#EA580C" },
        // PWA / mobile-web-app meta
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "apple-mobile-web-app-title", content: "TixNaija" },
        { property: "og:title", content: "TixNaija — Nigerian event tickets, sold fast" },
        {
          property: "og:description",
          content: "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija.",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "TixNaija — Nigerian event tickets, sold fast" },
        { name: "twitter:description", content: "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija." },
        { property: "og:image", content: "/preview.jpg" },
        { name: "twitter:image", content: "/preview.jpg" },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl },
        { rel: "manifest", href: "/manifest.json" },
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/icon-192.png", type: "image/png" },
        { rel: "apple-touch-icon", href: "/icon-192.png" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800;900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
        },
        { rel: "preload", as: "image", href: "/hero-concert.jpg" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
         * ── Theme init: MUST be first child, before HeadContent / CSS ──────────
         * Runs synchronously before the browser paints a single frame.
         * Reads localStorage preference → falls back to prefers-color-scheme.
         * Adds .dark to <html> if needed, eliminating all theme FOUC.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('tixnaija-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s==='dark'||(s===null&&d))document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
        <HeadContent />
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-PLT1VPPEQR"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-PLT1VPPEQR');
            `,
          }}
        />
      </head>
      <body className="overflow-x-hidden" suppressHydrationWarning>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const router = useRouter();

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const errorMsg = event.reason?.message || event.reason?.toString() || "";
      if (
        errorMsg.includes("message channel closed") ||
        errorMsg.includes("message port closed") ||
        errorMsg.includes("message timeout") ||
        errorMsg.includes("A listener indicated an asynchronous response")
      ) {
        console.warn("Suppressed Chrome extension message timeout error:", event.reason);
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        const { error } = await supabase.rpc("claim_guest_messages" as any);
        if (error) console.error("Failed to claim guest messages:", error);
      }
      // Re-evaluate routes when auth state changes
      router.invalidate();
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoader />
      <AppErrorBoundary>
        <main>
          <Outlet />
        </main>
      </AppErrorBoundary>
      <Toaster position="bottom-center" />
      <CookieBanner />
    </QueryClientProvider>
  );
}
