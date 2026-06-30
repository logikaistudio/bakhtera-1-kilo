-- Add cost_items column to blink_sales_quotations
-- This column stores the estimated buying/cost breakdown items for each quotation

ALTER TABLE public.blink_sales_quotations
ADD COLUMN IF NOT EXISTS cost_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.blink_sales_quotations.cost_items IS 'Estimated cost/buying items for the quotation (mirrors service_items structure)';
