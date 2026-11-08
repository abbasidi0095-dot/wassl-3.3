# Wassl 12.0 — Repository audit

Date: 2026-11-08
Branch: `feat/wassl-12`
Baseline commit: `7c17a01`
Production: `https://wassl.shop` (`/opt/wassl`, `wassl.service`, `127.0.0.1:3000`)

## 1. Existing capabilities

### Platform
- Next.js 16 App Router, React 19, strict TypeScript, Tailwind v4.
- JSON document backend in production (`/var/lib/wassl/db.json`, `WASSL_DATA_DIR`).
- Optional PostgreSQL backend (`DATABASE_URL`, `wassl_state` JSONB row).
- 209 cities, 105 stores, 1,720 products.
- EN / FR / ES / AR with RTL.
- Runtime brand and theme settings; light default.
- PWA plus Capacitor iOS/Android shells.
- SSE events (`/api/events`, `/api/events/poll`).
- MapLibre with a locally served worker.

### Customer
- Food storefront, store browser, search, product modifiers and cart.
- Grocery storefront, aisles, favourites, lists, basket, barcode scan, assistant, express/scheduled windows.
- Pharmacy catalogue.
- Taxi local/intercity/airport with fare confirmation and live tracking.
- Express parcels with quotes, tracking and PIN handover.
- Professional services providers and bookings.
- COD checkout, order history, ratings, reorder.
- Chat, loyalty, referrals, promos, push notifications, account, addresses, business accounts.

### Merchant
- Live order board and status actions.
- Menu and product management.
- Grocery settings, zones, slots, substitutions.
- Stock, promotions, COD reconciliation, messages, business orders.

### Driver
- Online/offline/available/busy state.
- Queue, claim, pickup, en route, delivered.
- Location updates, COD cash tracking, handover codes.
- Taxi and parcel boards.

### Admin
- Dispatch, orders, stores, products, drivers, accounts, cities.
- Grocery, pharmacy, taxi, express, services and business consoles.
- Settings, brand colours, theme preset, data provenance, audit activity.
- WhatsApp/OpenWA and push test tools.

## 2. Existing search

- `src/lib/search.ts` — `normalizeSearchText`, bounded Levenshtein, `matchScore`, `searchPlatform`.
- `src/app/api/search/route.ts` — query + city + limit.
- `src/app/search/page.tsx` + `search-experience.tsx`.
- Current results: stores, products, categories, services, delivery options.
- Current ranking: text match + city locality + open state + rating + popularity.
- Existing recent searches in localStorage.
- Gaps: no cross-store product comparison, no distance/ETA in results, no promotion metadata, no sponsored-result handling, no Darija/Hassaniya synonym expansion, no personal purchase history in search, no local marketplace index.

## 3. Reusable foundations

- `distanceKm` in `src/lib/utils.ts`.
- `getOpenState` in `src/lib/hours.ts`.
- `cityServiceEnabled` in `src/lib/city-services.ts`.
- `activeGroceryPromotions` / `promotionForProduct` in `src/lib/grocery-promotions.ts`.
- `getSession` and role guards for authenticated features.
- `getOrderViews` for purchase history.
- Existing `SearchHit` type and grouped result model.
- Existing design system classes in `src/app/globals.css`.

## 4. Risks and constraints

- Production is live with real data; no destructive migration without backup.
- JSON backend has no relational constraints; all validation must stay in application code.
- Product names are mostly English while customers search in Arabic, French, Spanish and Darija; synonyms are required.
- No sponsored-campaign schema yet; do not fake sponsored results.
- Distance can only use the selected city and store coordinates; there is no confirmed live customer GPS permission.
- Multi-store checkout does not exist; cross-store comparison must never imply one basket or one delivery.
- AI/WhatsApp/voice providers must be configurable and must not create orders without confirmation.

## 5. Verification baseline

- `npm run typecheck` passes.
- Build passes.
- Customer routes have zero horizontal overflow at 1440/1024/768/390.
- WCAG 2.2 AA axe checks pass on tested customer routes.
- MapLibre worker is served locally.
- Signed-out `/api/session` probes return 401 by design.
