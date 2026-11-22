/**
 * Single source of truth for "how many tickets are left".
 *
 * The event page computes remaining per tier as
 *   quantity_available - (quantity_sold - quantity_cancelled)
 * because cancelled tickets are still counted in quantity_sold but their seats
 * are released again. Browse must use the exact same definition, otherwise the
 * card and the event page disagree about whether a tier is sold out.
 */

/** Hard ceiling: at or below this many seats a show is "few left". */
export const FEW_LEFT_MAX = 10;

/** …or at/below this share of total capacity, whichever is smaller. */
export const FEW_LEFT_RATIO = 0.15;

export interface TicketStockTier {
  price_kobo: number;
  quantity_available: number;
  quantity_sold: number;
  quantity_cancelled?: number | null;
}

export type StockState = "sold_out" | "few_left" | "available";

export interface EventStock {
  minPriceKobo: number;
  lowestAvailablePriceKobo: number | null;
  totalRemaining: number;
  totalCapacity: number;
  state: StockState;
  isSoldOut: boolean;
  isFewLeft: boolean;
}

/** Seats still sellable in one tier. */
export function tierRemaining(tier: TicketStockTier): number {
  const cancelled = tier.quantity_cancelled ?? 0;
  return Math.max(0, tier.quantity_available - (tier.quantity_sold - cancelled));
}

/**
 * Aggregates every tier of one event into a single stock state.
 * A tier with no capacity at all (should not happen — the column is > 0) is
 * ignored rather than treated as unlimited.
 */
export function getEventStock(tiers: readonly TicketStockTier[] | null | undefined): EventStock {
  const list = tiers ?? [];

  let minPriceKobo = 0;
  let lowestAvailablePriceKobo: number | null = null;
  let totalRemaining = 0;
  let totalCapacity = 0;

  for (const tier of list) {
    totalCapacity += tier.quantity_available;
    const remaining = tierRemaining(tier);
    totalRemaining += remaining;

    if (minPriceKobo === 0 || tier.price_kobo < minPriceKobo) minPriceKobo = tier.price_kobo;
    if (remaining > 0 && (lowestAvailablePriceKobo === null || tier.price_kobo < lowestAvailablePriceKobo)) {
      lowestAvailablePriceKobo = tier.price_kobo;
    }
  }

  // No tiers on sale yet is not "sold out" — there is simply nothing to sell.
  if (list.length === 0) {
    return {
      minPriceKobo: 0,
      lowestAvailablePriceKobo: null,
      totalRemaining: 0,
      totalCapacity: 0,
      state: "available",
      isSoldOut: false,
      isFewLeft: false,
    };
  }

  const isSoldOut = totalRemaining <= 0;
  const threshold = Math.max(
    1,
    Math.min(FEW_LEFT_MAX, Math.floor(totalCapacity * FEW_LEFT_RATIO)),
  );
  const isFewLeft = !isSoldOut && totalRemaining <= threshold;

  return {
    minPriceKobo,
    lowestAvailablePriceKobo,
    totalRemaining,
    totalCapacity,
    state: isSoldOut ? "sold_out" : isFewLeft ? "few_left" : "available",
    isSoldOut,
    isFewLeft,
  };
}
