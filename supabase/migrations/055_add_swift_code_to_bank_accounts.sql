-- Add swift_code column to company_bank_accounts
ALTER TABLE company_bank_accounts
ADD COLUMN IF NOT EXISTS swift_code TEXT;

COMMENT ON COLUMN company_bank_accounts.swift_code IS 'BIC/SWIFT Code for international transfers';
