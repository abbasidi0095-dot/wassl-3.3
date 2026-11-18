import type { City, PlatformSettings, ServicePricing } from "./types";

/**
 * Flat + per-kilometre pricing, per city and per service.
 *
 *   distance <= freeKm  ->  flat price
 *   distance >  freeKm  ->  flat price + (distance - freeKm) * perKm
 *
 * The quote is a *suggestion*. Customers may raise it (inDrive-style) and
 * couriers may counter, but never below the suggestion and never above `max`.
 */
export type PriceQuote = {
  base: number;
  perKm: number;
  freeKm: number;
  km: number;
  billableKm: number;
  distanceFee: number;
  suggested: number;
  min: number;
  max: number;
  currency: "MAD";
  /** Human breakdown for the UI, already rounded. */
  lines: { label: string; amount: number }[];
};

export const DEFAULT_DELIVERY: ServicePricing = {
  enabled: true,
  base: 12,
  perKm: 3,
  freeKm: 3.5,
  min: 12,
  max: 150,
  step: 1,
  allowCounter: true,
};

export const DEFAULT_TAXI: ServicePricing = {
  enabled: true,
  base: 15,
  perKm: 5,
  freeKm: 3.5,
  min: 25,
  max: 400,
  step: 5,
  allowCounter: true,
};

/** Coerce anything to a usable number. Stored pricing must never reach the UI as NaN. */
function count(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function withDefaults(base: ServicePricing, override?: Partial<ServicePricing>): ServicePricing {
  const merged = { ...base, ...(override ?? {}) };
  const min = Math.max(0, Math.round(count(merged.min, base.min)));
  return {
    enabled: typeof merged.enabled === "boolean" ? merged.enabled : base.enabled,
    allowCounter: typeof merged.allowCounter === "boolean" ? merged.allowCounter : base.allowCounter,
    base: Math.max(0, Math.round(count(merged.base, base.base))),
    perKm: Math.max(0, Math.round(count(merged.perKm, base.perKm) * 100) / 100),
    freeKm: Math.max(0, Math.round(count(merged.freeKm, base.freeKm) * 100) / 100),
    min,
    max: Math.max(min, 1, Math.round(count(merged.max, base.max))),
    step: Math.max(1, Math.round(count(merged.step, base.step))),
  };
}

/** City override > platform default > built-in default. */
export function resolvePricing(
  service: "delivery" | "taxi",
  city?: Pick<City, "pricing"> | null,
  settings?: Pick<PlatformSettings, "pricing"> | null,
): ServicePricing {
  const fallback = service === "delivery" ? DEFAULT_DELIVERY : DEFAULT_TAXI;
  const platform = settings?.pricing?.[service];
  const local = city?.pricing?.[service];
  return withDefaults(withDefaults(fallback, platform), local);
}

export function roundTo(value: number, step: number) {
  const safe = step > 0 ? step : 1;
  return Math.round(value / safe) * safe;
}

export function quote(config: ServicePricing, distanceKm: number): PriceQuote {
  // A bad coordinate used to produce thousands of kilometres and a NaN quote.
  // Keep the distance finite so the maths can never leak NaN into the UI.
  const safeDistance = Number.isFinite(distanceKm) ? distanceKm : 0;
  const km = Math.max(0, Math.min(1000, Math.round(safeDistance * 100) / 100));
  const billableKm = Math.max(0, Math.round((km - config.freeKm) * 100) / 100);
  const distanceFee = roundTo(billableKm * config.perKm, config.step);
  const raw = config.base + distanceFee;
  const suggested = Math.min(
    config.max,
    Math.max(config.min, roundTo(raw, config.step)),
  );
  return {
    base: config.base,
    perKm: config.perKm,
    freeKm: config.freeKm,
    km,
    billableKm,
    distanceFee,
    suggested,
    min: Math.min(config.min, suggested),
    max: config.max,
    currency: "MAD",
    lines: [
      { label: "Flat price", amount: config.base },
      {
        label:
          billableKm > 0
            ? `${billableKm.toFixed(1)} km × ${config.perKm} MAD`
            : `First ${config.freeKm} km included`,
        amount: distanceFee,
      },
    ],
  };
}

/** Any accepted price must sit between the suggestion and the ceiling. */
export function clampOffer(config: ServicePricing, amount: number, suggested: number) {
  const floor = Math.min(config.min, suggested);
  const capped = Math.min(config.max, Math.max(floor, Math.round(amount)));
  return Math.max(suggested, roundTo(capped, config.step));
}

export function formatMad(amount: number) {
  return `${Math.round(amount)} MAD`;
}
