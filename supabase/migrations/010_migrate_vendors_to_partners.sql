-- =====================================================
-- Migration 010: Copy Vendors to Business Partners
-- =====================================================

-- Copy all vendor data from freight_vendors to blink_business_partners
-- Set is_vendor = true for all migrated records
-- If partner already exists (from customer migration), UPDATE to add vendor role

INSERT INTO blink_business_partners (
    partner_name,
    partner_type,
    contact_person,
    email,
    phone,
    mobile,
    address_line1,
    city,
    country,
    tax_id,
    is_customer,
    is_vendor,
    is_agent,
    is_transporter,
    payment_terms,
    currency,
    bank_name,
    bank_account_number,
    bank_account_holder,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    COALESCE(name, company, 'Unknown Vendor') as partner_name,
    CASE 
        WHEN company IS NOT NULL AND company != '' THEN 'company'
        ELSE 'individual'
    END as partner_type,
    contact as contact_person,
    email,
    phone,
    NULL as mobile,
    address as address_line1,
    city,
    COALESCE(country, 'Indonesia') as country,
    npwp as tax_id,
    false as is_customer,
    true as is_vendor, -- Mark as vendor
    false as is_agent,
    false as is_transporter,
    COALESCE(payment_terms, 'NET 30') as payment_terms,
    COALESCE(currency, 'IDR') as currency,
    bank_name,
    bank_account as bank_account_number,
    bank_holder as bank_account_holder,
    'active' as status,
    notes,
    created_at,
    NOW() as updated_at
FROM freight_vendors
WHERE NOT EXISTS (
    -- Skip if partner_name already exists (e.g., from customer migration)
    SELECT 1 FROM blink_business_partners 
    WHERE partner_name = COALESCE(freight_vendors.name, freight_vendors.company, 'Unknown Vendor')
);

-- Update existing partners that are BOTH customer AND vendor
-- Example: PT ABC is already in business_partners as customer, now mark as vendor too
UPDATE blink_business_partners bp
SET 
    is_vendor = true,
    bank_name = COALESCE(bp.bank_name, v.bank_name),
    bank_account_number = COALESCE(bp.bank_account_number, v.bank_account),
    bank_account_holder = COALESCE(bp.bank_account_holder, v.bank_holder),
    updated_at = NOW()
FROM freight_vendors v
WHERE bp.partner_name = COALESCE(v.name, v.company, 'Unknown Vendor')
    AND bp.is_vendor = false; -- Only update if not already vendor

-- Log success
DO $$
DECLARE
    vendor_count INTEGER;
    dual_role_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO vendor_count 
    FROM blink_business_partners 
    WHERE is_vendor = true;
    
    SELECT COUNT(*) INTO dual_role_count
    FROM blink_business_partners
    WHERE is_customer = true AND is_vendor = true;
    
    RAISE NOTICE '✅ Migration 010 complete: % vendors migrated', vendor_count;
    RAISE NOTICE '📊 Partners with dual roles (Customer + Vendor): %', dual_role_count;
END $$;
