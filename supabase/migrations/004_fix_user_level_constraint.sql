-- Fix user_level constraint to allow both old and new level names
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_level_check;

-- Step 2: Add new constraint with all allowed values
ALTER TABLE users ADD CONSTRAINT users_user_level_check 
CHECK (user_level IN (
    'super_admin',  -- Super admin (highest access)
    'admin',        -- Admin
    'manager',      -- Manager
    'staff',        -- Staff
    'view_only',    -- View only
    'direksi',      -- Same as super_admin (new naming)
    'chief',        -- Same as admin (new naming)
    'viewer'        -- Same as view_only (new naming)
));

-- Step 3: Update superadmin user to use 'super_admin' level
UPDATE users 
SET user_level = 'super_admin' 
WHERE username = 'superadmin';

-- Verify the update
SELECT id, username, full_name, user_level, is_active, portal_access 
FROM users 
WHERE username = 'superadmin';
