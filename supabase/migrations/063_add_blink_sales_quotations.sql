-- Create blink_sales_quotations table based on blink_quotations
CREATE TABLE IF NOT EXISTS public.blink_sales_quotations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Identification
    job_number VARCHAR,
    quotation_number VARCHAR,
    
    -- Customer Information
    partner_id UUID REFERENCES public.blink_business_partners(id),
    customer_id UUID, -- Legacy column
    customer_name VARCHAR,
    customer_company VARCHAR,
    customer_address TEXT,
    customer_contact_name VARCHAR,
    customer_email VARCHAR,
    customer_phone VARCHAR,
    
    -- Sales Info
    sales_person VARCHAR,
    
    -- Quotation Details
    quotation_type VARCHAR DEFAULT 'RG',
    quotation_date DATE,
    valid_until DATE,
    
    -- Route Information
    origin VARCHAR,
    destination VARCHAR,
    service_type VARCHAR,
    cargo_type VARCHAR,
    incoterm VARCHAR,
    
    -- Cargo Details
    commodity VARCHAR,
    package_type VARCHAR,
    quantity NUMERIC,
    weight NUMERIC,
    volume NUMERIC,
    gross_weight NUMERIC(10,2),
    net_weight NUMERIC(10,2),
    measure NUMERIC(10,3),
    
    -- Pricing
    currency VARCHAR DEFAULT 'USD',
    total_amount NUMERIC,
    payment_terms VARCHAR DEFAULT 'Net 30 Days',
    service_items JSONB,
    
    -- Status Management
    status VARCHAR DEFAULT 'draft',
    notes TEXT,
    terms_and_conditions TEXT,
    rejection_reason TEXT,
    
    -- Revision System
    revision_number INTEGER DEFAULT 0,
    parent_quotation_id UUID REFERENCES public.blink_sales_quotations(id),
    revision_reason TEXT,
    revised_at TIMESTAMP WITH TIME ZONE,
    revised_by VARCHAR,
    is_superseded BOOLEAN DEFAULT false,
    superseded_by_id UUID REFERENCES public.blink_sales_quotations(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Comments
COMMENT ON TABLE public.blink_sales_quotations IS 'Detailed sales quotations for Blink portal';
COMMENT ON COLUMN public.blink_sales_quotations.gross_weight IS 'Gross weight in kilograms';
COMMENT ON COLUMN public.blink_sales_quotations.net_weight IS 'Net weight in kilograms';
COMMENT ON COLUMN public.blink_sales_quotations.measure IS 'Measure/Volume in cubic meters (M3)';

-- Enable RLS
ALTER TABLE public.blink_sales_quotations ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies
CREATE POLICY "Enable read access for all users" ON public.blink_sales_quotations FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.blink_sales_quotations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.blink_sales_quotations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.blink_sales_quotations FOR DELETE USING (auth.role() = 'authenticated');
