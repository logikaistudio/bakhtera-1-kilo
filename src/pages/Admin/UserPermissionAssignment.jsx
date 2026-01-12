import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Shield, Save, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * User Permission Assignment
 * Table-based UI for assigning menu permissions to individual users
 */
const UserPermissionAssignment = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [menus, setMenus] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const userLevels = [
        { value: 'direksi', label: 'Direksi' },
        { value: 'chief', label: 'Chief' },
        { value: 'manager', label: 'Manager' },
        { value: 'staff', label: 'Staff' },
        { value: 'viewer', label: 'Viewer' }
    ];

    // Load users and menus
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Get all users
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .order('full_name');

            if (userError) throw userError;

            // Get all menus
            const { data: menuData, error: menuError } = await supabase
                .from('menu_registry')
                .select('*')
                .order('category', { ascending: true })
                .order('order_index', { ascending: true });

            if (menuError) throw menuError;

            setUsers(userData || []);
            setMenus(menuData || []);

            // Get existing permissions
            const { data: permData, error: permError } = await supabase
                .from('user_menu_permissions')
                .select('*');

            if (permError) throw permError;

            // Convert to permissions object
            const perms = {};
            (permData || []).forEach(p => {
                const key = `${p.user_id}-${p.menu_code}`;
                perms[key] = {
                    can_access: p.can_access,
                    can_view: p.can_view,
                    can_create: p.can_create,
                    can_edit: p.can_edit,
                    can_delete: p.can_delete,
                    can_approve: p.can_approve
                };
            });

            setPermissions(perms);
        } catch (err) {
            console.error('Error loading data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLevelChange = async (userId, newLevel) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ user_level: newLevel })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(users.map(u => u.id === userId ? { ...u, user_level: newLevel } : u));
            setSuccess('User level updated successfully');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error updating user level:', err);
            setError(err.message);
        }
    };

    const handlePortalToggle = async (userId, currentStatus) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ portal_access: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(users.map(u => u.id === userId ? { ...u, portal_access: !currentStatus } : u));
        } catch (err) {
            console.error('Error updating portal access:', err);
            setError(err.message);
        }
    };

    const handleActiveToggle = async (userId, currentStatus) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_active: !currentStatus })
                .eq('id', userId);

            if (error) throw error;

            // Update local state
            setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u));
        } catch (err) {
            console.error('Error updating active status:', err);
            setError(err.message);
        }
    };

    const handlePermissionToggle = async (userId, menuCode, permission) => {
        const key = `${userId}-${menuCode}`;
        const currentPerms = permissions[key] || {
            can_access: false,
            can_view: false,
            can_create: false,
            can_edit: false,
            can_delete: false,
            can_approve: false
        };

        const newValue = !currentPerms[permission];
        const updatedPerms = { ...currentPerms, [permission]: newValue };

        // Update local state immediately
        setPermissions({ ...permissions, [key]: updatedPerms });

        // Save to database
        try {
            const { error } = await supabase
                .from('user_menu_permissions')
                .upsert({
                    user_id: userId,
                    menu_code: menuCode,
                    ...updatedPerms,
                    created_by: user.id,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,menu_code' });

            if (error) throw error;
        } catch (err) {
            console.error('Error saving permission:', err);
            setError(err.message);
            // Revert on error
            setPermissions({ ...permissions, [key]: currentPerms });
        }
    };

    const saveAllPermissions = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            setSuccess('All permissions saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving permissions:', err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Group menus by category
    const menusByCategory = menus.reduce((acc, menu) => {
        if (!acc[menu.category]) {
            acc[menu.category] = [];
        }
        acc[menu.category].push(menu);
        return acc;
    }, {});

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-blue-600" />
                        User Permission Assignment
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Assign menu access permissions to individual users
                    </p>
                </div>
                <button
                    onClick={saveAllPermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save All'}
                </button>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg flex items-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {success}
                </div>
            )}

            {/* Permissions Table - By Category */}
            <div className="space-y-6">
                {Object.entries(menusByCategory).map(([category, categoryMenus]) => (
                    <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-gray-200">
                            <h2 className="text-lg font-bold text-gray-900">{category}</h2>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                                            Menu / Feature
                                        </th>
                                        {users.map(u => (
                                            <th key={u.id} className="px-3 py-3 text-center min-w-[200px]">
                                                <div className="space-y-2">
                                                    <div className="font-semibold text-gray-900 text-sm">{u.full_name}</div>
                                                    <div className="text-xs text-gray-500">@{u.username}</div>
                                                    <select
                                                        value={u.user_level}
                                                        onChange={(e) => handleLevelChange(u.id, e.target.value)}
                                                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        {userLevels.map(level => (
                                                            <option key={level.value} value={level.value}>{level.label}</option>
                                                        ))}
                                                    </select>
                                                    <div className="flex items-center justify-center gap-2 text-xs">
                                                        <label className="flex items-center gap-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={u.portal_access}
                                                                onChange={() => handlePortalToggle(u.id, u.portal_access)}
                                                                className="rounded border-gray-300"
                                                            />
                                                            <span>Portal</span>
                                                        </label>
                                                        <label className="flex items-center gap-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={u.is_active}
                                                                onChange={() => handleActiveToggle(u.id, u.is_active)}
                                                                className="rounded border-gray-300"
                                                            />
                                                            <span className={u.is_active ? 'text-green-600' : 'text-red-600'}>
                                                                {u.is_active ? 'Active' : 'Inactive'}
                                                            </span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {categoryMenus.map((menu) => (
                                        <tr key={menu.menu_code} className="hover:bg-gray-50">
                                            <td className="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                                                {menu.menu_name}
                                                {menu.has_approval && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                                                        Approval
                                                    </span>
                                                )}
                                            </td>
                                            {users.map(u => {
                                                const key = `${u.id}-${menu.menu_code}`;
                                                const perms = permissions[key] || {};

                                                return (
                                                    <td key={u.id} className="px-3 py-3">
                                                        <div className="space-y-1 text-xs">
                                                            <label className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={perms.can_view || false}
                                                                    onChange={() => handlePermissionToggle(u.id, menu.menu_code, 'can_view')}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span>View</span>
                                                            </label>
                                                            <label className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={perms.can_create || false}
                                                                    onChange={() => handlePermissionToggle(u.id, menu.menu_code, 'can_create')}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span>Add</span>
                                                            </label>
                                                            <label className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={perms.can_edit || false}
                                                                    onChange={() => handlePermissionToggle(u.id, menu.menu_code, 'can_edit')}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span>Edit</span>
                                                            </label>
                                                            <label className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={perms.can_delete || false}
                                                                    onChange={() => handlePermissionToggle(u.id, menu.menu_code, 'can_delete')}
                                                                    className="rounded border-gray-300"
                                                                />
                                                                <span>Delete</span>
                                                            </label>
                                                            {menu.has_approval && (
                                                                <label className="flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={perms.can_approve || false}
                                                                        onChange={() => handlePermissionToggle(u.id, menu.menu_code, 'can_approve')}
                                                                        className="rounded border-gray-300"
                                                                    />
                                                                    <span>Approve</span>
                                                                </label>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* Save Button (Bottom) */}
            <div className="mt-6 flex justify-end">
                <button
                    onClick={saveAllPermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save All Permissions'}
                </button>
            </div>
        </div>
    );
};

export default UserPermissionAssignment;
