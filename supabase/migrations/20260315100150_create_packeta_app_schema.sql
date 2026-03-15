/*
  # Zásilkovna / Packeta Shopify App Schema

  1. New Tables
    - `app_config`
      - `id` (uuid, primary key)
      - `shop_domain` (text, unique) - Shopify shop domain
      - `packeta_api_key` (text) - Packeta widget API key
      - `is_active` (boolean) - whether integration is active
      - `created_at` / `updated_at` (timestamps)

    - `order_pickups`
      - `id` (uuid, primary key)
      - `shop_domain` (text)
      - `order_id` (text) - Shopify order GID
      - `order_name` (text) - human-readable order name (e.g. #1001)
      - `packeta_point_id` (text)
      - `packeta_point_name` (text)
      - `packeta_point_address` (text)
      - `customer_email` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Service role has full access (used by edge functions)
    - No public access
*/

CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain text UNIQUE NOT NULL,
  packeta_api_key text NOT NULL DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to app_config"
  ON app_config
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert app_config"
  ON app_config
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role update app_config"
  ON app_config
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS order_pickups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain text NOT NULL,
  order_id text NOT NULL,
  order_name text NOT NULL DEFAULT '',
  packeta_point_id text NOT NULL,
  packeta_point_name text NOT NULL,
  packeta_point_address text NOT NULL,
  customer_email text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_pickups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to order_pickups"
  ON order_pickups
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role insert order_pickups"
  ON order_pickups
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS order_pickups_shop_domain_idx ON order_pickups (shop_domain);
CREATE INDEX IF NOT EXISTS order_pickups_order_id_idx ON order_pickups (order_id);
CREATE INDEX IF NOT EXISTS order_pickups_created_at_idx ON order_pickups (created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
