-- Add standalone Cabang flow support
-- 1) Master table for branch management (created by Admin HQ from app)
-- 2) branch_code partitioning fields for Blink/BXPO shared operational tables
-- 3) expand division domain to include 'cabang'

CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT,
    mode TEXT NOT NULL DEFAULT 'standalone' CHECK (mode IN ('standalone', 'shared')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branches_status ON public.branches(status);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'branches'
          AND policyname = 'branches_select_all'
    ) THEN
        CREATE POLICY branches_select_all ON public.branches
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'branches'
          AND policyname = 'branches_insert_all'
    ) THEN
        CREATE POLICY branches_insert_all ON public.branches
            FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'branches'
          AND policyname = 'branches_update_all'
    ) THEN
        CREATE POLICY branches_update_all ON public.branches
            FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
END $$;

ALTER TABLE public.blink_sales_quotations ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_quotations ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_shipments ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_purchase_orders ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_invoices ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_ar_transactions ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_ap_transactions ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_journal_entries ADD COLUMN IF NOT EXISTS branch_code TEXT;
ALTER TABLE public.blink_approval_history ADD COLUMN IF NOT EXISTS branch_code TEXT;

CREATE INDEX IF NOT EXISTS idx_blink_shipments_division_branch ON public.blink_shipments(division, branch_code);
CREATE INDEX IF NOT EXISTS idx_blink_invoices_division_branch ON public.blink_invoices(division, branch_code);
CREATE INDEX IF NOT EXISTS idx_blink_ar_division_branch ON public.blink_ar_transactions(division, branch_code);
CREATE INDEX IF NOT EXISTS idx_blink_ap_division_branch ON public.blink_ap_transactions(division, branch_code);

DO $$
BEGIN
    -- Expand partner division domain so cabang can maintain standalone partner data.
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND t.relname = 'blink_business_partners'
          AND c.conname = 'blink_business_partners_owner_division_check'
    ) THEN
        ALTER TABLE public.blink_business_partners
            DROP CONSTRAINT blink_business_partners_owner_division_check;
    END IF;

    ALTER TABLE public.blink_business_partners
        ADD CONSTRAINT blink_business_partners_owner_division_check
        CHECK (owner_division IN ('blink', 'bxpo', 'cabang'));
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
