import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { CookieBanner } from "@/components/cookie-banner";
import { GlobalLoader } from "@/components/global-loader";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* Decorative background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative max-w-lg text-center">
        {/* Big 404 */}
        <div className="relative mb-2">
          <h1 className="font-display text-[120px] leading-none md:text-[160px] text-gradient-sunset select-none">
            404
          </h1>
          <div className="absolute inset-0 font-display text-[120px] leading-none md:text-[160px] text-foreground/[0.03] blur-sm select-none">
            404
          </div>
        </div>

        <h2 className="text-2xl font-semibold tracking-tight">Page not found</h2>
        <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          The event or page you're looking for doesn't exist, may have moved, or the link might be broken.
        </p>

        {/* Primary CTA */}
        <div className="mt-8">
          <Link
            to="/browse"
            className="inline-flex items-center justify-center rounded-xl gradient-sunset px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Browse events
          </Link>
        </div>

        {/* Secondary links */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">Home</Link>
          <span className="text-border">·</span>
          <Link to="/faq" className="hover:text-primary transition-colors">Help / FAQ</Link>
          <span className="text-border">·</span>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact us</Link>
        </div>

        {/* Brand mark */}
        <div className="mt-12 flex items-baseline justify-center gap-0">
          <span className="font-display text-lg leading-none tracking-[0.02em] text-foreground/40">TIX</span>
          <span className="font-display text-lg leading-none tracking-[0.02em] font-light text-gradient-sunset opacity-40">NAIJA</span>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try refreshing, or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md gradient-sunset px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TixNaija — Nigerian event tickets, sold fast" },
      {
        name: "description",
        content:
          "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija.",
      },
      { name: "author", content: "TixNaija" },
      { name: "theme-color", content: "#EA580C" },
      { property: "og:title", content: "TixNaija — Nigerian event tickets, sold fast" },
      {
        property: "og:description",
        content: "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "TixNaija — Nigerian event tickets, sold fast" },
      { name: "twitter:description", content: "Discover concerts, comedy shows, conferences and parties across Nigeria. Buy tickets and get an instant QR code from TixNaija." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/17b326b8-1a1a-4d1e-bc3b-84034788fc9e/id-preview-34b380a2--71ce14f9-6aac-4f6d-b07d-7d28edaf34b6.lovable.app-1783687480763.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/17b326b8-1a1a-4d1e-bc3b-84034788fc9e/id-preview-34b380a2--71ce14f9-6aac-4f6d-b07d-7d28edaf34b6.lovable.app-1783687480763.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700&display=swap",
        crossOrigin: "anonymous"
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
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
    };
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoader />
      <Outlet />
      <Toaster position="top-center" richColors />
      <CookieBanner />
    </QueryClientProvider>
  );
}
