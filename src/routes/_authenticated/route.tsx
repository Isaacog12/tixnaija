import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SiteNav } from "@/components/site-nav";

// Client-only auth gate. SSR is off because the Supabase session lives in
// localStorage; gating server-side would loop on hard refresh.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/auth",
        search: { redirect: location.href },
      });
    }
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  // The support console is a full-viewport app shell: its sidebar is fixed to
  // the top edge and its own header is sticky at top:0. The site nav is sticky
  // too (z-50), so leaving it in place covered the console's header and the top
  // of its sidebar. The console has its own navigation and a back-to-dashboard
  // link, so it renders without the marketing nav.
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isConsole = pathname.startsWith("/support");

  return (
    <div className="min-h-dvh">
      {!isConsole && <SiteNav />}
      <Outlet />
    </div>
  );
}
