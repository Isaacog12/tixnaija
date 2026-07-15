import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data is fresh for 60 s (1 min) — significantly reduces DB load during high traffic
        staleTime: 60_000,
        // Keep unused cache for 10 minutes before garbage-collecting
        gcTime: 10 * 60_000,
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
