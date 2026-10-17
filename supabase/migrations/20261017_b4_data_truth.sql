-- ════════════════════════════════════════════════════════════════════
-- Thriv — B4 data-truth migration (2026-10-17)
--
-- Closes F-10 (missing subcategory / is_featured columns), F-15 (phantom
-- seed row) and F-16 (fabricated image paths). Applied live via psycopg
-- after a rolled-back test pass — this project has no migration-history
-- table (see supabase/README.md).
--
-- SAFE TO RE-RUN: every statement is idempotent.
-- ════════════════════════════════════════════════════════════════════

-- ── F-10: columns the admin form has always collected ───────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Backfill from the original static catalogue (data/products.ts). Only
-- fills gaps so later manual values are never clobbered.
UPDATE products AS p
SET subcategory = v.subcategory
FROM (VALUES
  ('zara-wide-leg-vintage-wash-denim', 'wide-leg'),
  ('bershka-baggy-carpenter-jeans', 'baggy'),
  ('calvin-klein-straight-cut-indigo-jeans', 'straight-leg'),
  ('hm-relaxed-light-blue-skater-jeans', 'baggy'),
  ('zara-raw-edge-flared-denim', 'wide-leg'),
  ('old-navy-loose-fit-workwear-jeans', 'relaxed-fit'),
  ('calvin-klein-high-rise-mom-jeans', 'relaxed-fit'),
  ('zara-distressed-knee-straight-jeans', 'straight-leg'),
  ('hm-washed-grey-cargo-denim', 'cargo-denim'),
  ('old-navy-classic-straight-dark-wash', 'straight-leg'),
  ('bershka-skater-fit-dirty-wash-denim', 'vintage-wash'),
  ('calvin-klein-slim-taper-black-jeans', 'straight-leg'),
  ('zara-pleated-wide-leg-trousers-denim', 'wide-leg'),
  ('hm-vintage-regular-stone-wash', 'straight-leg'),
  ('bershka-multi-pocket-utility-denim', 'cargo-denim'),
  ('old-navy-high-waisted-cropped-flare', 'wide-leg'),
  ('zara-acid-wash-relaxed-denim', 'vintage-wash'),
  ('calvin-klein-standard-straight-light-indigo', 'straight-leg'),
  ('hm-baggy-fit-ecru-natural-denim', 'baggy'),
  ('bershka-extreme-wide-leg-blue-jeans', 'wide-leg'),
  ('old-navy-boyfriend-slouch-jeans', 'relaxed-fit'),
  ('zara-faded-washed-charcoal-relaxed-denim', 'relaxed-fit'),
  ('calvin-klein-vintage-medium-wash-straight', 'straight-leg'),
  ('hm-wide-leg-cargo-pocket-denim', 'cargo-denim'),
  ('bershka-contrast-stitch-skater-jeans', 'baggy'),
  ('zara-archive-patchwork-reconstructed-jeans', 'vintage-wash'),
  ('calvin-klein-90s-classic-tapered-mom-denim', 'relaxed-fit'),
  ('akira-neo-tokyo-cyberpunk-tee', 'anime-tees'),
  ('evangelion-unit-01-schematic-tee', 'anime-tees'),
  ('berserk-brand-of-sacrifice-vintage-wash-tee', 'anime-tees'),
  ('cowboy-bebop-swordfish-jazz-noir-tee', 'anime-tees')
) AS v(slug, subcategory)
WHERE p.slug = v.slug
  AND (p.subcategory IS NULL OR p.subcategory = '');

UPDATE products AS p
SET is_featured = true
FROM (VALUES
  ('zara-wide-leg-vintage-wash-denim'),
  ('akira-neo-tokyo-cyberpunk-tee'),
  ('evangelion-unit-01-schematic-tee')
) AS v(slug)
WHERE p.slug = v.slug;

-- ── F-15: the phantom row is hidden by the single mechanism
-- (is_active). The hardcoded slug exclusions in lib/products-db.ts were
-- removed in the same release, so this row is now the only source of
-- truth about its own visibility.
UPDATE products SET is_active = false
WHERE slug = 'bershka-washed-black-balloon-jeans';

-- ── F-16: drop fabricated local image paths (no such files ever
-- existed). The storefront now renders an explicit "photo coming soon"
-- tile; upload real photos via admin → Supabase Storage (absolute URLs)
-- to replace.
UPDATE products
SET images = '{}'
WHERE images IS NOT NULL
  AND EXISTS (SELECT 1 FROM unnest(images) AS img WHERE img LIKE '/products/%');

-- ── F-62 note: the flat delivery fee exists in two runtimes — the live
-- value is v_delivery_fee in place_order (currently 200) and the client
-- mirror is FLAT_DELIVERY_FEE in lib/cart.ts. Change BOTH together.
