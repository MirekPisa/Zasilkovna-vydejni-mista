/*
  # Add label configuration columns to app_config

  Adds four new optional columns to app_config for controlling Packeta label generation:
  - label_format: Packeta label size/layout format (e.g. "A6 on A6", "A7 on A4")
  - label_offset: Position offset (0-3) used only for "on A4" formats
  - label_type: Output format - 'pdf' or 'zpl' (for thermal printers)
  - zpl_dpi: DPI used for ZPL labels - 203 or 300
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'label_format'
  ) THEN
    ALTER TABLE app_config ADD COLUMN label_format text NOT NULL DEFAULT 'A6 on A6';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'label_offset'
  ) THEN
    ALTER TABLE app_config ADD COLUMN label_offset integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'label_type'
  ) THEN
    ALTER TABLE app_config ADD COLUMN label_type text NOT NULL DEFAULT 'pdf';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_config' AND column_name = 'zpl_dpi'
  ) THEN
    ALTER TABLE app_config ADD COLUMN zpl_dpi integer NOT NULL DEFAULT 203;
  END IF;
END $$;
