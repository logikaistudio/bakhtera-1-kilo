import { supabase } from '../lib/supabase';
import { verifyPassword } from './passwordService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Authentication Service
 * Handles user login, logout, session management
 */

const SESSION_DURATION_HOURS = 24;

/**
 * Login user with username and password
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<object>} - User data and session token
 */
export const login = async (username, password) => {
    try {
        // Get user by username
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (userError || !user) {
            throw new Error('Invalid username or password');
        }

        // Check if user is active
        if (!user.is_active) {
            throw new Error('Your account has been disabled. Please contact administrator.');
        }

        // Check portal access
        if (!user.portal_access) {
            throw new Error('You do not have portal access.');
        }

        // Verify password
        const passwordValid = await verifyPassword(password, user.password_hash);
        if (!passwordValid) {
            throw new Error('Invalid username or password');
        }

        // Create session token
        const sessionToken = uuidv4();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + SESSION_DURATION_HOURS);

        // Save session to database
        const { error: sessionError } = await supabase
            .from('user_sessions')
            .insert({
                user_id: user.id,
                token: sessionToken,
                expires_at: expiresAt.toISOString(),
            });

        if (sessionError) {
            console.error('Error creating session:', sessionError);
            throw new Error('Failed to create session');
        }

        // Update last login
        await supabase
            .from('users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // Load user permissions
        const permissions = await getUserPermissions(user.id, user.user_level);

        // Return user data (exclude password hash)
        const { password_hash, ...userData } = user;

        return {
            success: true,
            user: userData,
            sessionToken,
            permissions,
            requiresPasswordChange: user.requires_password_change
        };

    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * Logout user and invalidate session
 * @param {string} sessionToken - Session token to invalidate
 */
export const logout = async (sessionToken) => {
    try {
        if (!sessionToken) return;

        // Delete session from database
        await supabase
            .from('user_sessions')
            .delete()
            .eq('token', sessionToken);

        return { success: true };
    } catch (error) {
        console.error('Logout error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Validate session token
 * @param {string} sessionToken - Session token to validate
 * @returns {Promise<object>} - User data if valid, null otherwise
 */
export const validateSession = async (sessionToken) => {
    try {
        if (!sessionToken) return null;

        // Get session
        const { data: session, error: sessionError } = await supabase
            .from('user_sessions')
            .select('*, users(*)')
            .eq('token', sessionToken)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (sessionError || !session) {
            return null;
        }

        // Check if user is still active
        if (!session.users.is_active || !session.users.portal_access) {
            return null;
        }

        // Load permissions
        const permissions = await getUserPermissions(session.users.id, session.users.user_level);

        const { password_hash, ...userData } = session.users;

        return {
            user: userData,
            permissions
        };

    } catch (error) {
        console.error('Session validation error:', error);
        return null;
    }
};

/**
 * Get user permissions based on user level and menu permissions.
 * Priority: user_menu_permissions (user-specific) overrides role_permissions (role-level).
 * @param {string} userId - User ID
 * @param {string} userLevel - User level / role_id
 * @returns {Promise<object>} - Permissions object
 */
export const getUserPermissions = async (userId, userLevel) => {
    try {
        // Super admin and admin have all permissions
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

        // Step 1: Load role-level permissions from role_permissions table.
        // This is what the Role Manager UI (Admin → Manajemen Role & Akses) configures.
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

        // Step 2: Apply user-specific overrides from user_menu_permissions.
        // These take priority over role-level permissions for the same menu_code.
        const { data: userPermissions } = await supabase
            .from('user_menu_permissions')
            .select('*')
            .eq('user_id', userId);

        userPermissions?.forEach(perm => {
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
 * Cleanup expired sessions
 */
export const cleanupExpiredSessions = async () => {
    try {
        await supabase
            .from('user_sessions')
            .delete()
            .lt('expires_at', new Date().toISOString());
    } catch (error) {
        console.error('Error cleaning up sessions:', error);
    }
};
