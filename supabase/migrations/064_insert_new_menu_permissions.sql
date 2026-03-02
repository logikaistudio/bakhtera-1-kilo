-- Insert the new menu permission code into role_permissions for existing roles
-- This ensures that roles that have access to similar blink modules can see the new menu
INSERT INTO public.role_permissions (role_name, menu_code, can_access, can_view, can_create, can_edit, can_delete, can_approve, requires_approval_for_edit, requires_approval_for_delete)
SELECT role_name, 'blink_sales_quotations', true, true, true, true, true, true, false, false
FROM (SELECT DISTINCT role_name FROM public.role_permissions) as roles
ON CONFLICT (role_name, menu_code) DO NOTHING;
