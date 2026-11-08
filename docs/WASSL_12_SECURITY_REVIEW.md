# Wassl 12.0 — Security review

## Scope of this review

Phase 1A search changes:

- `src/lib/search.ts`
- `src/app/api/search/route.ts`
- `src/app/search/search-experience.tsx`
- `src/lib/i18n.ts`

## Search-specific review

- Search is read-only. It cannot mutate orders, stock or prices.
- Query length is capped by the API (`slice(0, 80)`).
- City is constrained to the city directory before use.
- Results are built from the database document; no client-supplied
  prices or availability are trusted.
- Product links include a product id that is re-validated by the store page.
- Promotions are read through `promotionForProduct`, which checks
  active dates and store scope.
- Comparison results are informational and do not create a basket.
- Sponsored results are explicitly flagged; no fake ads are injected.
- No user data is included in the public search response.
- No new external provider or credential was introduced.

## Broader checklist (not yet complete)

- Rate limiting on public search (currently cache headers only).
- Authenticated personal search (recent purchases) must scope queries
  to the session user.
- Campaign tables need server-side budget, eligibility and fraud checks.
- Modern CSRF/session review across all mutation routes.
- Webhook signature verification for WhatsApp/voice providers.
- Upload validation and path traversal review.
- IDOR review for group orders, families, recurring orders and
  pickup points.
- Financial ledger permissions for driver wallets and COD.
- Data retention and Moroccan privacy compliance review.

## Deployment stance

No production deployment has been performed from this branch. The
existing `/etc/wassl.env` secrets remain outside git.
