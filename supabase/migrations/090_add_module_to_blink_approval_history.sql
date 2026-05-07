-- Migration: Fix RLS policies for blink_approval_history
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Add module column (if not already done)
ALTER TABLE blink_approval_history
    ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'blink_operations';

-- Step 2: Ensure RLS is enabled
ALTER TABLE blink_approval_history ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing conflicting policies (if any)
DROP POLICY IF EXISTS "allow_all_insert" ON blink_approval_history;
DROP POLICY IF EXISTS "allow_all_select" ON blink_approval_history;
DROP POLICY IF EXISTS "allow_authenticated_insert" ON blink_approval_history;
DROP POLICY IF EXISTS "allow_authenticated_select" ON blink_approval_history;

-- Step 4: Create permissive policies (allow all authenticated users)
CREATE POLICY "allow_all_insert" ON blink_approval_history
    FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_select" ON blink_approval_history
    FOR SELECT USING (true);

CREATE POLICY "allow_all_update" ON blink_approval_history
    FOR UPDATE USING (true);

-- Step 5: Create index for module filter
CREATE INDEX IF NOT EXISTS idx_blink_approval_history_module
    ON blink_approval_history(module);

-- Step 6: Verify
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'blink_approval_history';
