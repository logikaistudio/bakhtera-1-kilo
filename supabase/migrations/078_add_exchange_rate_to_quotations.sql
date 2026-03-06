-- Add exchange_rate to blink_quotations and blink_sales_quotations
ALTER TABLE public.blink_quotations 
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;

ALTER TABLE public.blink_sales_quotations 
ADD COLUMN IF NOT EXISTS exchange_rate numeric DEFAULT 1;
