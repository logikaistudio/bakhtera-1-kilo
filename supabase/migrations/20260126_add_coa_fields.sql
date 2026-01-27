
ALTER TABLE finance_coa 
ADD COLUMN IF NOT EXISTS "level" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_trial_balance BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_profit_loss BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_balance_sheet BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_ar BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_ap BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_cashflow BOOLEAN DEFAULT FALSE;

-- Optional: Attempt to auto-calculate level based on logic if possible, otherwise default is 1
-- Example: 1101 -> Level 4? Or Level based on indentation?
-- For now, default 1 is safe. The user can update it or logic in UI can set it.
