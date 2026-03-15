/*
  # Add Shopify access token to app_config

  Adds `shopify_access_token` and `shop_domain_override` columns to app_config
  so the admin UI can store the Shopify Admin API token needed to fetch orders.

  - `shopify_access_token` (text) - Shopify Admin API access token
  - `shopify_shop_domain` (text) - explicit shop domain for Admin API calls
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'shopify_access_token'
  ) THEN
    ALTER TABLE app_config ADD COLUMN shopify_access_token text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'shopify_shop_domain'
  ) THEN
    ALTER TABLE app_config ADD COLUMN shopify_shop_domain text NOT NULL DEFAULT '';
  END IF;
END $$;
