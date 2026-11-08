# Wassl 12.0 — Implementation plan

## Phase 0 — Audit (complete)
- Repository inventory.
- Search, data, auth, routes and design audit.
- Baseline typecheck and production verification.

## Phase 1 — Customer commerce

### 1A. Universal search and cross-store discovery (this slice)
- Multilingual and Darija/Hassaniya synonym expansion.
- Distance and ETA on results using city/store coordinates.
- Store rating, stock, delivery fee and promotion metadata.
- Sponsored-result support with an explicit `sponsored` flag; no fake sponsored data.
- Product-family grouping to compare the same item across nearby stores.
- Search UI section “Compare nearby stores”.
- Tests for normalization, synonyms, ranking, distance/ETA and comparison.

### 1B. Personal search (next)
- Recent purchases and frequently bought products for signed-in customers.
- One-click reorder.
- Personalised suggestions using real order history only.

### 1C. Smart Basket (next)
- Named saved baskets, duplicate, share, schedule reminders, add all to cart.
- Replenishment suggestions from actual purchase history.
- Cheapest-alternative suggestions.
- Budget-based basket generation.

### 1D. Group orders (next)
- Secure expiring invitation tokens, participant carts, deadlines, lock and shared tracking.
- Single-merchant checkout only.

### 1E. Recurring orders (next)
- Scheduler with idempotency, pause/skip/edit, COD confirmation consent.

### 1F. Wassl Family (next)
- Household accounts, roles, shared lists/baskets, permissions.

### 1G. Wassl Deals (next)
- Campaign schema, approvals, budgets, redemptions, performance, sponsored labels.

## Phase 2 — Merchant ecosystem
- POS, AI Manager, CRM, advanced inventory, marketing centre.

## Phase 3 — Logistics
- Dispatch 2.0, multi-order delivery, driver wallet, incentives, Send, pickup points.

## Phase 4 — AI and communication
- WhatsApp ordering, voice ordering, AI concierge.

## Phase 5 — New commerce
- Local marketplace, Wassl Home, mini apps, Wassl Club.

## Phase 6 — Admin and infrastructure
- Intelligence, city launch manager, fraud/risk, PostgreSQL migration prep,
  real-time hardening, security review.

## Deployment gates
- Typecheck, unit/integration tests, build, responsive checks and axe.
- Backup `/var/lib/wassl/db.json`.
- Stop `wassl.service` before rebuilding `.next`.
- Restart, health-check and inspect logs.
- Never deploy destructive migrations without explicit approval.
