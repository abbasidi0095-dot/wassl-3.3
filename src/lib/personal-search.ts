import { getDb, getOrderViews } from "./db";
import type { Product, Store } from "./types";

export type PersonalSearchItem = {
  productId: string;
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeCategory: Store["category"];
  citySlug: string;
  storeLat: number;
  storeLng: number;
  deliveryFee: number;
  minOrder: number;
  name: string;
  emoji: string;
  image?: string;
  basePrice: number;
  price: number;
  unit?: string;
  stockMax: number;
  barcode?: string;
  lastOrderedAt: string;
  reason: "recent" | "frequent";
};

export type PersonalSearchResult = {
  personalized: boolean;
  recent: PersonalSearchItem[];
  frequent: PersonalSearchItem[];
};

const EMPTY: PersonalSearchResult = {
  personalized: false,
  recent: [],
  frequent: [],
};

function cartItem(
  product: Product | undefined,
  store: Store | undefined,
  fallback: {
    productId: string;
    name: string;
    emoji?: string;
    image?: string;
    price: number;
    qty?: number;
    unit?: string;
    sku?: string;
  },
  orderedAt: string,
  reason: PersonalSearchItem["reason"],
): PersonalSearchItem | null {
  if (!store) return null;
  const available = product ? product.available && (product.stock ?? 1) > 0 : true;
  if (!available) return null;
  return {
    productId: product?.id ?? fallback.productId,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
    storeCategory: store.category,
    citySlug: store.citySlug,
    storeLat: store.lat,
    storeLng: store.lng,
    deliveryFee: store.deliveryFee,
    minOrder: store.minOrder,
    name: product?.name ?? fallback.name,
    emoji: product?.emoji ?? fallback.emoji ?? "",
    image: product?.image ?? fallback.image,
    basePrice: product?.price ?? fallback.price,
    price: product?.price ?? fallback.price,
    unit: product?.unit ?? fallback.unit,
    stockMax: product
      ? product.variants?.length
        ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
        : (product.stock ?? 20)
      : 1,
    barcode: product?.barcode ?? fallback.sku,
    lastOrderedAt: orderedAt,
    reason,
  };
}

/**
 * Builds “buy again” and “frequently bought” from real paid orders only.
 * It never invents purchases, stock or availability.
 */
export async function getPersonalSearch(
  email: string | undefined,
  limit = 6,
): Promise<PersonalSearchResult> {
  if (!email) return EMPTY;
  const [db, orders] = await Promise.all([
    getDb(),
    getOrderViews({ customerEmail: email }),
  ]);
  if (!orders.length) return EMPTY;

  const storeById = new Map(db.stores.map((store) => [store.id, store]));
  const productById = new Map(db.products.map((product) => [product.id, product]));
  const validOrders = orders
    .filter((order) => order.status !== "cancelled")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const recent: PersonalSearchItem[] = [];
  const seenRecent = new Set<string>();
  for (const order of validOrders.slice(0, 2)) {
    for (const line of order.items) {
      const key = `${order.storeId}:${line.productId}`;
      if (seenRecent.has(key)) continue;
      const item = cartItem(
        productById.get(line.productId),
        storeById.get(order.storeId),
        { ...line, price: line.price },
        order.createdAt,
        "recent",
      );
      if (!item) continue;
      seenRecent.add(key);
      recent.push(item);
      if (recent.length >= limit) break;
    }
    if (recent.length >= limit) break;
  }

  const counts = new Map<string, { count: number; at: string; storeId: string; line: (typeof validOrders)[number]["items"][number] }>();
  for (const order of validOrders) {
    for (const line of order.items) {
      const key = `${order.storeId}:${line.productId}`;
      const current = counts.get(key);
      counts.set(key, {
        count: (current?.count ?? 0) + line.qty,
        at: current?.at && current.at > order.createdAt ? current.at : order.createdAt,
        storeId: order.storeId,
        line,
      });
    }
  }

  const frequent: PersonalSearchItem[] = [...counts.entries()]
    .filter(([, entry]) => entry.count >= 2)
    .sort((a, b) => b[1].count - a[1].count || b[1].at.localeCompare(a[1].at))
    .slice(0, limit)
    .map(([, entry]) =>
      cartItem(
        productById.get(entry.line.productId),
        storeById.get(entry.storeId),
        { ...entry.line, price: entry.line.price },
        entry.at,
        "frequent",
      ),
    )
    .filter((item): item is PersonalSearchItem => Boolean(item));

  return {
    personalized: recent.length > 0 || frequent.length > 0,
    recent,
    frequent,
  };
}
