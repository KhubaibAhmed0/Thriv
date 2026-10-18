-- ============================================================================
-- Thriv --- security hardening migration (Phase 2 of the 2026-10-18 brief)
-- File: supabase/migrations/20261018_security_hardening.sql
--
-- Contents (brief section in parentheses):
--   1. orders.public_token --- unguessable confirmation key               (2e)
--   2. place_order v5 --- identical logic; search_path = ''; fully
--      qualified refs; returns public_token for FRESH orders only      (2b/2c)
--   3. is_admin() --- search_path = ''; EXECUTE narrowed to authenticated (2d)
--   4. update_order_status() --- search_path = ''; qualified refs        (2c)
--   5. Admin RLS policies scoped TO authenticated                      (2d)
--   6. Server-only tables: rate_limits, audit_log, store_settings      (2f)
--   7. check_rate_limit() --- atomic fixed-window counter                (2g)
--   8. Audit triggers: products price/stock, store_settings            (2h)
--
-- Idempotent: safe to re-run. Backward compatible with the deployed app
-- (the new column has a default; placement returns one extra JSON key that
-- older clients simply ignore). No end-user-visible change.
-- ============================================================================


-- ============================================================================
-- 1. orders.public_token  (brief 2e)
-- The ONLY key that may act as an order-confirmation access token.
-- order_number is sequential and must never grant access again.
-- ============================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS public_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS orders_public_token_key
  ON public.orders (public_token);


-- ============================================================================
-- 2. place_order v5  (brief 2b/2c)
-- Same logic as v4 (idempotency, row locks, server-side pricing, stock
-- decrement, TH0xx error codes). Changes:
--   * SET search_path = ''           (search-path hijack hardening)
--   * every table/enum reference is schema-qualified
--   * RETURNING now picks up public_token; fresh orders return it
--   * replay responses still return ONLY { idempotent: true } (no oracle)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.place_order(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  -- input
  v_idempotency_key  TEXT;
  v_customer_name    TEXT;
  v_customer_phone   TEXT;
  v_customer_email   TEXT;
  v_address_line     TEXT;
  v_city             TEXT;
  v_province         TEXT;
  v_notes            TEXT;
  v_payment_method   TEXT;
  v_items            jsonb;

  -- working
  item               jsonb;
  rec                RECORD;
  v_product_row      public.products%ROWTYPE;
  v_selected_size    TEXT;
  v_subtotal         INTEGER := 0;
  v_delivery_fee     INTEGER := 200;
  v_total            INTEGER;
  v_payment_method_e public.payment_method;

  -- output
  v_order_id         UUID;
  v_order_number     TEXT;
  v_public_token     UUID;
BEGIN
  -- Extract top-level fields
  v_idempotency_key := payload->>'idempotency_key';
  v_customer_name   := payload->>'customer_name';
  v_customer_phone  := payload->>'customer_phone';
  v_customer_email  := payload->>'customer_email';
  v_address_line    := payload->>'address_line';
  v_city            := payload->>'city';
  v_province        := payload->>'province';
  v_notes           := payload->>'notes';
  v_payment_method  := payload->>'payment_method';
  v_items           := payload->'items';

  -- Basic null checks
  IF v_customer_name IS NULL OR v_customer_phone IS NULL OR
     v_customer_email IS NULL OR v_address_line IS NULL OR
     v_city IS NULL OR v_province IS NULL OR
     v_payment_method IS NULL OR v_items IS NULL THEN
    RAISE EXCEPTION 'Missing required order fields' USING ERRCODE = 'TH001';
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item' USING ERRCODE = 'TH001';
  END IF;

  -- Normalise payment method string -> enum
  v_payment_method_e := CASE v_payment_method
    WHEN 'cash-on-delivery' THEN 'cod'::public.payment_method
    WHEN 'cod'              THEN 'cod'::public.payment_method
    WHEN 'bank-transfer'    THEN 'bank_transfer'::public.payment_method
    WHEN 'bank_transfer'    THEN 'bank_transfer'::public.payment_method
    WHEN 'easypaisa'        THEN 'easypaisa'::public.payment_method
    WHEN 'jazzcash'         THEN 'jazzcash'::public.payment_method
    WHEN 'card'             THEN 'card'::public.payment_method
    ELSE NULL
  END;

  IF v_payment_method_e IS NULL THEN
    RAISE EXCEPTION 'Invalid payment method: %', v_payment_method USING ERRCODE = 'TH007';
  END IF;

  -- Idempotency fast path (F-50 / SEC-19)
  -- A replay returns ONLY the flag: never the order number, total or token
  -- (that pair was a replay oracle).
  IF v_idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.orders WHERE idempotency_key = v_idempotency_key
  ) THEN
    RETURN jsonb_build_object('idempotent', true);
  END IF;

  -- Race-safe creation (F-50)
  BEGIN
    -- Lock product rows FOR UPDATE + validate each line
    FOR rec IN
      SELECT elem->>'product_slug' AS slug,
             COALESCE((elem->>'quantity')::INTEGER, 1) AS qty,
             elem->>'selected_size' AS sel_size
        FROM jsonb_array_elements(v_items) AS elem
    LOOP
      IF rec.slug IS NULL THEN
        RAISE EXCEPTION 'Each item must supply product_slug' USING ERRCODE = 'TH001';
      END IF;

      IF rec.qty < 1 THEN
        RAISE EXCEPTION 'Invalid quantity for product: %', rec.slug USING ERRCODE = 'TH002';
      END IF;

      -- Lock the row; will wait if another transaction holds the lock.
      PERFORM id
        FROM public.products
       WHERE slug = rec.slug
         FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found: %', rec.slug USING ERRCODE = 'TH003';
      END IF;

      -- A concurrent retry may have committed the same idempotency key
      -- while we waited for this row lock --- return the replay shape.
      IF v_idempotency_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders WHERE idempotency_key = v_idempotency_key
      ) THEN
        RETURN jsonb_build_object('idempotent', true);
      END IF;

      -- Size validation (audit F-20)
      SELECT * INTO v_product_row
        FROM public.products
       WHERE slug = rec.slug;

      IF v_product_row.sizes IS NOT NULL
         AND cardinality(v_product_row.sizes) > 0
         AND (rec.sel_size IS NULL OR NOT (rec.sel_size = ANY (v_product_row.sizes))) THEN
        RAISE EXCEPTION
          'Please select a valid size for % (available: %)',
          v_product_row.name,
          array_to_string(v_product_row.sizes, ', ') USING ERRCODE = 'TH006';
      END IF;
    END LOOP;

    -- Verify stock & recompute subtotal SERVER-SIDE (per slug)
    FOR rec IN
      SELECT elem->>'product_slug' AS slug,
             SUM(COALESCE((elem->>'quantity')::INTEGER, 1))::INTEGER AS qty
        FROM jsonb_array_elements(v_items) AS elem
       GROUP BY 1
    LOOP
      SELECT * INTO v_product_row
        FROM public.products
       WHERE slug = rec.slug;

      IF NOT v_product_row.is_active THEN
        RAISE EXCEPTION 'Product is no longer available: %', v_product_row.name USING ERRCODE = 'TH005';
      END IF;

      IF v_product_row.stock < rec.qty THEN
        RAISE EXCEPTION
          'This piece has just sold out: %. Only % remaining.',
          v_product_row.name,
          v_product_row.stock USING ERRCODE = 'TH004';
      END IF;

      v_subtotal := v_subtotal + (v_product_row.price_pkr * rec.qty);
    END LOOP;

    v_total := v_subtotal + v_delivery_fee;

    -- Insert order (public_token comes from the column default)
    INSERT INTO public.orders (
      customer_name, customer_phone, customer_email,
      address_line, city, province, notes,
      payment_method, payment_status, status,
      subtotal_pkr, delivery_fee_pkr, total_pkr,
      idempotency_key
    )
    VALUES (
      v_customer_name, v_customer_phone, v_customer_email,
      v_address_line, v_city, v_province, v_notes,
      v_payment_method_e, 'unpaid', 'new',
      v_subtotal, v_delivery_fee, v_total,
      v_idempotency_key
    )
    RETURNING id, order_number, public_token INTO v_order_id, v_order_number, v_public_token;

    -- Snapshot order_items (one row per submitted line)
    FOR item IN SELECT * FROM jsonb_array_elements(v_items)
    LOOP
      v_selected_size := item->>'selected_size';

      SELECT * INTO v_product_row
        FROM public.products
       WHERE slug = item->>'product_slug';

      INSERT INTO public.order_items (
        order_id, product_id, product_slug,
        name, brand, category,
        size, condition,
        unit_price_pkr, quantity, image_path
      )
      VALUES (
        v_order_id,
        v_product_row.id,
        v_product_row.slug,
        v_product_row.name,
        v_product_row.brand,
        v_product_row.category,
        COALESCE(v_selected_size, v_product_row.size),
        v_product_row.condition::TEXT,
        v_product_row.price_pkr,
        COALESCE((item->>'quantity')::INTEGER, 1),
        v_product_row.images[1]
      );
    END LOOP;

    -- Decrement stock once per slug (aggregated total)
    FOR rec IN
      SELECT elem->>'product_slug' AS slug,
             SUM(COALESCE((elem->>'quantity')::INTEGER, 1))::INTEGER AS qty
        FROM jsonb_array_elements(v_items) AS elem
       GROUP BY 1
    LOOP
      UPDATE public.products
         SET stock = stock - rec.qty
       WHERE slug = rec.slug;
    END LOOP;

    -- Write initial order_events row (null -> 'new')
    INSERT INTO public.order_events (order_id, from_status, to_status, note)
    VALUES (v_order_id, NULL, 'new', 'Order placed');

    -- Return minimal response (no PII) --- public_token for FRESH orders only
    RETURN jsonb_build_object(
      'order_number', v_order_number,
      'total_pkr',    v_total,
      'public_token', v_public_token,
      'idempotent',   false
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Same idempotency key committed concurrently: the subtransaction
      -- (including any stock decrements) is already rolled back here.
      IF v_idempotency_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.orders WHERE idempotency_key = v_idempotency_key
      ) THEN
        RETURN jsonb_build_object('idempotent', true);
      END IF;
      RAISE;
  END;
END;
$function$;


-- ============================================================================
-- 3. is_admin()  (brief 2d)
-- search_path = ''; table already schema-qualified. EXECUTE narrowed below.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$function$;


-- ============================================================================
-- 4. update_order_status()  (brief 2c)
-- Same logic as deployed (transition guard, delivered_at, stock restore on
-- cancel, order_events row). search_path = '' + qualified refs only.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_number text,
  p_new_status text,
  p_note text DEFAULT NULL::text,
  p_actor uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_order_id UUID;
  v_from     TEXT;
  v_item     RECORD;
BEGIN
  IF p_new_status NOT IN ('new', 'confirmed', 'shipped', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'Unknown status: %', p_new_status USING ERRCODE = 'P0001';
  END IF;

  SELECT id, status::TEXT
    INTO v_order_id, v_from
    FROM public.orders
   WHERE order_number = p_order_number
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found: %', p_order_number USING ERRCODE = 'P0002';
  END IF;

  -- Same status: no-op (no event row, no stock change).
  IF p_new_status = v_from THEN
    RETURN jsonb_build_object(
      'changed', false, 'from_status', v_from, 'to_status', v_from
    );
  END IF;

  -- State machine:
  --   * forward-only, skips allowed (the owner may deliver without marking
  --     shipped first --- fulfillment steps are bookkeeping, not gates)
  --   * cancelling is possible until delivery; delivered/cancelled terminal
  IF NOT (
       (v_from = 'new'       AND p_new_status IN ('confirmed', 'shipped', 'delivered', 'cancelled'))
    OR (v_from = 'confirmed' AND p_new_status IN ('shipped', 'delivered', 'cancelled'))
    OR (v_from = 'shipped'   AND p_new_status IN ('delivered', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_from, p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET status = p_new_status::public.order_status,
         delivered_at = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE NULL END
   WHERE id = v_order_id;

  -- Cancelling restores stock exactly once (stock was decremented at
  -- checkout by place_order):
  --   * merch: + the ordered quantity, aggregated per product
  --   * thrift (1-of-1): back to stock 1
  IF p_new_status = 'cancelled' THEN
    FOR v_item IN
      SELECT p.id AS product_id,
             p.is_merch,
             SUM(oi.quantity)::INTEGER AS qty
        FROM public.order_items oi
        JOIN public.products p
          ON p.id = oi.product_id
          OR (oi.product_id IS NULL AND p.slug = oi.product_slug)
       WHERE oi.order_id = v_order_id
       GROUP BY p.id, p.is_merch
    LOOP
      UPDATE public.products
         SET stock = CASE WHEN v_item.is_merch THEN stock + v_item.qty ELSE 1 END
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  INSERT INTO public.order_events (order_id, from_status, to_status, note, created_by)
  VALUES (
    v_order_id,
    v_from::public.order_status,
    p_new_status::public.order_status,
    COALESCE(NULLIF(BTRIM(p_note), ''), 'Status updated to ' || p_new_status),
    p_actor
  );

  RETURN jsonb_build_object(
    'changed', true, 'from_status', v_from, 'to_status', p_new_status
  );
END;
$function$;


-- ============================================================================
-- 5. Function EXECUTE grants  (brief 2b/2d)
-- ============================================================================

-- Admin helper: anon must not even probe it. authenticated (admins) + service.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Order RPCs: server (service_role) only. anon/authenticated must NOT be able
-- to reach them over /rest/v1/rpc/* --- they bypass Turnstile + rate limiting.
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.place_order(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.update_order_status(text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.update_order_status(text, text, text, uuid) TO service_role;


-- ============================================================================
-- 6. Server-only tables  (brief 2f)
-- RLS enabled; no anon policies. Writes happen via service_role or via
-- SECURITY DEFINER functions owned by postgres.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key_hash      text PRIMARY KEY,
  window_start  timestamptz NOT NULL,
  hit_count     integer NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx
  ON public.rate_limits (window_start);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,
  action      text NOT NULL,
  entity      text NOT NULL,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON public.audit_log (created_at DESC);

-- Only admins may read the audit trail from PostgREST; only triggers and
-- service_role may write it.
DROP POLICY IF EXISTS "audit_log: admin read" ON public.audit_log;
CREATE POLICY "audit_log: admin read"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.store_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Table-level grants (RLS is the second layer).
REVOKE ALL ON TABLE public.rate_limits  FROM anon, authenticated;
REVOKE ALL ON TABLE public.store_settings FROM anon, authenticated;
-- REVOKE ALL (not a fixed list) so newer PG17 privileges like MAINTAIN
-- cannot survive the sweep.
REVOKE ALL ON TABLE public.audit_log FROM anon, authenticated;
GRANT SELECT ON TABLE public.audit_log TO authenticated;   -- rows gated by policy
GRANT ALL ON TABLE public.rate_limits, public.audit_log, public.store_settings
  TO service_role;

-- Seed store_settings with the exact values currently shown on checkout.
-- (These are displayed to every customer at checkout; they are not secrets.
--  The owner can edit them later --- change is audited by the trigger below.)
INSERT INTO public.store_settings (key, value) VALUES
  ('bank_name',           'Faysal Bank'),
  ('bank_account_title',  'HASSAN RAZA'),
  ('bank_iban',           'PK05FAYS3605301000003020'),
  ('wallet_provider_easypaisa', 'EasyPaisa'),
  ('wallet_provider_jazzcash',  'JazzCash'),
  ('wallet_account_title','HASSAN RAZA'),
  ('wallet_number',       '0324-8188616')
ON CONFLICT (key) DO NOTHING;


-- ============================================================================
-- 7. check_rate_limit()  (brief 2g)
-- Atomic fixed-window counter. Callers pass sha256(route + ":" + client_ip)
-- as p_key_hash --- raw IPs are never stored. Returns true while the number of
-- hits in the current window is <= p_max.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key_hash text,
  p_max integer,
  p_window_seconds integer
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  v_now   timestamptz := now();
  v_count integer;
BEGIN
  IF p_max IS NULL OR p_max < 1
     OR p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'check_rate_limit: invalid parameters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limits AS rl (key_hash, window_start, hit_count)
  VALUES (p_key_hash, v_now, 1)
  ON CONFLICT (key_hash) DO UPDATE
    SET hit_count = CASE
          WHEN rl.window_start <= v_now - make_interval(secs => p_window_seconds)
            THEN 1
          ELSE rl.hit_count + 1
        END,
        window_start = CASE
          WHEN rl.window_start <= v_now - make_interval(secs => p_window_seconds)
            THEN v_now
          ELSE rl.window_start
        END
  RETURNING hit_count INTO v_count;

  -- Housekeeping: a fresh window is a good moment to drop day-old rows.
  IF v_count = 1 THEN
    DELETE FROM public.rate_limits
     WHERE window_start < v_now - interval '1 day'
       AND key_hash <> p_key_hash;
  END IF;

  RETURN v_count <= p_max;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)
  TO service_role;


-- ============================================================================
-- 8. Audit triggers  (brief 2h)
-- actor_id stays NULL for trigger-written rows (DB-level truth); the admin
-- routes additionally write actor-attributed rows via service_role (Phase 4h).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_products_price_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  IF (NEW.price_pkr IS DISTINCT FROM OLD.price_pkr)
     OR (NEW.stock IS DISTINCT FROM OLD.stock) THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, before, after)
    VALUES (
      NULL,
      'product.price_stock_change',
      'products',
      NEW.id::text,
      jsonb_build_object('price_pkr', OLD.price_pkr, 'stock', OLD.stock),
      jsonb_build_object('price_pkr', NEW.price_pkr, 'stock', NEW.stock)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS products_audit_price_stock ON public.products;
CREATE TRIGGER products_audit_price_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_products_price_stock();

CREATE OR REPLACE FUNCTION public.audit_store_settings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at := now();

  IF NEW.value IS DISTINCT FROM OLD.value THEN
    INSERT INTO public.audit_log (actor_id, action, entity, entity_id, before, after)
    VALUES (
      NULL,
      'store_settings.update',
      'store_settings',
      NEW.key,
      jsonb_build_object('value', OLD.value),
      jsonb_build_object('value', NEW.value)
    );
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS store_settings_audit ON public.store_settings;
CREATE TRIGGER store_settings_audit
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_store_settings();

-- Trigger functions are never invoked directly; keep them off every API role
-- (Postgres rejects direct calls anyway --- this is hygiene for least privilege
-- and the security advisor).
REVOKE EXECUTE ON FUNCTION public.audit_products_price_stock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_store_settings() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 9. Scope admin policies to authenticated  (brief 2d)
-- The quals already call is_admin(); anon has no business matching them at
-- all. Storefront read policy on products stays public (anon SELECT only).
-- ============================================================================

ALTER POLICY "orders: admin select"      ON public.orders       TO authenticated;
ALTER POLICY "orders: admin update"      ON public.orders       TO authenticated;
ALTER POLICY "order_items: admin select" ON public.order_items  TO authenticated;
ALTER POLICY "order_events: admin select" ON public.order_events TO authenticated;
ALTER POLICY "order_events: admin insert" ON public.order_events TO authenticated;
ALTER POLICY "products: admin write"     ON public.products     TO authenticated;


-- ============================================================================
-- Verification after applying (run separately, must return zero rows):
--
--   select tablename from pg_tables
--    where schemaname = 'public' and rowsecurity = false;
--
-- Also expect, via the security advisor:
--   * is_admin() no longer flagged executable by PUBLIC/anon
--   * no secdef function without a fixed search_path
-- ============================================================================
