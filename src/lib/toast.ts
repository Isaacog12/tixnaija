/**
 * `toast` with the same shape the app already uses, rendered by the Dynamic
 * Island instead of a floating stack. Every existing
 * `toast.success(...)` / `toast.error(...)` call site keeps working.
 *
 * Errors pass through friendlyError first, so a raw Postgres or PostgREST
 * message can never reach the screen — even from an old call site that still
 * hands over `error.message`.
 */

import { friendlyError, GENERIC_ERROR } from "./errors";
import { dismiss as dismissIsland, notify, type IslandAction, type IslandKind } from "./island-store";

export type ToastOptions = {
  description?: string;
  /** Milliseconds on screen; 0 keeps it until dismissed. */
  duration?: number;
  action?: IslandAction;
};

const DEFAULT_DURATION: Record<IslandKind, number> = {
  success: 2600,
  error: 6000,
  info: 4000,
  loading: 0,
};

function show(kind: IslandKind, title: string, options: ToastOptions = {}) {
  return notify({
    kind,
    title,
    description: options.description,
    action: options.action,
    duration: options.duration ?? DEFAULT_DURATION[kind],
  });
}

export const toast = {
  success(message: string, options?: ToastOptions) {
    return show("success", message, options);
  },

  /** Accepts an error, a supabase response error, or a plain string. */
  error(input: unknown, options?: ToastOptions) {
    return show("error", friendlyError(input, GENERIC_ERROR), options);
  },

  info(message: string, options?: ToastOptions) {
    return show("info", message, options);
  },

  /** Neutral one-liner, for call sites that used to pass through Sonner. */
  message(message: string, options?: ToastOptions) {
    return show("info", message, options);
  },

  /** Sticky until replaced or dismissed. */
  loading(message: string, options?: ToastOptions) {
    return show("loading", message, { ...options, duration: 0 });
  },

  dismiss(id?: number) {
    dismissIsland(id);
  },
};
