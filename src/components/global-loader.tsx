import { useRouterState } from "@tanstack/react-router";

export function GlobalLoader() {
  // Check if the router is currently navigating between pages
  // We removed useIsMutating() because it can occasionally get stuck if a background mutation hangs,
  // and local actions usually have their own inline loading states (like button spinners).
  const isRouting = useRouterState({ select: (s) => s.status === "pending" });

  if (!isRouting) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-primary/20 overflow-hidden pointer-events-none">
      <div className="h-full bg-primary animate-loader-progress w-full origin-left" />
    </div>
  );
}
