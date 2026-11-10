export interface EventDateStatusItem {
  start_datetime: string;
  end_datetime?: string | null;
  status?: string | null;
}

/**
 * Returns true if the event has ended, based on end_datetime (or fallback start_datetime)
 * or if the event status is 'completed'.
 */
export function isEventEnded(event: EventDateStatusItem, now = new Date()): boolean {
  if (event.status === "completed") return true;
  const start = new Date(event.start_datetime);
  const end = event.end_datetime ? new Date(event.end_datetime) : start;
  return end < now;
}

/**
 * Returns true if the event is currently active and can be suggested or shown as upcoming.
 * Must be published, not cancelled, and not ended.
 */
export function isEventActive(event: EventDateStatusItem, now = new Date()): boolean {
  if (event.status !== "published") return false;
  return !isEventEnded(event, now);
}

/**
 * Filters an array of events to only those that are active and have not ended.
 */
export function filterActiveEvents<T extends EventDateStatusItem>(
  events: T[] | null | undefined,
  now = new Date()
): T[] {
  if (!events || !Array.isArray(events)) return [];
  return events.filter((ev) => isEventActive(ev, now));
}
