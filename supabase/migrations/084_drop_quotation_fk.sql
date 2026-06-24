-- Migration to drop foreign key constraint on blink_shipments.quotation_id
-- Because blink_shipments can now be created from blink_sales_quotations (which has a different ID)
-- This allows quotation_id to store IDs from either blink_quotations or blink_sales_quotations

ALTER TABLE public.blink_shipments 
DROP CONSTRAINT IF EXISTS blink_shipments_quotation_id_fkey;

-- Add a sales_quotation_id column for explicit linking
ALTER TABLE public.blink_shipments 
ADD COLUMN IF NOT EXISTS sales_quotation_id UUID REFERENCES public.blink_sales_quotations(id) ON DELETE SET NULL;

-- Also refresh cache
NOTIFY pgrst, 'reload schema';
