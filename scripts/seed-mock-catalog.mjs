#!/usr/bin/env node
/**
 * Merge the curated mock catalogue into the live database document.
 *
 *   sudo bash -c 'set -a; . /etc/wassl.env; set +a; node scripts/seed-mock-catalog.mjs'
 *
 * Idempotent: stores are matched by slug, products by id or store+name.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(
  readFileSync(path.join(here, "../src/data/mock-catalog.json"), "utf8"),
);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const stateId = process.env.WASSL_DB_STATE_ID || "platform";
const pool = new pg.Pool({ connectionString, max: 1 });
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const row = await client.query(
    "SELECT data FROM wassl_state WHERE id = $1 FOR UPDATE",
    [stateId],
  );
  if (!row.rowCount) throw new Error(`No wassl_state row for ${stateId}`);
  const db = row.rows[0].data;

  // Replace the previous mock catalogue so menus and photos stay in sync.
db.stores = (db.stores ?? []).filter((store) => !store.id?.startsWith("store_mock_"));
db.products = (db.products ?? []).filter((product) => !product.id?.startsWith("product_mock_"));

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

  await client.query(
    "UPDATE wassl_state SET data = $2::jsonb, updated_at = now() WHERE id = $1",
    [stateId, JSON.stringify(db)],
  );
  await client.query("COMMIT");

  console.log(
    `stores +${addedStores} (total ${db.stores.length}), products +${addedProducts} (total ${db.products.length}), images updated ${images}`,
  );
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
