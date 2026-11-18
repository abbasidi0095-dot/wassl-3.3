import { describe, expect, it } from "vitest";
import { clampOffer, DEFAULT_DELIVERY, DEFAULT_TAXI, quote, resolvePricing } from "@/lib/pricing";

describe("flat + per-km pricing", () => {
  it("charges only the flat price inside the free distance", () => {
    const q = quote(DEFAULT_DELIVERY, 3.2);
    expect(q.distanceFee).toBe(0);
    expect(q.suggested).toBe(DEFAULT_DELIVERY.base);
  });

  it("adds per-km beyond the free distance", () => {
    const q = quote(DEFAULT_DELIVERY, 5.5);
    expect(q.billableKm).toBe(2);
    expect(q.distanceFee).toBe(6);
    expect(q.suggested).toBe(18);
  });

  it("never goes below the minimum fare", () => {
    const q = quote({ ...DEFAULT_TAXI, base: 5, min: 25 }, 0.5);
    expect(q.suggested).toBe(25);
  });

  it("caps at the configured maximum", () => {
    const q = quote({ ...DEFAULT_DELIVERY, max: 40 }, 200);
    expect(q.suggested).toBe(40);
  });

  it("prefers the city override over the platform default", () => {
    const pricing = resolvePricing(
      "delivery",
      { pricing: { delivery: { base: 20 } } },
      { pricing: { delivery: { base: 14, perKm: 4 } } },
    );
    expect(pricing.base).toBe(20);
    expect(pricing.perKm).toBe(4);
    expect(pricing.freeKm).toBe(DEFAULT_DELIVERY.freeKm);
  });

  it("never emits NaN when a city override is sparse", () => {
    const pricing = resolvePricing("delivery", {
      pricing: { delivery: { base: 8, max: undefined, step: undefined } },
    });
    expect(Number.isFinite(pricing.max)).toBe(true);
    expect(Number.isFinite(pricing.step)).toBe(true);
    expect(pricing.max).toBeGreaterThanOrEqual(pricing.min);

    const q = quote(pricing, Number.NaN);
    expect(Number.isFinite(q.km)).toBe(true);
    expect(Number.isFinite(q.suggested)).toBe(true);
    expect(q.suggested).toBeGreaterThan(0);
  });

  it("keeps offers at or above the suggestion and under the ceiling", () => {
    expect(clampOffer(DEFAULT_DELIVERY, 5, 12)).toBe(12);
    expect(clampOffer(DEFAULT_DELIVERY, 18, 12)).toBe(18);
    expect(clampOffer(DEFAULT_DELIVERY, 10_000, 12)).toBe(DEFAULT_DELIVERY.max);
  });
});
