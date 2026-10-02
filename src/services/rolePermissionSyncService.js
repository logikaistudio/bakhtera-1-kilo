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

const normalizeRoleId = (value) => String(value || '').trim();
const normalizeMenuCode = (value) => String(value || '').trim();

export const DEFAULT_ROLE_OPTIONS = [
    { id: 'direksi', label: 'Direksi' },
    { id: 'chief', label: 'Chief' },
    { id: 'manager', label: 'Manager' },
    { id: 'staff', label: 'Staff' },
    { id: 'viewer', label: 'Viewer' },
];

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

export const buildRoleOptionsFromPermissionRows = ({
    rows = [],
    includeSuperAdmin = false,
    includeDefaults = true,
}) => {
    const defaultOrder = ['direksi', 'chief', 'manager', 'staff', 'viewer'];
    const roleMap = new Map();

    if (includeDefaults) {
        DEFAULT_ROLE_OPTIONS.forEach((role) => roleMap.set(role.id, role.label));
    }

    if (includeSuperAdmin) {
        roleMap.set('super_admin', 'Super Admin');
    }

    (rows || []).forEach((row) => {
        const roleId = normalizeRoleId(row?.role_id);
        if (!roleId) return;
        const label = row.role_label?.trim() || DEFAULT_ROLE_LABELS[roleId] || normalizeRoleLabel(roleId);
        roleMap.set(roleId, label);
    });

    const roles = Array.from(roleMap, ([id, label]) => ({ id, label }));

    return roles.sort((a, b) => {
        if (a.id === 'super_admin') return -1;
        if (b.id === 'super_admin') return 1;

        const aIdx = defaultOrder.indexOf(a.id);
        const bIdx = defaultOrder.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return a.label.localeCompare(b.label);
    });
};

/**
 * Sync role_permissions with menu source-of-truth from menuConfig.
 * - Inserts missing role x menu rows with all permissions false.
 * - Optionally prunes stale rows for menu codes that no longer exist in menuConfig.
 */
export const syncRolePermissionsWithMenus = async ({ pruneStale = true } = {}) => {
    const now = new Date().toISOString();
    const allMenus = getAllMenus();
    // Some menu codes intentionally appear in multiple module groups (e.g. Blink + Finance).
    // Deduplicate here so role_permissions sync does not generate duplicate insert rows.
    const validMenuCodes = Array.from(new Set(allMenus.map((menu) => menu.code)));
    const validMenuCodeSet = new Set(validMenuCodes);

    const { data: existingRows, error: existingError } = await supabase
        .from('role_permissions')
        .select('role_id, role_label, menu_code');

    if (existingError) {
        throw existingError;
    }

    const roleLabelMap = new Map(Object.entries(DEFAULT_ROLE_LABELS));

    (existingRows || []).forEach((row) => {
        const roleId = normalizeRoleId(row?.role_id);
        if (!roleId || EXCLUDED_AUTO_ROLES.has(roleId)) return;
        const fallbackLabel = DEFAULT_ROLE_LABELS[roleId] || normalizeRoleLabel(roleId);
        const nextLabel = row.role_label?.trim() || fallbackLabel;
        if (!roleLabelMap.has(roleId)) {
            roleLabelMap.set(roleId, nextLabel);
        }
    });

    // Include roles already used by users so role assignment and role permissions stay aligned.
    const { data: userRoles } = await supabase
        .from('users')
        .select('user_level')
        .not('user_level', 'is', null);

    (userRoles || []).forEach((row) => {
        const roleId = normalizeRoleId(row?.user_level);
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
        (existingRows || [])
            .map((row) => `${normalizeRoleId(row?.role_id)}::${normalizeMenuCode(row?.menu_code)}`)
            .filter((key) => !key.startsWith('::') && !key.endsWith('::'))
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
            .upsert(chunk, {
                onConflict: 'role_id,menu_code',
                ignoreDuplicates: true,
            });

        if (error) {
            throw error;
        }
        insertedCount += chunk.length;
    }

    const staleMenuCodes = pruneStale
        ? Array.from(
            new Set(
                (existingRows || [])
                    .map((row) => normalizeMenuCode(row?.menu_code))
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
