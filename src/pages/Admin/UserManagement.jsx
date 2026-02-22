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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div style={{ padding: 24, fontFamily: 'inherit' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                        <Shield style={{ width: 26, height: 26, color: '#2563eb' }} />
                        Manajemen User
                    </h1>
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Kelola user, level, dan password</p>
                </div>
                <button
                    onClick={handleCreateUser}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                >
                    <Plus style={{ width: 16, height: 16 }} />
                    Tambah User
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total User', value: users.length, bg: '#f9fafb', border: '#e5e7eb', text: '#374151' },
                    { label: 'Aktif', value: users.filter(u => u.is_active).length, bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
                    { label: 'Tidak Aktif', value: users.filter(u => !u.is_active).length, bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
                    { label: 'Super Admin', value: users.filter(u => u.user_level === 'super_admin').length, bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
                ].map(card => (
                    <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 12, color: card.text, fontWeight: 500, marginBottom: 4 }}>{card.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: card.text }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            {['Username', 'Nama Lengkap', 'Email', 'Level', 'Status', 'Terakhir Login', 'Aksi'].map((h, i) => (
                                <th key={h} style={{ padding: '10px 20px', textAlign: i === 6 ? 'right' : 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u, idx) => (
                            <tr key={u.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'}
                            >
                                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Users style={{ width: 16, height: 16, color: '#9ca3af' }} />
                                        <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{u.username}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 20px', fontSize: 14, color: '#374151', whiteSpace: 'nowrap' }}>{u.full_name}</td>
                                <td style={{ padding: '12px 20px', fontSize: 14, color: '#6b7280', whiteSpace: 'nowrap' }}>{u.email || '—'}</td>
                                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>{getUserLevelBadge(u.user_level)}</td>
                                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>
                                    {u.is_active ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: 13, fontWeight: 500 }}>
                                            <CheckCircle style={{ width: 15, height: 15 }} /> Aktif
                                        </span>
                                    ) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#dc2626', fontSize: 13, fontWeight: 500 }}>
                                            <Ban style={{ width: 15, height: 15 }} /> Nonaktif
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '12px 20px', fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                                    {u.last_login ? new Date(u.last_login).toLocaleDateString('id-ID') : 'Belum pernah'}
                                </td>
                                <td style={{ padding: '12px 20px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                        <button onClick={() => handleEditUser(u)} title="Edit User"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4, borderRadius: 6 }}
                                        ><Edit style={{ width: 18, height: 18 }} /></button>
                                        <button onClick={() => handleResetPassword(u)} title="Reset Password"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4, borderRadius: 6 }}
                                        ><Key style={{ width: 18, height: 18 }} /></button>
                                        <button onClick={() => handleToggleActive(u)} title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? '#dc2626' : '#16a34a', padding: 4, borderRadius: 6 }}
                                        >{u.is_active ? <Ban style={{ width: 18, height: 18 }} /> : <CheckCircle style={{ width: 18, height: 18 }} />}</button>
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
