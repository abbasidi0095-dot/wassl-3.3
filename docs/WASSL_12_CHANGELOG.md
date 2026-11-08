# Wassl 12.0 — Changelog

## 2026-11-08 — Phase 1A: Universal search and cross-store discovery

Status: **implemented on branch `feat/wassl-12`, not deployed**.

### Added

- Multilingual and Darija/Hassaniya synonym expansion for search:
  - milk / حليب / لبن / lait / leche
  - bread / خبز / pain / pan
  - water / ماء / eau / agua
  - chicken / دجاج / poulet / pollo
  - fish / سمك / حوت / poisson / pescado
  - plus meat, eggs, rice, oil, sugar, produce, dairy, drinks,
    pharmacy, taxi, grocery, restaurant, café, pizza, burger,
    tagine, couscous and personal-care terms.
- Phrase aliases such as `pomme de terre → potato`.
- `expandedMatchScore()` used by stores, products, categories,
  services and comparisons.
- Distance from the selected city centre on store and product results.
- Prep + travel ETA in minutes.
- Store rating, delivery fee, stock state and live promotions on
  product results.
- Explicit `sponsored` flag on every hit. No fake sponsored data is
  produced while no campaign schema exists.
- Product-family grouping and `comparisons` in search results.
- “Compare nearby stores” UI with the same product across stores,
  sorted by price, showing stock, delivery fee, distance, ETA,
  rating and promotion.
- New translations for comparison, low stock, best price and
  sponsored labels in FR/ES/AR.

### Ranking

Store score:

`text + city locality + open state + rating − distance`

Product score:

`text + city locality + popularity + availability + rating − distance + promotion`

### Safety

- Comparisons are read-only discovery. They do not create a
  multi-store cart or imply one delivery.
- Prices, stock and promotions are read from the database document.
- Sponsored results are supported in the type and UI but no ads are
  fabricated.

### Tests

- `tests/search.test.ts` now covers:
  - Arabic/Darija/French/Spanish synonym expansion
  - cross-store comparison and price ordering
  - distance, ETA, stock state and sponsored flag
  - existing normalization, typo tolerance and empty-query behaviour

`npm run typecheck` passes. `npx vitest run tests/search.test.ts` passes
(8 tests).

### Not included in this slice

- Personal recent purchases/frequently bought in search (requires
  session-aware search API).
- Sponsored campaign storage and ad events.
- Local marketplace indexing.
- Group orders, recurring orders, family accounts, smart basket,
  POS, logistics, AI concierge and the remaining 12.0 phases.

### Classification

| Feature | Status |
|---|---|
| Multilingual universal search | COMPLETE for stores/products/categories/services/delivery |
| Cross-store product comparison | COMPLETE (single-city, read-only) |
| Distance / ETA / rating / stock in results | COMPLETE |
| Promotion metadata in search | COMPLETE for grocery products |
| Sponsored labels | PARTIALLY IMPLEMENTED (UI/type ready, no campaign data) |
| Personalised search history | NOT IMPLEMENTED |
| Local marketplace search | NOT IMPLEMENTED |
| Everything after Phase 1A | NOT IMPLEMENTED |
