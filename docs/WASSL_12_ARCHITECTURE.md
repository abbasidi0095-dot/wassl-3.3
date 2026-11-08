# Wassl 12.0 — Architecture

## Runtime

```
Browser / PWA / Capacitor shell
        │
        ▼
Next.js 16 App Router
  ├─ Server Components (data reads, route shells)
  ├─ Client Components (search, cart, dashboards, maps)
  ├─ Route Handlers /api/*
  └─ SSE /api/events
        │
        ▼
Data access: src/lib/db.ts
        │
        ├─ JSON backend   WASSL_DATA_DIR/db.json   (production today)
        └─ PostgreSQL     wassl_state (JSONB)      (optional)
```

## Domains

| Domain | Core modules |
|---|---|
| Identity | `auth.ts`, `auth-config.ts`, `api-auth.ts`, session cookies |
| Catalogue | `seed.ts`, `mock-catalog.json`, `store-images.ts`, `product-icon.tsx` |
| Search | `search.ts`, `/api/search`, `/search` |
| Orders | `order-machine.ts`, `db.ts`, `/api/orders/*`, `/orders/*` |
| Grocery | `grocery.ts`, `grocery-assistant.ts`, `basket.ts`, `grocery-promotions.ts` |
| Taxi | `taxi` routes, `taxi-rating.test.ts`, MapLibre |
| Express | `express.ts`, `/api/express/*`, `/express/*` |
| Services | `services-business.test.ts`, `/services`, `/provider/[code]` |
| Chat | `chat.ts`, `/api/chat/*`, `/messages` |
| Loyalty | `loyalty.ts`, `/api/loyalty/*` |
| Notifications | `events.ts`, `/api/push/*`, `web-push` |
| Design | `globals.css`, `theme.ts`, `brand-provider.tsx` |

## Data rules

- All prices, stock, promotions, permissions and order transitions are validated server-side.
- JSON mutations are serialized through `mutate()`.
- Postgres mutations lock the `wassl_state` row `FOR UPDATE`.
- New sensitive creation endpoints should accept and store idempotency keys.
- Financial and stock changes must be auditable.

## Search architecture (12.0 slice)

```
query ──► normalize (Unicode, diacritics, Arabic variants)
      ──► synonym expansion (EN/FR/ES/AR/Darija/Hassaniya)
      ──► token match + bounded typo tolerance
      ──► score = text + city + availability + rating + distance + promotion
      ──► group: stores, products, categories, services, delivery
      ──► product-family comparison (same item across nearby stores)
```

Comparison results are informational only. They do not create a multi-store cart.

## Future architecture

- PostgreSQL relational migration with domain tables, indexes and transactions.
- Campaign/ad tables for sponsored placements and ad events.
- Group order, recurring order, family and membership tables.
- Scheduler/worker for recurring orders and reminders.
- WhatsApp/voice provider adapters behind server-side interfaces.
- AI concierge tools with explicit confirmation and audit logs.
