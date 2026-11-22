import { useRef } from "react";
import { X } from "lucide-react";

interface RecentSearchesProps {
  items: string[];
  onPick: (query: string) => void;
  onRemove: (query: string) => void;
  onClear: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * A plain list of buttons (not a listbox) with arrow-key navigation, so it
 * stays usable with a keyboard without re-implementing combobox semantics.
 */
export function RecentSearches({
  items,
  onPick,
  onRemove,
  onClear,
  onDismiss,
  className,
}: RecentSearchesProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onDismiss?.();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLButtonElement>("button[data-nav]") ?? [],
    );
    if (buttons.length === 0) return;

    event.preventDefault();
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? current >= buttons.length - 1
          ? 0
          : current + 1
        : current <= 0
          ? buttons.length - 1
          : current - 1;
    buttons[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={
        className ??
        "mt-2 w-full overflow-hidden rounded-lg border border-border/60 bg-card text-left"
      }
    >
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Recent searches
        </span>
        <button
          type="button"
          data-nav
          onClick={onClear}
          className="text-[11px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Clear all
        </button>
      </div>

      <ul className="divide-y divide-border/40">
        {items.map((query) => (
          <li key={query} className="flex items-stretch">
            <button
              type="button"
              data-nav
              onClick={() => onPick(query)}
              className="flex-1 truncate px-3 py-2.5 text-left text-[13px] text-foreground transition-colors hover:bg-secondary/50"
            >
              {query}
            </button>
            <button
              type="button"
              data-nav
              onClick={() => onRemove(query)}
              aria-label={`Remove “${query}” from recent searches`}
              className="shrink-0 px-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
