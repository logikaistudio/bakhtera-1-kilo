-- =====================================================================
-- Migration 072: Add COST type to finance_coa
-- Purpose: Allow 'COST' as a valid account type (treated same as COGS
--          in P&L reports). User's COA data uses 'COST' in the Type
--          column while 'COGS' appears in the account Name.
-- =====================================================================

-- Drop old constraint
ALTER TABLE finance_coa DROP CONSTRAINT IF EXISTS finance_coa_type_check;

-- Add new constraint with COST included
ALTER TABLE finance_coa ADD CONSTRAINT finance_coa_type_check
  CHECK (type IN (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE',
    'COGS',
    'COST',
    'DIRECT_COST',
    'OTHER_INCOME',
    'OTHER_EXPENSE'
  ));

-- =====================================================================
-- END OF MIGRATION 072
-- =====================================================================
COMMENT ON COLUMN finance_coa.type IS 'Account type: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE, COGS, COST, DIRECT_COST, OTHER_INCOME, OTHER_EXPENSE. COST is treated same as COGS in P&L.';
