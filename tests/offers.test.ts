import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";
import { resolvePricing } from "@/lib/pricing";

let dataDir: string;
const customer: OrderActor = { role: "customer", id: "user_customer_demo", name: "Mariam" };
const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-offer-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});
afterEach(() => fs.rmSync(dataDir, { recursive: true, force: true }));

async function seed() {
  const db = await import("@/lib/db");
  await db.resetDatabase();
  const product = (await db.getProducts("store_dakhla_grill")).find((p) => p.id === "product_001")!;
  const order = await db.createOrder(
    {
      citySlug: "dakhla",
      storeId: "store_dakhla_grill",
      customerName: "Mariam",
      customerPhone: "+212600000000",
      address: "12 Rue de la Plage",
      landmark: "Lighthouse",
      lat: 23.69,
      lng: -15.94,
      items: [{ productId: product.id, qty: 1 }],
    },
    customer,
  );
  return { db, order };
}

describe("delivery bidding", () => {
  it("quotes flat + km and stores the breakdown", async () => {
    const { order } = await seed();
    expect(order.price).toBeTruthy();
    expect(order.price!.suggested).toBeGreaterThan(0);
    expect(order.price!.current).toBe(order.price!.suggested);
    expect(order.deliveryFee).toBe(order.price!.suggested);
  });

  it("lets the customer raise the offer and rolls it into the total", async () => {
    const { db, order } = await seed();
    const start = order.price!.current;
    const before = order.total;
    const raised = await db.setOrderOffer(order.id, { amount: start + 10 }, { role: "customer" });
    expect(raised.price!.current).toBe(start + 10);
    expect(raised.deliveryFee).toBe(start + 10);
    expect(raised.total).toBe(before + 10);
    expect(raised.price!.history.length).toBeGreaterThan(1);
  });

  it("refuses to lower the offer", async () => {
    const { db, order } = await seed();
    await expect(
      db.setOrderOffer(order.id, { amount: 1 }, { role: "customer" }),
    ).rejects.toThrow(/raise/i);
  });

  it("refuses offers above the city ceiling", async () => {
    const { db, order } = await seed();
    await expect(
      db.setOrderOffer(order.id, { amount: 10_000 }, { role: "customer" }),
    ).rejects.toThrow(/under/i);
  });

  it("takes a courier counter and lets the customer accept it", async () => {
    const { db, order } = await seed();
    const driver = (await db.getDrivers("dakhla")).find((d) => d.active)!;
    const counter = order.price!.current + 8;
    const withCounter = await db.setOrderOffer(
      order.id,
      { counter: true, amount: counter },
      { role: "driver", id: "user_driver", name: driver.name, driverId: driver.id },
    );
    expect(withCounter.price!.counter?.amount).toBe(counter);

    const accepted = await db.setOrderOffer(
      order.id,
      { acceptCounter: true },
      { role: "customer" },
    );
    expect(accepted.price!.current).toBe(counter);
    expect(accepted.price!.counter).toBeUndefined();
    expect(accepted.deliveryFee).toBe(counter);
  });

  it("prices new orders from the city override", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const city = (await db.getCities()).find((c) => c.slug === "dakhla")!;
    const updated = await db.updateCity(
      city.id,
      { pricing: { delivery: { base: 30, perKm: 0, freeKm: 3.5 } } },
      admin,
    );
    expect(updated.pricing?.delivery?.base).toBe(30);

    const product = (await db.getProducts("store_dakhla_grill")).find((p) => p.id === "product_001")!;
    const order = await db.createOrder(
      {
        citySlug: "dakhla",
        storeId: "store_dakhla_grill",
        customerName: "Mariam",
        customerPhone: "+212600000000",
        address: "12 Rue de la Plage",
        landmark: "Lighthouse",
        lat: 23.69,
        lng: -15.94,
        items: [{ productId: product.id, qty: 1 }],
      },
      customer,
    );
    expect(order.deliveryFee).toBe(30);
    expect(order.price?.base).toBe(30);
  });

  it("keeps default bounds when the admin saves a sparse city price", async () => {
    const db = await import("@/lib/db");
    await db.resetDatabase();
    const city = (await db.getCities()).find((c) => c.slug === "dakhla")!;
    const updated = await db.updateCity(
      city.id,
      { pricing: { delivery: { base: 9, perKm: 2, freeKm: 3.5 } } },
      admin,
    );
    expect(updated.pricing?.delivery?.base).toBe(9);
    // Sparse overrides stay sparse on disk; the resolver must still be finite.
    expect(Number.isFinite(resolvePricing("delivery", updated).max)).toBe(true);

    const product = (await db.getProducts("store_dakhla_grill")).find((p) => p.id === "product_001")!;
    const order = await db.createOrder(
      {
        citySlug: "dakhla",
        storeId: "store_dakhla_grill",
        customerName: "Mariam",
        customerPhone: "+212600000000",
        address: "12 Rue de la Plage",
        landmark: "Lighthouse",
        lat: 23.69,
        lng: -15.94,
        items: [{ productId: product.id, qty: 1 }],
      },
      customer,
    );
    expect(Number.isFinite(order.price?.max)).toBe(true);
    expect(Number.isFinite(order.price?.suggested)).toBe(true);
    expect(Number.isFinite(order.deliveryFee)).toBe(true);
    expect(Number.isFinite(order.total)).toBe(true);
  });

  it("blocks bidding on a closed order", async () => {
    const { db, order } = await seed();
    await db.updateOrderStatus(order.id, "cancelled", admin, { note: "test" });
    await expect(
      db.setOrderOffer(order.id, { amount: 50 }, { role: "admin" }),
    ).rejects.toThrow(/closed/i);
  });
});
