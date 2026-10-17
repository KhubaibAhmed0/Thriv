-- ════════════════════════════════════════════════════════════════════
-- Thriv — B3 Purchase-Path Migration
-- Apply AFTER 20261017_b2_data_integrity.sql (supersedes its place_order)
--
-- Audit findings closed:
--   F-20  place_order now validates selected_size against products.sizes —
--         a cart line can no longer order an impossible size (the old
--         quick-add hardcoded 'L' for every merch piece; a size-M customer
--         could buy a final-sale item they can never wear).
--
-- Applied via psycopg (this project has no supabase_migrations history table);
-- see FIX_LOG.md for the run log.
-- ════════════════════════════════════════════════════════════════════

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
           COALESCE((elem->>'quantity')::INTEGER, 1) AS qty,
           elem->>'selected_size' AS sel_size
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

    -- ── Size validation (audit F-20) ────────────────────────────────
    -- When the product declares sizes, the submitted size must be one
    -- of them. Products without a sizes list (plain thrift rows) keep
    -- accepting the client value / null.
    SELECT * INTO v_product_row
      FROM products
     WHERE slug = rec.slug;

    IF v_product_row.sizes IS NOT NULL
       AND cardinality(v_product_row.sizes) > 0
       AND (rec.sel_size IS NULL OR NOT (rec.sel_size = ANY (v_product_row.sizes))) THEN
      RAISE EXCEPTION
        'Please select a valid size for % (available: %)',
        v_product_row.name,
        array_to_string(v_product_row.sizes, ', ');
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

-- ════════════════════════════════════════════════════════════════════
-- END OF B3 MIGRATION
-- ════════════════════════════════════════════════════════════════════
