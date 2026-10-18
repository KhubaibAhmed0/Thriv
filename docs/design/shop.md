# Thriv shop

The shop extends the approved landing-page identity. Its mode is Operate: help customers find, inspect, save, and add real catalogue pieces.

## Direction contract

**Thesis:** A spacious editorial collection with clear product browsing. Remove the enclosing beige card treatment and the long row of competing category pills.

**Own-world:** Inherit cream `#F5F3F0`, neutral photo panels `#E5E3DF`, denim `#1C2431`, pale denim `#CCD7DD`, Inter supporting copy, and locally hosted Anton display headings. Use subtle rounded panels, thin rules, and restrained pill controls.

**Story:** Understand the denim/graphic-tee offer, choose a category, refine by brand/fit/condition, inspect a piece or save it, then add the fixed denim size or a chosen tee size to the existing cart.

**First viewport:** Large left-aligned CURATED DROPS heading with short copy to the right. Three counted category tabs, saved-items link, compact search/filter/sort controls, and a three-column product grid. Mobile stacks the introduction and uses two product columns.

**Form:** Direct extension of the established storefront. Filters expand inline, keeping their context. URL parameters preserve search, categories, filters, sorting, and browser history. Neutral labelled media stays reserved until supplied photography is available. No new visual-world selection or generated imagery.

**Finish:** Verify desktop and mobile renders, keyboard/focus feedback, filter combinations, save/cart persistence, fixed denim quantity, tee size choice, empty/error/loading states, and image failure. Review against the existing homepage system; leave the work on localhost.

## Implementation boundaries

- Homepage and other catalogue-card consumers keep their current composition.
- `/api/products` remains authoritative; no client seed catalogue before loading or on failure.
- Existing cart/wishlist providers, stock checks, price formatting, and quick-add logic remain in use.
- Product photography uses the centralized `data/homepage.ts` mappings or catalogue images. No replacement photography is fetched.
- Reduced motion, native filter selects, visible focus, 44px actions, and polite result announcements remain available.

## Verification

Desktop/mobile screenshots checked at 1440, 1024, 768, 390, and 375px; 320px reflow also has no horizontal overflow. Browser checks passed for combined filters, sorting, search/back navigation, saved-item persistence, denim cart persistence/quantity one, tee size selection and focus restoration, sold-out controls, loading, empty/error/retry, and failed-image layout. Homepage, wishlist, cart, and checkout smoke checks returned 200 without runtime errors.

Production build, TypeScript, and ESLint passed. Independent finish review: ship for localhost. Impeccable's automated detector was unavailable because its engine is not installed; direct code and rendered-browser review was used. Product photographs remain intentionally labelled placeholders until supplied.
