-- Create big_business_partners table
CREATE TABLE IF NOT EXISTS big_business_partners (
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
    
    -- Roles (a partner can have multiple roles)
    is_customer BOOLEAN DEFAULT false,
    is_vendor BOOLEAN DEFAULT false,
    is_agent BOOLEAN DEFAULT false,
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
CREATE INDEX IF NOT EXISTS idx_big_partners_code ON big_business_partners(partner_code);
CREATE INDEX IF NOT EXISTS idx_big_partners_name ON big_business_partners(partner_name);
CREATE INDEX IF NOT EXISTS idx_big_partners_customer ON big_business_partners(is_customer) WHERE is_customer = true;
CREATE INDEX IF NOT EXISTS idx_big_partners_vendor ON big_business_partners(is_vendor) WHERE is_vendor = true;

-- Auto-generate partner code
CREATE OR REPLACE FUNCTION generate_big_partner_code()
RETURNS TRIGGER AS $$
DECLARE
    next_num INTEGER;
    new_code TEXT;
BEGIN
    IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
        -- Get the next sequence number
        SELECT COALESCE(MAX(CAST(SUBSTRING(partner_code FROM 5) AS INTEGER)), 0) + 1
        INTO next_num
        FROM big_business_partners
        WHERE partner_code ~ '^BGP-[0-9]+$';
        
        -- Generate new code
        new_code := 'BGP-' || LPAD(next_num::TEXT, 4, '0');
        NEW.partner_code := new_code;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_big_partner_code ON big_business_partners;
CREATE TRIGGER trg_big_partner_code
    BEFORE INSERT OR UPDATE ON big_business_partners
    FOR EACH ROW
    EXECUTE FUNCTION generate_big_partner_code();

-- Enable RLS
ALTER TABLE big_business_partners ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON big_business_partners
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON big_business_partners
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON big_business_partners
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users" ON big_business_partners
    FOR DELETE USING (auth.role() = 'authenticated');

COMMENT ON TABLE big_business_partners IS 'Big module business partners - customers, vendors, agents, event organizers';
