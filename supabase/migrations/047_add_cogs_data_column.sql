-- =====================================================
-- Migration: Add COGS Columns to blink_shipments
-- Version: 047
-- Description: Adds cogs JSONB column to store 
--              Cost of Goods Sold breakdown per shipment
-- =====================================================

-- Add cogs column for storing COGS breakdown
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS cogs JSONB DEFAULT '{}';

-- Add cogs_currency column for multi-currency support
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS cogs_currency TEXT DEFAULT 'USD';

-- Add exchange rate and rate date for currency conversion
ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(15,4);

ALTER TABLE blink_shipments 
ADD COLUMN IF NOT EXISTS rate_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN blink_shipments.cogs IS 'JSONB containing COGS breakdown: oceanFreight, airFreight, trucking, thc, documentation, customs, insurance, demurrage, other, additionalCosts';
COMMENT ON COLUMN blink_shipments.cogs_currency IS 'Currency used for COGS (USD/IDR)';
COMMENT ON COLUMN blink_shipments.exchange_rate IS 'Exchange rate from USD to IDR for COGS calculation';
COMMENT ON COLUMN blink_shipments.rate_date IS 'Date when exchange rate was set';

-- Create index for performance on selling vs buying queries
CREATE INDEX IF NOT EXISTS idx_blink_shipments_cogs 
ON blink_shipments USING GIN (cogs);

CREATE INDEX IF NOT EXISTS idx_blink_shipments_buying_items 
ON blink_shipments USING GIN (buying_items);

CREATE INDEX IF NOT EXISTS idx_blink_shipments_selling_items 
ON blink_shipments USING GIN (selling_items);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
-- Columns added:
-- 1. cogs (JSONB) - Stores detailed COGS breakdown
-- 2. cogs_currency (TEXT) - Currency for COGS
-- 3. exchange_rate (DECIMAL) - Exchange rate
-- 4. rate_date (DATE) - Date of exchange rate
-- =====================================================
