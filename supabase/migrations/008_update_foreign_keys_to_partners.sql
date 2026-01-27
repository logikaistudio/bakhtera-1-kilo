-- =====================================================
-- Update Foreign Keys - Blink Tables to Business Partners
-- =====================================================

-- 1. Update blink_quotations
ALTER TABLE blink_quotations 
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES blink_business_partners(id);

-- Migrate existing customer data (if column exists)
-- Note: Run this manually after populating business_partners from old data
-- UPDATE blink_quotations SET partner_id = (SELECT id FROM blink_business_partners WHERE partner_name = blink_quotations.customer_name LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_quotations_partner_id ON blink_quotations(partner_id);

COMMENT ON COLUMN blink_quotations.partner_id IS 'Reference to business partner (replaces customer_id)';

-- 2. Update blink_shipments
ALTER TABLE blink_shipments 
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS vendor_partner_id UUID REFERENCES blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS shipper_partner_id UUID REFERENCES blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS consignee_partner_id UUID REFERENCES blink_business_partners(id);

CREATE INDEX IF NOT EXISTS idx_shipments_partner_id ON blink_shipments(partner_id);
CREATE INDEX IF NOT EXISTS idx_shipments_vendor_partner_id ON blink_shipments(vendor_partner_id);

COMMENT ON COLUMN blink_shipments.partner_id IS 'Customer/Bill-to partner';
COMMENT ON COLUMN blink_shipments.vendor_partner_id IS 'Vendor/Service provider partner';
COMMENT ON COLUMN blink_shipments.shipper_partner_id IS 'Shipper (can be linked to partner or manual text)';
COMMENT ON COLUMN blink_shipments.consignee_partner_id IS 'Consignee (can be linked to partner or manual text)';

-- 3. Update blink_invoices
ALTER TABLE blink_invoices 
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES blink_business_partners(id);

CREATE INDEX IF NOT EXISTS idx_invoices_partner_id ON blink_invoices(partner_id);

COMMENT ON COLUMN blink_invoices.partner_id IS 'Customer partner reference';

-- 4. Create view for backward compatibility (optional)
CREATE OR REPLACE VIEW blink_customers_legacy AS
SELECT 
    id,
    partner_code as customer_code,
    partner_name as customer_name,
    contact_person,
    email,
    phone,
    address_line1 || ' ' || COALESCE(address_line2, '') as address,
    city,
    country,
    payment_terms,
    credit_limit,
    status,
    created_at,
    updated_at
FROM blink_business_partners
WHERE is_customer = true;

CREATE OR REPLACE VIEW blink_vendors_legacy AS
SELECT 
    id,
    partner_code as vendor_code,
    partner_name as vendor_name,
    contact_person,
    email,
    phone,
    address_line1 || ' ' || COALESCE(address_line2, '') as address,
    city,
    country,
    payment_terms,
    status,
    created_at,
    updated_at
FROM blink_business_partners
WHERE is_vendor = true;

COMMENT ON VIEW blink_customers_legacy IS 'Legacy view for backward compatibility - filters partners with is_customer=true';
COMMENT ON VIEW blink_vendors_legacy IS 'Legacy view for backward compatibility - filters partners with is_vendor=true';
