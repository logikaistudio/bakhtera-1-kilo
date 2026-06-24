-- Add container fields to blink_sales_quotations
ALTER TABLE public.blink_sales_quotations 
ADD COLUMN IF NOT EXISTS container_size VARCHAR,
ADD COLUMN IF NOT EXISTS container_count INTEGER;

COMMENT ON COLUMN public.blink_sales_quotations.container_size IS 'Size of container (e.g., 20ft, 40ft) added for Cargo Details';
COMMENT ON COLUMN public.blink_sales_quotations.container_count IS 'Number of containers';
