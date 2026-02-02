-- Migration: Invoice Currency Constraint
-- Purpose: Ensure only 2 invoices (1 IDR + 1 USD) can be created per quotation
-- Created: 2026-01-29

-- ============================================================================
-- 1. Add unique partial index for quotation_id + currency combination
-- ============================================================================
-- This ensures that for each quotation, only ONE active invoice per currency can exist
-- Cancelled invoices are excluded from this constraint

CREATE UNIQUE INDEX IF NOT EXISTS idx_blink_invoices_quotation_currency_unique
ON blink_invoices(quotation_id, currency)
WHERE status != 'cancelled' AND quotation_id IS NOT NULL;

COMMENT ON INDEX idx_blink_invoices_quotation_currency_unique IS 
'Ensures only one active invoice per currency (IDR/USD) per quotation. Cancelled invoices are excluded.';

-- ============================================================================
-- 2. Add helper function to get invoice summary by quotation
-- ============================================================================

CREATE OR REPLACE FUNCTION get_quotation_invoice_summary(p_quotation_id UUID)
RETURNS TABLE (
    currency VARCHAR(10),
    invoice_count BIGINT,
    total_amount DECIMAL(15,2),
    invoice_numbers TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.currency,
        COUNT(*)::BIGINT as invoice_count,
        SUM(i.total_amount) as total_amount,
        ARRAY_AGG(i.invoice_number ORDER BY i.created_at) as invoice_numbers
    FROM blink_invoices i
    WHERE i.quotation_id = p_quotation_id
      AND i.status != 'cancelled'
    GROUP BY i.currency;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_quotation_invoice_summary IS 
'Returns summary of active invoices grouped by currency for a given quotation';

-- ============================================================================
-- 3. Add validation trigger to prevent more than 2 currencies
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_invoice_currency_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_currency_count INTEGER;
BEGIN
    -- Only validate if quotation_id is set and status is not cancelled
    IF NEW.quotation_id IS NOT NULL AND NEW.status != 'cancelled' THEN
        -- Check how many different currencies already exist for this quotation
        SELECT COUNT(DISTINCT currency)
        INTO v_currency_count
        FROM blink_invoices
        WHERE quotation_id = NEW.quotation_id
          AND status != 'cancelled'
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
        
        -- If there's already 2 currencies and this is a new currency, reject
        IF v_currency_count >= 2 AND NEW.currency NOT IN (
            SELECT DISTINCT currency 
            FROM blink_invoices 
            WHERE quotation_id = NEW.quotation_id 
              AND status != 'cancelled'
              AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        ) THEN
            RAISE EXCEPTION 'Cannot create invoice: Maximum 2 currencies (IDR and USD) allowed per quotation';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_validate_invoice_currency_limit ON blink_invoices;

CREATE TRIGGER trg_validate_invoice_currency_limit
    BEFORE INSERT OR UPDATE ON blink_invoices
    FOR EACH ROW
    EXECUTE FUNCTION validate_invoice_currency_limit();

COMMENT ON TRIGGER trg_validate_invoice_currency_limit ON blink_invoices IS 
'Validates that a quotation cannot have more than 2 different currencies in active invoices';

-- ============================================================================
-- 4. Add view for invoice analytics
-- ============================================================================

CREATE OR REPLACE VIEW v_invoice_quotation_summary AS
SELECT 
    q.id as quotation_id,
    q.quotation_number,
    q.job_number,
    q.customer_name,
    q.total_amount as quotation_amount,
    q.currency as quotation_currency,
    -- IDR Invoice
    i_idr.invoice_number as idr_invoice_number,
    i_idr.total_amount as idr_invoice_amount,
    i_idr.status as idr_invoice_status,
    -- USD Invoice
    i_usd.invoice_number as usd_invoice_number,
    i_usd.total_amount as usd_invoice_amount,
    i_usd.status as usd_invoice_status,
    -- Summary
    CASE 
        WHEN i_idr.id IS NOT NULL AND i_usd.id IS NOT NULL THEN 'BOTH'
        WHEN i_idr.id IS NOT NULL THEN 'IDR_ONLY'
        WHEN i_usd.id IS NOT NULL THEN 'USD_ONLY'
        ELSE 'NONE'
    END as invoice_status_summary
FROM blink_quotations q
LEFT JOIN blink_invoices i_idr ON q.id = i_idr.quotation_id 
    AND i_idr.currency = 'IDR' 
    AND i_idr.status != 'cancelled'
LEFT JOIN blink_invoices i_usd ON q.id = i_usd.quotation_id 
    AND i_usd.currency = 'USD' 
    AND i_usd.status != 'cancelled'
WHERE q.status = 'approved';

COMMENT ON VIEW v_invoice_quotation_summary IS 
'Summary view showing quotations with their IDR and USD invoices';
