import { supabase } from '../lib/supabase';

/**
 * Approval Service
 * Handles approval workflow for edit/delete operations
 */

/**
 * Create a pending change request
 * @param {object} changeData - Change request data
 * @returns {Promise<object>} - Created pending change
 */
export const createPendingChange = async (changeData) => {
    try {
        const { data: pendingChange, error } = await supabase
            .from('pending_changes')
            .insert({
                menu_code: changeData.menu_code,
                record_id: changeData.record_id,
                table_name: changeData.table_name,
                action_type: changeData.action_type, // 'edit' or 'delete'
                old_data: changeData.old_data,
                new_data: changeData.new_data,
                requested_by: changeData.requested_by
            })
            .select()
            .single();

        if (error) throw error;

        return { success: true, pendingChange };

    } catch (error) {
        console.error('Error creating pending change:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get pending changes for a specific approver
 * @param {string} approverId - User ID who can approve
 * @param {string} menuCode - Optional filter by menu
 * @returns {Promise<array>} - Array of pending changes
 */
export const getPendingChangesForApprover = async (approverId, menuCode = null) => {
    try {
        // Get user's approvable menus
        const { data: userData } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', approverId)
            .single();

        if (!userData) {
            throw new Error('User not found');
        }

        let query = supabase
            .from('pending_changes')
            .select(`
        *,
        requester:users!requested_by(username, full_name)
      `)
            .eq('status', 'pending')
            .order('requested_at', { ascending: false });

        // Super admin and admin can approve all
        if (userData.user_level !== 'super_admin' && userData.user_level !== 'admin') {
            // Get menus where user can approve
            const { data: approvableMenus } = await supabase
                .from('user_menu_permissions')
                .select('menu_code')
                .eq('user_id', approverId)
                .eq('can_approve', true);

            if (!approvableMenus || approvableMenus.length === 0) {
                return { success: true, pendingChanges: [] };
            }

            const menuCodes = approvableMenus.map(m => m.menu_code);
            query = query.in('menu_code', menuCodes);
        }

        // Filter by specific menu if provided
        if (menuCode) {
            query = query.eq('menu_code', menuCode);
        }

        const { data: pendingChanges, error } = await query;

        if (error) throw error;

        return { success: true, pendingChanges: pendingChanges || [] };

    } catch (error) {
        console.error('Error getting pending changes:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get pending changes count for approver
 * @param {string} approverId - User ID who can approve
 * @returns {Promise<number>} - Count of pending changes
 */
export const getPendingChangesCount = async (approverId) => {
    try {
        const result = await getPendingChangesForApprover(approverId);
        return result.success ? result.pendingChanges.length : 0;
    } catch (error) {
        console.error('Error getting pending changes count:', error);
        return 0;
    }
};

/**
 * Get user's own pending requests
 * @param {string} userId - User ID
 * @returns {Promise<array>} - Array of user's pending requests
 */
export const getUserPendingRequests = async (userId) => {
    try {
        const { data: pendingRequests, error } = await supabase
            .from('pending_changes')
            .select(`
        *,
        approver:users!approved_by(username, full_name)
      `)
            .eq('requested_by', userId)
            .order('requested_at', { ascending: false });

        if (error) throw error;

        return { success: true, pendingRequests: pendingRequests || [] };

    } catch (error) {
        console.error('Error getting user pending requests:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Approve a pending change
 * @param {string} pendingChangeId - Pending change ID
 * @param {string} approverId - User approving
 * @param {string} notes - Optional approval notes
 * @returns {Promise<object>} - Result
 */
export const approvePendingChange = async (pendingChangeId, approverId, notes = null) => {
    try {
        // Get pending change
        const { data: pendingChange } = await supabase
            .from('pending_changes')
            .select('*')
            .eq('id', pendingChangeId)
            .single();

        if (!pendingChange) {
            throw new Error('Pending change not found');
        }

        if (pendingChange.status !== 'pending') {
            throw new Error('This change has already been processed');
        }

        // Check if approver has permission
        const { data: approver } = await supabase
            .from('users')
            .select('user_level')
            .eq('id', approverId)
            .single();

        if (!approver) {
            throw new Error('Approver not found');
        }

        // Verify approver has approve permission for this menu
        if (approver.user_level !== 'super_admin' && approver.user_level !== 'admin') {
            const { data: permission } = await supabase
                .from('user_menu_permissions')
                .select('can_approve')
                .eq('user_id', approverId)
                .eq('menu_code', pendingChange.menu_code)
                .single();

            if (!permission || !permission.can_approve) {
                throw new Error('You do not have permission to approve this change');
            }
        }

        // Update pending change status
        const { error: updateError } = await supabase
            .from('pending_changes')
            .update({
                status: 'approved',
                approved_by: approverId,
                approved_at: new Date().toISOString(),
                approval_notes: notes
            })
            .eq('id', pendingChangeId);

        if (updateError) throw updateError;

        // Apply the change to actual table
        await applyChange(pendingChange);

        return { success: true, message: 'Change approved and applied successfully' };

    } catch (error) {
        console.error('Error approving change:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Reject a pending change
 * @param {string} pendingChangeId - Pending change ID
 * @param {string} approverId - User rejecting
 * @param {string} notes - Rejection reason
 * @returns {Promise<object>} - Result
 */
export const rejectPendingChange = async (pendingChangeId, approverId, notes) => {
    try {
        // Get pending change
        const { data: pendingChange } = await supabase
            .from('pending_changes')
            .select('*')
            .eq('id', pendingChangeId)
            .single();

        if (!pendingChange) {
            throw new Error('Pending change not found');
        }

        if (pendingChange.status !== 'pending') {
            throw new Error('This change has already been processed');
        }

        // Update pending change status
        const { error: updateError } = await supabase
            .from('pending_changes')
            .update({
                status: 'rejected',
                approved_by: approverId,
                approved_at: new Date().toISOString(),
                approval_notes: notes
            })
            .eq('id', pendingChangeId);

        if (updateError) throw updateError;

        return { success: true, message: 'Change rejected successfully' };

    } catch (error) {
        console.error('Error rejecting change:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Apply approved change to actual table
 * @param {object} pendingChange - Pending change object
 * @private
 */
const applyChange = async (pendingChange) => {
    try {
        const { table_name, record_id, action_type, new_data } = pendingChange;

        if (action_type === 'delete') {
            // Delete record
            const { error } = await supabase
                .from(table_name)
                .delete()
                .eq('id', record_id);

            if (error) throw error;

        } else if (action_type === 'edit') {
            // Update record
            const { error } = await supabase
                .from(table_name)
                .update(new_data)
                .eq('id', record_id);

            if (error) throw error;
        }

        console.log(`Applied ${action_type} to ${table_name}:${record_id}`);

    } catch (error) {
        console.error('Error applying change:', error);
        throw error;
    }
};

/**
 * Cancel a pending request (by requester only)
 * @param {string} pendingChangeId - Pending change ID
 * @param {string} userId - User canceling (must be requester)
 * @returns {Promise<object>} - Result
 */
export const cancelPendingRequest = async (pendingChangeId, userId) => {
    try {
        // Get pending change
        const { data: pendingChange } = await supabase
            .from('pending_changes')
            .select('*')
            .eq('id', pendingChangeId)
            .single();

        if (!pendingChange) {
            throw new Error('Pending change not found');
        }

        if (pendingChange.requested_by !== userId) {
            throw new Error('You can only cancel your own requests');
        }

        if (pendingChange.status !== 'pending') {
            throw new Error('This change has already been processed');
        }

        // Delete pending change
        const { error } = await supabase
            .from('pending_changes')
            .delete()
            .eq('id', pendingChangeId);

        if (error) throw error;

        return { success: true, message: 'Request canceled successfully' };

    } catch (error) {
        console.error('Error canceling request:', error);
        return { success: false, error: error.message };
    }
};
