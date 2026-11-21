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
import { lazy, Suspense, useEffect, useState, type ReactNode, Component } from "react";
import appCss from "../styles.css?url";

import { DynamicIsland } from "@/components/ui/dynamic-island";
import { CookieBanner } from "@/components/cookie-banner";
import { GlobalLoader } from "@/components/global-loader";
import { supabase } from "@/integrations/supabase/client";

// The support assistant is a floating widget no visitor needs on first paint.
// Kept out of the root chunk and warmed during idle time instead.
const loadSupportChat = () => import("@/components/support-chat");
const SupportChat = lazy(() => loadSupportChat().then((m) => ({ default: m.SupportChat })));

// ── Render-phase crash boundary ────────────────────────────────────────────────
// Catches any JS error thrown during React render (e.g. a failed dynamic import
// or a bad hook call in a component) so users see a message instead of a blank
// screen. In dev mode the actual error is shown in an expanded panel.
// ── Render-phase crash boundary ────────────────────────────────────────────────
// Catches any JS error thrown during React render so users see a calm, reassuring
// Apple-grade recovery screen instead of a blank page or jarring technical crash.
class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; showDetails: boolean }
> {
  state = { error: null, showDetails: false };

  static getDerivedStateFromError(error: Error) {
    return { error, showDetails: false };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[AppErrorBoundary]", error, info);
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12 selection:bg-primary/20">
          {/* Ambient lighting mesh */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[540px] rounded-full bg-primary/10 blur-[120px]" />
          </div>

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card/75 p-8 sm:p-10 text-center shadow-2xl backdrop-blur-2xl">
            {/* Reassuring status badge */}
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
              <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Page Interrupted
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Your session and tickets are completely safe. A quick refresh usually restores the page immediately.
            </p>

            {/* Apple fluid action buttons */}
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-sunset px-6 text-sm font-semibold text-primary-foreground shadow-glow transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Refresh Page
              </button>
              <a
                href="/"
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border/80 bg-secondary/50 px-6 text-sm font-medium text-foreground transition-all duration-150 hover:bg-secondary/80 active:scale-[0.98]"
              >
                Return to Home
              </a>
            </div>

            {/* Support link */}
            <div className="mt-6 pt-6 border-t border-border/40 text-xs text-muted-foreground">
              Persistent issue?{" "}
              <a href="/support" className="text-primary font-medium hover:underline">
                Contact Customer Support
              </a>
            </div>

            {/* Dev trace */}
            {import.meta.env.DEV && (
              <div className="mt-6 text-left">
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="text-[11px] text-muted-foreground/80 hover:text-foreground font-mono underline"
                >
                  {this.state.showDetails ? "Hide technical details" : "Show technical details (Dev)"}
                </button>
                {this.state.showDetails && (
                  <pre className="mt-3 overflow-auto max-h-48 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-[11px] font-mono text-destructive whitespace-pre-wrap break-words">
                    {(this.state.error as Error).message}
                    {"\n"}
                    {(this.state.error as Error).stack}
                  </pre>
                )}
              </div>
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-16 selection:bg-primary/20">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[600px] rounded-full bg-primary/8 blur-[130px]" />
      </div>

      <div className="relative z-10 max-w-lg text-center">
        <div className="relative mb-6 select-none">
          <span className="font-display text-[110px] sm:text-[140px] font-bold tracking-tight text-foreground/5 leading-none block">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
              Page Not Found
            </h1>
          </div>
        </div>

        <p className="mt-2 text-sm sm:text-base leading-relaxed text-muted-foreground max-w-sm mx-auto">
          The event or link you're looking for doesn't exist, has ended, or may have moved.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/browse"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-2xl gradient-sunset px-8 text-sm font-semibold text-primary-foreground shadow-glow transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
          >
            Explore Events
          </Link>
          <Link
            to="/"
            className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-2xl border border-border/80 bg-secondary/50 px-8 text-sm font-medium text-foreground transition-all duration-150 hover:bg-secondary/80 active:scale-[0.98]"
          >
            Go Home
          </Link>
        </div>

        {/* Secondary helpful links */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
          <Link to="/browse" className="hover:text-foreground transition-colors">Concerts & Shows</Link>
          <span className="text-border">·</span>
          <Link to="/my-tickets" className="hover:text-foreground transition-colors">Find My Tickets</Link>
          <span className="text-border">·</span>
          <Link to="/support" className="hover:text-foreground transition-colors">Support Desk</Link>
        </div>

        <div className="mt-10 flex items-baseline justify-center gap-0.5 opacity-40">
          <span className="font-display text-sm tracking-[0.08em] font-bold text-foreground">TIX</span>
          <span className="font-display text-sm tracking-[0.08em] font-light text-foreground">NAIJA</span>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-background px-4 py-12 selection:bg-primary/20">
      {/* Ambient lighting mesh */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[540px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border/80 bg-card/75 p-8 sm:p-10 text-center shadow-2xl backdrop-blur-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
          <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0 3.75h.007M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Unable to Load Section
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We couldn't load this content right now. Your data and account are untouched.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl gradient-sunset px-6 text-sm font-semibold text-primary-foreground shadow-glow transition-all duration-150 hover:opacity-95 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-border/80 bg-secondary/50 px-6 text-sm font-medium text-foreground transition-all duration-150 hover:bg-secondary/80 active:scale-[0.98]"
          >
            Return to Home
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-border/40 text-xs text-muted-foreground">
          Need assistance?{" "}
          <a href="/support" className="text-primary font-medium hover:underline">
            Visit Support Desk
          </a>
        </div>
      </div>
    </div>
  );
}

const SITE_ORIGIN = "https://tixnaija.name.ng";

/**
 * Signed-in app screens. They hold private, per-user data, so they are marked
 * noindex and get no canonical URL.
 */
const PRIVATE_APP_PATHS = [
  "/account",
  "/admin",
  "/dashboard",
  "/events",
  "/notifications",
  "/support",
  "/tickets",
];

/**
 * Tables the signed-out pages actually read. Kept narrow on purpose — see the
 * realtime effect in RootComponent.
 */
const PUBLIC_REALTIME_TABLES = ["events", "ticket_types", "sponsored_banners"];

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ matches }) => {
    /**
     * The deepest match is the route actually being rendered. Deriving the
     * canonical from it replaces a hardcoded domain root that made every page
     * on the site declare itself a duplicate of the home page.
     *
     * Search params are intentionally dropped so filtered variants such as
     * /browse?c=Concerts all resolve to a single canonical URL.
     */
    const leafMatch = matches?.[matches.length - 1];
    const pathname = leafMatch?.pathname ?? "/";
    const isPrivateAppPath = PRIVATE_APP_PATHS.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

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
        // Social crawlers ignore relative og:image URLs — these must be absolute
        // or WhatsApp/Twitter/Facebook share no preview at all.
        { property: "og:image", content: `${SITE_ORIGIN}/preview.jpg` },
        { name: "twitter:image", content: `${SITE_ORIGIN}/preview.jpg` },
        ...(isPrivateAppPath ? [{ name: "robots", content: "noindex, nofollow" }] : []),
      ],
      links: [
        ...(isPrivateAppPath ? [] : [{ rel: "canonical", href: `${SITE_ORIGIN}${pathname}` }]),
        { rel: "manifest", href: "/manifest.json" },
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/icon-192.png", type: "image/png" },
        { rel: "apple-touch-icon", href: "/icon-192.png" },
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
      </head>
      <body className="overflow-x-hidden" suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2.5 focus:bg-background focus:text-foreground focus:border focus:border-primary focus:rounded-xl focus:shadow-2xl focus:font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
        >
          Skip to main content
        </a>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  const router = useRouter();

  // Client-only widgets are gated on mount so SSR never renders them (avoids a
  // hydration mismatch) and their chunks load after the page is interactive.
  const [mounted, setMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setMounted(true);

    const warmSupportChat = () => {
      loadSupportChat().catch(() => {
        // Non-critical: the chunk is fetched again on the next render attempt.
      });
    };
    // Probed through a loosely-typed alias on purpose: `requestIdleCallback` is
    // declared non-optional in TS's DOM lib, so testing it directly on `window`
    // narrows the fallback branch to `never`.
    const scheduler = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    const supportsIdleCallback = typeof scheduler.requestIdleCallback === "function";

    if (supportsIdleCallback) {
      const idle = window.requestIdleCallback(warmSupportChat, { timeout: 4000 });
      return () => window.cancelIdleCallback(idle);
    }
    const timer = window.setTimeout(warmSupportChat, 1500);
    return () => window.clearTimeout(timer);
  }, []);

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
      setIsAuthenticated(Boolean(session));
      if (event === "SIGNED_IN" && session) {
        const { error } = await supabase.rpc("claim_guest_messages");
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

  /**
   * Realtime cache sync.
   *
   * Signed-in users keep the whole-schema subscription: organiser dashboards and
   * the admin screens read orders, tickets, messages and audit logs, and those
   * have to move live during a sale.
   *
   * Anonymous visitors are restricted to the tables the public pages read.
   * Previously every socket received every write in the schema — orders,
   * tickets, support messages, audit logs — only to invalidate a cache holding
   * two or three public queries. Ticket availability on event pages still
   * updates live, which is the part visitors actually notice.
   */
  useEffect(() => {
    const invalidateCache = () => {
      queryClient.invalidateQueries();
    };

    const channel = supabase.channel(isAuthenticated ? "global-sync" : "public-sync");

    if (isAuthenticated) {
      channel.on("postgres_changes", { event: "*", schema: "public" }, invalidateCache);
    } else {
      for (const table of PUBLIC_REALTIME_TABLES) {
        channel.on("postgres_changes", { event: "*", schema: "public", table }, invalidateCache);
      }
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoader />
      <AppErrorBoundary>
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>
      </AppErrorBoundary>
      <DynamicIsland />
      <CookieBanner />
      {mounted && (
        <Suspense fallback={null}>
          <SupportChat />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
