-- Create a view to monitor aging inventory and outbound duration
-- Joined with 'bridge_business_partners' to ensure we use official partner data (Mitra Bisnis).

CREATE OR REPLACE VIEW view_bridge_aging_monitor AS
SELECT
    q.id,
    q.quotation_number,
    q.bc_document_number,
    q.customer as customer_name, -- The customer string from quotation
    
    -- Join with Bridge Business Partners to get official partner details
    p.id as partner_id,
    p.partner_name,
    p.is_customer,
    p.is_shipper,
    
    q.type,
    q.status,
    q.outbound_status,
    q.submission_date,
    q.approved_date,
    q.outbound_date,
    q.created_at,
    
    -- Calculate Aging for Inbound (Days in Warehouse)
    CASE 
        WHEN q.type = 'inbound' AND q.status = 'approved' THEN 
            EXTRACT(DAY FROM (NOW() - COALESCE(q.submission_date, q.approved_date, q.created_at)))::integer
        ELSE NULL 
    END as aging_days,
    
    -- Calculate Duration for Outbound (Days Out of Warehouse)
    CASE 
        WHEN q.type = 'outbound' AND q.outbound_status IN ('submitted', 'processed') THEN 
            EXTRACT(DAY FROM (NOW() - COALESCE(q.outbound_date, q.approved_date, q.created_at)))::integer
        ELSE NULL 
    END as outbound_duration_days,

    -- Determine Aging Status (Alert Logic)
    CASE 
        WHEN q.type = 'inbound' AND q.status = 'approved' THEN
            CASE 
                WHEN EXTRACT(DAY FROM (NOW() - COALESCE(q.submission_date, q.approved_date, q.created_at))) > 90 THEN 'Alert'
                WHEN EXTRACT(DAY FROM (NOW() - COALESCE(q.submission_date, q.approved_date, q.created_at))) > 60 THEN 'Warning'
                ELSE 'Normal' 
            END
        WHEN q.type = 'outbound' AND q.outbound_status IN ('submitted', 'processed') THEN
             CASE 
                WHEN EXTRACT(DAY FROM (NOW() - COALESCE(q.outbound_date, q.approved_date, q.created_at))) > 90 THEN 'Alert'
                WHEN EXTRACT(DAY FROM (NOW() - COALESCE(q.outbound_date, q.approved_date, q.created_at))) > 60 THEN 'Warning'
                ELSE 'Normal' 
            END
        ELSE 'N/A'
    END as aging_status

FROM freight_quotations q
LEFT JOIN bridge_business_partners p ON q.customer = p.partner_name;

-- Grant access to authenticated users
GRANT SELECT ON view_bridge_aging_monitor TO authenticated;
GRANT SELECT ON view_bridge_aging_monitor TO service_role;
