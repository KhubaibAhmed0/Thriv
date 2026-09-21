-- ─────────────────────────────────────────────────────────────────────────────
-- Thriv — Product Storage Bucket & Schema Enhancements
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create the public storage bucket for product photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880, -- 5MB limit per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 2. Storage Policies
-- Anyone can view product photos (public CDN)
DROP POLICY IF EXISTS "products: public view" ON storage.objects;
CREATE POLICY "products: public view"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'products');

-- Only admins / service role can upload or delete photos
DROP POLICY IF EXISTS "products: admin upload" ON storage.objects;
CREATE POLICY "products: admin upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products' AND (
      is_admin() OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "products: admin update" ON storage.objects;
CREATE POLICY "products: admin update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products' AND (
      is_admin() OR
      auth.role() = 'service_role'
    )
  );

DROP POLICY IF EXISTS "products: admin delete" ON storage.objects;
CREATE POLICY "products: admin delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products' AND (
      is_admin() OR
      auth.role() = 'service_role'
    )
  );

-- 3. Relax price constraint on products table to support any positive price
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_price_pkr_check;
ALTER TABLE public.products ADD CONSTRAINT products_price_pkr_check CHECK (price_pkr >= 0);

-- 4. Ensure admin full write access to products table
DROP POLICY IF EXISTS "products: admin write" ON public.products;
CREATE POLICY "products: admin write"
  ON public.products FOR ALL
  USING (is_admin() OR auth.role() = 'service_role')
  WITH CHECK (is_admin() OR auth.role() = 'service_role');

-- 5. Grant storage and table access to API roles
GRANT ALL ON TABLE public.products TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE storage.objects TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE storage.buckets TO postgres, anon, authenticated, service_role;
