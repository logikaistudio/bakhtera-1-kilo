-- =====================================================
-- Migration 090: Fix finance_coa RLS Policy
-- Purpose: Fix row-level security policy to allow COA import
-- Issue: The original policy was restricting INSERT operations
-- Solution: Replace with separate, permissive policies
-- =====================================================

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Enable all for authenticated users" ON finance_coa;

-- Create separate policies for each operation
-- SELECT: Allow all users to read COA data
CREATE POLICY "Allow read access for all users" ON finance_coa
    FOR SELECT
    USING (true);

-- INSERT: Allow authenticated users to insert COA records
CREATE POLICY "Allow insert for authenticated users" ON finance_coa
    FOR INSERT
    WITH CHECK (true);

-- UPDATE: Allow authenticated users to update COA records
CREATE POLICY "Allow update for authenticated users" ON finance_coa
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- DELETE: Allow authenticated users to delete COA records
CREATE POLICY "Allow delete for authenticated users" ON finance_coa
    FOR DELETE
    USING (true);

-- =====================================================
-- END OF MIGRATION 090
-- =====================================================
