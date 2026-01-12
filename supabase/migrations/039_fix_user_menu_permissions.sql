-- Migration: Fix User Menu Permissions Table
-- Description: Adds missing created_by column to user_menu_permissions table
-- Date: 2026-01-09

-- Add created_by column to user_menu_permissions if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_menu_permissions' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE public.user_menu_permissions 
        ADD COLUMN created_by UUID REFERENCES public.users(id);
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.user_menu_permissions.created_by IS 'User who assigned this permission';

-- Migration complete
