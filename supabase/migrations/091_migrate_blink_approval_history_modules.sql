-- Migration: Update existing blink_approval_history module fields to separate Sales and Operations
-- Setting default to blink_operations, and sales_quotation to blink_sales

UPDATE public.blink_approval_history
SET module = 'blink_operations'
WHERE document_type != 'sales_quotation' OR document_type IS NULL;

UPDATE public.blink_approval_history
SET module = 'blink_sales'
WHERE document_type = 'sales_quotation';
