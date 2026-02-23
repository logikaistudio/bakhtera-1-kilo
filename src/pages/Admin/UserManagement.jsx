import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAllUsers, createUser, updateUser, resetPassword, toggleUserActive, deleteUser } from '../../services/userService';
import { generatePassword } from '../../services/passwordService';
import { Users, Plus, Edit, Key, Ban, CheckCircle, Shield, RefreshCw, Trash2 } from 'lucide-react';

/**
 * User Management Page (Super Admin Only)
 * Manages users, passwords, and roles
 * Roles diambil DINAMIS dari tabel role_permissions + super_admin
 */

// Warna badge per role
const ROLE_COLORS = {
    super_admin: { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' },
    direksi: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
    chief: { bg: '#faf5ff', text: '#9333ea', border: '#e9d5ff' },
    manager: { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    staff: { bg: '#f0fdf4', text: '#16a34a', border: '#bbf7d0' },
    viewer: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

const getDefaultColor = () => ({ bg: '#f0f9ff', text: '#0284c7', border: '#bae6fd' });

const UserManagement = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [availableRoles, setAvailableRoles] = useState([]);

    // Fetch users + roles on mount
    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        const result = await getAllUsers(user.id);
        if (result.success) {
            setUsers(result.users);
        }
        setLoading(false);
    };

    // Load roles dari tabel role_permissions + tambahkan super_admin
    const loadRoles = async () => {
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('role_id, role_label');

            if (error) {
                console.warn('Could not load roles:', error.message);
                // Fallback ke default
                setAvailableRoles([
                    { id: 'super_admin', label: 'Super Admin' },
                    { id: 'direksi', label: 'Direksi' },
                    { id: 'chief', label: 'Chief' },
                    { id: 'manager', label: 'Manager' },
                    { id: 'staff', label: 'Staff' },
                    { id: 'viewer', label: 'Viewer' },
                ]);
                return;
            }

            // Deduplicate role_id
            const roleMap = new Map();
            roleMap.set('super_admin', 'Super Admin'); // selalu ada
            (data || []).forEach(d => {
                if (!roleMap.has(d.role_id)) {
                    roleMap.set(d.role_id, d.role_label || d.role_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                }
            });

            const roles = Array.from(roleMap, ([id, label]) => ({ id, label }));
            setAvailableRoles(roles);
        } catch (err) {
            console.warn('loadRoles error:', err.message);
        }
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
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handleDeleteUser = async (userToDelete) => {
        if (userToDelete.id === user.id) {
            alert('Tidak bisa menghapus akun Anda sendiri.');
            return;
        }
        if (!confirm(`⚠️ HAPUS user "${userToDelete.username}" (${userToDelete.full_name})?\n\nTindakan ini PERMANEN dan tidak bisa dibatalkan.\nSemua sesi dan izin user ini akan ikut dihapus.`)) return;

        const result = await deleteUser(userToDelete.id, user.id);
        if (result.success) {
            loadUsers();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const getRoleBadge = (level) => {
        const c = ROLE_COLORS[level] || getDefaultColor();
        const role = availableRoles.find(r => r.id === level);
        const label = role?.label || level?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
        return (
            <span style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 20,
                fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                background: c.bg, color: c.text, border: `1px solid ${c.border}`
            }}>
                {label}
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
                    <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Kelola user, role, dan password</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        onClick={() => { loadUsers(); loadRoles(); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}
                    >
                        <RefreshCw style={{ width: 14, height: 14 }} />
                        Refresh
                    </button>
                    <button
                        onClick={handleCreateUser}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
                    >
                        <Plus style={{ width: 16, height: 16 }} />
                        Tambah User
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                    { label: 'Total User', value: users.length, bg: '#f9fafb', border: '#e5e7eb', text: '#374151' },
                    { label: 'Aktif', value: users.filter(u => u.is_active).length, bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
                    { label: 'Tidak Aktif', value: users.filter(u => !u.is_active).length, bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
                ].map(card => (
                    <div key={card.label} style={{ background: card.bg, border: `1px solid ${card.border}`, borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 12, color: card.text, fontWeight: 500, marginBottom: 4 }}>{card.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 700, color: card.text }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Users Table */}
            <div style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                {['Username', 'Nama Lengkap', 'Email', 'Role', 'Status', 'Terakhir Login', 'Aksi'].map((h, i) => (
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
                                    <td style={{ padding: '12px 20px', whiteSpace: 'nowrap' }}>{getRoleBadge(u.user_level)}</td>
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
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: u.is_active ? '#f59e0b' : '#16a34a', padding: 4, borderRadius: 6 }}
                                            >{u.is_active ? <Ban style={{ width: 18, height: 18 }} /> : <CheckCircle style={{ width: 18, height: 18 }} />}</button>
                                            {u.id !== user.id && (
                                                <button onClick={() => handleDeleteUser(u)} title="Hapus User"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4, borderRadius: 6 }}
                                                ><Trash2 style={{ width: 18, height: 18 }} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals — pass availableRoles */}
            {showCreateModal && (
                <CreateUserModal
                    roles={availableRoles}
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={() => { loadUsers(); setShowCreateModal(false); }}
                    createdBy={user.id}
                />
            )}

            {showEditModal && selectedUser && (
                <EditUserModal
                    user={selectedUser}
                    roles={availableRoles}
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
 * CREATE USER MODAL — dropdown role dinamis
 * ============================================================================= */
const CreateUserModal = ({ roles, onClose, onSuccess, createdBy }) => {
    const [formData, setFormData] = useState({
        username: '',
        full_name: '',
        email: '',
        user_level: 'staff',
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
            alert(`User berhasil dibuat!\nUsername: ${formData.username}\nPassword: ${formData.password}\n\nSimpan password ini dengan aman.`);
            onSuccess();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Buat User Baru</h2>

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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Opsional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role / Level *</label>
                        <select
                            value={formData.user_level}
                            onChange={(e) => setFormData({ ...formData, user_level: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Role dapat ditambah di halaman Manajemen Role & Akses</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Min 8 karakter, huruf & angka"
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
                            <span className="text-sm text-gray-700">Aktif</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Membuat...' : 'Buat User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

/* =============================================================================
 * EDIT USER MODAL — dropdown role dinamis
 * ============================================================================= */
const EditUserModal = ({ user: selectedUser, roles, onClose, onSuccess, updatedBy }) => {
    const [formData, setFormData] = useState({
        username: selectedUser.username,
        full_name: selectedUser.full_name,
        email: selectedUser.email || '',
        user_level: selectedUser.user_level,
        portal_access: selectedUser.portal_access,
        is_active: selectedUser.is_active
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Pastikan current user_level ada di daftar roles
    const allRoles = [...roles];
    if (!allRoles.find(r => r.id === selectedUser.user_level)) {
        allRoles.push({
            id: selectedUser.user_level,
            label: selectedUser.user_level?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || selectedUser.user_level
        });
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await updateUser(selectedUser.id, formData, updatedBy);

        if (result.success) {
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap *</label>
                        <input
                            type="text"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Opsional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role / Level *</label>
                        <select
                            value={formData.user_level}
                            onChange={(e) => setFormData({ ...formData, user_level: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        >
                            {allRoles.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Role dari Manajemen Role & Akses</p>
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
                            <span className="text-sm text-gray-700">Aktif</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
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
            alert(`Password berhasil direset untuk ${selectedUser.username}!\n\nPassword Baru: ${password}\n\nSimpan password ini dengan aman.`);
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru *</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Min 8 karakter, huruf & angka"
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
                    </div>

                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={requireChange}
                                onChange={(e) => setRequireChange(e.target.checked)}
                                className="rounded border-gray-300"
                            />
                            <span className="text-sm text-gray-700">Wajib ganti password saat login berikutnya</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                        >
                            {loading ? 'Mereset...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserManagement;
