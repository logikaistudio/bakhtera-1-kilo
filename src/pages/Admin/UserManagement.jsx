import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getAllUsers, createUser, updateUser, resetPassword, toggleUserActive } from '../../services/userService';
import { generatePassword } from '../../services/passwordService';
import { Users, Plus, Edit, Key, Ban, CheckCircle, Trash2, Shield } from 'lucide-react';

/**
 * User Management Page (Super Admin Only)
 * Manages users, passwords, and roles
 */
const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showPermissionModal, setShowPermissionModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);

    // Fetch all users on mount
    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const result = await getAllUsers(user.id);
        if (result.success) {
            setUsers(result.users);
        }
        setLoading(false);
    };

    const handleCreateUser = () => {
        setShowCreateModal(true);
    };

    const handleEditUser = (userToEdit) => {
        setSelectedUser(userToEdit);
        setShowEditModal(true);
    };

    const handleResetPassword = (userToReset) => {
        setSelectedUser(userToReset);
        setShowPasswordModal(true);
    };

    const handleToggleActive = async (userToToggle) => {
        const newStatus = !userToToggle.is_active;
        const result = await toggleUserActive(userToToggle.id, newStatus, user.id);

        if (result.success) {
            loadUsers();
            alert(`User ${newStatus ? 'enabled' : 'disabled'} successfully`);
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const getUserLevelBadge = (level) => {
        const badges = {
            super_admin: 'bg-red-100 text-red-800',
            admin: 'bg-orange-100 text-orange-800',
            approver: 'bg-blue-100 text-blue-800',
            full_access: 'bg-green-100 text-green-800',
            view_only: 'bg-gray-100 text-gray-800'
        };

        const labels = {
            super_admin: 'Super Admin',
            admin: 'Admin',
            approver: 'Approver',
            full_access: 'Full Access',
            view_only: 'View Only'
        };

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${badges[level]}`}>
                {labels[level]}
            </span>
        );
    };

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
                        User Management
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Manage users, roles, and permissions</p>
                </div>
                <button
                    onClick={handleCreateUser}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Create User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-sm text-gray-600">Total Users</div>
                    <div className="text-2xl font-bold text-gray-900">{users.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
                    <div className="text-sm text-green-600">Active</div>
                    <div className="text-2xl font-bold text-green-700">{users.filter(u => u.is_active).length}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
                    <div className="text-sm text-red-600">Inactive</div>
                    <div className="text-2xl font-bold text-red-700">{users.filter(u => !u.is_active).length}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                    <div className="text-sm text-blue-600">Super Admins</div>
                    <div className="text-2xl font-bold text-blue-700">{users.filter(u => u.user_level === 'super_admin').length}</div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((u) => (
                            <tr key={u.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-gray-400" />
                                        <span className="font-medium text-gray-900">{u.username}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{u.full_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{getUserLevelBadge(u.user_level)}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {u.is_active ? (
                                        <span className="flex items-center gap-1 text-green-600 text-sm">
                                            <CheckCircle className="w-4 h-4" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-600 text-sm">
                                            <Ban className="w-4 h-4" />
                                            Inactive
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEditUser(u)}
                                            className="text-blue-600 hover:text-blue-900"
                                            title="Edit User"
                                        >
                                            <Edit className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleResetPassword(u)}
                                            className="text-green-600 hover:text-green-900"
                                            title="Reset Password"
                                        >
                                            <Key className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(u)}
                                            className={u.is_active ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                                            title={u.is_active ? "Disable User" : "Enable User"}
                                        >
                                            {u.is_active ? <Ban className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {showCreateModal && (
                <CreateUserModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => { loadUsers(); setShowCreateModal(false); }}
                    createdBy={user.id}
                />
            )}

            {showEditModal && selectedUser && (
                <EditUserModal
                    user={selectedUser}
                    onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
                    onSuccess={() => { loadUsers(); setShowEditModal(false); setSelectedUser(null); }}
                    updatedBy={user.id}
                />
            )}

            {showPasswordModal && selectedUser && (
                <ResetPasswordModal
                    user={selectedUser}
                    onClose={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                    onSuccess={() => { setShowPasswordModal(false); setSelectedUser(null); }}
                    resetBy={user.id}
                />
            )}
        </div>
    );
};

/* =============================================================================
 * CREATE USER MODAL
 * ============================================================================= */
const CreateUserModal = ({ onClose, onSuccess, createdBy }) => {
    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        email: '',
        user_level: 'full_access',
        password: '',
        portal_access: true,
        is_active: true,
        requires_password_change: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGeneratePassword = () => {
        const newPassword = generatePassword(12);
        setFormData({ ...formData, password: newPassword });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await createUser(formData, createdBy);

        if (result.success) {
            alert(`User created successfully!\nUsername: ${formData.username}\nPassword: ${formData.password}\n\nPlease save this password securely.`);
            onSuccess();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Create New User</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User Level *</label>
                        <select
                            value={formData.user_level}
                            onChange={(e) => setFormData({ ...formData, user_level: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="view_only">View Only</option>
                            <option value="full_access">Full Access</option>
                            <option value="approver">Approver</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Min 8 chars, letters & numbers"
                                required
                            />
                            <button
                                type="button"
                                onClick={handleGeneratePassword}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters with letters and numbers</p>
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.portal_access}
                                onChange={(e) => setFormData({ ...formData, portal_access: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Portal Access</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Active</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Creating...' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* =============================================================================
 * EDIT USER MODAL
 * ============================================================================= */
const EditUserModal = ({ user: selectedUser, onClose, onSuccess, updatedBy }) => {
    const [formData, setFormData] = useState({
        full_name: selectedUser.full_name,
        email: selectedUser.email || '',
        user_level: selectedUser.user_level,
        portal_access: selectedUser.portal_access,
        is_active: selectedUser.is_active
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await updateUser(selectedUser.id, formData, updatedBy);

        if (result.success) {
            alert('User updated successfully!');
            onSuccess();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Edit User: {selectedUser.username}</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User Level *</label>
                        <select
                            value={formData.user_level}
                            onChange={(e) => setFormData({ ...formData, user_level: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            <option value="view_only">View Only</option>
                            <option value="full_access">Full Access</option>
                            <option value="approver">Approver</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                        </select>
                    </div>

                    <div className="flex gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.portal_access}
                                onChange={(e) => setFormData({ ...formData, portal_access: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Portal Access</span>
                        </label>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Active</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Updating...' : 'Update User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* =============================================================================
 * RESET PASSWORD MODAL
 * ============================================================================= */
const ResetPasswordModal = ({ user: selectedUser, onClose, onSuccess, resetBy }) => {
    const [password, setPassword] = useState('');
    const [requireChange, setRequireChange] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleGeneratePassword = () => {
        const newPassword = generatePassword(12);
        setPassword(newPassword);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await resetPassword(selectedUser.id, password, resetBy, requireChange);

        if (result.success) {
            alert(`Password reset successfully for ${selectedUser.username}!\n\nNew Password: ${password}\n\nPlease save this password securely.`);
            onSuccess();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Reset Password: {selectedUser.username}</h2>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Min 8 chars, letters & numbers"
                                required
                            />
                            <button
                                type="button"
                                onClick={handleGeneratePassword}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Minimum 8 characters with letters and numbers</p>
                    </div>

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={requireChange}
                                onChange={(e) => setRequireChange(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Require password change on next login</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagement;
