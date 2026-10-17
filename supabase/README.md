# supabase/

The **authoritative** database definition for this project lives in `migrations/`:

1. `20260920_initial_schema.sql`
2. `20260920_place_order_rpc.sql`
3. `20260921_products_storage.sql`

Apply them in filename order (Supabase SQL editor, or any Postgres client connected
as the `postgres` role).

> ⚠️ **A legacy `schema.sql` used to live in this folder.** It created permissive
> `USING (true)` RLS policies that exposed every order to the public anon key.
> It was **deleted on 2026-10-17** (see `FIX_LOG.md`, finding F-03). Never
> re-add or run SQL that grants `USING (true)` policies on `orders` /
> `order_items`.
