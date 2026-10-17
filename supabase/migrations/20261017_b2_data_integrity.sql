-- ════════════════════════════════════════════════════════════════════
-- Thriv — B2 Data-Integrity Migration
-- Apply AFTER 20260920_place_order_rpc.sql (supersedes its place_order definition)
--
-- Audit findings closed:
--   F-04  Status changes no longer touch stock (shipping/delivering used to
--         zero every line, including merch already decremented at checkout)
--   F-11  1-of-1 invariant for thrift pieces enforced in the DB
--   F-12  Order status transitions are guarded server-side; cancels restore
--         stock exactly once and are impossible after delivery
--   F-54  place_order aggregates quantities per slug before the stock check,
--         so duplicate line items can no longer defeat it
--
-- Applied via psycopg (this project has no supabase_migrations history table);
-- see FIX_LOG.md for the run log.
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. place_order v2 — per-slug aggregation (F-54)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION place_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  v_product_row      products%ROWTYPE;
  v_selected_size    TEXT;
  v_subtotal         INTEGER := 0;
  v_delivery_fee     INTEGER := 200;
  v_total            INTEGER;
  v_payment_method_e payment_method;

  -- output
  v_order_id         UUID;
  v_order_number     TEXT;

  -- idempotency
  v_existing_order   RECORD;
BEGIN
  -- ── Extract top-level fields ──────────────────────────────────────
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

  -- ── Basic null checks ────────────────────────────────────────────
  IF v_customer_name IS NULL OR v_customer_phone IS NULL OR
     v_customer_email IS NULL OR v_address_line IS NULL OR
     v_city IS NULL OR v_province IS NULL OR
     v_payment_method IS NULL OR v_items IS NULL THEN
    RAISE EXCEPTION 'Missing required order fields';
  END IF;

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one item';
  END IF;

  -- ── Normalise payment method string → enum ────────────────────────
  v_payment_method_e := CASE v_payment_method
    WHEN 'cash-on-delivery' THEN 'cod'::payment_method
    WHEN 'cod'              THEN 'cod'::payment_method
    WHEN 'bank-transfer'    THEN 'bank_transfer'::payment_method
    WHEN 'bank_transfer'    THEN 'bank_transfer'::payment_method
    WHEN 'easypaisa'        THEN 'easypaisa'::payment_method
    WHEN 'jazzcash'         THEN 'jazzcash'::payment_method
    WHEN 'card'             THEN 'card'::payment_method
    ELSE NULL
  END;

  IF v_payment_method_e IS NULL THEN
    RAISE EXCEPTION 'Invalid payment method: %', v_payment_method;
  END IF;

  -- ── Idempotency check ────────────────────────────────────────────
  IF v_idempotency_key IS NOT NULL THEN
    SELECT order_number, total_pkr
      INTO v_existing_order
      FROM orders
     WHERE idempotency_key = v_idempotency_key
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'order_number', v_existing_order.order_number,
        'total_pkr',    v_existing_order.total_pkr,
        'idempotent',   true
      );
    END IF;
  END IF;

  -- ── Lock product rows FOR UPDATE + validate each line ─────────────
  -- Acquire row-level locks on every referenced product before any
  -- reads or writes. This is what prevents two concurrent checkouts
  -- from both seeing stock = 1 and both succeeding.
  FOR rec IN
    SELECT elem->>'product_slug' AS slug,
           COALESCE((elem->>'quantity')::INTEGER, 1) AS qty
      FROM jsonb_array_elements(v_items) AS elem
  LOOP
    IF rec.slug IS NULL THEN
      RAISE EXCEPTION 'Each item must supply product_slug';
    END IF;

    IF rec.qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity for product: %', rec.slug;
    END IF;

    -- Lock the row; will wait if another transaction holds the lock.
    PERFORM id
      FROM products
     WHERE slug = rec.slug
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', rec.slug;
    END IF;
  END LOOP;

  -- ── Verify stock & recompute subtotal SERVER-SIDE (per slug) ──────
  -- Client prices are IGNORED. Duplicate lines for the same slug are
  -- summed first (audit F-54), so the stock check sees the TOTAL
  -- requested quantity — two lines of 1 can no longer beat a 1-of-1.
  FOR rec IN
    SELECT elem->>'product_slug' AS slug,
           SUM(COALESCE((elem->>'quantity')::INTEGER, 1))::INTEGER AS qty
      FROM jsonb_array_elements(v_items) AS elem
     GROUP BY 1
  LOOP
    SELECT * INTO v_product_row
      FROM products
     WHERE slug = rec.slug;

    IF NOT v_product_row.is_active THEN
      RAISE EXCEPTION 'Product is no longer available: %', v_product_row.name;
    END IF;

    IF v_product_row.stock < rec.qty THEN
      RAISE EXCEPTION
        'This piece has just sold out: %. Only % remaining.',
        v_product_row.name,
        v_product_row.stock;
    END IF;

    v_subtotal := v_subtotal + (v_product_row.price_pkr * rec.qty);
  END LOOP;

  v_total := v_subtotal + v_delivery_fee;

  -- ── Insert order ──────────────────────────────────────────────────
  INSERT INTO orders (
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
  RETURNING id, order_number INTO v_order_id, v_order_number;

  -- ── Snapshot order_items (one row per submitted line) ─────────────
  -- Sizes can differ between lines of the same slug, so the snapshot
  -- stays per line even though validation/decrement are per slug.
  FOR item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_selected_size := item->>'selected_size';

    SELECT * INTO v_product_row
      FROM products
     WHERE slug = item->>'product_slug';

    INSERT INTO order_items (
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

  -- ── Decrement stock once per slug (aggregated total) ──────────────
  FOR rec IN
    SELECT elem->>'product_slug' AS slug,
           SUM(COALESCE((elem->>'quantity')::INTEGER, 1))::INTEGER AS qty
      FROM jsonb_array_elements(v_items) AS elem
     GROUP BY 1
  LOOP
    UPDATE products
       SET stock = stock - rec.qty
     WHERE slug = rec.slug;
  END LOOP;

  -- ── Write initial order_events row (null → 'new') ────────────────
  INSERT INTO order_events (order_id, from_status, to_status, note)
  VALUES (v_order_id, NULL, 'new', 'Order placed');

  -- ── Return minimal response (no PII) ──────────────────────────────
  RETURN jsonb_build_object(
    'order_number', v_order_number,
    'total_pkr',    v_total,
    'idempotent',   false
  );

EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise so the caller gets the message; nothing is committed.
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION place_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_order(jsonb) FROM anon;
REVOKE ALL ON FUNCTION place_order(jsonb) FROM authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 2. update_order_status — the only writer of order status changes
--    (transition guard + cancel stock restore + order_events, atomic)
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_order_status(
  p_order_number TEXT,
  p_new_status   TEXT,
  p_note         TEXT DEFAULT NULL,
  p_actor        UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    FROM orders
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
  --     shipped first — the fulfillment steps are bookkeeping, not gates)
  --   * cancelling is possible until delivery; delivered/cancelled are terminal
  IF NOT (
       (v_from = 'new'       AND p_new_status IN ('confirmed', 'shipped', 'delivered', 'cancelled'))
    OR (v_from = 'confirmed' AND p_new_status IN ('shipped', 'delivered', 'cancelled'))
    OR (v_from = 'shipped'   AND p_new_status IN ('delivered', 'cancelled'))
  ) THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', v_from, p_new_status
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE orders
     SET status = p_new_status::order_status,
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
        FROM order_items oi
        JOIN products p
          ON p.id = oi.product_id
          OR (oi.product_id IS NULL AND p.slug = oi.product_slug)
       WHERE oi.order_id = v_order_id
       GROUP BY p.id, p.is_merch
    LOOP
      UPDATE products
         SET stock = CASE WHEN v_item.is_merch THEN stock + v_item.qty ELSE 1 END
       WHERE id = v_item.product_id;
    END LOOP;
  END IF;

  INSERT INTO order_events (order_id, from_status, to_status, note, created_by)
  VALUES (
    v_order_id,
    v_from::order_status,
    p_new_status::order_status,
    COALESCE(NULLIF(BTRIM(p_note), ''), 'Status updated to ' || p_new_status),
    p_actor
  );

  RETURN jsonb_build_object(
    'changed', true, 'from_status', v_from, 'to_status', p_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION update_order_status(text, text, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_order_status(text, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION update_order_status(text, text, text, uuid) FROM authenticated;

-- ────────────────────────────────────────────────────────────────────
-- 3. 1-of-1 invariant for thrift pieces (F-11)
-- ────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_thrift_one_of_one'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_thrift_one_of_one
      CHECK (is_merch OR stock <= 1);
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- END OF B2 MIGRATION
-- ════════════════════════════════════════════════════════════════════
