# Wassl 12.0 — Database migration plan

## Current state

Production uses the JSON document backend:

- `WASSL_DATA_DIR=/var/lib/wassl`
- `/var/lib/wassl/db.json`
- A single document with users, cities, stores, products, drivers,
  orders, addresses, promotions, loyalty, chat, parcels, services,
  business accounts and audit logs.
- Mutations are serialized through the application write path.
- Backups are written before catalogue merges.

PostgreSQL support exists in code (`src/lib/db-backend.ts`) but is
not enabled in production.

## Migration principles

1. Take a verified backup before any migration.
2. Do not switch production to PostgreSQL until counts, foreign keys,
   reads and writes are verified.
3. Keep the JSON backend available during the transition.
4. Use transactions for stock, orders, wallets and ledgers.
5. Add unique constraints and indexes for lookup-heavy fields.
6. Preserve idempotency keys for sensitive creation endpoints.
7. Provide a tested rollback path.

## Proposed domain tables

- users, sessions, addresses
- cities, city_services
- stores, store_hours, grocery_settings
- products, product_variants, inventory, stock_movements
- orders, order_items, order_events, order_ratings
- drivers, driver_locations, driver_assignments, driver_cash_ledger
- promotions, campaigns, ad_events
- loyalty_accounts, loyalty_transactions
- chat_threads, chat_messages
- parcels, parcel_events
- service_providers, service_bookings
- business_accounts, business_orders
- recurring_orders, group_orders, group_participants
- families, family_members
- ai_conversations, ai_action_logs
- audit_events

## Migration steps (not started)

1. Export JSON and record counts per collection.
2. Create schema, keys and indexes.
3. Import in dependency order.
4. Reconcile counts and checksums.
5. Run read-only shadow reads.
6. Enable dual-write behind a feature flag.
7. Compare reads and writes for a defined window.
8. Switch reads, then writes, with rollback available.
9. Keep the JSON backup for the agreed retention period.

No migration has been run in this branch.
