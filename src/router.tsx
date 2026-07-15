import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 30 s — navigating back won't re-fetch within that window
        staleTime: 30_000,
        // Keep unused cache for 5 minutes before garbage-collecting
        gcTime: 5 * 60_000,
        // Only retry once on failure (default is 3 — hammers the network on hard errors)
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
