-- =====================================================
-- Migration 009: Copy Customers to Business Partners
-- =====================================================

-- Copy all customer data from freight_customers to blink_business_partners
-- Set is_customer = true for all migrated records

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
    credit_limit,
    status,
    notes,
    created_at,
    updated_at
)
SELECT
    COALESCE(name, company, 'Unknown Customer') as partner_name,
    CASE 
        WHEN company IS NOT NULL AND company != '' THEN 'company'
        ELSE 'individual'
    END as partner_type,
    contact as contact_person,
    email,
    phone,
    NULL as mobile, -- freight_customers doesn't have mobile
    address as address_line1,
    city,
    COALESCE(country, 'Indonesia') as country,
    npwp as tax_id,
    true as is_customer, -- Mark as customer
    false as is_vendor,
    false as is_agent,
    false as is_transporter,
    COALESCE(payment_terms, 'NET 30') as payment_terms,
    COALESCE(currency, 'IDR') as currency,
    COALESCE(credit_limit, 0) as credit_limit,
    'active' as status,
    notes,
    created_at,
    NOW() as updated_at
FROM freight_customers
WHERE NOT EXISTS (
    -- Avoid duplicates: skip if partner_name already exists
    SELECT 1 FROM blink_business_partners 
    WHERE partner_name = COALESCE(freight_customers.name, freight_customers.company, 'Unknown Customer')
);

-- Log success
DO $$
DECLARE
    migrated_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO migrated_count 
    FROM blink_business_partners 
    WHERE is_customer = true;
    
    RAISE NOTICE '✅ Migration 009 complete: % customers migrated to business_partners', migrated_count;
END $$;
