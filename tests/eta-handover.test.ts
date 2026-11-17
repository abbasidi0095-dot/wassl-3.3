import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderActor } from "@/lib/order-machine";

let dataDir: string;

const admin: OrderActor = { role: "admin", id: "user_admin", name: "Ops" };
const customer: OrderActor = { role: "customer", id: "user_customer_demo", name: "Mariam" };

beforeEach(() => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "wassl-eta-"));
  process.env.WASSL_DATA_DIR = dataDir;
  vi.resetModules();
});

afterEach(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function seedOrder() {
  const db = await import("@/lib/db");
  await db.resetDatabase();
  const product = (await db.getProducts("store_dakhla_grill")).find(
    (entry) => entry.id === "product_001",
  )!;
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

async function moveToEnRoute(db: Awaited<ReturnType<typeof seedOrder>>["db"], orderId: string) {
  const driver = (await db.getDrivers("dakhla")).find((entry) => entry.active)!;
  await db.updateOrderStatus(orderId, "accepted", admin);
  await db.updateOrderStatus(orderId, "preparing", admin);
  await db.updateOrderStatus(orderId, "ready", admin);
  await db.assignDriver(orderId, driver.id, admin);
  await db.updateOrderStatus(orderId, "picked_up", {
    role: "driver",
    id: "user_driver",
    name: driver.name,
    driverId: driver.id,
  });
  await db.updateOrderStatus(orderId, "en_route", {
    role: "driver",
    id: "user_driver",
    name: driver.name,
    driverId: driver.id,
  });
  return driver;
}

describe("delivery estimate", () => {
  it("stays empty until dispatch publishes it", async () => {
    const { db, order } = await seedOrder();
    expect(order.etaMinutes).toBeUndefined();
    const updated = await db.setOrderEta(order.id, 25, admin);
    expect(updated.etaMinutes).toBe(25);
    expect(updated.etaSetBy).toBe("admin");
    expect(updated.etaSetAt).toBeTruthy();
  });

  it("rejects out-of-range estimates", async () => {
    const { db, order } = await seedOrder();
    await expect(db.setOrderEta(order.id, 0, admin)).rejects.toThrow(/between 1 and 240/i);
    await expect(db.setOrderEta(order.id, 900, admin)).rejects.toThrow(/between 1 and 240/i);
  });

  it("lets only the assigned courier publish it", async () => {
    const { db, order } = await seedOrder();
    const driver = await moveToEnRoute(db, order.id);
    const other = (await db.getDrivers("dakhla")).find(
      (entry) => entry.active && entry.id !== driver.id,
    );
    if (other) {
      await expect(
        db.setOrderEta(order.id, 20, {
          role: "driver",
          id: "user_other",
          name: other.name,
          driverId: other.id,
        }),
      ).rejects.toThrow(/assigned/i);
    }
    const updated = await db.setOrderEta(order.id, 18, {
      role: "driver",
      id: "user_driver",
      name: driver.name,
      driverId: driver.id,
    });
    expect(updated.etaMinutes).toBe(18);
    expect(updated.etaSetBy).toBe("driver");
  });

  it("refuses to publish on a closed order", async () => {
    const { db, order } = await seedOrder();
    await db.updateOrderStatus(order.id, "cancelled", admin, { note: "test" });
    await expect(db.setOrderEta(order.id, 20, admin)).rejects.toThrow(/closed/i);
  });
});

describe("delivery handover code is mandatory", () => {
  it("blocks the courier until the customer code is entered", async () => {
    const { db, order } = await seedOrder();
    await moveToEnRoute(db, order.id);

    await expect(
      db.updateOrderStatus(order.id, "delivered", {
        role: "driver",
        id: "user_driver",
        name: "Courier",
        driverId: order.driverId,
      }),
    ).rejects.toThrow(/handover code/i);

    await expect(
      db.updateOrderStatus(
        order.id,
        "delivered",
        { role: "driver", id: "user_driver", name: "Courier", driverId: order.driverId },
        { proofPin: "0000" },
      ),
    ).rejects.toThrow(/does not match/i);
  });

  it("accepts the real code and records the proof", async () => {
    const { db, order } = await seedOrder();
    await moveToEnRoute(db, order.id);
    const fresh = await db.getOrder(order.id);
    const delivered = await db.updateOrderStatus(
      order.id,
      "delivered",
      { role: "driver", id: "user_driver", name: "Courier", driverId: order.driverId },
      { proofPin: fresh?.deliveryPin },
    );
    expect(delivered.status).toBe("delivered");
    expect(delivered.proofOfDelivery?.method).toBe("pin");
  });

  it("allows dispatch to override, and marks the delivery as overridden", async () => {
    const { db, order } = await seedOrder();
    await moveToEnRoute(db, order.id);
    const delivered = await db.updateOrderStatus(order.id, "delivered", admin, {
      note: "Customer unreachable",
    });
    expect(delivered.status).toBe("delivered");
    expect(delivered.proofOfDelivery?.note).toMatch(/override/i);
  });
});
