/**
 * Activity Logger Service
 * Handles logging of all user actions and data modifications
 * Integrates with Supabase for persistent storage
 */

import { supabase } from '../lib/supabase';

/**
 * Log an activity to the database
 * @param {string} module - Module/feature name (e.g., 'Warehouse Inventory')
 * @param {string} action - Action type (add, edit, delete, approve, etc.)
 * @param {string} entityType - Type of entity (e.g., 'warehouse_stock')
 * @param {string} entityId - ID of the entity
 * @param {string} entityName - Human-readable name of entity
 * @param {string} details - Description of what was changed
 * @param {object} metadata - Additional data (before/after values, etc.)
 * @param {object} user - User object with id, email, name
 * @returns {Promise<boolean>} Success status
 */
export const logActivity = async (
    module,
    action,
    entityType,
    entityId,
    entityName,
    details,
    metadata = {},
    user = null
) => {
    try {
        // Get current user if not provided
        let currentUser = user;
        if (!currentUser) {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
                currentUser = {
                    id: authUser.id,
                    email: authUser.email,
                    name: authUser.user_metadata?.name || 'Unknown User'
                };
            }
        }

        // Create log entry
        const logEntry = {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            module: module || 'Unknown',
            action: action || 'unknown',
            entity_type: entityType || 'unknown',
            entity_id: String(entityId),
            entity_name: entityName || 'Unknown',
            user_id: currentUser?.id || null,
            user_email: currentUser?.email || null,
            user_name: currentUser?.name || null,
            details: details || '',
            metadata: metadata || {},
            created_at: new Date().toISOString()
        };

        // Insert into database
        const { error } = await supabase
            .from('activity_logs')
            .insert([logEntry]);

        if (error) {
            console.error('Error logging activity:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Activity logging error:', error);
        return false;
    }
};

/**
 * Fetch activity logs from database
 * @param {object} options - Filter options
 * @param {string} options.module - Filter by module
 * @param {string} options.action - Filter by action
 * @param {string} options.entityType - Filter by entity type
 * @param {number} options.limit - Number of records to fetch (default: 1000)
 * @param {number} options.offset - Pagination offset (default: 0)
 * @returns {Promise<array>} Array of activity logs
 */
export const fetchActivityLogs = async (options = {}) => {
    try {
        const {
            module = null,
            action = null,
            entityType = null,
            userId = null,
            limit = 1000,
            offset = 0,
            startDate = null,
            endDate = null
        } = options;

        let query = supabase
            .from('activity_logs')
            .select('*', { count: 'exact' });

        // Apply filters
        if (module) {
            query = query.eq('module', module);
        }
        if (action) {
            query = query.eq('action', action);
        }
        if (entityType) {
            query = query.eq('entity_type', entityType);
        }
        if (userId) {
            query = query.eq('user_id', userId);
        }
        if (startDate) {
            query = query.gte('timestamp', new Date(startDate).toISOString());
        }
        if (endDate) {
            query = query.lte('timestamp', new Date(endDate).toISOString());
        }

        // Apply sorting and pagination
        const { data, error, count } = await query
            .order('timestamp', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Error fetching activity logs:', error);
            return [];
        }

        // Transform data for consistency
        return (data || []).map(log => ({
            id: log.id,
            timestamp: log.timestamp,
            module: log.module,
            action: log.action,
            entityType: log.entity_type,
            entityId: log.entity_id,
            entityName: log.entity_name,
            user: log.user_name || log.user_email || 'Unknown',
            userId: log.user_id,
            userEmail: log.user_email,
            details: log.details,
            metadata: log.metadata || {}
        }));
    } catch (error) {
        console.error('Activity logs fetch error:', error);
        return [];
    }
};

/**
 * Get activity statistics
 * @returns {Promise<object>} Statistics object
 */
export const getActivityStats = async () => {
    try {
        // Get counts by action
        const { data: actionStats, error: actionError } = await supabase
            .from('activity_logs')
            .select('action')
            .then(result => {
                if (result.error) return { data: null, error: result.error };
                
                const stats = {};
                (result.data || []).forEach(log => {
                    stats[log.action] = (stats[log.action] || 0) + 1;
                });
                return { data: stats, error: null };
            });

        // Get counts by module
        const { data: moduleStats, error: moduleError } = await supabase
            .from('activity_logs')
            .select('module')
            .then(result => {
                if (result.error) return { data: null, error: result.error };
                
                const stats = {};
                (result.data || []).forEach(log => {
                    stats[log.module] = (stats[log.module] || 0) + 1;
                });
                return { data: stats, error: null };
            });

        // Get total count
        const { count: totalCount } = await supabase
            .from('activity_logs')
            .select('*', { count: 'exact', head: true });

        return {
            total: totalCount || 0,
            byAction: actionStats || {},
            byModule: moduleStats || {}
        };
    } catch (error) {
        console.error('Activity stats error:', error);
        return { total: 0, byAction: {}, byModule: {} };
    }
};

/**
 * Clean up old activity logs (retention policy)
 * @param {number} daysToKeep - Number of days to keep logs (default: 90)
 * @returns {Promise<boolean>} Success status
 */
export const cleanupOldActivityLogs = async (daysToKeep = 90) => {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const { error } = await supabase
            .from('activity_logs')
            .delete()
            .lt('created_at', cutoffDate.toISOString());

        if (error) {
            console.error('Error cleaning up activity logs:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Activity logs cleanup error:', error);
        return false;
    }
};

export default {
    logActivity,
    fetchActivityLogs,
    getActivityStats,
    cleanupOldActivityLogs
};
