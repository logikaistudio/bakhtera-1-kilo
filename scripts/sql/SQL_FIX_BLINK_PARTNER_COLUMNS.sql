-- Fix missing partner references in Blink tables

ALTER TABLE IF EXISTS public.blink_quotations
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.blink_business_partners(id);
CREATE INDEX IF NOT EXISTS idx_blink_quotations_partner_id ON public.blink_quotations(partner_id);
COMMENT ON COLUMN public.blink_quotations.partner_id IS 'Reference to business partner (replaces customer_id)';

ALTER TABLE IF EXISTS public.blink_shipments
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS vendor_partner_id UUID REFERENCES public.blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS shipper_partner_id UUID REFERENCES public.blink_business_partners(id),
    ADD COLUMN IF NOT EXISTS consignee_partner_id UUID REFERENCES public.blink_business_partners(id);
CREATE INDEX IF NOT EXISTS idx_blink_shipments_partner_id ON public.blink_shipments(partner_id);
CREATE INDEX IF NOT EXISTS idx_blink_shipments_vendor_partner_id ON public.blink_shipments(vendor_partner_id);
COMMENT ON COLUMN public.blink_shipments.partner_id IS 'Customer/Bill-to partner';
COMMENT ON COLUMN public.blink_shipments.vendor_partner_id IS 'Vendor/Service provider partner';
COMMENT ON COLUMN public.blink_shipments.shipper_partner_id IS 'Shipper partner reference';
COMMENT ON COLUMN public.blink_shipments.consignee_partner_id IS 'Consignee partner reference';

ALTER TABLE IF EXISTS public.blink_invoices
    ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.blink_business_partners(id);
CREATE INDEX IF NOT EXISTS idx_blink_invoices_partner_id ON public.blink_invoices(partner_id);
COMMENT ON COLUMN public.blink_invoices.partner_id IS 'Customer partner reference';
