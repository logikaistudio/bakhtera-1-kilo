import { supabase } from '../lib/supabase';
import { getAllMenus } from '../config/menuConfig';

const DEFAULT_ROLE_LABELS = {
    direksi: 'Direksi',
    chief: 'Chief',
    manager: 'Manager',
    staff: 'Staff',
    viewer: 'Viewer',
};

const EXCLUDED_AUTO_ROLES = new Set(['super_admin', 'admin']);

const normalizeRoleLabel = (roleId) =>
    roleId
        ?.replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Unknown';

const chunkArray = (items, size = 500) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

/**
 * Sync role_permissions with menu source-of-truth from menuConfig.
 * - Inserts missing role x menu rows with all permissions false.
 * - Optionally prunes stale rows for menu codes that no longer exist in menuConfig.
 */
export const syncRolePermissionsWithMenus = async ({ pruneStale = true } = {}) => {
    const now = new Date().toISOString();
    const allMenus = getAllMenus();
    const validMenuCodes = allMenus.map((menu) => menu.code);
    const validMenuCodeSet = new Set(validMenuCodes);

    const { data: existingRows, error: existingError } = await supabase
        .from('role_permissions')
        .select('role_id, role_label, menu_code');

    if (existingError) {
        throw existingError;
    }

    const roleLabelMap = new Map(Object.entries(DEFAULT_ROLE_LABELS));

    (existingRows || []).forEach((row) => {
        if (!row?.role_id || EXCLUDED_AUTO_ROLES.has(row.role_id)) return;
        const fallbackLabel = DEFAULT_ROLE_LABELS[row.role_id] || normalizeRoleLabel(row.role_id);
        const nextLabel = row.role_label?.trim() || fallbackLabel;
        if (!roleLabelMap.has(row.role_id)) {
            roleLabelMap.set(row.role_id, nextLabel);
        }
    });

    // Include roles already used by users so role assignment and role permissions stay aligned.
    const { data: userRoles } = await supabase
        .from('users')
        .select('user_level')
        .not('user_level', 'is', null);

    (userRoles || []).forEach((row) => {
        const roleId = row?.user_level;
        if (!roleId || EXCLUDED_AUTO_ROLES.has(roleId)) return;
        if (!roleLabelMap.has(roleId)) {
            roleLabelMap.set(roleId, DEFAULT_ROLE_LABELS[roleId] || normalizeRoleLabel(roleId));
        }
    });

    const roles = Array.from(roleLabelMap.entries()).map(([roleId, roleLabel]) => ({
        roleId,
        roleLabel,
    }));

    const existingKeySet = new Set(
        (existingRows || []).map((row) => `${row.role_id}::${row.menu_code}`)
    );

    const missingRows = [];
    roles.forEach(({ roleId, roleLabel }) => {
        validMenuCodes.forEach((menuCode) => {
            const key = `${roleId}::${menuCode}`;
            if (!existingKeySet.has(key)) {
                const isManagement = ['direksi', 'chief', 'manager'].includes(roleId);
                missingRows.push({
                    role_id: roleId,
                    role_label: roleLabel,
                    menu_code: menuCode,
                    can_access: isManagement,
                    can_view: isManagement,
                    can_create: isManagement,
                    can_edit: isManagement,
                    can_delete: roleId === 'direksi',
                    can_approve: isManagement,
                    updated_at: now,
                });
            }
        });
    });

    let insertedCount = 0;
    for (const chunk of chunkArray(missingRows, 500)) {
        const { error } = await supabase
            .from('role_permissions')
            .insert(chunk);

        if (error) {
            throw error;
        }
        insertedCount += chunk.length;
    }

    const staleMenuCodes = pruneStale
        ? Array.from(
            new Set(
                (existingRows || [])
                    .map((row) => row.menu_code)
                    .filter((menuCode) => menuCode && !validMenuCodeSet.has(menuCode))
            )
        )
        : [];

    let deletedCount = 0;
    for (const staleChunk of chunkArray(staleMenuCodes, 100)) {
        const { data: staleRows, error: countError } = await supabase
            .from('role_permissions')
            .select('role_id, menu_code')
            .in('menu_code', staleChunk);

        if (countError) {
            throw countError;
        }

        const { error: deleteError } = await supabase
            .from('role_permissions')
            .delete()
            .in('menu_code', staleChunk);

        if (deleteError) {
            throw deleteError;
        }

        deletedCount += (staleRows || []).length;
    }

    return {
        insertedCount,
        deletedCount,
        staleMenuCodes,
        roleCount: roles.length,
        menuCount: validMenuCodes.length,
    };
};
