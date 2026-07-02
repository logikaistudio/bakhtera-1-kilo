-- Migration 093: Add division column to Blink/BXPO tables
-- Purpose: Support data partitioning between Blink and BXPO using the same tables

ALTER TABLE public.blink_sales_quotations ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_quotations ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_shipments ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_purchase_orders ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_invoices ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_payments ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_ar_transactions ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_ap_transactions ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_journal_entries ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';
ALTER TABLE public.blink_approval_history ADD COLUMN IF NOT EXISTS division TEXT DEFAULT 'blink';

-- Backfill existing NULL data to 'blink'
UPDATE public.blink_sales_quotations SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_quotations SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_shipments SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_purchase_orders SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_invoices SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_payments SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_ar_transactions SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_ap_transactions SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_journal_entries SET division = 'blink' WHERE division IS NULL;
UPDATE public.blink_approval_history SET division = 'blink' WHERE division IS NULL;

-- Insert default role permissions for the new menu codes of BXPO (Dashboard is deleted, mapping directly to main dashboard)
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
VALUES
    ('direksi', 'Direksi', 'bxpo_sales_quotations', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_flow_monitor', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_sales', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_sales_approval', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_quotations', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_shipments', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_bl', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_tracking', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_awb', true, true, true, true, true, true),
    ('direksi', 'Direksi', 'bxpo_approval', true, true, true, true, true, true),

    ('chief', 'Chief', 'bxpo_sales_quotations', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_flow_monitor', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_sales', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_sales_approval', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_quotations', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_shipments', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_bl', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_tracking', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_awb', true, true, true, true, true, true),
    ('chief', 'Chief', 'bxpo_approval', true, true, true, true, true, true),

    ('manager', 'Manager', 'bxpo_sales_quotations', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_flow_monitor', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_sales', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_sales_approval', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_quotations', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_shipments', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_bl', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_tracking', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_awb', true, true, true, true, true, true),
    ('manager', 'Manager', 'bxpo_approval', true, true, true, true, true, true),

    ('staff', 'Staff', 'bxpo_sales_quotations', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_flow_monitor', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_sales', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_sales_approval', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_quotations', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_shipments', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_bl', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_tracking', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_awb', true, true, true, true, false, false),
    ('staff', 'Staff', 'bxpo_approval', true, true, true, true, false, false),

    ('viewer', 'Viewer', 'bxpo_sales_quotations', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_flow_monitor', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_sales', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_sales_approval', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_quotations', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_shipments', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_bl', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_tracking', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_awb', true, true, false, false, false, false),
    ('viewer', 'Viewer', 'bxpo_approval', true, true, false, false, false, false)
ON CONFLICT (role_id, menu_code) DO UPDATE
SET
    can_access = EXCLUDED.can_access,
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_approve = EXCLUDED.can_approve;
