-- ════════════════════════════════════════════════════════════════════
-- Thriv — Phase 2 Migration: place_order RPC
-- Run AFTER 20260920_initial_schema.sql
-- ════════════════════════════════════════════════════════════════════

-- Payment method mapping: storefront sends 'cash-on-delivery', 'bank-transfer'
-- which need normalising to the DB enum values 'cod', 'bank_transfer'.
-- We handle this inside the function with a CASE expression.

CREATE OR REPLACE FUNCTION place_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_product_id       UUID;
  v_product_slug     TEXT;
  v_product_row      products%ROWTYPE;
  v_quantity         INTEGER;
  v_selected_size    TEXT;
  v_line_total       INTEGER;
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
  -- If this idempotency key has already been used, return the
  -- existing order without creating a duplicate.
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

  -- ── Lock product rows FOR UPDATE ──────────────────────────────────
  -- Acquire row-level locks on every referenced product before any
  -- reads or writes. This is what prevents two concurrent checkouts
  -- from both seeing stock = 1 and both succeeding.
  --
  -- We iterate once to lock, then again below to build the snapshot.
  -- All locks are held until the transaction commits or rolls back.

  FOR item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_slug := item->>'product_slug';

    IF v_product_slug IS NULL THEN
      RAISE EXCEPTION 'Each item must supply product_slug';
    END IF;

    -- Lock the row; will wait if another transaction holds the lock.
    PERFORM id
      FROM products
     WHERE slug = v_product_slug
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_product_slug;
    END IF;
  END LOOP;

  -- ── Verify stock & recompute subtotal SERVER-SIDE ─────────────────
  -- Client prices are IGNORED. We read price_pkr from the locked rows.

  FOR item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_slug := item->>'product_slug';
    v_quantity     := COALESCE((item->>'quantity')::INTEGER, 1);

    IF v_quantity < 1 THEN
      RAISE EXCEPTION 'Invalid quantity for product: %', v_product_slug;
    END IF;

    SELECT * INTO v_product_row
      FROM products
     WHERE slug = v_product_slug;

    -- Stock check
    IF NOT v_product_row.is_active THEN
      RAISE EXCEPTION 'Product is no longer available: %', v_product_row.name;
    END IF;

    IF v_product_row.stock < v_quantity THEN
      RAISE EXCEPTION
        'This piece has just sold out: %. Only % remaining.',
        v_product_row.name,
        v_product_row.stock;
    END IF;

    v_subtotal := v_subtotal + (v_product_row.price_pkr * v_quantity);
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

  -- ── Decrement stock & insert snapshot order_items ─────────────────
  FOR item IN SELECT * FROM jsonb_array_elements(v_items)
  LOOP
    v_product_slug  := item->>'product_slug';
    v_quantity      := COALESCE((item->>'quantity')::INTEGER, 1);
    v_selected_size := item->>'selected_size';   -- NULL for thrift jeans

    SELECT * INTO v_product_row
      FROM products
     WHERE slug = v_product_slug;

    -- Decrement
    UPDATE products
       SET stock = stock - v_quantity
     WHERE id = v_product_row.id;

    -- Snapshot insert — copies name, brand, price as-of-purchase
    INSERT INTO order_items (
      order_id, product_id, product_slug,
      name, brand, category,
      size, condition,
      unit_price_pkr, quantity, image_path
    )
    VALUES (
      v_order_id,
      v_product_row.id,
      v_product_slug,
      v_product_row.name,
      v_product_row.brand,
      v_product_row.category,
      COALESCE(v_selected_size, v_product_row.size),
      v_product_row.condition::TEXT,
      v_product_row.price_pkr,
      v_quantity,
      v_product_row.images[1]
    );
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

-- Grant execute to the service role only (no anon, no authenticated)
-- The service role bypasses RLS by default; we call this from the
-- server-side route handler only.
REVOKE ALL ON FUNCTION place_order(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_order(jsonb) FROM anon;
REVOKE ALL ON FUNCTION place_order(jsonb) FROM authenticated;
-- Service role keeps its default superuser-level access; no explicit GRANT needed.

-- ════════════════════════════════════════════════════════════════════
-- END OF PHASE 2 MIGRATION
-- ════════════════════════════════════════════════════════════════════
