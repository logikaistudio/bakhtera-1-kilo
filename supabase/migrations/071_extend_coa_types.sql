-- =====================================================================
-- Migration 071: Extend finance_coa type constraint
-- Purpose: Allow COGS, DIRECT_COST, OTHER_INCOME, OTHER_EXPENSE types
--          so that P&L categorization works correctly
-- =====================================================================

-- Drop old constraint
ALTER TABLE finance_coa DROP CONSTRAINT IF EXISTS finance_coa_type_check;

-- Add new constraint with extended types
ALTER TABLE finance_coa ADD CONSTRAINT finance_coa_type_check
  CHECK (type IN (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE',
    'COGS',
    'DIRECT_COST',
    'OTHER_INCOME',
    'OTHER_EXPENSE'
  ));

-- =====================================================================
-- END OF MIGRATION 071
-- =====================================================================
COMMENT ON COLUMN finance_coa.type IS 'Account type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COGS, DIRECT_COST, OTHER_INCOME, OTHER_EXPENSE';
