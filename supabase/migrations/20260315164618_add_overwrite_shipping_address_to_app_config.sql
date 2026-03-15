/*
  # Add overwrite_shipping_address to app_config

  ## Summary
  Adds a boolean column to control whether the Shopify shipping address
  should be overwritten with the Packeta pickup point address when a
  new order is created via webhook.

  ## Changes
  - `app_config` table:
    - New column `overwrite_shipping_address` (boolean, default true):
      When enabled, the order-webhook function will update the Shopify
      order's shipping_address to reflect the chosen Packeta pickup point.

  ## Notes
  - Uses IF NOT EXISTS guard to safely re-run without errors.
  - Defaults to true so existing installs benefit automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'overwrite_shipping_address'
  ) THEN
    ALTER TABLE app_config ADD COLUMN overwrite_shipping_address boolean NOT NULL DEFAULT true;
  END IF;
END $$;
