/**
 * Tiny external store for the Dynamic Island.
 *
 * Kept outside React because notifications are fired from event handlers,
 * mutations and plain helper functions — not only from components. One
 * notification is live at a time: a newer one replaces the current one, which
 * is what makes the island morph instead of stacking like a toast list.
 */

export type IslandKind = "success" | "error" | "info" | "loading";

export type IslandAction = {
  label: string;
  onClick: () => void;
};

export type IslandNotification = {
  id: number;
  kind: IslandKind;
  title: string;
  description?: string;
  action?: IslandAction;
  /** Milliseconds before it retracts. 0 keeps it until dismissed. */
  duration: number;
};

let current: IslandNotification | null = null;
const listeners = new Set<() => void>();
let sequence = 0;

function emit() {
  for (const listener of listeners) listener();
}

export function notify(input: Omit<IslandNotification, "id">): number {
  sequence += 1;
  current = { ...input, id: sequence };
  emit();
  return sequence;
}

export function dismiss(id?: number) {
  if (!current) return;
  if (id !== undefined && current.id !== id) return;
  current = null;
  emit();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): IslandNotification | null {
  return current;
}

export function getServerSnapshot(): IslandNotification | null {
  return null;
}
