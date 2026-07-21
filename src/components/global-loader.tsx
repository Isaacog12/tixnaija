import { useRouterState } from "@tanstack/react-router";

export function GlobalLoader() {
  // useRouterState is more reliable than useIsMutating for page transitions.
  // On mobile some browsers don't fire the "pending" state long enough;
  // we add a CSS animation that runs for 1.5s so it's always visible.
  const isRouting = useRouterState({ select: (s) => s.status === "pending" });

  if (!isRouting) return null;

  return (
    <div
      key={Date.now()} // force remount on each navigation so animation restarts
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden pointer-events-none"
      style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}
    >
      <div
        className="h-full animate-loader-progress"
        style={{ background: "var(--gradient-sunset)", width: "100%" }}
      />
    </div>
  );
}

