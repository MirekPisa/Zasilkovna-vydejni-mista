/*
  # Add Packeta API password and label tracking

  1. Changes to `app_config`
     - `packeta_api_password` (text) - Packeta REST API password (different from widget API key)

  2. New table `packeta_labels`
     - Tracks generated shipping labels per order
     - `shop_domain`, `order_id`, `order_name`, `barcode`, `created_at`
     - RLS enabled - accessible via service role only (edge functions)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'packeta_api_password'
  ) THEN
    ALTER TABLE app_config ADD COLUMN packeta_api_password text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS packeta_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain text NOT NULL,
  order_id text NOT NULL,
  order_name text NOT NULL DEFAULT '',
  barcode text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE packeta_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage packeta labels"
  ON packeta_labels
  FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert packeta labels"
  ON packeta_labels
  FOR INSERT
  TO service_role
  WITH CHECK (true);
