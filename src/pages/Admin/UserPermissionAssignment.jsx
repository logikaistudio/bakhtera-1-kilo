import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Users, Shield, CheckCircle2, AlertCircle, Edit2, Save, X,
    UserCheck, UserX, Info, RefreshCw
} from 'lucide-react';

/**
 * Penugasan Role User
 * Halaman untuk menetapkan/mengubah role pada setiap user individual.
 * Roles diambil DINAMIS dari tabel role_permissions (sinkron dgn Manajemen Role & Akses).
 */

const DEFAULT_ROLE_COLORS = {
    super_admin: { color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
    direksi: { color: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
    chief: { color: '#a855f7', bg: '#faf5ff', border: '#e9d5ff' },
    manager: { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
    staff: { color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
    viewer: { color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};
const fallbackColor = { color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' };

const RoleBadge = ({ role, roles }) => {
    const roleInfo = roles.find(r => r.id === role);
    const c = DEFAULT_ROLE_COLORS[role] || fallbackColor;
    const label = roleInfo?.label || role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || '—';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: c.bg, color: c.color, border: `1px solid ${c.border}`
        }}>
            {label}
        </span>
    );
};

const UserPermissionAssignment = () => {
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editRole, setEditRole] = useState('');
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);

    const showNotif = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    const loadUsers = async () => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, full_name, username, email, user_level, is_active, portal_access')
                .order('full_name');

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            showNotif('error', 'Gagal memuat data user: ' + err.message);
        }
    };

    // Load roles dari tabel role_permissions + super_admin
    const loadRoles = async () => {
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('role_id, role_label');

            const roleMap = new Map();
            roleMap.set('super_admin', 'Super Admin');
            (data || []).forEach(d => {
                if (!roleMap.has(d.role_id)) {
                    roleMap.set(d.role_id, d.role_label || d.role_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
                }
            });

            setRoles(Array.from(roleMap, ([id, label]) => ({ id, label })));
        } catch (err) {
            console.warn('loadRoles error:', err);
            // Fallback
            setRoles([
                { id: 'super_admin', label: 'Super Admin' },
                { id: 'direksi', label: 'Direksi' },
                { id: 'chief', label: 'Chief' },
                { id: 'manager', label: 'Manager' },
                { id: 'staff', label: 'Staff' },
                { id: 'viewer', label: 'Viewer' },
            ]);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([loadUsers(), loadRoles()]);
        setLoading(false);
    };

    useEffect(() => {
        loadAll();
    }, []);

    const startEdit = (user) => {
        setEditingId(user.id);
        setEditRole(user.user_level || 'viewer');
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditRole('');
    };

    const saveRole = async (userId) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ user_level: editRole })
                .eq('id', userId);

            if (error) throw error;

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, user_level: editRole } : u));
            showNotif('success', 'Role berhasil diperbarui!');
            cancelEdit();
        } catch (err) {
            showNotif('error', 'Gagal menyimpan: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (userId, current) => {
        try {
            const { error } = await supabase
                .from('users')
                .update({ is_active: !current })
                .eq('id', userId);

            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u));
            showNotif('success', `User ${!current ? 'diaktifkan' : 'dinonaktifkan'}.`);
        } catch (err) {
            showNotif('error', 'Gagal mengubah status: ' + err.message);
        }
    };

    // Statistik per role
    const stats = roles
        .map(r => ({
            ...r,
            ...(DEFAULT_ROLE_COLORS[r.id] || fallbackColor),
            count: users.filter(u => u.user_level === r.id).length,
        }))
        .filter(s => s.count > 0);

    const activeCount = users.filter(u => u.is_active).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center space-y-3">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto" />
                    <p className="text-sm text-gray-500">Memuat data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-6xl mx-auto">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-silver-light flex items-center gap-2.5">
                        <Users className="w-6 h-6 text-accent-blue" />
                        Penugasan Role User
                    </h1>
                    <p className="text-sm text-silver-dark mt-1">
                        Tetapkan role untuk setiap user. Hak akses per role diatur di <strong className="text-silver">Manajemen Role & Akses</strong>.
                    </p>
                </div>
                <button
                    onClick={loadAll}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dark-border text-silver-dark hover:text-silver-light hover:border-accent-blue/50 smooth-transition text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* ── Info Box ── */}
            <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12,
                padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start'
            }}>
                <Info style={{ width: 18, height: 18, color: '#3b82f6', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: '#1e40af', lineHeight: 1.6 }}>
                    <strong>Cara Kerja Terintegrasi:</strong>
                    <ul style={{ marginTop: 4, paddingLeft: 16, color: '#1d4ed8' }}>
                        <li><strong>Manajemen Role & Akses</strong> → membuat role dan mengatur hak akses per menu</li>
                        <li><strong>Halaman ini</strong> → menentukan role mana yang diberikan kepada setiap user</li>
                        <li><strong>Manajemen User</strong> → membuat/mengedit user beserta role awalnya</li>
                    </ul>
                </div>
            </div>

            {/* ── Notification ── */}
            {notification && (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border ${notification.type === 'success'
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                    {notification.type === 'success'
                        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    {notification.message}
                </div>
            )}

            {/* ── Statistik ── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {stats.map(s => (
                    <div key={s.id} style={{
                        background: s.bg, border: `1px solid ${s.border}`,
                        borderRadius: 12, padding: '12px 14px', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
                    </div>
                ))}
                <div style={{
                    background: '#f0fdf4', border: '1px solid #bbf7d0',
                    borderRadius: 12, padding: '12px 14px', textAlign: 'center'
                }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#16a34a' }}>{activeCount}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Aktif</div>
                </div>
            </div>

            {/* ── Tabel User ── */}
            <div style={{
                background: '#ffffff', borderRadius: 14, border: '1px solid #e5e7eb',
                overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                {['User', 'Role Saat Ini', 'Status', 'Aksi'].map(h => (
                                    <th key={h} style={{ padding: '12px 16px', textAlign: h === 'User' ? 'left' : 'center', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u, idx) => {
                                const isEditing = editingId === u.id;
                                const roleCfg = DEFAULT_ROLE_COLORS[u.user_level] || fallbackColor;

                                return (
                                    <tr
                                        key={u.id}
                                        style={{
                                            background: isEditing ? '#fffbeb' : (idx % 2 === 0 ? '#ffffff' : '#f9fafb'),
                                            borderBottom: '1px solid #f3f4f6',
                                            transition: 'background 0.15s'
                                        }}
                                    >
                                        {/* User Info */}
                                        <td style={{ padding: '14px 16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                    background: `linear-gradient(135deg, ${roleCfg.color}40, ${roleCfg.color}20)`,
                                                    border: `2px solid ${roleCfg.color}40`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 14, fontWeight: 700, color: roleCfg.color
                                                }}>
                                                    {(u.full_name || u.username || 'U')[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                                                        {u.full_name || u.username}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                                                        @{u.username} {u.email && `• ${u.email}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Role */}
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <select
                                                    value={editRole}
                                                    onChange={e => setEditRole(e.target.value)}
                                                    style={{
                                                        padding: '6px 10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                                                        border: '2px solid #f59e0b', outline: 'none', background: '#fffbeb',
                                                        color: '#92400e', cursor: 'pointer'
                                                    }}
                                                    autoFocus
                                                >
                                                    {roles.map(r => (
                                                        <option key={r.id} value={r.id}>{r.label}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <RoleBadge role={u.user_level} roles={roles} />
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => toggleActive(u.id, u.is_active)}
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                                    background: u.is_active ? '#f0fdf4' : '#fef2f2',
                                                    color: u.is_active ? '#16a34a' : '#dc2626',
                                                }}
                                                title={u.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                                            >
                                                {u.is_active
                                                    ? <><UserCheck style={{ width: 13, height: 13 }} /> Aktif</>
                                                    : <><UserX style={{ width: 13, height: 13 }} /> Nonaktif</>
                                                }
                                            </button>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            {isEditing ? (
                                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                                                    <button
                                                        onClick={() => saveRole(u.id)}
                                                        disabled={saving}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                            background: '#16a34a', color: '#fff', border: 'none', cursor: 'pointer',
                                                            opacity: saving ? 0.7 : 1
                                                        }}
                                                    >
                                                        <Save style={{ width: 13, height: 13 }} />
                                                        {saving ? 'Simpan...' : 'Simpan'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 5,
                                                            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                                            background: '#f3f4f6', color: '#6b7280', border: 'none', cursor: 'pointer'
                                                        }}
                                                    >
                                                        <X style={{ width: 13, height: 13 }} />
                                                        Batal
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => startEdit(u)}
                                                    style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                                                        background: '#eff6ff', color: '#2563eb',
                                                        border: '1px solid #bfdbfe', cursor: 'pointer',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    <Edit2 style={{ width: 13, height: 13 }} />
                                                    Ubah Role
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {users.length === 0 && (
                        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6b7280' }}>
                            <Users style={{ width: 40, height: 40, margin: '0 auto 12px', opacity: 0.4 }} />
                            <p style={{ fontSize: 14 }}>Tidak ada user ditemukan</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Legenda Role ── */}
            <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: 12, padding: '16px 20px'
            }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                    Role Tersedia (dari Manajemen Role & Akses)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                    {roles.map(r => {
                        const c = DEFAULT_ROLE_COLORS[r.id] || fallbackColor;
                        return (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    display: 'inline-block', width: 10, height: 10,
                                    borderRadius: '50%', background: c.color, flexShrink: 0
                                }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: c.color, minWidth: 90 }}>{r.label}</span>
                                <span style={{ fontSize: 12, color: '#64748b' }}>({r.id})</span>
                            </div>
                        );
                    })}
                </div>
            </div>

        </div>
    );
};

export default UserPermissionAssignment;
