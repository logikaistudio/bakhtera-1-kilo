-- Migration: Add COGS and Profit Fields to Invoices
-- Purpose: Track Cost of Goods Sold and calculate profit per invoice
-- Created: 2026-01-29

-- ============================================================================
-- 1. Add COGS-related columns to blink_invoices
-- ============================================================================

ALTER TABLE blink_invoices 
ADD COLUMN IF NOT EXISTS cogs_items JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS cogs_subtotal DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS gross_profit DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_margin DECIMAL(5,2) DEFAULT 0;

-- ============================================================================
-- 2. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN blink_invoices.cogs_items IS 
'Array of cost items from shipment buying_items: [{description, qty, unit, rate, amount, vendor, currency}]';

COMMENT ON COLUMN blink_invoices.cogs_subtotal IS 
'Total cost of goods sold (sum of cogs_items amounts)';

COMMENT ON COLUMN blink_invoices.gross_profit IS 
'Calculated: total_amount - cogs_subtotal (Gross Profit)';

COMMENT ON COLUMN blink_invoices.profit_margin IS 
'Calculated: (gross_profit / total_amount) * 100 (Profit Margin %)';

-- ============================================================================
-- 3. Create function to auto-calculate profit on insert/update
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_invoice_profit()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate COGS subtotal from cogs_items JSONB array
    IF NEW.cogs_items IS NOT NULL AND jsonb_array_length(NEW.cogs_items) > 0 THEN
        SELECT COALESCE(SUM((item->>'amount')::DECIMAL), 0)
        INTO NEW.cogs_subtotal
        FROM jsonb_array_elements(NEW.cogs_items) AS item;
    ELSE
        NEW.cogs_subtotal := 0;
    END IF;
    
    -- Calculate gross profit
    NEW.gross_profit := COALESCE(NEW.total_amount, 0) - COALESCE(NEW.cogs_subtotal, 0);
    
    -- Calculate profit margin percentage
    IF NEW.total_amount > 0 THEN
        NEW.profit_margin := (NEW.gross_profit / NEW.total_amount) * 100;
    ELSE
        NEW.profit_margin := 0;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_calculate_invoice_profit ON blink_invoices;

-- Create trigger to auto-calculate profit
CREATE TRIGGER trg_calculate_invoice_profit
    BEFORE INSERT OR UPDATE ON blink_invoices
    FOR EACH ROW
    EXECUTE FUNCTION calculate_invoice_profit();

COMMENT ON TRIGGER trg_calculate_invoice_profit ON blink_invoices IS 
'Automatically calculates COGS subtotal, gross profit, and profit margin on insert/update';

-- ============================================================================
-- 4. Create view for profit analysis
-- ============================================================================

CREATE OR REPLACE VIEW v_invoice_profit_analysis AS
SELECT 
    i.id,
    i.invoice_number,
    i.quotation_id,
    i.job_number,
    i.customer_name,
    i.currency,
    i.invoice_date,
    i.status,
    -- Revenue
    i.subtotal as revenue_subtotal,
    i.tax_amount as revenue_tax,
    i.total_amount as revenue_total,
    -- COGS
    i.cogs_subtotal,
    jsonb_array_length(COALESCE(i.cogs_items, '[]'::jsonb)) as cogs_item_count,
    -- Profit
    i.gross_profit,
    i.profit_margin,
    -- Classification
    CASE 
        WHEN i.profit_margin >= 30 THEN 'Excellent'
        WHEN i.profit_margin >= 20 THEN 'Good'
        WHEN i.profit_margin >= 10 THEN 'Fair'
        WHEN i.profit_margin >= 0 THEN 'Low'
        ELSE 'Loss'
    END as profit_category,
    -- Items breakdown
    jsonb_array_length(COALESCE(i.invoice_items, '[]'::jsonb)) as revenue_item_count,
    i.invoice_items as revenue_items,
    i.cogs_items
FROM blink_invoices i
WHERE i.status != 'cancelled';

COMMENT ON VIEW v_invoice_profit_analysis IS 
'Comprehensive profit analysis view showing revenue, COGS, and profit metrics per invoice';

-- ============================================================================
-- 5. Create aggregate profit summary function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_profit_summary_by_period(
    p_start_date DATE,
    p_end_date DATE,
    p_currency VARCHAR(10) DEFAULT NULL
)
RETURNS TABLE (
    period_start DATE,
    period_end DATE,
    currency VARCHAR(10),
    total_revenue DECIMAL(15,2),
    total_cogs DECIMAL(15,2),
    total_profit DECIMAL(15,2),
    avg_profit_margin DECIMAL(5,2),
    invoice_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_start_date as period_start,
        p_end_date as period_end,
        i.currency,
        SUM(i.total_amount) as total_revenue,
        SUM(i.cogs_subtotal) as total_cogs,
        SUM(i.gross_profit) as total_profit,
        AVG(i.profit_margin) as avg_profit_margin,
        COUNT(*)::BIGINT as invoice_count
    FROM blink_invoices i
    WHERE i.invoice_date >= p_start_date
      AND i.invoice_date <= p_end_date
      AND i.status != 'cancelled'
      AND (p_currency IS NULL OR i.currency = p_currency)
    GROUP BY i.currency;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_profit_summary_by_period IS 
'Returns aggregated profit summary for a date range, optionally filtered by currency';

-- ============================================================================
-- 6. Update existing invoices to have empty cogs_items array
-- ============================================================================

UPDATE blink_invoices
SET cogs_items = '[]'::jsonb,
    cogs_subtotal = 0,
    gross_profit = total_amount,
    profit_margin = 100
WHERE cogs_items IS NULL;
