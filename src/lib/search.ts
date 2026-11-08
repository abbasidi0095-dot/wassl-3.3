import { getOpenState } from "./hours";
import type { City, Database, Product, Store } from "./types";
import { categoryLabel, distanceKm } from "./utils";
import { promotionForProduct } from "./grocery-promotions";
import { cityServiceEnabled } from "./city-services";

export type SearchKind =
  | "store"
  | "product"
  | "category"
  | "service"
  | "delivery";

export type SearchHit = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  href: string;
  meta?: string;
  image?: string;
  badge?: string;
  /** True when the title is an i18n key rather than merchant data. */
  titleIsKey?: boolean;
  /** True when the subtitle is an i18n key rather than merchant data. */
  subtitleIsKey?: boolean;
  /** Structured product/store data for the grocery basket. */
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  storeCategory?: Store["category"];
  citySlug?: string;
  storeLat?: number;
  storeLng?: number;
  price?: number;
  unit?: string;
  category?: string;
  stock?: number;
  deliveryFee?: number;
  minOrder?: number;
  barcode?: string;
  /** Straight-line distance from the selected city centre, in km. */
  distanceKm?: number;
  /** Practical prep + travel estimate in minutes. */
  etaMinutes?: number;
  storeRating?: number;
  stockStatus?: "in_stock" | "low_stock" | "sold_out";
  promotion?: string;
  promotionPercent?: number;
  /** Sponsored placements must be visibly marked in the UI. */
  sponsored?: boolean;
  score: number;
};

export type ComparisonOffer = {
  storeId: string;
  storeSlug: string;
  storeName: string;
  storeRating: number;
  price: number;
  stock: number;
  stockStatus: "in_stock" | "low_stock" | "sold_out";
  deliveryFee: number;
  distanceKm?: number;
  etaMinutes?: number;
  promotion?: string;
  href: string;
};

export type ProductComparison = {
  key: string;
  title: string;
  image?: string;
  unit?: string;
  category?: string;
  bestPrice: number;
  offers: ComparisonOffer[];
};

export type SearchGroup = {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
};

export type SearchResult = {
  query: string;
  citySlug: string;
  groups: SearchGroup[];
  suggestions: string[];
  comparisons: ProductComparison[];
  total: number;
};

export type SearchInput = {
  query?: string;
  citySlug?: string;
  limit?: number;
};

const GROUP_LIMITS: Record<SearchKind, number> = {
  store: 8,
  product: 12,
  category: 6,
  service: 6,
  delivery: 4,
};

const GROUP_LABELS: Record<SearchKind, string> = {
  store: "Stores",
  product: "Products",
  category: "Categories",
  service: "Services",
  delivery: "Delivery options",
};

/** Arabic and Latin search text is compared without diacritics or case. */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Cross-language shopping synonyms. Product names are mostly English, so a
 * customer searching in Darija, Hassaniya, Arabic, French or Spanish is mapped
 * back to the canonical English token before matching.
 */
const SYNONYMS: Record<string, string[]> = {
  milk: ["حليب", "لبن", "lait", "leche", "حليب طازج"],
  bread: ["خبز", "خبزة", "pain", "pan", "مخبزة"],
  water: ["ماء", "ما", "eau", "agua", "مياه"],
  chicken: ["دجاج", "جاج", "poulet", "pollo", "دجاجة"],
  fish: ["سمك", "حوت", "poisson", "pescado", "حوتة"],
  meat: ["لحم", "viande", "carne", "لحوم"],
  egg: ["بيض", "بيضة", "oeuf", "oeufs", "huevo", "huevos"],
  rice: ["أرز", "رز", "riz", "arroz"],
  oil: ["زيت", "huile", "aceite", "زيتون"],
  sugar: ["سكر", "sucre", "azucar", "azúcar"],
  tomato: ["طماطم", "طماطة", "tomate", "tomates"],
  potato: ["بطاطس", "بطاطا", "pomme de terre", "patata", "patatas"],
  onion: ["بصل", "oignon", "cebolla", "بصلة"],
  carrot: ["جزر", "carotte", "zanahoria"],
  apple: ["تفاح", "تفاحة", "pomme", "manzana"],
  orange: ["برتقال", "برتقالة", "orange", "naranja"],
  strawberry: ["فراولة", "fraise", "fresa", "فراولة"],
  grape: ["عنب", "raisin", "uva", "عنبة"],
  lemon: ["ليمون", "حامض", "citron", "limón", "limon"],
  cheese: ["جبن", "جبنة", "fromage", "queso"],
  butter: ["زبدة", "beurre", "mantequilla"],
  yogurt: ["ياغورت", "زبادي", "yaourt", "yogur"],
  coffee: ["قهوة", "café", "cafe", "café", "kawa"],
  tea: ["أتاي", "اتاي", "شاي", "thé", "te", "té"],
  juice: ["عصير", "jus", "zumo", "عصير"],
  pharmacy: ["صيدلية", "pharmacie", "farmacia"],
  taxi: ["طاكسي", "طكسي", "taxi", "سيارة أجرة"],
  grocery: ["بقالة", "سوبرماركت", "courses", "supermercado", "سوق"],
  restaurant: ["مطعم", "مطاعم", "restaurant", "restaurante", "ماكلة"],
  cafe: ["مقهى", "قهوة", "café", "cafetería"],
  pizza: ["بيتزا", "pizza"],
  burger: ["برغر", "برجر", "burger", "hamburger"],
  tagine: ["طاجين", "طجين", "tajine", "tagine"],
  couscous: ["كسكس", "couscous", "cuscús"],
  shampoo: ["شامبو", "shampooing", "champú"],
  toothpaste: ["معجون", "dentifrice", "pasta de dientes"],
  detergent: ["منظف", "صابون", "lessive", "detergente"],
  diapers: ["حفاضات", "couches", "pañales"],
  sunscreen: ["واقي الشمس", "crème solaire", "protector solar"],
  water_bottle: ["قنينة ماء", "bouteille d'eau", "botella de agua"],
};

const PHRASES: Array<[string, string]> = [
  ["pomme de terre", "potato"],
  ["creme solaire", "sunscreen"],
  ["protector solar", "sunscreen"],
  ["pasta de dientes", "toothpaste"],
  ["سيارة اجرة", "taxi"],
];

const TOKEN_ALIASES = new Map<string, string>();
for (const [canonical, variants] of Object.entries(SYNONYMS)) {
  for (const variant of [canonical, ...variants]) {
    TOKEN_ALIASES.set(normalizeSearchText(variant), canonical);
  }
}

/** Query variants used for matching: normalized, phrase-expanded and canonical. */
export function expandSearchQuery(query: string): string[] {
  const normalized = normalizeSearchText(query);
  if (!normalized) return [];
  const variants = new Set<string>([normalized]);
  let phrase = normalized;
  for (const [from, to] of PHRASES) {
    if (phrase.includes(from)) {
      phrase = phrase.split(from).join(to);
      variants.add(phrase);
    }
  }
  const canonical = phrase
    .split(" ")
    .map((token) => TOKEN_ALIASES.get(token) ?? token)
    .join(" ");
  variants.add(canonical);
  return [...variants].filter(Boolean).slice(0, 8);
}

function expandedMatchScore(query: string, fields: Array<string | undefined>): number {
  let best = 0;
  for (const variant of expandSearchQuery(query)) {
    best = Math.max(best, matchScore(variant, fields));
  }
  return best;
}

function allowedDistance(token: string): number {
  if (token.length <= 4) return 0;
  if (token.length <= 7) return 1;
  return 2;
}

/** Small bounded Levenshtein implementation; no dependency required. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = current[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost,
      );
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function tokenScore(fieldToken: string, queryToken: string): number {
  if (!fieldToken || !queryToken) return 0;
  if (fieldToken === queryToken) return 5;
  if (fieldToken.startsWith(queryToken)) return 4;
  if (fieldToken.includes(queryToken)) return 3;
  // Typos are only considered when the first letter is stable; this stops
  // short unrelated words (water/later) from fuzzy-matching each other.
  if (fieldToken[0] !== queryToken[0]) return 0;
  const distance = editDistance(fieldToken, queryToken, allowedDistance(queryToken));
  if (distance <= allowedDistance(queryToken)) return 2;
  return 0;
}

/**
 * Scores a query against a set of fields. Exact phrases beat prefixes, which
 * beat word matches, which beat one- or two-character typos.
 */
export function matchScore(query: string, fields: Array<string | undefined>): number {
  const needle = normalizeSearchText(query);
  if (!needle) return 0;
  const queryTokens = needle.split(" ").filter(Boolean);
  let best = 0;

  for (const field of fields) {
    if (!field) continue;
    const haystack = normalizeSearchText(field);
    if (!haystack) continue;

    if (haystack === needle) {
      best = Math.max(best, 140);
      continue;
    }
    if (haystack.startsWith(`${needle} `)) {
      best = Math.max(best, 120);
      continue;
    }
    const words = haystack.split(" ");
    const wordMatch =
      words.includes(needle) ||
      haystack.startsWith(`${needle} `) ||
      haystack.endsWith(` ${needle}`) ||
      haystack.includes(` ${needle} `);
    if (wordMatch) {
      best = Math.max(best, 95);
      continue;
    }
    if (haystack.includes(needle)) {
      best = Math.max(best, 58);
      continue;
    }

    const haystackTokens = haystack.split(" ").filter(Boolean);
    let tokenTotal = 0;
    for (const queryToken of queryTokens) {
      let tokenBest = 0;
      for (const haystackToken of haystackTokens) {
        tokenBest = Math.max(tokenBest, tokenScore(haystackToken, queryToken));
      }
      if (!tokenBest) {
        tokenTotal = 0;
        break;
      }
      tokenTotal += tokenBest;
    }
    if (tokenTotal) {
      best = Math.max(best, 45 + (tokenTotal / queryTokens.length) * 9);
    }
  }

  return best;
}

function cityName(city: City | undefined): string {
  return city?.name ?? "";
}

function shortImage(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.startsWith("data:") ? undefined : value;
}

function storeIsOpen(store: Store): boolean {
  return getOpenState(store).open;
}

function distanceFor(store: Store, city: City | undefined): number | undefined {
  if (!city) return undefined;
  return Math.round(distanceKm(city, store) * 10) / 10;
}

function etaFor(store: Store, distance: number | undefined): number {
  return store.prepTime + (distance === undefined ? 6 : Math.round(6 + distance * 2.2));
}

function stockState(product: Product): "in_stock" | "low_stock" | "sold_out" {
  const total = product.variants?.length
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : (product.stock ?? 1);
  if (!product.available || total <= 0) return "sold_out";
  if (total <= (product.lowStockThreshold ?? 5)) return "low_stock";
  return "in_stock";
}

function stockCount(product: Product): number {
  return product.variants?.length
    ? product.variants.reduce((sum, variant) => sum + variant.stock, 0)
    : (product.stock ?? 1);
}

/** Group equivalent grocery items so offers can be compared across stores. */
function productFamily(product: Product): string {
  const text = normalizeSearchText(
    `${product.name} ${product.brand ?? ""} ${product.category}`,
  );
  for (const canonical of Object.keys(SYNONYMS)) {
    if (text.split(" ").includes(canonical)) return canonical;
    const variants = SYNONYMS[canonical].map((value) => normalizeSearchText(value));
    if (variants.some((value) => value && text.includes(value))) return canonical;
  }
  return normalizeSearchText(product.name)
    .replace(/\b\d+([.,]\d+)?\s*(kg|g|l|ml|cl|pack|x|pieces?|pcs?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ServiceDefinition = {
  id: string;
  title: string;
  subtitle: string;
  keywords: string[];
  href: (citySlug: string) => string;
  enabled: (db: Database, citySlug: string) => boolean;
};

const SERVICES: ServiceDefinition[] = [
  {
    id: "restaurants",
    title: "Restaurants",
    subtitle: "Local kitchens and cafés",
    keywords: ["restaurant", "food", "eat", "delivery", "مطاعم", "أكل"],
    href: (citySlug) => `/city/${citySlug}?category=restaurant`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) =>
          store.citySlug === citySlug &&
          (store.category === "restaurant" || store.category === "cafe"),
      ),
  },
  {
    id: "grocery",
    title: "Grocery",
    subtitle: "Supermarkets and daily essentials",
    keywords: ["grocery", "groceries", "supermarket", "market", "بقالة", "سوبرماركت"],
    href: () => "/grocery",
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "grocery",
      ),
  },
  {
    id: "taxi",
    title: "Taxi",
    subtitle: "Cash fare and live route",
    keywords: ["taxi", "ride", "car", "airport", "transport", "طاكسي", "سيارة"],
    href: () => "/taxi",
    enabled: (db, citySlug) =>
      db.drivers.some(
        (driver) =>
          driver.citySlug === citySlug &&
          driver.active &&
          driver.kind !== "delivery",
      ) || citySlug === "dakhla",
  },
  {
    id: "pharmacy",
    title: "Pharmacy",
    subtitle: "Health and personal care",
    keywords: ["pharmacy", "medicine", "health", "صيدلية", "دواء"],
    href: (citySlug) => `/city/${citySlug}?category=pharmacy`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "pharmacy",
      ),
  },
  {
    id: "cafes",
    title: "Cafés",
    subtitle: "Coffee, breakfast and something sweet",
    keywords: ["cafe", "coffee", "breakfast", "مقهى", "قهوة"],
    href: (citySlug) => `/city/${citySlug}?category=cafe`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "cafe",
      ),
  },
  {
    id: "gifts",
    title: "Gifts",
    subtitle: "Something local, delivered",
    keywords: ["gift", "gifts", "present", "هدية", "هدايا"],
    href: (citySlug) => `/city/${citySlug}?category=gifts`,
    enabled: (db, citySlug) =>
      db.stores.some(
        (store) => store.citySlug === citySlug && store.category === "gifts",
      ),
  },
];

function deliveryOptions(
  db: Database,
  citySlug: string,
): Array<Omit<SearchHit, "score">> {
  const city = db.cities.find((candidate) => candidate.slug === citySlug);
  if (!cityServiceEnabled(city, "grocery")) return [];
  const grocery = db.stores.find(
    (store) => store.citySlug === citySlug && store.category === "grocery",
  );
  if (!grocery) return [];
  const settings = grocery.grocery;
  const items: Array<Omit<SearchHit, "score">> = [
    {
      id: "delivery-pickup",
      kind: "delivery",
      title: "Pickup",
      subtitle: "Collect from the store",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=pickup",
      meta: grocery.name,
    },
    {
      id: "delivery-express",
      kind: "delivery",
      title: "Express",
      subtitle: "Fastest available window",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=express",
      meta: grocery.name,
    },
  ];
  if (settings?.schedulingEnabled) {
    items.push({
      id: "delivery-scheduled",
      kind: "delivery",
      title: "Scheduled",
      subtitle: "Choose a later delivery window",
      titleIsKey: true,
      subtitleIsKey: true,
      href: "/grocery?filter=all",
      meta: grocery.name,
    });
  }
  return items;
}

function storeCategoryCounts(stores: Store[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const store of stores) {
    counts.set(store.category, (counts.get(store.category) ?? 0) + 1);
  }
  return counts;
}

/**
 * Searches the real platform document. Results never include invented
 * availability, prices or destinations.
 */
export function searchPlatform(db: Database, input: SearchInput): SearchResult {
  const query = (input.query ?? "").trim();
  const citySlug = input.citySlug || "dakhla";
  const limit = Math.max(1, Math.min(input.limit ?? 10, 30));
  const city = db.cities.find((candidate) => candidate.slug === citySlug);
  const cityStores = db.stores.filter((store) => store.citySlug === citySlug);
  const storeById = new Map(db.stores.map((store) => [store.id, store]));
  const empty = !normalizeSearchText(query);

  const stores: SearchHit[] = [];
  for (const store of db.stores) {
    if (store.citySlug !== citySlug) continue;
    const fields = [
      store.name,
      store.nameAr,
      store.tagline,
      store.description,
      store.landmark,
      store.address,
      categoryLabel(store.category),
      ...(store.tags ?? []),
      ...(store.dietaryTags ?? []),
      db.cities.find((candidate) => candidate.slug === store.citySlug)?.name,
      db.cities.find((candidate) => candidate.slug === store.citySlug)?.nameAr,
    ];
    const base = empty ? (store.citySlug === citySlug ? 50 : 0) : expandedMatchScore(query, fields);
    if (!base) continue;
    const local = store.citySlug === citySlug;
    const distance = distanceFor(store, city);
    const score =
      base +
      (local ? 35 : 0) +
      (storeIsOpen(store) ? 12 : 0) +
      Math.min(15, store.rating * 3) -
      (distance ?? 0) * 1.2;
    stores.push({
      id: store.id,
      kind: "store",
      title: store.name,
      subtitle: `${categoryLabel(store.category)} · ${store.landmark}`,
      href: `/store/${store.slug}`,
      meta: store.isOpen ? "Open" : "Closed",
      image: shortImage(store.image),
      citySlug: store.citySlug,
      distanceKm: distance,
      etaMinutes: etaFor(store, distance),
      storeRating: store.rating,
      stockStatus: storeIsOpen(store) ? "in_stock" : "sold_out",
      sponsored: false,
      score,
    });
  }
  stores.sort((a, b) => b.score - a.score);

  const products: SearchHit[] = [];
  for (const product of db.products) {
    const store = storeById.get(product.storeId);
    if (!store || store.citySlug !== citySlug) continue;
    const variants = product.variants ?? [];
    const nameFields = [
      product.name,
      product.brand,
      product.category,
      product.aisle,
      product.sku,
      product.barcode,
      store.name,
      store.nameAr,
      ...variants.flatMap((variant) => [
        variant.label,
        variant.sku,
        variant.barcode,
      ]),
    ];
    const base = empty
      ? product.popular
        ? 45
        : store.citySlug === citySlug
          ? 10
          : 0
      : Math.max(
          expandedMatchScore(query, nameFields),
          expandedMatchScore(query, [product.description]) * 0.45,
        );
    if (!base) continue;
    const stock = stockCount(product);
    const status = stockState(product);
    const soldOut = status === "sold_out";
    const distance = distanceFor(store, city);
    const promotion =
      store.category === "grocery" && db.promotions?.length
        ? promotionForProduct(product, db.promotions, store.id)
        : undefined;
    const score =
      base +
      (store.citySlug === citySlug ? 28 : 0) +
      (product.popular ? 8 : 0) +
      (soldOut ? -40 : 8) +
      Math.min(12, store.rating * 2) -
      (distance ?? 0) * 1.2 +
      (promotion ? 7 : 0);
    products.push({
      id: product.id,
      kind: "product",
      title: product.name,
      subtitle: store.name,
      href: `/store/${store.slug}?product=${encodeURIComponent(product.id)}`,
      meta: `${product.price} MAD`,
      image: shortImage(product.image),
      badge: soldOut ? "Sold out" : undefined,
      storeId: store.id,
      storeSlug: store.slug,
      storeName: store.name,
      storeCategory: store.category,
      citySlug: store.citySlug,
      storeLat: store.lat,
      storeLng: store.lng,
      price: product.price,
      unit: product.unit,
      category: product.category,
      stock,
      deliveryFee: store.deliveryFee,
      minOrder: store.minOrder,
      barcode: product.barcode,
      distanceKm: distance,
      etaMinutes: etaFor(store, distance),
      storeRating: store.rating,
      stockStatus: status,
      promotion: promotion?.title,
      promotionPercent: promotion?.percentOff,
      sponsored: false,
      score,
    });
  }
  products.sort((a, b) => b.score - a.score);

  const comparisonMap = new Map<
    string,
    { title: string; image?: string; unit?: string; category?: string; offers: ComparisonOffer[] }
  >();
  if (!empty) {
    for (const product of db.products) {
      const store = storeById.get(product.storeId);
      if (!store || store.citySlug !== citySlug) continue;
      const status = stockState(product);
      if (status === "sold_out") continue;
      const base = expandedMatchScore(query, [
        product.name,
        product.brand,
        product.category,
        product.aisle,
        store.name,
        store.nameAr,
      ]);
      if (!base) continue;
      const family = productFamily(product);
      if (!family) continue;
      // Comparisons must be the same item, not any product whose description
      // happens to mention the query. Require a query word in the family name.
      const familyWords = family.split(" ").filter(Boolean);
      const queryWords = new Set(
        expandSearchQuery(query).flatMap((variant) => variant.split(" ")),
      );
      const familyMatches = [...queryWords].some(
        (word) => word.length > 1 && familyWords.includes(word),
      );
      if (!familyMatches) continue;
      const distance = distanceFor(store, city);
      const promotion =
        store.category === "grocery" && db.promotions?.length
          ? promotionForProduct(product, db.promotions, store.id)
          : undefined;
      const entry = comparisonMap.get(family) ?? {
        title: product.name,
        image: shortImage(product.image),
        unit: product.unit,
        category: product.category,
        offers: [],
      };
      entry.offers.push({
        storeId: store.id,
        storeSlug: store.slug,
        storeName: store.name,
        storeRating: store.rating,
        price: product.price,
        stock: stockCount(product),
        stockStatus: status,
        deliveryFee: store.deliveryFee,
        distanceKm: distance,
        etaMinutes: etaFor(store, distance),
        promotion: promotion?.title,
        href: `/store/${store.slug}?product=${encodeURIComponent(product.id)}`,
      });
      comparisonMap.set(family, entry);
    }
  }

  const comparisons: ProductComparison[] = [...comparisonMap.entries()]
    .map(([key, entry]) => {
      const byStore = new Map<string, ComparisonOffer>();
      for (const offer of entry.offers) {
        const current = byStore.get(offer.storeId);
        if (!current || offer.price < current.price) byStore.set(offer.storeId, offer);
      }
      const offers = [...byStore.values()].sort((a, b) => a.price - b.price);
      return {
        key,
        title: entry.title,
        image: entry.image,
        unit: entry.unit,
        category: entry.category,
        bestPrice: offers[0]?.price ?? 0,
        offers,
      };
    })
    .filter((entry) => entry.offers.length >= 2)
    .sort((a, b) => b.offers.length - a.offers.length || a.bestPrice - b.bestPrice)
    .slice(0, 4);

  const categories: SearchHit[] = [];
  const counts = storeCategoryCounts(cityStores.length ? cityStores : db.stores);
  for (const [category, count] of counts) {
    const title = categoryLabel(category);
    const base = empty
      ? 30
      : matchScore(query, [title, category]);
    if (!base) continue;
    categories.push({
      id: `category-${category}`,
      kind: "category",
      title,
      subtitle: count === 1 ? "1 store" : `${count} stores`,
      href:
        category === "grocery"
          ? "/grocery"
          : `/city/${citySlug}?category=${category}`,
      meta: String(count),
      score: base + 8,
    });
  }

  const groceryCategories = new Map<string, number>();
  for (const product of db.products) {
    const store = storeById.get(product.storeId);
    if (!store || store.category !== "grocery" || !product.category) continue;
    groceryCategories.set(
      product.category,
      (groceryCategories.get(product.category) ?? 0) + 1,
    );
  }
  for (const [category, count] of groceryCategories) {
    const base = empty ? 12 : matchScore(query, [category]);
    if (!base) continue;
    categories.push({
      id: `aisle-${category}`,
      kind: "category",
      title: category,
      subtitle: "Grocery aisle",
      href: `/grocery?q=${encodeURIComponent(category)}`,
      meta: String(count),
      score: base + 4,
    });
  }
  categories.sort((a, b) => b.score - a.score);

  const services: SearchHit[] = [];
  for (const service of SERVICES) {
    const serviceGate =
      service.id === "grocery"
        ? "grocery"
        : service.id === "taxi"
          ? "taxi"
          : "restaurant";
    if (!cityServiceEnabled(city, serviceGate)) continue;
    if (!service.enabled(db, citySlug)) continue;
    const base = empty ? 24 : matchScore(query, [service.title, ...service.keywords]);
    if (!base) continue;
    services.push({
      id: `service-${service.id}`,
      kind: "service",
      title: service.title,
      subtitle: service.subtitle,
      titleIsKey: true,
      subtitleIsKey: true,
      href: service.href(citySlug),
      meta: city ? cityName(city) : undefined,
      score: base + 10,
    });
  }
  services.sort((a, b) => b.score - a.score);

  const delivery: SearchHit[] = [];
  for (const option of deliveryOptions(db, citySlug)) {
    const base = empty
      ? 8
      : matchScore(query, [
          option.title,
          option.subtitle,
          option.href,
          "delivery",
          "cash",
        ]);
    if (!base) continue;
    delivery.push({ ...option, score: base + 4 });
  }
  delivery.sort((a, b) => b.score - a.score);

  const grouped: Array<[SearchKind, SearchHit[]]> = [
    ["store", stores],
    ["product", products],
    ["category", categories],
    ["service", services],
    ["delivery", delivery],
  ];

  const groups: SearchGroup[] = grouped
    .filter(([, hits]) => hits.length > 0)
    .map(([kind, hits]) => ({
      kind,
      label: GROUP_LABELS[kind],
      hits: hits.slice(0, Math.min(GROUP_LIMITS[kind], limit)),
    }));

  const suggestions = Array.from(
    new Set(
      [
        ...stores.map((hit) => hit.title),
        ...products.map((hit) => hit.title),
        ...categories.map((hit) => hit.title),
        ...services.map((hit) => hit.title),
      ]
        .filter((value) => value.trim().length > 1)
        .slice(0, 24),
    ),
  ).slice(0, 6);

  return {
    query,
    citySlug,
    groups,
    suggestions,
    comparisons,
    total: groups.reduce((sum, group) => sum + group.hits.length, 0),
  };
}
