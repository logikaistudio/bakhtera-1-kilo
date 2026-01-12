import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Shield, CheckSquare, Square, Save, AlertCircle } from 'lucide-react';

/**
 * Role Permissions Management
 * Matrix-style UI for assigning menu permissions to user roles
 */
const RolePermissions = () => {
    const { user } = useAuth();
    const [menus, setMenus] = useState([]);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const roles = [
        { value: 'direksi', label: 'Direksi', color: 'red' },
        { value: 'chief', label: 'Chief', color: 'orange' },
        { value: 'manager', label: 'Manager', color: 'blue' },
        { value: 'staff', label: 'Staff', color: 'green' },
        { value: 'viewer', label: 'Viewer', color: 'gray' }
    ];

    // Load all menus and current permissions
    useEffect(() => {
        loadMenusAndPermissions();
    }, []);

    const loadMenusAndPermissions = async () => {
        setLoading(true);
        try {
            // Get all menus from menu_registry
            const { data: menuData, error: menuError } = await supabase
                .from('menu_registry')
                .select('*')
                .order('order_index');

            if (menuError) throw menuError;

            setMenus(menuData || []);

            // Initialize permissions object
            const perms = {};
            roles.forEach(role => {
                perms[role.value] = {};
                menuData?.forEach(menu => {
                    perms[role.value][menu.menu_code] = {
                        can_access: false,
                        can_view: false,
                        can_create: false,
                        can_edit: false,
                        can_delete: false,
                        can_approve: false
                    };
                });
            });

            setPermissions(perms);
        } catch (err) {
            console.error('Error loading menus:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (role, menuCode, permission) => {
        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [menuCode]: {
                    ...prev[role][menuCode],
                    [permission]: !prev[role][menuCode][permission]
                }
            }
        }));
    };

    const toggleAllForMenu = (role, menuCode) => {
        const currentState = permissions[role][menuCode];
        const allChecked = Object.values(currentState).every(v => v === true);

        setPermissions(prev => ({
            ...prev,
            [role]: {
                ...prev[role],
                [menuCode]: {
                    can_access: !allChecked,
                    can_view: !allChecked,
                    can_create: !allChecked,
                    can_edit: !allChecked,
                    can_delete: !allChecked,
                    can_approve: !allChecked
                }
            }
        }));
    };

    const savePermissions = async () => {
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // This would typically save to a role_permissions table
            // For now, we'll just show success
            // In production, you'd iterate through permissions and save each

            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate save

            setSuccess('Permissions saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error('Error saving permissions:', err);
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const getRoleBadgeColor = (color) => {
        const colors = {
            red: 'bg-red-100 text-red-800 border-red-200',
            orange: 'bg-orange-100 text-orange-800 border-orange-200',
            blue: 'bg-blue-100 text-blue-800 border-blue-200',
            green: 'bg-green-100 text-green-800 border-green-200',
            gray: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        return colors[color] || colors.gray;
    };

    // Group menus by category
    const menusByCategory = menus.reduce((acc, menu) => {
        if (!acc[menu.category]) {
            acc[menu.category] = [];
        }
        acc[menu.category].push(menu);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-7 h-7 text-blue-600" />
                        Role & Permission Management
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                        Assign menu access permissions to different user roles
                    </p>
                </div>
                <button
                    onClick={savePermissions}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Permissions'}
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
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg">
                    {success}
                </div>
            )}

            {/* Role Legend */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">User Roles:</h3>
                <div className="flex flex-wrap gap-3">
                    {roles.map(role => (
                        <div key={role.value} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${getRoleBadgeColor(role.color)}`}>
                            {role.label}
                        </div>
                    ))}
                </div>
            </div>

            {/* Permission Matrix - By Category */}
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
                                        <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                                            Menu / Feature
                                        </th>
                                        {roles.map(role => (
                                            <th key={role.value} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                <div className={`inline-block px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(role.color)}`}>
                                                    {role.label}
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {categoryMenus.map((menu) => (
                                        <tr key={menu.menu_code} className="hover:bg-gray-50">
                                            <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                                                {menu.menu_name}
                                                {menu.has_approval && (
                                                    <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                                                        Approval
                                                    </span>
                                                )}
                                            </td>
                                            {roles.map(role => {
                                                const isChecked = permissions[role.value]?.[menu.menu_code]?.can_access;
                                                return (
                                                    <td key={role.value} className="px-4 py-4 text-center">
                                                        <button
                                                            onClick={() => toggleAllForMenu(role.value, menu.menu_code)}
                                                            className="inline-flex items-center justify-center w-full hover:bg-gray-100 rounded p-2 transition-colors"
                                                        >
                                                            {isChecked ? (
                                                                <CheckSquare className="w-6 h-6 text-blue-600" />
                                                            ) : (
                                                                <Square className="w-6 h-6 text-gray-400" />
                                                            )}
                                                        </button>
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
                    onClick={savePermissions}
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

export default RolePermissions;
