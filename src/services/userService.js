import { supabase } from '../lib/supabase';
import { hashPassword } from './passwordService';

/**
 * User Service
 * Handles CRUD operations for users (Super Admin only)
 */

/**
 * Create a new user
 * @param {object} userData - User data
 * @param {string} createdBy - ID of user creating this user (must be super_admin)
 * @returns {Promise<object>} - Created user or error
 */
export const createUser = async (userData, createdBy) => {
    try {
        // Verify creator is super admin
        const { data: creator } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', createdBy)
            .single();

        if (!creator || creator.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can create users');
        }

        // Hash password
        const passwordHash = await hashPassword(userData.password);

        // Create user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username: userData.username,
                password_hash: passwordHash,
                full_name: userData.full_name,
                email: userData.email || null,
                user_level: userData.user_level,
                portal_access: userData.portal_access ?? true,
                is_active: userData.is_active ?? true,
                requires_password_change: userData.requires_password_change ?? true,
                created_by: createdBy
            })
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Log audit
        await logAudit({
            action_type: 'create_user',
            target_user_id: newUser.id,
            performed_by: createdBy,
            new_value: {
                username: newUser.username,
                user_level: newUser.user_level,
                portal_access: newUser.portal_access
            }
        });

        return { success: true, user: newUser };

    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get all users
 * @param {string} requestedBy - ID of user requesting (must be super_admin)
 * @returns {Promise<array>} - Array of users
 */
export const getAllUsers = async (requestedBy) => {
    try {
        // Verify requester is super admin
        const { data: requester } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', requestedBy)
            .single();

        if (!requester || requester.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can view all users');
        }

        const { data: users, error } = await supabase
            .from('users')
            .select('id, username, full_name, email, user_level, portal_access, is_active, last_login, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, users };

    } catch (error) {
        console.error('Error getting users:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Update user details
 * @param {string} userId - User ID to update
 * @param {object} updates - Updates to apply
 * @param {string} updatedBy - ID of user performing update (must be super_admin)
 * @returns {Promise<object>} - Result
 */
export const updateUser = async (userId, updates, updatedBy) => {
    try {
        // Verify updater is super admin
        const { data: updater } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', updatedBy)
            .single();

        if (!updater || updater.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can update users');
        }

        // Get old values for audit
        const { data: oldUser } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        // Update user
        const { data: updatedUser, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        // Log audit
        await logAudit({
            action_type: 'update_user',
            target_user_id: userId,
            performed_by: updatedBy,
            old_value: oldUser,
            new_value: updatedUser
        });

        return { success: true, user: updatedUser };

    } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reset user password
 * @param {string} userId - User ID
 * @param {string} newPassword - New password
 * @param {string} resetBy - ID of user resetting (super_admin or self)
 * @param {boolean} requireChange - Require password change on next login
 * @returns {Promise<object>} - Result
 */
export const resetPassword = async (userId, newPassword, resetBy, requireChange = true) => {
    try {
        // Verify permission (super_admin can reset anyone, users can reset self)
        if (userId !== resetBy) {
            const { data: resetter } = await supabase
                .from('users')
                .select('user_level')
                .eq('id', resetBy)
                .single();

            if (!resetter || resetter.user_level !== 'super_admin') {
                throw new Error('Only Super Admin can reset other users passwords');
            }
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password
        const { error } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                requires_password_change: requireChange
            })
            .eq('id', userId);

        if (error) throw error;

        // Log audit
        await logAudit({
            action_type: 'reset_password',
            target_user_id: userId,
            performed_by: resetBy
        });

        // Invalidate all sessions for this user
        await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', userId);

        return { success: true, message: 'Password reset successfully' };

    } catch (error) {
        console.error('Error resetting password:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Toggle user active status
 * @param {string} userId - User ID
 * @param {boolean} isActive - New active status
 * @param {string} toggledBy - ID of user toggling (must be super_admin)
 * @returns {Promise<object>} - Result
 */
export const toggleUserActive = async (userId, isActive, toggledBy) => {
    try {
        // Verify toggler is super admin
        const { data: toggler } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', toggledBy)
            .single();

        if (!toggler || toggler.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can enable/disable users');
        }

        // Update status
        const { error } = await supabase
            .from('users')
            .update({ is_active: isActive })
            .eq('id', userId);

        if (error) throw error;

        // Log audit
        await logAudit({
            action_type: isActive ? 'enable_user' : 'disable_user',
            target_user_id: userId,
            performed_by: toggledBy
        });

        // If disabling, invalidate all sessions
        if (!isActive) {
            await supabase
                .from('user_sessions')
                .delete()
                .eq('user_id', userId);
        }

        return { success: true, message: `User ${isActive ? 'enabled' : 'disabled'} successfully` };

    } catch (error) {
        console.error('Error toggling user status:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<object>} - User data
 */
export const getUserById = async (userId) => {
    try {
        const { data: user, error } = await supabase
            .from('users')
            .select('id, username, full_name, email, user_level, portal_access, is_active, last_login, created_at')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return { success: true, user };

    } catch (error) {
        console.error('Error getting user:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Log audit entry
 * @param {object} auditData - Audit data
 * @private
 */
const logAudit = async (auditData) => {
    try {
        await supabase
            .from('user_audit_log')
            .insert(auditData);
    } catch (error) {
        console.error('Error logging audit:', error);
    }
};

/**
 * Get audit log for a user
 * @param {string} targetUserId - User ID to get audit for
 * @param {string} requestedBy - ID of user requesting (must be super_admin)
 * @returns {Promise<array>} - Audit entries
 */
export const getUserAuditLog = async (targetUserId, requestedBy) => {
    try {
        // Verify requester is super admin
        const { data: requester } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', requestedBy)
            .single();

        if (!requester || requester.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can view audit logs');
        }

        const { data: logs, error } = await supabase
            .from('user_audit_log')
            .select('*, performed_by_user:users!performed_by(username, full_name)')
            .eq('target_user_id', targetUserId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return { success: true, logs };

    } catch (error) {
        console.error('Error getting audit log:', error);
        return { success: false, error: error.message };
    }
};
