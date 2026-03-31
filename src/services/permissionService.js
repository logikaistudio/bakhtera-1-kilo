import { supabase } from '../lib/supabase';

/**
 * Permission Service
 * Handles permission checking and menu access
 */

/**
 * Check if user has specific permission for a menu
 * @param {string} userId - User ID
 * @param {string} userLevel - User level
 * @param {string} menuCode - Menu code
 * @param {string} permission - Permission to check (access, view, create, edit, delete, approve)
 * @param {object} permissions - Pre-loaded permissions object (optional, for performance)
 * @returns {Promise<boolean>} - True if user has permission
 */
export const checkPermission = async (userId, userLevel, menuCode, permission, permissions = null) => {
    try {
        // Super admin and admin have all permissions
        if (userLevel === 'super_admin' || userLevel === 'admin') {
            return true;
        }

        // Use pre-loaded permissions if available
        if (permissions && permissions[menuCode]) {
            return permissions[menuCode][`can_${permission}`] || false;
        }

        // Load permission from role_permissions (sole source of truth)
        const { data, error } = await supabase
            .from('role_permissions')
            .select(`can_${permission}`)
            .eq('role_id', userLevel)
            .eq('menu_code', menuCode)
            .single();

        if (error || !data) return false;

        return data[`can_${permission}`] || false;

    } catch (error) {
        console.error('Error checking permission:', error);
        return false;
    }
};

/**
 * Get all permissions for a user
 * Uses role_permissions as the sole source of truth (matching authService).
 * @param {string} userId - User ID
 * @param {string} userLevel - User level / role_id
 * @returns {Promise<object>} - Permissions object keyed by menu_code
 */
export const getUserPermissions = async (userId, userLevel) => {
    try {
        // Super admin and admin get all menus
        if (userLevel === 'super_admin' || userLevel === 'admin') {
            const { data: menus } = await supabase
                .from('menu_registry')
                .select('menu_code');

            const permissions = {};
            menus?.forEach(menu => {
                permissions[menu.menu_code] = {
                    can_access: true,
                    can_view: true,
                    can_create: true,
                    can_edit: true,
                    can_delete: true,
                    can_approve: true,
                    requires_approval_for_edit: false,
                    requires_approval_for_delete: false
                };
            });

            return permissions;
        }

        const isViewOnly = userLevel === 'view_only';
        const permissions = {};

        // Load role-level permissions from role_permissions table.
        // This is the SOLE source of truth, configured via Admin → Manajemen Role & Akses.
        const { data: rolePerms } = await supabase
            .from('role_permissions')
            .select('*')
            .eq('role_id', userLevel);

        rolePerms?.forEach(perm => {
            permissions[perm.menu_code] = {
                can_access: perm.can_access,
                can_view: perm.can_view,
                can_create: isViewOnly ? false : perm.can_create,
                can_edit: isViewOnly ? false : perm.can_edit,
                can_delete: isViewOnly ? false : perm.can_delete,
                can_approve: isViewOnly ? false : perm.can_approve,
                requires_approval_for_edit: perm.requires_approval_for_edit ?? false,
                requires_approval_for_delete: perm.requires_approval_for_delete ?? false
            };
        });

        return permissions;

    } catch (error) {
        console.error('Error getting user permissions:', error);
        return {};
    }
};

/**
 * Set user permissions for a menu
 * @param {string} userId - User ID
 * @param {string} menuCode - Menu code
 * @param {object} permissions - Permission settings
 * @param {string} setBy - ID of user setting permissions (must be super_admin)
 * @returns {Promise<object>} - Result
 */
export const setUserMenuPermissions = async (userId, menuCode, permissions, setBy) => {
    try {
        // Verify setter is super admin
        const { data: setter } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', setBy)
            .single();

        if (!setter || setter.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can set permissions');
        }

        // Upsert permission
        const { error } = await supabase
            .from('user_menu_permissions')
            .upsert({
                user_id: userId,
                menu_code: menuCode,
                can_access: permissions.can_access ?? false,
                can_view: permissions.can_view ?? false,
                can_create: permissions.can_create ?? false,
                can_edit: permissions.can_edit ?? false,
                can_delete: permissions.can_delete ?? false,
                can_approve: permissions.can_approve ?? false,
                requires_approval_for_edit: permissions.requires_approval_for_edit ?? false,
                requires_approval_for_delete: permissions.requires_approval_for_delete ?? false,
                set_by: setBy
            }, {
                onConflict: 'user_id,menu_code'
            });

        if (error) throw error;

        return { success: true, message: 'Permissions updated successfully' };

    } catch (error) {
        console.error('Error setting permissions:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Set multiple menu permissions for a user at once
 * @param {string} userId - User ID
 * @param {array} permissionsArray - Array of {menu_code, permissions} objects
 * @param {string} setBy - ID of user setting permissions (must be super_admin)
 * @returns {Promise<object>} - Result
 */
export const setUserPermissions = async (userId, permissionsArray, setBy) => {
    try {
        // Verify setter is super admin
        const { data: setter } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', setBy)
            .single();

        if (!setter || setter.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can set permissions');
        }

        // Prepare bulk upsert
        const records = permissionsArray.map(item => ({
            user_id: userId,
            menu_code: item.menu_code,
            can_access: item.permissions.can_access ?? false,
            can_view: item.permissions.can_view ?? false,
            can_create: item.permissions.can_create ?? false,
            can_edit: item.permissions.can_edit ?? false,
            can_delete: item.permissions.can_delete ?? false,
            can_approve: item.permissions.can_approve ?? false,
            requires_approval_for_edit: item.permissions.requires_approval_for_edit ?? false,
            requires_approval_for_delete: item.permissions.requires_approval_for_delete ?? false,
            set_by: setBy
        }));

        const { error } = await supabase
            .from('user_menu_permissions')
            .upsert(records, {
                onConflict: 'user_id,menu_code'
            });

        if (error) throw error;

        return { success: true, message: 'Permissions updated successfully' };

    } catch (error) {
        console.error('Error setting permissions:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all menus from registry
 * @returns {Promise<array>} - Array of menu items
 */
export const getAllMenus = async () => {
    try {
        const { data: menus, error } = await supabase
            .from('menu_registry')
            .select('*')
            .order('order_index');

        if (error) throw error;

        return { success: true, menus };

    } catch (error) {
        console.error('Error getting menus:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get user's accessible menus with permissions
 * @param {string} userId - User ID
 * @param {string} userLevel - User level
 * @returns {Promise<array>} - Array of accessible menus with permissions
 */
export const getUserAccessibleMenus = async (userId, userLevel) => {
    try {
        // Super admin and admin get all menus
        if (userLevel === 'super_admin' || userLevel === 'admin') {
            const { data: menus } = await supabase
                .from('menu_registry')
                .select('*')
                .order('order_index');

            return menus.map(menu => ({
                ...menu,
                can_access: true,
                can_view: true,
                can_create: true,
                can_edit: true,
                can_delete: true,
                can_approve: true
            }));
        }

        // Get user's accessible menus
        const { data: accessibleMenus } = await supabase
            .from('menu_registry')
            .select(`
        *,
        user_menu_permissions!inner(
          can_access,
          can_view,
          can_create,
          can_edit,
          can_delete,
          can_approve,
          requires_approval_for_edit,
          requires_approval_for_delete
        )
      `)
            .eq('user_menu_permissions.user_id', userId)
            .eq('user_menu_permissions.can_access', true)
            .order('order_index');

        return accessibleMenus || [];

    } catch (error) {
        console.error('Error getting accessible menus:', error);
        return [];
    }
};
