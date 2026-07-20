import { useIsMutating } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";

export function GlobalLoader() {
  // Check if there are any global mutations running
  const isMutating = useIsMutating();
  
  // Check if the router is currently navigating between pages
  const isRouting = useRouterState({ select: (s) => s.status === "pending" });

  const isLoading = isMutating > 0 || isRouting;

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20 overflow-hidden pointer-events-none">
      <div className="h-full bg-primary animate-loader-progress w-full origin-left" />
    </div>
  );
}
