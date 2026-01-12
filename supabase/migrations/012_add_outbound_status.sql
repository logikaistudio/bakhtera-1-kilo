
ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS outbound_status TEXT;
ALTER TABLE freight_quotations ADD COLUMN IF NOT EXISTS outbound_date TIMESTAMP WITH TIME ZONE;
