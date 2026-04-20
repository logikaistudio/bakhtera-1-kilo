-- =====================================================
-- Migration 091: Fix SELECT RLS Policies
-- Purpose: Add missing SELECT policies for affected tables
-- =====================================================

-- Ensure RLS is enabled on both tables
ALTER TABLE blink_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Fix blink_purchase_orders SELECT policy
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read access for all users" ON blink_purchase_orders;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON blink_purchase_orders;
    
    CREATE POLICY "Allow read access for all users" ON blink_purchase_orders
        FOR SELECT
        USING (true);
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- Fix partners SELECT policy
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow read access for all users" ON partners;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON partners;
    
    CREATE POLICY "Allow read access for all users" ON partners
        FOR SELECT
        USING (true);
EXCEPTION WHEN OTHERS THEN
    NULL;
END;
$$;

-- =====================================================
-- END OF MIGRATION 091
-- =====================================================
