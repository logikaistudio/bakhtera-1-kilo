-- Add missing fields for Blink Invoice Printout
-- Based on the requirement to match the provided image

ALTER TABLE blink_invoices
ADD COLUMN IF NOT EXISTS consignor TEXT,
ADD COLUMN IF NOT EXISTS consignee TEXT,
ADD COLUMN IF NOT EXISTS order_reference TEXT,
ADD COLUMN IF NOT EXISTS goods_description TEXT,
ADD COLUMN IF NOT EXISTS import_broker TEXT,
ADD COLUMN IF NOT EXISTS chargeable_weight NUMERIC,
ADD COLUMN IF NOT EXISTS packages TEXT,
ADD COLUMN IF NOT EXISTS vessel_name TEXT,
ADD COLUMN IF NOT EXISTS voyage_number TEXT,
ADD COLUMN IF NOT EXISTS ocean_bl TEXT,
ADD COLUMN IF NOT EXISTS house_bl TEXT,
ADD COLUMN IF NOT EXISTS etd DATE,
ADD COLUMN IF NOT EXISTS eta DATE,
ADD COLUMN IF NOT EXISTS containers TEXT,
ADD COLUMN IF NOT EXISTS terms TEXT;
