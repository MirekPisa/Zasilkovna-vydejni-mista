/*
  # Add hd_address_id column to app_config

  Adds a new optional column to app_config for configuring the Packeta carrier ID
  used for home delivery (address delivery) shipments.

  1. New Columns
    - `hd_address_id` (integer, default 106) - Packeta carrier ID for home delivery.
      Default value 106 corresponds to "Zásilkovna Home Delivery CZ".
      Users with different country or carrier preferences can override this.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'hd_address_id'
  ) THEN
    ALTER TABLE app_config ADD COLUMN hd_address_id integer NOT NULL DEFAULT 106;
  END IF;
END $$;
