-- Code of Account (Chart of Accounts) Master Table
-- Used for budgeting and financial reporting classification
-- Created: 2025-01-25

CREATE TABLE IF NOT EXISTS code_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Account Identification
    code VARCHAR(20) NOT NULL UNIQUE,           -- e.g., "1-0000", "1-1100"
    name VARCHAR(255) NOT NULL,                 -- Account name
    
    -- Hierarchy
    master_code VARCHAR(20),                    -- Parent account code reference
    account_group VARCHAR(50) NOT NULL,         -- Asset, Liability, Equity, Revenue, Expense
    level INTEGER DEFAULT 1,                    -- Hierarchy level (1=top, 2, 3, etc.)
    
    -- Report Classification (checkboxes)
    in_trial_balance BOOLEAN DEFAULT true,      -- Show in Trial Balance
    in_profit_loss BOOLEAN DEFAULT false,       -- Show in Profit & Loss
    in_balance_sheet BOOLEAN DEFAULT false,     -- Show in Balance Sheet
    is_ar BOOLEAN DEFAULT false,                -- Accounts Receivable related
    is_ap BOOLEAN DEFAULT false,                -- Accounts Payable related  
    in_cashflow BOOLEAN DEFAULT false,          -- Show in Cashflow Statement
    
    -- Additional Info
    description TEXT,                           -- Optional description
    is_active BOOLEAN DEFAULT true,             -- Active/Inactive status
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_coa_code ON code_of_accounts(code);
CREATE INDEX idx_coa_master_code ON code_of_accounts(master_code);
CREATE INDEX idx_coa_group ON code_of_accounts(account_group);
CREATE INDEX idx_coa_level ON code_of_accounts(level);
CREATE INDEX idx_coa_active ON code_of_accounts(is_active);

-- RLS Policies
ALTER TABLE code_of_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON code_of_accounts
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON code_of_accounts
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON code_of_accounts
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON code_of_accounts
    FOR DELETE USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_coa_updated_at 
    BEFORE UPDATE ON code_of_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE code_of_accounts IS 'Chart of Accounts master data for financial reporting';
COMMENT ON COLUMN code_of_accounts.code IS 'Unique account code (e.g., 1-0000)';
COMMENT ON COLUMN code_of_accounts.master_code IS 'Parent account code for hierarchy';
COMMENT ON COLUMN code_of_accounts.account_group IS 'Account classification: Asset, Liability, Equity, Revenue, Expense';
COMMENT ON COLUMN code_of_accounts.level IS 'Hierarchy level: 1=top level, 2=sub-account, etc.';

-- Seed some default accounts
INSERT INTO code_of_accounts (code, name, master_code, account_group, level, in_trial_balance, in_balance_sheet, in_profit_loss, is_ar, is_ap, in_cashflow) VALUES
-- ASSETS (1-xxxx)
('1-0000', 'ASSETS', NULL, 'Asset', 1, true, true, false, false, false, false),
('1-1000', 'Current Assets', '1-0000', 'Asset', 2, true, true, false, false, false, true),
('1-1100', 'Cash & Bank', '1-1000', 'Asset', 3, true, true, false, false, false, true),
('1-1110', 'Cash on Hand', '1-1100', 'Asset', 4, true, true, false, false, false, true),
('1-1120', 'Bank - IDR', '1-1100', 'Asset', 4, true, true, false, false, false, true),
('1-1130', 'Bank - USD', '1-1100', 'Asset', 4, true, true, false, false, false, true),
('1-1200', 'Accounts Receivable', '1-1000', 'Asset', 3, true, true, false, true, false, true),
('1-1210', 'Trade Receivables', '1-1200', 'Asset', 4, true, true, false, true, false, true),
('1-1300', 'Inventory', '1-1000', 'Asset', 3, true, true, false, false, false, false),
('1-2000', 'Fixed Assets', '1-0000', 'Asset', 2, true, true, false, false, false, false),
('1-2100', 'Equipment', '1-2000', 'Asset', 3, true, true, false, false, false, false),
('1-2200', 'Vehicles', '1-2000', 'Asset', 3, true, true, false, false, false, false),

-- LIABILITIES (2-xxxx)
('2-0000', 'LIABILITIES', NULL, 'Liability', 1, true, true, false, false, false, false),
('2-1000', 'Current Liabilities', '2-0000', 'Liability', 2, true, true, false, false, false, true),
('2-1100', 'Accounts Payable', '2-1000', 'Liability', 3, true, true, false, false, true, true),
('2-1110', 'Trade Payables', '2-1100', 'Liability', 4, true, true, false, false, true, true),
('2-1200', 'Accrued Expenses', '2-1000', 'Liability', 3, true, true, false, false, false, true),
('2-1300', 'Taxes Payable', '2-1000', 'Liability', 3, true, true, false, false, false, true),

-- EQUITY (3-xxxx)
('3-0000', 'EQUITY', NULL, 'Equity', 1, true, true, false, false, false, false),
('3-1000', 'Capital Stock', '3-0000', 'Equity', 2, true, true, false, false, false, false),
('3-2000', 'Retained Earnings', '3-0000', 'Equity', 2, true, true, false, false, false, false),

-- REVENUE (4-xxxx)
('4-0000', 'REVENUE', NULL, 'Revenue', 1, true, false, true, false, false, true),
('4-1000', 'Operating Revenue', '4-0000', 'Revenue', 2, true, false, true, false, false, true),
('4-1100', 'Freight Revenue', '4-1000', 'Revenue', 3, true, false, true, false, false, true),
('4-1110', 'Sea Freight Revenue', '4-1100', 'Revenue', 4, true, false, true, false, false, true),
('4-1120', 'Air Freight Revenue', '4-1100', 'Revenue', 4, true, false, true, false, false, true),
('4-1200', 'Customs Revenue', '4-1000', 'Revenue', 3, true, false, true, false, false, true),
('4-1300', 'Warehousing Revenue', '4-1000', 'Revenue', 3, true, false, true, false, false, true),
('4-2000', 'Other Revenue', '4-0000', 'Revenue', 2, true, false, true, false, false, true),

-- EXPENSES (5-xxxx)
('5-0000', 'EXPENSES', NULL, 'Expense', 1, true, false, true, false, false, true),
('5-1000', 'Cost of Sales', '5-0000', 'Expense', 2, true, false, true, false, false, true),
('5-1100', 'Freight Cost', '5-1000', 'Expense', 3, true, false, true, false, false, true),
('5-1110', 'Ocean Freight Cost', '5-1100', 'Expense', 4, true, false, true, false, false, true),
('5-1120', 'Air Freight Cost', '5-1100', 'Expense', 4, true, false, true, false, false, true),
('5-1130', 'Trucking Cost', '5-1100', 'Expense', 4, true, false, true, false, false, true),
('5-1200', 'Port Charges', '5-1000', 'Expense', 3, true, false, true, false, false, true),
('5-1300', 'Customs Fees', '5-1000', 'Expense', 3, true, false, true, false, false, true),
('5-2000', 'Operating Expenses', '5-0000', 'Expense', 2, true, false, true, false, false, true),
('5-2100', 'Salary & Wages', '5-2000', 'Expense', 3, true, false, true, false, false, true),
('5-2200', 'Rent Expense', '5-2000', 'Expense', 3, true, false, true, false, false, true),
('5-2300', 'Utilities', '5-2000', 'Expense', 3, true, false, true, false, false, true),
('5-2400', 'Office Supplies', '5-2000', 'Expense', 3, true, false, true, false, false, true),
('5-3000', 'Other Expenses', '5-0000', 'Expense', 2, true, false, true, false, false, true)
ON CONFLICT (code) DO NOTHING;
