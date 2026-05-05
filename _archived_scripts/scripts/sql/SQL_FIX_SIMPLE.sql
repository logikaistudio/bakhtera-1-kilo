-- =====================================================
-- SIMPLE SQL FIX - Copy and paste ini ke Supabase SQL Editor
-- =====================================================

-- 1. Ensure RLS is enabled
ALTER TABLE IF EXISTS blink_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS partners ENABLE ROW LEVEL SECURITY;

-- 2. Remove old policies if they exist
DROP POLICY IF EXISTS "Allow read access for all users" ON blink_purchase_orders;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON blink_purchase_orders;
DROP POLICY IF EXISTS "Allow read access for all users" ON partners;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON partners;

-- 3. Create new SELECT policies
CREATE POLICY "Allow read access for all users" ON blink_purchase_orders
    FOR SELECT
    USING (true);

CREATE POLICY "Allow read access for all users" ON partners
    FOR SELECT
    USING (true);

-- Done!
