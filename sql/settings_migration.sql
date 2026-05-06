-- ====================================================================
-- COMPANY SETTINGS & BANK ACCOUNTS MIGRATION FOR BRIDGE & BIG
-- ====================================================================
-- Menambahkan tabel pengaturan modul yang independen untuk Bridge dan Big
-- agar tidak bercampur dengan tabel Blink (company_settings).
-- ====================================================================

-- 1. BRIDGE COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS bridge_company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_fax TEXT,
    company_email TEXT,
    company_npwp TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. BRIDGE BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS bridge_company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_settings_id UUID REFERENCES bridge_company_settings(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    branch_name TEXT,
    currency TEXT DEFAULT 'IDR',
    swift_code TEXT,
    display_order INTEGER DEFAULT 0,
    coa_id UUID REFERENCES bridge_coa(id) ON DELETE SET NULL,
    coa_code TEXT,
    coa_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. BIG COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS big_company_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT,
    company_address TEXT,
    company_phone TEXT,
    company_fax TEXT,
    company_email TEXT,
    company_npwp TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. BIG BANK ACCOUNTS
CREATE TABLE IF NOT EXISTS big_company_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_settings_id UUID REFERENCES big_company_settings(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    bank_code TEXT,
    account_number TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    branch_name TEXT,
    currency TEXT DEFAULT 'IDR',
    swift_code TEXT,
    display_order INTEGER DEFAULT 0,
    -- Catatan: Jika BIG tidak menggunakan big_coa, baris ini bisa diabaikan atau dihapus fk-nya
    coa_id UUID REFERENCES big_coa(id) ON DELETE SET NULL,
    coa_code TEXT,
    coa_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MATIKAN RLS AGAR FRONTEND BISA AKSES DENGAN MUDAH
ALTER TABLE bridge_company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE bridge_company_bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_company_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE big_company_bank_accounts DISABLE ROW LEVEL SECURITY;
