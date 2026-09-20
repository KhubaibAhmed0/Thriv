-- ════════════════════════════════════════════════════════════════════
-- Thriv — Phase 1 Migration
-- Run this once in Supabase SQL Editor:
--   https://supabase.com/dashboard/project/_/sql
--
-- Safe to re-run: uses IF NOT EXISTS and OR REPLACE throughout.
-- Drop order: events → items → orders → products → admins → types
-- ════════════════════════════════════════════════════════════════════


-- ── 0. EXTENSIONS ───────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ── 1. ENUMS ────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('cod', 'bank_transfer', 'easypaisa', 'jazzcash', 'card');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_condition AS ENUM ('Premium', 'Excellent', 'Very Good');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ── 2. SEQUENCES ────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1 INCREMENT BY 1;


-- ── 3. TABLES ────────────────────────────────────────────────────────

-- admins — manually populated via Supabase dashboard after creating the user
CREATE TABLE IF NOT EXISTS admins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- products
CREATE TABLE IF NOT EXISTS products (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT              UNIQUE NOT NULL,
  name        TEXT              NOT NULL,
  brand       TEXT              NOT NULL,
  category    TEXT              NOT NULL,           -- 'jeans' | 'graphic-tees'
  price_pkr   INTEGER           NOT NULL CHECK (price_pkr BETWEEN 999 AND 2499),
  condition   product_condition,                    -- NULL for merch
  is_merch    BOOLEAN           NOT NULL DEFAULT false,
  size        TEXT,                                 -- thrift: one fixed size
  sizes       TEXT[],                               -- merch: array of sizes
  stock       INTEGER           NOT NULL DEFAULT 1 CHECK (stock >= 0),
  images      TEXT[]            NOT NULL DEFAULT '{}',
  description TEXT              NOT NULL,
  measurements JSONB,
  is_active   BOOLEAN           NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id               UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT           UNIQUE NOT NULL
                                  DEFAULT ('THR-' || LPAD(nextval('order_number_seq')::TEXT, 5, '0')),
  customer_name    TEXT           NOT NULL,
  customer_phone   TEXT           NOT NULL,
  customer_email   TEXT           NOT NULL,
  address_line     TEXT           NOT NULL,
  city             TEXT           NOT NULL,
  province         TEXT           NOT NULL,
  notes            TEXT,
  payment_method   payment_method NOT NULL,
  payment_status   payment_status NOT NULL DEFAULT 'unpaid',
  status           order_status   NOT NULL DEFAULT 'new',
  subtotal_pkr     INTEGER        NOT NULL,
  delivery_fee_pkr INTEGER        NOT NULL DEFAULT 200,
  total_pkr        INTEGER        NOT NULL,
  idempotency_key  TEXT           UNIQUE,
  created_at       TIMESTAMPTZ    NOT NULL DEFAULT now(),
  delivered_at     TIMESTAMPTZ
);

-- order_items — immutable snapshot taken at purchase time
-- NEVER join live to products for order history rendering
CREATE TABLE IF NOT EXISTS order_items (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID    NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID    REFERENCES products(id) ON DELETE SET NULL,
  product_slug  TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  brand         TEXT    NOT NULL,
  category      TEXT    NOT NULL,
  size          TEXT,
  condition     TEXT,
  unit_price_pkr INTEGER NOT NULL,
  quantity      INTEGER NOT NULL DEFAULT 1,
  image_path    TEXT
);

-- order_events — full audit trail of status changes
CREATE TABLE IF NOT EXISTS order_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID         NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status   order_status NOT NULL,
  note        TEXT,
  created_by  UUID         REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);


-- ── 4. INDEXES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_slug        ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category    ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_is_active   ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at    ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_number  ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_idem_key      ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_order   ON order_events(order_id);


-- ── 5. HELPER FUNCTION ──────────────────────────────────────────────
-- is_admin() — security definer so it can read the admins table
-- regardless of caller's RLS context.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE user_id = auth.uid()
  );
$$;


-- ── 6. ROW LEVEL SECURITY ────────────────────────────────────────────
-- Enable RLS on every table — no exceptions.
ALTER TABLE admins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- admins: each admin can read their own row only
DROP POLICY IF EXISTS "admins: read own row" ON admins;
CREATE POLICY "admins: read own row"
  ON admins FOR SELECT
  USING (user_id = auth.uid());

-- products: anon + authenticated can read active items
DROP POLICY IF EXISTS "products: public read active" ON products;
CREATE POLICY "products: public read active"
  ON products FOR SELECT
  USING (is_active = true);

-- products: only admins can insert / update / delete
DROP POLICY IF EXISTS "products: admin write" ON products;
CREATE POLICY "products: admin write"
  ON products FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- orders: admin read only — ZERO anon policies
DROP POLICY IF EXISTS "orders: admin select" ON orders;
CREATE POLICY "orders: admin select"
  ON orders FOR SELECT
  USING (is_admin());

-- orders: admin update only (status changes etc.)
DROP POLICY IF EXISTS "orders: admin update" ON orders;
CREATE POLICY "orders: admin update"
  ON orders FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- orders: inserts go via the service-role client from place_order RPC
-- No client INSERT policy — the RPC runs as security definer

-- order_items: admin read only — ZERO anon policies
DROP POLICY IF EXISTS "order_items: admin select" ON order_items;
CREATE POLICY "order_items: admin select"
  ON order_items FOR SELECT
  USING (is_admin());

-- order_events: admin only
DROP POLICY IF EXISTS "order_events: admin select" ON order_events;
CREATE POLICY "order_events: admin select"
  ON order_events FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS "order_events: admin insert" ON order_events;
CREATE POLICY "order_events: admin insert"
  ON order_events FOR INSERT
  WITH CHECK (is_admin());


-- ── 7. REALTIME ─────────────────────────────────────────────────────
-- Allows the admin portal to subscribe to new order events in real time.
ALTER PUBLICATION supabase_realtime ADD TABLE orders;


-- ── 8. PRODUCT SEED DATA ─────────────────────────────────────────────
-- All 32 products migrated from data/products.ts.
-- Sold-out items (stock: 0) are seeded with is_active = true so order
-- history still resolves them; the storefront filters by stock > 0.
-- Measurements stored as JSONB.

INSERT INTO products (slug, name, brand, category, price_pkr, condition, is_merch, size, sizes, stock, images, description, measurements, is_active)
VALUES

-- ── THRIFT JEANS (26 in stock) ──────────────────────────────────────

('zara-wide-leg-vintage-wash-denim',
 'Zara Wide-Leg Vintage Wash Denim', 'Zara', 'jeans', 2199, 'Premium', false, '32', NULL, 1,
 ARRAY['/products/zara-wide-leg-vintage-wash-denim-1.jpg'],
 'Heavyweight rigid denim in a faded stone wash with clean hems and wide leg draping. Cleaned and pre-sanitized in Karachi. No visible scuffs or edge fraying.',
 '{"waist":"32 in","length":"41 in","inseam":"30 in","rise":"12 in"}', true),

('bershka-baggy-carpenter-jeans',
 'Bershka Baggy Carpenter Jeans', 'Bershka', 'jeans', 1899, 'Excellent', false, '30', NULL, 1,
 ARRAY['/products/bershka-baggy-carpenter-jeans-1.jpg'],
 'Utility skater fit with utility hammer loop and reinforced back pockets in mid-blue wash. Soft broken-in cotton feel with zero structural flaws.',
 '{"waist":"30 in","length":"40 in","inseam":"29 in","rise":"11.5 in"}', true),

('calvin-klein-straight-cut-indigo-jeans',
 'Calvin Klein Straight Cut Indigo Jeans', 'Calvin Klein', 'jeans', 2499, 'Premium', false, '34', NULL, 1,
 ARRAY['/products/calvin-klein-straight-cut-indigo-jeans-1.jpg'],
 'Deep indigo raw-look denim with signature Calvin Klein leather patch at back waistband. High density 13.5oz weave with sharp tailored leg taper.',
 '{"waist":"34 in","length":"42 in","inseam":"32 in","rise":"11 in"}', true),

('hm-relaxed-light-blue-skater-jeans',
 'H&M Relaxed Light Blue Skater Jeans', 'H&M', 'jeans', 1599, 'Very Good', false, '31', NULL, 1,
 ARRAY['/products/hm-relaxed-light-blue-skater-jeans-1.jpg'],
 'Sun-bleached sky blue wash with relaxed thigh room and clean pooling at shoes. Minor surface fade characteristic of authentic pre-loved denim.',
 '{"waist":"31 in","length":"39 in","inseam":"28.5 in","rise":"11 in"}', true),

('zara-raw-edge-flared-denim',
 'Zara Raw Edge Flared Denim', 'Zara', 'jeans', 1999, 'Excellent', false, '28', NULL, 1,
 ARRAY['/products/zara-raw-edge-flared-denim-1.jpg'],
 'High-waisted fit with subtle bootcut flare and finished raw hem. Pure cotton structure with zero elastane sagging.',
 '{"waist":"28 in","length":"40.5 in","inseam":"31 in","rise":"11.5 in"}', true),

('old-navy-loose-fit-workwear-jeans',
 'Old Navy Loose Fit Workwear Jeans', 'Old Navy', 'jeans', 1499, 'Very Good', false, '33', NULL, 1,
 ARRAY['/products/old-navy-loose-fit-workwear-jeans-1.jpg'],
 'Durable heavyweight cotton denim built for everyday streetwear wear. Double-needle stitch lines and comfortable room in thighs.',
 '{"waist":"33 in","length":"41 in","inseam":"30 in","rise":"12 in"}', true),

('bershka-washed-black-balloon-jeans',
 'Bershka Washed Black Balloon Jeans', 'Bershka', 'jeans', 2099, 'Premium', false, '32', NULL, 1,
 ARRAY['/products/bershka-washed-black-balloon-jeans-1.jpg'],
 'Charcoal faded wash balloon curve profile that tapers neatly at the ankle. Heavyweight sanitized denim ready to wear straight out of the box.',
 '{"waist":"32 in","length":"39.5 in","inseam":"28 in","rise":"12.5 in"}', true),

('calvin-klein-high-rise-mom-jeans',
 'Calvin Klein High Rise Mom Jeans', 'Calvin Klein', 'jeans', 2399, 'Premium', false, '27', NULL, 1,
 ARRAY['/products/calvin-klein-high-rise-mom-jeans-1.jpg'],
 'Vintage 90s silhouette with high cinch waist and tapered ankle profile. Authentic CK metal button rivets with pristine inner labeling.',
 '{"waist":"27 in","length":"38.5 in","inseam":"27.5 in","rise":"12 in"}', true),

('zara-distressed-knee-straight-jeans',
 'Zara Distressed Knee Straight Jeans', 'Zara', 'jeans', 1799, 'Excellent', false, '32', NULL, 1,
 ARRAY['/products/zara-distressed-knee-straight-jeans-1.jpg'],
 'Mid-blue straight cut with tasteful horizontal knee slit distressing. Washed soft cotton with sturdy pocket bags.',
 '{"waist":"32 in","length":"41 in","inseam":"30 in","rise":"11 in"}', true),

('hm-washed-grey-cargo-denim',
 'H&M Washed Grey Cargo Denim', 'H&M', 'jeans', 1899, 'Excellent', false, '30', NULL, 1,
 ARRAY['/products/hm-washed-grey-cargo-denim-1.jpg'],
 'Acid washed slate grey with dual side bellow cargo pockets. Clean metal zipper fly and reinforced belt loops.',
 '{"waist":"30 in","length":"40 in","inseam":"29 in","rise":"11.5 in"}', true),

('old-navy-classic-straight-dark-wash',
 'Old Navy Classic Straight Dark Wash', 'Old Navy', 'jeans', 1399, 'Very Good', false, '34', NULL, 1,
 ARRAY['/products/old-navy-classic-straight-dark-wash-1.jpg'],
 'Clean dark wash straight denim with amber contrast stitching. Reliable everyday pair with minimal fading.',
 '{"waist":"34 in","length":"42 in","inseam":"31 in","rise":"11.5 in"}', true),

('bershka-skater-fit-dirty-wash-denim',
 'Bershka Skater Fit Dirty Wash Denim', 'Bershka', 'jeans', 1999, 'Excellent', false, '31', NULL, 1,
 ARRAY['/products/bershka-skater-fit-dirty-wash-denim-1.jpg'],
 'Y2K tinted yellow-cast dirty wash in an ultra wide leg drape. Cleaned and pre-washed, no stains or odor.',
 '{"waist":"31 in","length":"41 in","inseam":"30 in","rise":"12 in"}', true),

('calvin-klein-slim-taper-black-jeans',
 'Calvin Klein Slim Taper Black Jeans', 'Calvin Klein', 'jeans', 2299, 'Premium', false, '32', NULL, 1,
 ARRAY['/products/calvin-klein-slim-taper-black-jeans-1.jpg'],
 'Pitch black stretch-cotton twill with tonal matte black hardware. Retains 95% of original rich saturation.',
 '{"waist":"32 in","length":"41 in","inseam":"31 in","rise":"10.5 in"}', true),

('zara-pleated-wide-leg-trousers-denim',
 'Zara Pleated Wide Leg Trouser Denim', 'Zara', 'jeans', 2199, 'Premium', false, '29', NULL, 1,
 ARRAY['/products/zara-pleated-wide-leg-trousers-denim-1.jpg'],
 'Tailored dress-cut denim featuring front pleats and draped flowing leg profile. Elegant streetwear hybrid.',
 '{"waist":"29 in","length":"41 in","inseam":"30 in","rise":"13 in"}', true),

('hm-vintage-regular-stone-wash',
 'H&M Vintage Regular Stone Wash', 'H&M', 'jeans', 1499, 'Very Good', false, '33', NULL, 1,
 ARRAY['/products/hm-vintage-regular-stone-wash-1.jpg'],
 'Classic 5-pocket blue denim with natural whiskering across the lap. Sturdy cotton construction with years of life left.',
 '{"waist":"33 in","length":"40.5 in","inseam":"29.5 in","rise":"11 in"}', true),

('bershka-multi-pocket-utility-denim',
 'Bershka Multi-Pocket Utility Denim', 'Bershka', 'jeans', 2199, 'Excellent', false, '32', NULL, 1,
 ARRAY['/products/bershka-multi-pocket-utility-denim-1.jpg'],
 'Tactical multi-pocket streetwear denim in a washed graphite tint. Flap closures and reinforced knee patches.',
 '{"waist":"32 in","length":"41 in","inseam":"30 in","rise":"12 in"}', true),

('old-navy-high-waisted-cropped-flare',
 'Old Navy High Waisted Cropped Flare', 'Old Navy', 'jeans', 1299, 'Very Good', false, '28', NULL, 1,
 ARRAY['/products/old-navy-high-waisted-cropped-flare-1.jpg'],
 'Ankle length cropped silhouette with soft kick-flare opening. Soft stretch denim with comfortable day-long hold.',
 '{"waist":"28 in","length":"36 in","inseam":"25 in","rise":"11 in"}', true),

('zara-acid-wash-relaxed-denim',
 'Zara Acid Wash Relaxed Denim', 'Zara', 'jeans', 1999, 'Excellent', false, '30', NULL, 1,
 ARRAY['/products/zara-acid-wash-relaxed-denim-1.jpg'],
 'Bold 80s inspired marble acid wash pattern. Heavy cotton fabric with solid original hardware and no pocket wear.',
 '{"waist":"30 in","length":"39.5 in","inseam":"29 in","rise":"11.5 in"}', true),

('calvin-klein-standard-straight-light-indigo',
 'Calvin Klein Standard Straight Light Indigo', 'Calvin Klein', 'jeans', 2399, 'Premium', false, '34', NULL, 1,
 ARRAY['/products/calvin-klein-standard-straight-light-indigo-1.jpg'],
 'Premium light indigo shade with subtle hand-sanded highlights along the thigh. Clean hemline and original silver rivets.',
 '{"waist":"34 in","length":"41.5 in","inseam":"31 in","rise":"11 in"}', true),

('hm-baggy-fit-ecru-natural-denim',
 'H&M Baggy Fit Ecru Natural Denim', 'H&M', 'jeans', 1799, 'Excellent', false, '31', NULL, 1,
 ARRAY['/products/hm-baggy-fit-ecru-natural-denim-1.jpg'],
 'Unbleached natural ecru cream denim with subtle organic seed flecks. Flawlessly cleaned, completely stain-free.',
 '{"waist":"31 in","length":"40 in","inseam":"29.5 in","rise":"12 in"}', true),

('bershka-extreme-wide-leg-blue-jeans',
 'Bershka Extreme Wide-Leg Blue Jeans', 'Bershka', 'jeans', 2099, 'Excellent', false, '27', NULL, 1,
 ARRAY['/products/bershka-extreme-wide-leg-blue-jeans-1.jpg'],
 'Ultra-wide palazzo denim drape with high waist fit. Washed medium blue cotton with zero knee bagging.',
 '{"waist":"27 in","length":"42 in","inseam":"31.5 in","rise":"12.5 in"}', true),

('old-navy-boyfriend-slouch-jeans',
 'Old Navy Boyfriend Slouch Jeans', 'Old Navy', 'jeans', 1399, 'Very Good', false, '29', NULL, 1,
 ARRAY['/products/old-navy-boyfriend-slouch-jeans-1.jpg'],
 'Easy relaxed mid-rise fit intended to sit loose on the hips. Soft worn-in handfeel with rollable cuff hems.',
 '{"waist":"29 in","length":"38 in","inseam":"27 in","rise":"11 in"}', true),

('zara-faded-washed-charcoal-relaxed-denim',
 'Zara Faded Charcoal Relaxed Denim', 'Zara', 'jeans', 1999, 'Excellent', false, '33', NULL, 1,
 ARRAY['/products/zara-faded-washed-charcoal-relaxed-denim-1.jpg'],
 'Sun-faded mineral black wash with relaxed silhouette and gentle taper. Substantial 100% cotton weave.',
 '{"waist":"33 in","length":"41 in","inseam":"30 in","rise":"11.5 in"}', true),

('calvin-klein-vintage-medium-wash-straight',
 'Calvin Klein Vintage Medium Wash Straight', 'Calvin Klein', 'jeans', 2499, 'Premium', false, '30', NULL, 1,
 ARRAY['/products/calvin-klein-vintage-medium-wash-straight-1.jpg'],
 'Archival 90s CK cut with classic contrast stitching, embossed silver button, and heavy 14oz rigid denim body.',
 '{"waist":"30 in","length":"41 in","inseam":"30.5 in","rise":"11.5 in"}', true),

('hm-wide-leg-cargo-pocket-denim',
 'H&M Wide-Leg Cargo Pocket Denim', 'H&M', 'jeans', 1699, 'Very Good', false, '28', NULL, 1,
 ARRAY['/products/hm-wide-leg-cargo-pocket-denim-1.jpg'],
 'Utility pockets stitched flush along outer thigh seams on a relaxed wide leg frame. Clean pale blue wash.',
 '{"waist":"28 in","length":"39 in","inseam":"28 in","rise":"11.5 in"}', true),

('bershka-contrast-stitch-skater-jeans',
 'Bershka Contrast Stitch Skater Jeans', 'Bershka', 'jeans', 1899, 'Excellent', false, '32', NULL, 1,
 ARRAY['/products/bershka-contrast-stitch-skater-jeans-1.jpg'],
 'Dark blue denim accented with stark white contrast top-stitching throughout. Deep front pockets and relaxed seat.',
 '{"waist":"32 in","length":"40.5 in","inseam":"29.5 in","rise":"12 in"}', true),

-- ── SOLD OUT THRIFT ITEMS (stock: 0) ─────────────────────────────────

('zara-archive-patchwork-reconstructed-jeans',
 'Zara Archive Patchwork Reconstructed Jeans', 'Zara', 'jeans', 2499, 'Premium', false, '32', NULL, 0,
 ARRAY['/products/zara-archive-patchwork-reconstructed-jeans-1.jpg'],
 'Dual-tone panelled denim featuring contrasting wash blocks on knees and calves. One of one piece, previously sold.',
 '{"waist":"32 in","length":"41 in","inseam":"30 in","rise":"12 in"}', true),

('calvin-klein-90s-classic-tapered-mom-denim',
 'Calvin Klein 90s Tapered Mom Denim', 'Calvin Klein', 'jeans', 2299, 'Premium', false, '26', NULL, 0,
 ARRAY['/products/calvin-klein-90s-classic-tapered-mom-denim-1.jpg'],
 'Original vintage high cinch silhouette with archival Calvin Klein waist patch. Sourced in Karachi, now marked sold.',
 '{"waist":"26 in","length":"38 in","inseam":"27 in","rise":"11.5 in"}', true),

-- ── IN-HOUSE MERCH: ANIME GRAPHIC TEES ──────────────────────────────

('akira-neo-tokyo-cyberpunk-tee',
 'Akira Neo-Tokyo Silhouette Graphic Tee', 'Thriv', 'graphic-tees', 1599, NULL, true, NULL, ARRAY['S','M','L','XL'], 28,
 ARRAY['/products/akira-neo-tokyo-cyberpunk-tee-1.jpg'],
 'Custom 240 GSM combed cotton heavyweight tee featuring screenprinted Neo-Tokyo highway explosion graphic on the back with minimal chest kanji. Boxy streetwear drape designed to pair with baggy denim.',
 '{"chest":"46 in (L)","length":"29 in (L)","shoulders":"21 in (L)"}', true),

('evangelion-unit-01-schematic-tee',
 'Evangelion Unit-01 Blueprint Graphic Tee', 'Thriv', 'graphic-tees', 1499, NULL, true, NULL, ARRAY['S','M','L','XL'], 22,
 ARRAY['/products/evangelion-unit-01-schematic-tee-1.jpg'],
 'Technical wireframe blueprint graphic of Test Type Unit-01 printed in neon violet and signal green ink over washed carbon black cotton. Pre-shrunk tight collar ribbing that does not bacon.',
 '{"chest":"45 in (L)","length":"28.5 in (L)","shoulders":"20.5 in (L)"}', true),

('berserk-brand-of-sacrifice-vintage-wash-tee',
 'Berserk Brand of Sacrifice Mineral Wash Tee', 'Thriv', 'graphic-tees', 1699, NULL, true, NULL, ARRAY['S','M','L','XL'], 18,
 ARRAY['/products/berserk-brand-of-sacrifice-vintage-wash-tee-1.jpg'],
 'Distressed stone-washed charcoal grey tee with cracked vintage-style Brand of Sacrifice insignia centered on chest and manga panels spanning the lower hem. 100% thick breathable cotton.',
 '{"chest":"46 in (L)","length":"29 in (L)","shoulders":"21 in (L)"}', true),

('cowboy-bebop-swordfish-jazz-noir-tee',
 'Cowboy Bebop Swordfish II Graphic Tee', 'Thriv', 'graphic-tees', 1399, NULL, true, NULL, ARRAY['S','M','L','XL'], 35,
 ARRAY['/products/cowboy-bebop-swordfish-jazz-noir-tee-1.jpg'],
 'Warm cream ecru tee showcasing Spike Spiegel with the iconic "See You Space Cowboy" typography. High-density water-based ink that stays soft to touch even after repeated washing.',
 '{"chest":"44 in (L)","length":"28 in (L)","shoulders":"20 in (L)"}', true)

ON CONFLICT (slug) DO NOTHING;


-- ════════════════════════════════════════════════════════════════════
-- END OF PHASE 1 MIGRATION
--
-- NEXT STEPS (do NOT run yet — Phase 2):
--   place_order(payload jsonb) RPC — atomic, security definer
--
-- MANUAL STEPS AFTER RUNNING THIS SCRIPT:
--   1. Create admin user in Supabase Auth dashboard (email + password).
--   2. Copy the new user's UUID from auth.users.
--   3. Run:
--        INSERT INTO admins (user_id, email) VALUES ('<uuid>', '<email>');
--   4. Add to Vercel/local env:
--        NEXT_PUBLIC_SUPABASE_URL   = https://<project>.supabase.co
--        NEXT_PUBLIC_SUPABASE_ANON_KEY = <anon_key>
--        SUPABASE_SERVICE_ROLE_KEY  = <service_role_key>  ← NEVER in NEXT_PUBLIC_
-- ════════════════════════════════════════════════════════════════════
