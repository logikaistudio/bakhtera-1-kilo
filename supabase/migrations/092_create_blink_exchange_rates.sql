-- Migration 092: Create public.blink_exchange_rates Table
-- Purpose: Reference Exchange Rates USD to IDR with effective date

CREATE TABLE IF NOT EXISTS public.blink_exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rate NUMERIC(15, 4) NOT NULL,
    effective_date DATE NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by TEXT
);

-- Enable Row Level Security
ALTER TABLE public.blink_exchange_rates ENABLE ROW LEVEL SECURITY;

-- Permissive RLS policies for CRUD operations
CREATE POLICY "Allow read access for all users" ON public.blink_exchange_rates
    FOR SELECT USING (true);

CREATE POLICY "Allow insert for all" ON public.blink_exchange_rates
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update for all" ON public.blink_exchange_rates
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete for all" ON public.blink_exchange_rates
    FOR DELETE USING (true);

-- Insert a default rate for today
INSERT INTO public.blink_exchange_rates (rate, effective_date, created_by)
VALUES (16000.0000, CURRENT_DATE, 'System')
ON CONFLICT (effective_date) DO NOTHING;

-- Insert default role permissions for the new menu code 'blink_exchange_rates'
INSERT INTO public.role_permissions (role_id, role_label, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve)
VALUES
    ('direksi', 'Direksi', 'blink_exchange_rates', true, true, true, true, true, true),
    ('chief', 'Chief', 'blink_exchange_rates', true, true, true, true, true, true),
    ('manager', 'Manager', 'blink_exchange_rates', true, true, true, true, true, true),
    ('staff', 'Staff', 'blink_exchange_rates', true, true, true, true, false, false),
    ('viewer', 'Viewer', 'blink_exchange_rates', true, true, false, false, false, false)
ON CONFLICT (role_id, menu_code) DO UPDATE
SET
    can_access = EXCLUDED.can_access,
    can_view = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_edit = EXCLUDED.can_edit,
    can_delete = EXCLUDED.can_delete,
    can_approve = EXCLUDED.can_approve;
