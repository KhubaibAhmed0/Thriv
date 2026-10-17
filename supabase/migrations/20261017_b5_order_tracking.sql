-- B5 (F-79): courier tracking on orders
--
-- The admin status API can record a courier name and tracking number when an
-- order ships; the public order lookup returns them so the confirmation page
-- shows the real tracking number instead of only promising one over WhatsApp.
--
-- Idempotent: safe to re-run.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;
