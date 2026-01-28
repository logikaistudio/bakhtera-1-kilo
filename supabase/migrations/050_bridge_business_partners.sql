-- Create bridge_business_partners table
CREATE TABLE IF NOT EXISTS bridge_business_partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_code TEXT UNIQUE,
    partner_name TEXT NOT NULL,
    partner_type TEXT DEFAULT 'company', -- 'company' or 'individual'
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Indonesia',
    tax_id TEXT,
    
    -- Roles (a partner can have multiple roles) - Bridge specific
    is_customer BOOLEAN DEFAULT false,
    is_vendor BOOLEAN DEFAULT false,
    is_consignee BOOLEAN DEFAULT false, -- Penerima barang (TPB)
    is_shipper BOOLEAN DEFAULT false,   -- Pengirim barang (TPB)
    is_transporter BOOLEAN DEFAULT false,
    
    -- Financial
    payment_terms TEXT DEFAULT 'NET 30',
    credit_limit NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'IDR',
    
    -- Banking
    bank_name TEXT,
    bank_account_number TEXT,
    bank_account_holder TEXT,
    
    -- Metadata
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_bridge_partners_code ON bridge_business_partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_bridge_partners_name ON bridge_business_partners(partner_name);
CREATE INDEX IF NOT EXISTS idx_bridge_partners_customer ON bridge_business_partners(is_customer) WHERE is_customer = true;
CREATE INDEX IF NOT EXISTS idx_bridge_partners_vendor ON bridge_business_partners(is_vendor) WHERE is_vendor = true;
CREATE INDEX IF NOT EXISTS idx_bridge_partners_consignee ON bridge_business_partners(is_consignee) WHERE is_consignee = true;
CREATE INDEX IF NOT EXISTS idx_bridge_partners_shipper ON bridge_business_partners(is_shipper) WHERE is_shipper = true;

-- Auto-generate partner code
CREATE OR REPLACE FUNCTION generate_bridge_partner_code()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
    new_code TEXT;
BEGIN
    IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
        -- Get the next sequence number
        SELECT COALESCE(MAX(CAST(SUBSTRING(partner_code FROM 5) AS INTEGER)), 0) + 1
        INTO next_num
        FROM bridge_business_partners
        WHERE partner_code ~ '^BRP-[0-9]+$';
        
        -- Generate new code
        new_code := 'BRP-' || LPAD(next_num::TEXT, 4, '0');
        NEW.partner_code := new_code;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_bridge_partner_code ON bridge_business_partners;
CREATE TRIGGER trg_bridge_partner_code
    BEFORE INSERT OR UPDATE ON bridge_business_partners
    FOR EACH ROW
    EXECUTE FUNCTION generate_bridge_partner_code();

-- Enable RLS
ALTER TABLE bridge_business_partners ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON bridge_business_partners
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON bridge_business_partners
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON bridge_business_partners
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON bridge_business_partners
    FOR DELETE USING (auth.role() = 'authenticated');

-- Migrate existing customers and vendors from centralized tables (if they exist)
-- This is optional and can be commented out if not needed
DO $$
BEGIN
    -- Migrate customers
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'freight_customers') THEN
        INSERT INTO bridge_business_partners (
            partner_name, partner_type, contact_person, email, phone,
            address_line1, city, country, tax_id,
            is_customer, payment_terms, currency, notes, created_at
        )
        SELECT 
            customer_name, 'company', contact_person, email, phone,
            address, city, country, tax_id,
            true, payment_terms, currency, notes, created_at
        FROM freight_customers
        WHERE customer_name NOT IN (SELECT partner_name FROM bridge_business_partners WHERE is_customer = true)
        ON CONFLICT (partner_code) DO NOTHING;
    END IF;

    -- Migrate vendors
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'freight_vendors') THEN
        INSERT INTO bridge_business_partners (
            partner_name, partner_type, contact_person, email, phone,
            address_line1, city, country, tax_id,
            is_vendor, payment_terms, currency, notes, created_at
        )
        SELECT 
            vendor_name, 'company', contact_person, email, phone,
            address, city, country, tax_id,
            true, payment_terms, currency, notes, created_at
        FROM freight_vendors
        WHERE vendor_name NOT IN (SELECT partner_name FROM bridge_business_partners WHERE is_vendor = true)
        ON CONFLICT (partner_code) DO NOTHING;
    END IF;
END $$;

COMMENT ON TABLE bridge_business_partners IS 'Bridge module business partners - customers, vendors, agents, transporters';
