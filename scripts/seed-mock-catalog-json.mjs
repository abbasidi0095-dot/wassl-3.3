#!/usr/bin/env node
/**
 * Merge the curated mock catalogue into the JSON database document.
 *
 *   WASSL_DATA_DIR=/var/lib/wassl node scripts/seed-mock-catalog-json.mjs
 *
 * Idempotent: stores are matched by slug, products by id or store+name.
 * Writes a timestamped backup before replacing db.json atomically.
 */
import { readFileSync, writeFileSync, renameSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(path.join(here, "../src/data/mock-catalog.json"), "utf8"),
);

const dataDir = process.env.WASSL_DATA_DIR || "/var/lib/wassl";
const file = path.join(dataDir, "db.json");
const db = JSON.parse(readFileSync(file, "utf8"));

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
copyFileSync(file, path.join(dataDir, `db.backup-${stamp}.json`));

const storeSlugs = new Set((db.stores ?? []).map((store) => store.slug));
const productIds = new Set((db.products ?? []).map((product) => product.id));
const storeProductNames = new Set(
  (db.products ?? []).map((product) => `${product.storeId}::${product.name}`),
);

let addedStores = 0;
let addedProducts = 0;
let images = 0;

for (const store of catalog.stores) {
  const existing = db.stores.find((candidate) => candidate.slug === store.slug);
  if (!existing) {
    db.stores.push(store);
    storeSlugs.add(store.slug);
    addedStores += 1;
  } else if (existing.id?.startsWith("store_mock_")) {
    Object.assign(existing, store);
  }
}

for (const product of catalog.products) {
  const key = `${product.storeId}::${product.name}`;
  const existing = db.products.find(
    (candidate) => candidate.id === product.id || `${candidate.storeId}::${candidate.name}` === key,
  );
  if (!existing) {
    db.products.push(product);
    productIds.add(product.id);
    storeProductNames.add(key);
    addedProducts += 1;
  } else if (existing.id?.startsWith("product_mock_")) {
    Object.assign(existing, product);
  }
}

const liveCitySlugs = new Set(catalog.stores.map((store) => store.citySlug));
for (const city of db.cities ?? []) {
  if (liveCitySlugs.has(city.slug)) city.launchStatus = "live";
}

for (const product of db.products) {
  const image = catalog.existingProductImages[product.name];
  if (image && product.image !== image) {
    product.image = image;
    images += 1;
  }
}

const tmp = `${file}.tmp-${process.pid}`;
writeFileSync(tmp, JSON.stringify(db));
renameSync(tmp, file);

console.log(
  `stores +${addedStores} (total ${db.stores.length}), products +${addedProducts} (total ${db.products.length}), images updated ${images}`,
);
