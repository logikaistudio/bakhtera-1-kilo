import { supabase } from '../lib/supabase';
import { hashPassword, verifyPassword, validatePasswordStrength, generatePassword } from './passwordService';

/**
 * User Service
 * Handles CRUD operations for users (Super Admin only)
 */

const DEFAULT_FALLBACK_ROLE_IDS = ['super_admin', 'direksi', 'chief', 'manager', 'staff', 'viewer'];

const getAllowedRoleIds = async () => {
    try {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('role_id');

        if (error) {
            return new Set(DEFAULT_FALLBACK_ROLE_IDS);
        }

        const roles = new Set(DEFAULT_FALLBACK_ROLE_IDS);
        (data || []).forEach(r => {
            if (r?.role_id) roles.add(r.role_id);
        });

        return roles;
    } catch {
        return new Set(DEFAULT_FALLBACK_ROLE_IDS);
    }
};

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

        // Validate role exists in role manager source of truth
        const allowedRoleIds = await getAllowedRoleIds();
        if (!allowedRoleIds.has(userData.user_level)) {
            throw new Error('Role tidak valid atau belum tersinkron dari Manajemen Role & Akses');
        }

        // Validate password strength before hashing
        const strength = validatePasswordStrength(userData.password);
        if (!strength.valid) {
            throw new Error(strength.errors[0]);
        }

        // Hash password
        const passwordHash = await hashPassword(userData.password);

        // Create user
        const { data: newUser, error } = await supabase
            .from('users')
            .insert({
                username: userData.username,
                password_hash: passwordHash,
                password_plain: userData.password,
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
            .select('id, username, full_name, email, user_level, portal_access, is_active, last_login, created_at, password_plain')
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

        if (updates.user_level) {
            const allowedRoleIds = await getAllowedRoleIds();
            if (!allowedRoleIds.has(updates.user_level)) {
                throw new Error('Role tidak valid atau belum tersinkron dari Manajemen Role & Akses');
            }
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

        const strength = validatePasswordStrength(newPassword);
        if (!strength.valid) {
            throw new Error(strength.errors[0]);
        }

        // Hash new password
        const passwordHash = await hashPassword(newPassword);

        // Update password
        const { error } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                password_plain: newPassword,
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
 * Delete user permanently
 * @param {string} userId - User ID to delete
 * @param {string} deletedBy - ID of user performing delete (must be super_admin)
 * @returns {Promise<object>} - Result
 */
export const deleteUser = async (userId, deletedBy) => {
    try {
        // Cannot delete self
        if (userId === deletedBy) {
            throw new Error('Tidak bisa menghapus akun sendiri');
        }

        // Verify deleter is super admin
        const { data: deleter } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', deletedBy)
            .single();

        if (!deleter || deleter.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can delete users');
        }

        // Get user info before deletion
        const { data: targetUser } = await supabase
            .from('users')
            .select('username, full_name, user_level')
            .eq('id', userId)
            .single();

        // 1) Delete audit log entries referencing this user (FK constraint)
        await supabase
            .from('user_audit_log')
            .delete()
            .eq('target_user_id', userId);

        // Also clean up audit entries where this user performed actions
        await supabase
            .from('user_audit_log')
            .delete()
            .eq('performed_by', userId);

        // 2) Delete all sessions
        await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', userId);

        // 3) Delete user menu permissions
        await supabase
            .from('user_menu_permissions')
            .delete()
            .eq('user_id', userId);

        // 4) Delete user
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        // Log deletion by the admin (target_user_id = deletedBy since user no longer exists)
        await logAudit({
            action_type: 'delete_user',
            target_user_id: deletedBy,
            performed_by: deletedBy,
            old_value: { deleted_user: targetUser }
        });

        return { success: true, message: `User "${targetUser?.username}" berhasil dihapus` };

    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Change own password (self-service)
 * Verifies old password before allowing change
 * @param {string} userId - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<object>} - Result
 */
export const changePassword = async (userId, oldPassword, newPassword) => {
    try {
        // Get current password hash
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('id, username, password_hash')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            throw new Error('User tidak ditemukan');
        }

        // Verify old password
        const isValid = await verifyPassword(oldPassword, user.password_hash);
        if (!isValid) {
            throw new Error('Password lama salah');
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            throw new Error('Password baru minimal 8 karakter');
        }
        if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
            throw new Error('Password baru harus mengandung huruf dan angka');
        }
        if (oldPassword === newPassword) {
            throw new Error('Password baru tidak boleh sama dengan password lama');
        }

        // Hash new password
        const newHash = await hashPassword(newPassword);

        // Update
        const { error: updateError } = await supabase
            .from('users')
            .update({
                password_hash: newHash,
                password_plain: newPassword,
                requires_password_change: false
            })
            .eq('id', userId);

        if (updateError) throw updateError;

        // Log audit
        await logAudit({
            action_type: 'change_password',
            target_user_id: userId,
            performed_by: userId
        });

        return { success: true, message: 'Password berhasil diubah!' };

    } catch (error) {
        console.error('Error changing password:', error);
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
            .select('id, username, full_name, email, user_level, portal_access, is_active, last_login, created_at, password_plain')
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
 * Self-service forgot password reset (no email server flow).
 * User verifies identity with username + full name, then receives a generated password.
 * @param {string} username - Username
 * @param {string} fullName - Full name
 * @returns {Promise<object>} - Result with generated password on success
 */
export const forgotPasswordSelfService = async (username, fullName) => {
    try {
        const normalizedUsername = (username || '').trim();
        const normalizedFullName = (fullName || '').trim();

        if (!normalizedUsername || !normalizedFullName) {
            throw new Error('Username dan nama lengkap wajib diisi');
        }

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, username, full_name, is_active, portal_access')
            .eq('username', normalizedUsername)
            .single();

        if (userError || !user) {
            throw new Error('Data verifikasi tidak valid');
        }

        const fullNameMatch = (user.full_name || '').trim().toLowerCase() === normalizedFullName.toLowerCase();
        if (!fullNameMatch) {
            throw new Error('Data verifikasi tidak valid');
        }

        if (!user.is_active || !user.portal_access) {
            throw new Error('Akun tidak aktif atau tidak memiliki akses portal');
        }

        const generatedPassword = generatePassword(12);
        const passwordHash = await hashPassword(generatedPassword);

        const { error: updateError } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                password_plain: generatedPassword,
                requires_password_change: true
            })
            .eq('id', user.id);

        if (updateError) throw updateError;

        await supabase
            .from('user_sessions')
            .delete()
            .eq('user_id', user.id);

        await logAudit({
            action_type: 'forgot_password_self_service',
            target_user_id: user.id,
            performed_by: user.id,
            new_value: {
                reset_channel: 'self_service_no_email'
            }
        });

        return {
            success: true,
            generatedPassword,
            message: 'Password baru berhasil dibuat. Catat password ini, lalu login dan segera ganti password Anda.'
        };
    } catch (error) {
        console.error('Error forgot password self service:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Bulk reset legacy users that do not yet have password_plain value.
 * Intended for one-time migration so superadmin can see active passwords.
 * @param {string} requestedBy - Super admin user ID
 * @returns {Promise<object>} - Result with reset details
 */
export const bulkResetLegacyPasswords = async (requestedBy) => {
    try {
        const { data: requester } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', requestedBy)
            .single();

        if (!requester || requester.user_level !== 'super_admin') {
            throw new Error('Only Super Admin can perform bulk password reset');
        }

        const { data: allUsers, error: usersError } = await supabase
            .from('users')
            .select('id, username, full_name, is_active, portal_access, password_plain');

        if (usersError) throw usersError;

        const targetUsers = (allUsers || []).filter(u => !u.password_plain);
        if (targetUsers.length === 0) {
            return {
                success: true,
                message: 'Tidak ada user legacy yang perlu direset.',
                totalReset: 0,
                resetList: []
            };
        }

        const resetList = [];

        for (const target of targetUsers) {
            const generatedPassword = generatePassword(12);
            const passwordHash = await hashPassword(generatedPassword);

            const { error: updateError } = await supabase
                .from('users')
                .update({
                    password_hash: passwordHash,
                    password_plain: generatedPassword,
                    requires_password_change: true
                })
                .eq('id', target.id);

            if (updateError) {
                console.error('Bulk reset update error for user:', target.username, updateError);
                continue;
            }

            await supabase
                .from('user_sessions')
                .delete()
                .eq('user_id', target.id);

            await logAudit({
                action_type: 'bulk_reset_legacy_password',
                target_user_id: target.id,
                performed_by: requestedBy,
                new_value: {
                    reason: 'legacy_password_plain_backfill'
                }
            });

            resetList.push({
                username: target.username,
                full_name: target.full_name,
                password: generatedPassword,
                status: target.is_active && target.portal_access ? 'Aktif' : 'Perlu Aktivasi'
            });
        }

        return {
            success: true,
            message: `Berhasil reset ${resetList.length} user legacy.`,
            totalReset: resetList.length,
            resetList
        };
    } catch (error) {
        console.error('Error bulk resetting legacy passwords:', error);
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
