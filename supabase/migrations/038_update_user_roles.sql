-- Migration: Update User Roles
-- Description: Changes user levels from generic roles to organizational hierarchy
-- Date: 2026-01-09

-- Update user_level enum values
-- Note: We need to update existing data first, then modify the constraint

-- 1. First, update existing data if any
UPDATE public.users 
SET user_level = CASE
    WHEN user_level = 'super_admin' THEN 'direksi'
    WHEN user_level = 'admin' THEN 'chief'
    WHEN user_level = 'approver' THEN 'manager'
    WHEN user_level = 'full_access' THEN 'staff'
    WHEN user_level = 'view_only' THEN 'viewer'
    ELSE user_level
END;

-- 2. Drop the old constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_level_check;

-- 3. Add new constraint with organizational roles
ALTER TABLE public.users ADD CONSTRAINT users_user_level_check 
CHECK (user_level IN ('direksi', 'chief', 'manager', 'staff', 'viewer'));

-- 4. Add comment explaining the hierarchy
COMMENT ON COLUMN public.users.user_level IS 'User organizational level: direksi (highest), chief, manager, staff, viewer (lowest)';

-- Migration complete
