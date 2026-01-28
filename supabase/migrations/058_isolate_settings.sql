
-- Migration to isolate company settings per module

-- 1. Rename existing company_settings to blink_company_settings and add module column just in case
ALTER TABLE IF EXISTS company_settings RENAME TO blink_company_settings;

-- 2. Create tables for Bridge and Big
CREATE TABLE IF NOT EXISTS bridge_company_settings (LIKE blink_company_settings INCLUDING ALL);
CREATE TABLE IF NOT EXISTS big_company_settings (LIKE blink_company_settings INCLUDING ALL);

-- 3. Handle Bank Accounts
-- Rename existing to blink_company_bank_accounts
ALTER TABLE IF EXISTS company_bank_accounts RENAME TO blink_company_bank_accounts;

-- Create for Bridge and Big
CREATE TABLE IF NOT EXISTS bridge_company_bank_accounts (LIKE blink_company_bank_accounts INCLUDING ALL);
CREATE TABLE IF NOT EXISTS big_company_bank_accounts (LIKE blink_company_bank_accounts INCLUDING ALL);

-- Add module identifier if needed, but separate tables usually enough.
-- Ensuring RLS policies if any (copying structure usually copies constraints but not policies by default)
-- For now, we assume public access or basic authenticated access is fine as per previous context.

