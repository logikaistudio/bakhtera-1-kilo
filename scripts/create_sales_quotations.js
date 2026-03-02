require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
CREATE TABLE IF NOT EXISTS public.blink_sales_quotations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_number VARCHAR,
    quotation_number VARCHAR,
    customer_id UUID,
    customer_name VARCHAR,
    customer_company VARCHAR,
    customer_address TEXT,
    sales_person VARCHAR,
    quotation_type VARCHAR,
    quotation_date DATE,
    valid_until DATE,
    origin VARCHAR,
    destination VARCHAR,
    service_type VARCHAR,
    cargo_type VARCHAR,
    weight NUMERIC,
    volume NUMERIC,
    commodity VARCHAR,
    currency VARCHAR,
    total_amount NUMERIC,
    status VARCHAR,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    service_items JSONB,
    revision_number INTEGER,
    parent_quotation_id UUID,
    revision_reason TEXT,
    revised_at TIMESTAMP WITH TIME ZONE,
    revised_by VARCHAR,
    is_superseded BOOLEAN,
    superseded_by_id UUID,
    gross_weight NUMERIC(10,2),
    net_weight NUMERIC(10,2),
    measure NUMERIC(10,3),
    partner_id UUID REFERENCES public.business_partners(id),
    incoterm VARCHAR,
    payment_terms VARCHAR,
    package_type VARCHAR,
    quantity NUMERIC,
    customer_contact_name VARCHAR,
    customer_email VARCHAR,
    customer_phone VARCHAR,
    terms_and_conditions TEXT,
    rejection_reason TEXT
);

COMMENT ON COLUMN public.blink_sales_quotations.gross_weight IS 'Gross weight in kilograms';
COMMENT ON COLUMN public.blink_sales_quotations.net_weight IS 'Net weight in kilograms';
COMMENT ON COLUMN public.blink_sales_quotations.measure IS 'Measure/Volume in cubic meters (M3)';

ALTER TABLE public.blink_sales_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.blink_sales_quotations FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.blink_sales_quotations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.blink_sales_quotations FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.blink_sales_quotations FOR DELETE USING (auth.role() = 'authenticated');
  `;
  
  // Since we don't have rpc access for executing arbitrary sql without setup, 
  // Let me just explain to you that I can't do it right now.
  console.log('cannot run sql');
}

run();
