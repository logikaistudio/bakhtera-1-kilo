-- Add currency column to company_bank_accounts
ALTER TABLE company_bank_accounts
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'IDR';

COMMENT ON COLUMN company_bank_accounts.currency IS 'Account currency (IDR, USD, etc.)';
