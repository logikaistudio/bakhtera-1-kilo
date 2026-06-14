-- Fix RLS for bridge_business_partners
-- Since the application uses a custom authentication system (users and user_sessions tables) 
-- instead of Supabase Auth, requests are made with the anon key. 
-- The previous policy required auth.role() = 'authenticated' which caused inserts to fail.

ALTER TABLE bridge_business_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all users" ON bridge_business_partners;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON bridge_business_partners;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON bridge_business_partners;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON bridge_business_partners;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON bridge_business_partners;
DROP POLICY IF EXISTS "Allow all for now" ON bridge_business_partners;

CREATE POLICY "Allow all for now" ON bridge_business_partners
    FOR ALL
    USING (true)
    WITH CHECK (true);
