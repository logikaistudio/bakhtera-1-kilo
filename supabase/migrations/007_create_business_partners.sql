-- =====================================================
-- Migrasi ke Business Partner Model (Mitra Bisnis)
-- Portal Blink Only - Menggabungkan Customer & Vendor
-- =====================================================

-- 1. Buat Tabel Business Partners
CREATE TABLE IF NOT EXISTS blink_business_partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic Info
    partner_code VARCHAR(50) UNIQUE NOT NULL,
    partner_name VARCHAR(255) NOT NULL,
    partner_type VARCHAR(20) NOT NULL DEFAULT 'company', -- 'company', 'individual'
    
    -- Contact Details
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    fax VARCHAR(50),
    website VARCHAR(255),
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Indonesia',
    
    -- Tax & Legal
    tax_id VARCHAR(50), -- NPWP
    company_registration VARCHAR(100),
    
    -- Roles (Multiple flags - one partner can have multiple roles)
    is_customer BOOLEAN DEFAULT false,
    is_vendor BOOLEAN DEFAULT false,
    is_agent BOOLEAN DEFAULT false,
    is_transporter BOOLEAN DEFAULT false,
    is_consignee BOOLEAN DEFAULT false,
    is_shipper BOOLEAN DEFAULT false,
    
    -- Financial Settings
    payment_terms VARCHAR(50) DEFAULT 'NET 30',
    credit_limit NUMERIC(15,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'IDR',
    
    -- Banking (for payments)
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(100),
    bank_account_holder VARCHAR(255),
    bank_swift_code VARCHAR(50),
    
    -- Status & Metadata
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'blocked'
    notes TEXT,
    tags TEXT[], -- For categorization
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- 2. Indexes for Performance
CREATE INDEX idx_bp_partner_code ON blink_business_partners(partner_code);
CREATE INDEX idx_bp_partner_name ON blink_business_partners(partner_name);
CREATE INDEX idx_bp_is_customer ON blink_business_partners(is_customer);
CREATE INDEX idx_bp_is_vendor ON blink_business_partners(is_vendor);
CREATE INDEX idx_bp_status ON blink_business_partners(status);

-- 3. Full-text search index
CREATE INDEX idx_bp_search ON blink_business_partners 
    USING gin(to_tsvector('english', partner_name || ' ' || COALESCE(contact_person, '') || ' ' || COALESCE(email, '')));

-- 4. Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_blink_business_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_bp_timestamp
    BEFORE UPDATE ON blink_business_partners
    FOR EACH ROW
    EXECUTE FUNCTION update_blink_business_partners_updated_at();

-- 5. Auto-generate partner code if not provided
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(50);
    counter INT := 1;
BEGIN
    IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
        -- Generate format: BP-YYMM-XXXX
        new_code := 'BP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(counter::TEXT, 4, '0');
        
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM blink_business_partners WHERE partner_code = new_code) LOOP
            counter := counter + 1;
            new_code := 'BP-' || TO_CHAR(NOW(), 'YYMM') || '-' || LPAD(counter::TEXT, 4, '0');
        END LOOP;
        
        NEW.partner_code := new_code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_partner_code
    BEFORE INSERT ON blink_business_partners
    FOR EACH ROW
    EXECUTE FUNCTION generate_partner_code();

-- 6. Comments for documentation
COMMENT ON TABLE blink_business_partners IS 'Unified business partner table (Customer, Vendor, Agent, etc) for Blink Portal';
COMMENT ON COLUMN blink_business_partners.is_customer IS 'Can be invoiced (Receivables)';
COMMENT ON COLUMN blink_business_partners.is_vendor IS 'Can receive PO (Payables)';
COMMENT ON COLUMN blink_business_partners.is_agent IS 'Overseas/Local agent partner';
COMMENT ON COLUMN blink_business_partners.is_transporter IS 'Trucking/Airline/Shipping line';
COMMENT ON COLUMN blink_business_partners.is_consignee IS 'Frequently used as document consignee';
COMMENT ON COLUMN blink_business_partners.is_shipper IS 'Frequently used as document shipper';

-- 7. Enable Row Level Security (Optional - if using Supabase Auth)
ALTER TABLE blink_business_partners ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated users (adjust based on your needs)
CREATE POLICY "Enable all for authenticated users" ON blink_business_partners
    FOR ALL
    USING (auth.role() = 'authenticated');
