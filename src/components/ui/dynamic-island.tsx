import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, Info, Loader2, X } from "lucide-react";

import {
  dismiss,
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type IslandKind,
} from "@/lib/island-store";
import { cn } from "@/lib/utils";

/**
 * The Dynamic Island.
 *
 * A single pill pinned to the top centre of the screen. It blooms out of the
 * top edge, morphs between a compact summary and an expanded card, and retracts
 * on its own. Deliberately one at a time — a newer notification replaces the
 * current one, so it never grows into a stack the way a toast list does.
 */

const TONE: Record<IslandKind, { border: string; icon: string; bar: string }> = {
  success: {
    border: "border-emerald-500/30",
    icon: "bg-emerald-500/15 text-emerald-400",
    bar: "bg-emerald-400/50",
  },
  error: {
    border: "border-red-500/40",
    icon: "bg-red-500/15 text-red-400",
    bar: "bg-red-400/50",
  },
  info: {
    border: "border-white/10",
    icon: "bg-white/10 text-zinc-300",
    bar: "bg-white/25",
  },
  loading: {
    border: "border-white/10",
    icon: "bg-white/10 text-zinc-300",
    bar: "bg-white/20",
  },
};

function IslandIcon({ kind }: { kind: IslandKind }) {
  const className = "h-3.5 w-3.5";
  if (kind === "success") return <Check className={className} strokeWidth={2.5} />;
  if (kind === "error") return <AlertTriangle className={className} strokeWidth={2.2} />;
  if (kind === "loading") return <Loader2 className={cn(className, "animate-spin")} />;
  return <Info className={className} />;
}

export function DynamicIsland() {
  const notification = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const notificationId = notification?.id;

  // Each new notification starts compact, like a fresh island state.
  useEffect(() => {
    setOpen(false);
  }, [notificationId]);

  // Retract on the notification's own timer, paused while it is expanded so the
  // message cannot disappear mid-read.
  useEffect(() => {
    if (!notification) return;
    if (notification.duration <= 0 || open) return;
    const timer = window.setTimeout(() => dismiss(notification.id), notification.duration);
    return () => window.clearTimeout(timer);
  }, [notification, open]);

  const close = useCallback(() => dismiss(notification?.id), [notification?.id]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3"
      style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
    >
      <AnimatePresence>
        {notification && (
          <motion.div
            key={notification.id}
            layout
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.84 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.9 }}
            transition={
              reduceMotion
                ? { duration: 0.12 }
                : { type: "spring", stiffness: 420, damping: 32, mass: 0.7 }
            }
            role={notification.kind === "error" ? "alert" : "status"}
            aria-live={notification.kind === "error" ? "assertive" : "polite"}
            onClick={() => {
              if (notification.description || notification.action) setOpen((value) => !value);
            }}
            onMouseEnter={() => {
              if (notification.description || notification.action) setOpen(true);
            }}
            onMouseLeave={() => setOpen(false)}
            className={cn(
              "pointer-events-auto relative flex w-fit max-w-[min(92vw,26rem)] overflow-hidden border bg-zinc-950/95 text-zinc-50",
              "shadow-[0_18px_50px_-12px_rgba(0,0,0,0.85)] backdrop-blur-xl",
              TONE[notification.kind].border,
              open
                ? "items-start gap-3 rounded-3xl px-4 py-3.5"
                : "items-center gap-2.5 rounded-full px-3 py-2",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                TONE[notification.kind].icon,
              )}
            >
              <IslandIcon kind={notification.kind} />
            </span>

            <div className="min-w-0">
              <p
                className={cn(
                  "text-[13px] font-medium leading-tight",
                  open ? "whitespace-normal" : "max-w-[15rem] truncate",
                )}
              >
                {notification.title}
              </p>
              {open && notification.description && (
                <p className="mt-1 text-[11.5px] leading-snug text-zinc-400">
                  {notification.description}
                </p>
              )}
              {open && notification.action && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    close();
                    notification.action?.onClick();
                  }}
                  className="mt-2 inline-flex h-7 items-center rounded-full bg-white/10 px-3 text-[11px] font-semibold text-zinc-100 transition-colors hover:bg-white/15"
                >
                  {notification.action.label}
                </button>
              )}
            </div>

            {open && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={(event) => {
                  event.stopPropagation();
                  close();
                }}
                className="ml-0.5 shrink-0 rounded-full p-1 text-zinc-500 transition-colors hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}

            {notification.duration > 0 && !open && (
              <motion.span
                key={notification.id}
                aria-hidden="true"
                className={cn("absolute bottom-0 left-0 h-[2px]", TONE[notification.kind].bar)}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: notification.duration / 1000, ease: "linear" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
