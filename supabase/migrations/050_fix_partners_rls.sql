-- Fix RLS for blink_business_partners
ALTER TABLE blink_business_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all for authenticated users" ON blink_business_partners;
DROP POLICY IF EXISTS "Enable read access for all users" ON blink_business_partners;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON blink_business_partners;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON blink_business_partners;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON blink_business_partners;
DROP POLICY IF EXISTS "Allow all for now" ON blink_business_partners;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON blink_business_partners;

CREATE POLICY "Allow all for now" ON blink_business_partners
    FOR ALL
    USING (true)
    WITH CHECK (true);
