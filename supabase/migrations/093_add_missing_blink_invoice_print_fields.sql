-- Migration: Add missing Blink invoice print fields
-- Purpose: Ensure blink_invoices has all printed invoice columns used by the application
-- Created: 2026-04-12

ALTER TABLE blink_invoices
ADD COLUMN IF NOT EXISTS consignor TEXT,
ADD COLUMN IF NOT EXISTS consignee TEXT,
ADD COLUMN IF NOT EXISTS goods_description TEXT,
ADD COLUMN IF NOT EXISTS vessel_name TEXT,
ADD COLUMN IF NOT EXISTS voyage_number TEXT,
ADD COLUMN IF NOT EXISTS ocean_bl TEXT,
ADD COLUMN IF NOT EXISTS house_bl TEXT,
ADD COLUMN IF NOT EXISTS etd DATE,
ADD COLUMN IF NOT EXISTS eta DATE,
ADD COLUMN IF NOT EXISTS containers TEXT,
ADD COLUMN IF NOT EXISTS packages TEXT,
ADD COLUMN IF NOT EXISTS terms TEXT;

COMMENT ON COLUMN blink_invoices.consignor IS 'Name of the consignor for printed invoice';
COMMENT ON COLUMN blink_invoices.consignee IS 'Name of the consignee for printed invoice';
COMMENT ON COLUMN blink_invoices.goods_description IS 'Goods or commodity description for printed invoice';
COMMENT ON COLUMN blink_invoices.vessel_name IS 'Vessel or flight name for printed invoice';
COMMENT ON COLUMN blink_invoices.voyage_number IS 'Voyage number for printed invoice';
COMMENT ON COLUMN blink_invoices.ocean_bl IS 'Ocean Bill of Lading number for printed invoice';
COMMENT ON COLUMN blink_invoices.house_bl IS 'House Bill of Lading number for printed invoice';
COMMENT ON COLUMN blink_invoices.etd IS 'Estimated time of departure for printed invoice';
COMMENT ON COLUMN blink_invoices.eta IS 'Estimated time of arrival for printed invoice';
COMMENT ON COLUMN blink_invoices.containers IS 'Container details for printed invoice';
COMMENT ON COLUMN blink_invoices.packages IS 'Packages detail for printed invoice';
COMMENT ON COLUMN blink_invoices.terms IS 'Trade or payment terms for printed invoice';
