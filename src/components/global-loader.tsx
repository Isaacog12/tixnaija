import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export function GlobalLoader() {
  const isRouting = useRouterState({ select: (s) => s.status === "pending" });

  // Safety valve: if the router never clears "pending" (e.g. a beforeLoad that
  // throws without a redirect, or an unhandled async error), force-hide the
  // loader after 3 s so it can never get permanently stuck.
  const [safetyClear, setSafetyClear] = useState(false);

  useEffect(() => {
    if (!isRouting) {
      setSafetyClear(false);
      return;
    }
    const timer = setTimeout(() => setSafetyClear(true), 3000);
    return () => clearTimeout(timer);
  }, [isRouting]);

  if (!isRouting || safetyClear) return null;

  return (
    <div
      key={String(isRouting)} // remount only when routing state changes (not every render)
      className="fixed top-0 left-0 right-0 z-[100] h-[3px] overflow-hidden pointer-events-none"
      style={{ backgroundColor: "hsl(var(--primary) / 0.15)" }}
    >
      <div
        className="h-full w-full animate-loader-progress"
        style={{ background: "var(--gradient-sunset)", transformOrigin: "left" }}
      />
    </div>
  );
}
