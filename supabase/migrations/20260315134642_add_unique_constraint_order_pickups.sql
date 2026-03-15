/*
  # Add unique constraint to order_pickups

  Adds a unique constraint on (shop_domain, order_id) so that upsert
  operations correctly update an existing row instead of inserting duplicates
  when a customer changes their pickup point selection during checkout.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_pickups_shop_domain_order_id_key'
  ) THEN
    ALTER TABLE order_pickups
      ADD CONSTRAINT order_pickups_shop_domain_order_id_key
      UNIQUE (shop_domain, order_id);
  END IF;
END $$;
