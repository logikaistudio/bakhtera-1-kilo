import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Shield, Plus, Save, AlertCircle, CheckCircle2, Trash2, X, Edit2,
    ChevronDown, ChevronRight, Check, Minus, Plane, Building2, Calendar
} from 'lucide-react';

/* ─────────────────────────────────────────────
   MENU DEFINITIONS PER MODULE
   ───────────────────────────────────────────── */
const MODULE_MENUS = {
    Bridge: {
        icon: Building2,
        color: 'blue',
        menus: [
            { code: 'bridge_dashboard', label: 'Dashboard Bridge' },
            { code: 'bridge_pengajuan', label: 'Pengajuan' },
            { code: 'bridge_ata_carnet', label: 'ATA Carnet' },
            { code: 'bridge_inventory', label: 'Inventaris Gudang' },
            { code: 'bridge_outbound', label: 'Laporan Barang Keluar' },
            { code: 'bridge_movement', label: 'Pergerakan Barang' },
            { code: 'bridge_delivery', label: 'Delivery Notes' },
            { code: 'bridge_approval', label: 'Approval Manager' },
            { code: 'bridge_activity', label: 'Activity Logger' },
            { code: 'bridge_finance', label: 'Keuangan Bridge' },
            { code: 'bridge_coa', label: 'Kode Akun' },
            { code: 'bridge_partners', label: 'Mitra Bisnis' },
            { code: 'bridge_bc_master', label: 'BC Master' },
            { code: 'bridge_item_master', label: 'Item Master' },
            { code: 'bridge_hs_master', label: 'HS Master' },
            { code: 'bridge_pabean', label: 'Pabean Dashboard' },
            { code: 'bridge_barang_masuk', label: 'Pabean — Barang Masuk' },
            { code: 'bridge_barang_keluar', label: 'Pabean — Barang Keluar' },
            { code: 'bridge_barang_reject', label: 'Pabean — Barang Reject' },
            { code: 'bridge_pabean_movement', label: 'Pabean — Pergerakan' },
            { code: 'bridge_settings', label: 'Pengaturan Modul' },
        ]
    },
    Blink: {
        icon: Plane,
        color: 'cyan',
        menus: [
            { code: 'blink_dashboard', label: 'Dashboard Blink' },
            { code: 'blink_quotations', label: 'Quotation' },
            { code: 'blink_shipments', label: 'Shipment' },
            { code: 'blink_flow_monitor', label: 'Flow Monitor' },
            { code: 'blink_sales', label: 'Sales Achievement' },
            { code: 'blink_tracking', label: 'Tracking & Monitoring' },
            { code: 'blink_awb', label: 'AWB Management' },
            { code: 'blink_bl', label: 'BL Management' },
            { code: 'blink_invoices', label: 'Invoice' },
            { code: 'blink_purchase_order', label: 'Purchase Order' },
            { code: 'blink_journal', label: 'Jurnal Umum' },
            { code: 'blink_ledger', label: 'Buku Besar' },
            { code: 'blink_trial_balance', label: 'Trial Balance' },
            { code: 'blink_ar', label: 'Piutang (AR)' },
            { code: 'blink_ap', label: 'Hutang (AP)' },
            { code: 'blink_pnl', label: 'Laba Rugi' },
            { code: 'blink_balance_sheet', label: 'Neraca' },
            { code: 'blink_selling_buying', label: 'Selling vs Buying' },
            { code: 'blink_routes', label: 'Master Rute' },
            { code: 'blink_partners', label: 'Mitra Bisnis' },
            { code: 'blink_settings', label: 'Pengaturan Modul' },
        ]
    },
    Big: {
        icon: Calendar,
        color: 'orange',
        menus: [
            { code: 'big_dashboard', label: 'Dashboard BIG' },
            { code: 'big_events', label: 'Event Management' },
            { code: 'big_costs', label: 'Event Costs' },
            { code: 'big_quotations', label: 'Quotation' },
            { code: 'big_invoices', label: 'Invoice' },
            { code: 'big_ar', label: 'Piutang (AR)' },
            { code: 'big_settings', label: 'Pengaturan Modul' },
        ]
    }
};

const PERMISSION_COLS = [
    { key: 'can_access', label: 'Akses' },
    { key: 'can_view', label: 'Lihat' },
    { key: 'can_create', label: 'Buat' },
    { key: 'can_edit', label: 'Edit' },
    { key: 'can_delete', label: 'Hapus' },
    { key: 'can_approve', label: 'Approve' },
];

const DEFAULT_PERMS = () => ({
    can_access: false, can_view: false, can_create: false,
    can_edit: false, can_delete: false, can_approve: false
});

/* ─────────────────────────────────────────────
   MODULE COLOR HELPERS
   ───────────────────────────────────────────── */
const MODULE_STYLES = {
    Bridge: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/20 text-blue-300' },
    Blink: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-300' },
    Big: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300' },
};

/* ─────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────── */
// Default (built-in) roles — selalu ada
const DEFAULT_ROLES = [
    { id: 'direksi', label: 'Direksi', color: 'red' },
    { id: 'chief', label: 'Chief', color: 'orange' },
    { id: 'manager', label: 'Manager', color: 'blue' },
    { id: 'staff', label: 'Staff', color: 'green' },
    { id: 'viewer', label: 'Viewer', color: 'gray' },
];

const RolePermissions = () => {
    const [roles, setRoles] = useState(DEFAULT_ROLES);
    const [permissions, setPermissions] = useState({});
    const [activeModule, setActiveModule] = useState('Bridge');
    const [activeRole, setActiveRole] = useState('direksi');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState(null);
    const [showAddRole, setShowAddRole] = useState(false);
    const [newRoleName, setNewRoleName] = useState('');
    const [expandedMenus, setExpandedMenus] = useState({});
    const [editingRoleId, setEditingRoleId] = useState(null);
    const [editRoleName, setEditRoleName] = useState('');

    // Load from Supabase on mount — custom roles juga ikut diload
    useEffect(() => {
        loadPermissions();
    }, []);

    const loadPermissions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('role_permissions')
                .select('*');

            if (error && error.code !== 'PGRST116') {
                console.warn('role_permissions table may not exist yet:', error.message);
                // Inisialisasi default saja
                const init = {};
                DEFAULT_ROLES.forEach(role => {
                    init[role.id] = {};
                    Object.values(MODULE_MENUS).forEach(mod => {
                        mod.menus.forEach(menu => {
                            init[role.id][menu.code] = DEFAULT_PERMS();
                        });
                    });
                });
                setPermissions(init);
                setLoading(false);
                return;
            }

            // ── Deteksi custom roles dari DB ──────────────────────────
            const defaultIds = new Set(DEFAULT_ROLES.map(r => r.id));
            const dbRoleIds = [...new Set((data || []).map(d => d.role_id))];
            const customRoles = dbRoleIds
                .filter(id => !defaultIds.has(id))
                .map(id => {
                    // Ambil label dari kolom role_label yang tersimpan di DB
                    const sample = data.find(d => d.role_id === id);
                    const label = sample?.role_label || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return { id, label, color: 'gray' };
                });

            const allRoles = [...DEFAULT_ROLES, ...customRoles];
            setRoles(allRoles);

            // ── Build permissions untuk semua role ────────────────────
            const updated = {};
            allRoles.forEach(role => {
                updated[role.id] = {};
                Object.values(MODULE_MENUS).forEach(mod => {
                    mod.menus.forEach(menu => {
                        const existing = (data || []).find(d => d.role_id === role.id && d.menu_code === menu.code);
                        if (existing) {
                            // Hanya ambil 6 field boolean, JANGAN spread seluruh row DB
                            updated[role.id][menu.code] = {
                                can_access: !!existing.can_access,
                                can_view: !!existing.can_view,
                                can_create: !!existing.can_create,
                                can_edit: !!existing.can_edit,
                                can_delete: !!existing.can_delete,
                                can_approve: !!existing.can_approve,
                            };
                        } else {
                            updated[role.id][menu.code] = DEFAULT_PERMS();
                        }
                    });
                });
            });
            setPermissions(updated);

        } catch (err) {
            console.warn('Could not load permissions:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const togglePerm = (roleId, menuCode, permKey) => {
        setPermissions(prev => ({
            ...prev,
            [roleId]: {
                ...prev[roleId],
                [menuCode]: {
                    ...prev[roleId][menuCode],
                    [permKey]: !prev[roleId][menuCode][permKey]
                }
            }
        }));
    };

    const setAllPermsForMenu = (roleId, menuCode, value) => {
        const updated = {};
        PERMISSION_COLS.forEach(col => { updated[col.key] = value; });
        setPermissions(prev => ({
            ...prev,
            [roleId]: { ...prev[roleId], [menuCode]: updated }
        }));
    };

    const setAllPermsForModule = (roleId, moduleName, value) => {
        const menus = MODULE_MENUS[moduleName].menus;
        const updatedRole = { ...permissions[roleId] };
        menus.forEach(menu => {
            const p = {};
            PERMISSION_COLS.forEach(col => { p[col.key] = value; });
            updatedRole[menu.code] = p;
        });
        setPermissions(prev => ({ ...prev, [roleId]: updatedRole }));
    };

    const isMenuFullyGranted = (roleId, menuCode) =>
        PERMISSION_COLS.every(col => permissions[roleId]?.[menuCode]?.[col.key]);

    const isMenuPartiallyGranted = (roleId, menuCode) =>
        PERMISSION_COLS.some(col => permissions[roleId]?.[menuCode]?.[col.key]) &&
        !isMenuFullyGranted(roleId, menuCode);

    const isModuleFullyGranted = (roleId, moduleName) =>
        MODULE_MENUS[moduleName].menus.every(m => isMenuFullyGranted(roleId, m.code));

    const savePermissions = async () => {
        setSaving(true);
        try {
            // Build upsert rows — hanya kirim 6 field boolean + identifiers
            const rows = [];
            roles.forEach(role => {
                Object.entries(permissions[role.id] || {}).forEach(([menuCode, perms]) => {
                    rows.push({
                        role_id: role.id,
                        role_label: role.label,
                        menu_code: menuCode,
                        can_access: !!perms.can_access,
                        can_view: !!perms.can_view,
                        can_create: !!perms.can_create,
                        can_edit: !!perms.can_edit,
                        can_delete: !!perms.can_delete,
                        can_approve: !!perms.can_approve,
                        updated_at: new Date().toISOString()
                    });
                });
            });

            // Upsert dalam batch kecil (max 500 per batch) untuk menghindari timeout
            const BATCH_SIZE = 500;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                const { error } = await supabase
                    .from('role_permissions')
                    .upsert(batch, { onConflict: 'role_id,menu_code', ignoreDuplicates: false });

                if (error) throw error;
            }

            setNotification({ type: 'success', message: `Pengaturan role berhasil disimpan! (${rows.length} entri)` });
        } catch (err) {
            console.error('Save error:', err);
            setNotification({ type: 'error', message: 'Gagal menyimpan: ' + err.message });
        } finally {
            setSaving(false);
            setTimeout(() => setNotification(null), 4000);
        }
    };

    const addRole = async () => {
        const trimmed = newRoleName.trim();
        if (!trimmed) return;
        const id = trimmed.toLowerCase().replace(/\s+/g, '_');
        if (roles.find(r => r.id === id)) {
            setNotification({ type: 'error', message: 'Role dengan nama tersebut sudah ada.' });
            return;
        }
        const newRole = { id, label: trimmed, color: 'gray' };
        const newPerms = {};
        Object.values(MODULE_MENUS).forEach(mod => {
            mod.menus.forEach(menu => { newPerms[menu.code] = DEFAULT_PERMS(); });
        });
        setRoles(prev => [...prev, newRole]);
        setPermissions(prev => ({ ...prev, [id]: newPerms }));
        setActiveRole(id);
        setNewRoleName('');
        setShowAddRole(false);

        // Simpan ke DB langsung agar tidak hilang saat reload
        try {
            const rows = Object.keys(newPerms).map(menuCode => ({
                role_id: id,
                role_label: trimmed,
                menu_code: menuCode,
                ...DEFAULT_PERMS(),
                updated_at: new Date().toISOString()
            }));
            const { error } = await supabase
                .from('role_permissions')
                .upsert(rows, { onConflict: 'role_id,menu_code', ignoreDuplicates: false });
            if (error) throw error;
            setNotification({ type: 'success', message: `Role "${trimmed}" berhasil ditambahkan & disimpan!` });
        } catch (err) {
            setNotification({ type: 'success', message: `Role "${trimmed}" ditambahkan (belum tersimpan ke DB — klik Simpan).` });
            console.warn('addRole DB error:', err.message);
        }
        setTimeout(() => setNotification(null), 4000);
    };

    const deleteRole = async (roleId) => {
        const roleName = roles.find(r => r.id === roleId)?.label;
        const isDefault = ['direksi', 'chief', 'manager', 'staff', 'viewer'].includes(roleId);
        const msg = isDefault
            ? `⚠️ Hapus role bawaan "${roleName}"?\n\nRole ini adalah role default. Penghapusan akan menghilangkan semua hak akses yang terkait.\n\nLanjutkan?`
            : `Hapus role "${roleName}"? Semua pengaturan akses role ini akan dihapus.`;
        if (!confirm(msg)) return;
        setRoles(prev => prev.filter(r => r.id !== roleId));
        setPermissions(prev => { const n = { ...prev }; delete n[roleId]; return n; });
        if (activeRole === roleId) setActiveRole(roles.find(r => r.id !== roleId)?.id || DEFAULT_ROLES[0]?.id);
        // Hapus dari DB
        try {
            const { error } = await supabase
                .from('role_permissions')
                .delete()
                .eq('role_id', roleId);
            if (error) throw error;
            setNotification({ type: 'success', message: `Role "${roleName}" berhasil dihapus.` });
        } catch (err) {
            console.warn('deleteRole DB error:', err.message);
            setNotification({ type: 'success', message: `Role "${roleName}" dihapus dari tampilan.` });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    // ── Edit / Rename Role ──
    const startEditRole = (role) => {
        setEditingRoleId(role.id);
        setEditRoleName(role.label);
    };

    const cancelEditRole = () => {
        setEditingRoleId(null);
        setEditRoleName('');
    };

    const saveEditRole = async () => {
        const trimmed = editRoleName.trim();
        if (!trimmed) return;

        const oldRole = roles.find(r => r.id === editingRoleId);
        if (!oldRole) return;

        // Update label di state
        setRoles(prev => prev.map(r =>
            r.id === editingRoleId ? { ...r, label: trimmed } : r
        ));

        // Update role_label di DB
        try {
            const { error } = await supabase
                .from('role_permissions')
                .update({ role_label: trimmed, updated_at: new Date().toISOString() })
                .eq('role_id', editingRoleId);

            if (error) throw error;
            setNotification({ type: 'success', message: `Role diubah menjadi "${trimmed}"` });
        } catch (err) {
            console.warn('editRole DB error:', err.message);
            setNotification({ type: 'error', message: 'Gagal mengubah nama role: ' + err.message });
        }

        cancelEditRole();
        setTimeout(() => setNotification(null), 3000);
    };

    const currentMenus = MODULE_MENUS[activeModule]?.menus || [];
    const style = MODULE_STYLES[activeModule];
    const ModuleIcon = MODULE_MENUS[activeModule]?.icon;

    return (
        <div className="p-4 lg:p-6 space-y-6">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-silver-light flex items-center gap-2.5">
                        <Shield className="w-6 h-6 text-accent-blue" />
                        Manajemen Role & Akses
                    </h1>
                    <p className="text-sm text-silver-dark mt-1">Atur hak akses per role untuk setiap modul dan menu</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowAddRole(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-surface border border-dark-border text-silver hover:text-silver-light hover:border-accent-blue smooth-transition text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Tambah Role
                    </button>
                    <button
                        onClick={savePermissions}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white hover:bg-accent-blue/90 smooth-transition text-sm font-medium disabled:opacity-60"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Menyimpan...' : 'Simpan'}
                    </button>
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

            {/* ── Add Role Modal ── */}
            {showAddRole && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-silver-light">Tambah Role Baru</h2>
                            <button onClick={() => setShowAddRole(false)} className="text-silver-dark hover:text-silver-light">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <label className="block text-sm text-silver-dark mb-2">Nama Role</label>
                        <input
                            type="text"
                            value={newRoleName}
                            onChange={e => setNewRoleName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addRole()}
                            placeholder="cth: Supervisor, Operator, HRD..."
                            className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue/50"
                            autoFocus
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowAddRole(false)} className="px-4 py-2 text-sm text-silver-dark hover:text-silver-light smooth-transition rounded-lg hover:bg-dark-surface">
                                Batal
                            </button>
                            <button onClick={addRole} className="px-4 py-2 text-sm font-medium bg-accent-blue text-white rounded-lg hover:bg-accent-blue/90 smooth-transition">
                                Tambah
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Layout: Role Tabs + Module Tabs + Permission Matrix ── */}
            <div style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

                {/* Role Tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px', paddingTop: 12, overflowX: 'auto', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
                    {roles.map(role => (
                        <div key={role.id} className="relative flex-shrink-0 group">
                            {editingRoleId === role.id ? (
                                /* Inline Edit Mode */
                                <div className="flex items-center gap-1 px-2 py-1.5">
                                    <input
                                        type="text"
                                        value={editRoleName}
                                        onChange={e => setEditRoleName(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') saveEditRole();
                                            if (e.key === 'Escape') cancelEditRole();
                                        }}
                                        className="px-2 py-1 text-sm border border-blue-400 rounded bg-white text-gray-800 outline-none w-28"
                                        autoFocus
                                    />
                                    <button onClick={saveEditRole} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Simpan">
                                        <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={cancelEditRole} className="p-1 text-gray-400 hover:bg-gray-100 rounded" title="Batal">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                /* Normal Mode */
                                <>
                                    <button
                                        onClick={() => setActiveRole(role.id)}
                                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${activeRole === role.id
                                            ? 'bg-white text-gray-900 border-t border-l border-r border-gray-300 font-semibold'
                                            : 'text-gray-500 hover:text-gray-800 hover:bg-white/60'
                                            }`}
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        {role.label}
                                        {isModuleFullyGranted(role.id, activeModule) && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                        )}
                                    </button>
                                    {/* Edit & Delete buttons on hover */}
                                    <div className="absolute -top-1 -right-1 hidden group-hover:flex items-center gap-0.5">
                                        <button
                                            onClick={() => startEditRole(role)}
                                            className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-500 text-white"
                                            title="Edit nama role"
                                        >
                                            <Edit2 className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                            onClick={() => deleteRole(role.id)}
                                            className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white"
                                            title="Hapus role"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ padding: 20, background: '#ffffff' }}>

                    {/* Module Tabs */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        {Object.entries(MODULE_MENUS).map(([modName, mod]) => {
                            const Icon = mod.icon;
                            const isActive = activeModule === modName;
                            const allGranted = isModuleFullyGranted(activeRole, modName);
                            const modColors = {
                                Bridge: { active: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
                                Blink: { active: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
                                Big: { active: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
                            };
                            const mc = modColors[modName];
                            return (
                                <button
                                    key={modName}
                                    onClick={() => setActiveModule(modName)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                                        border: `1px solid ${isActive ? mc.border : '#e5e7eb'}`,
                                        background: isActive ? mc.active : '#ffffff',
                                        color: isActive ? mc.text : '#6b7280',
                                        cursor: 'pointer', transition: 'all 0.15s'
                                    }}
                                >
                                    <Icon style={{ width: 15, height: 15 }} />
                                    {modName}
                                    {allGranted && <Check style={{ width: 13, height: 13, color: '#16a34a' }} />}
                                </button>
                            );
                        })}
                    </div>

                    {/* Module Header + Grant All */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderRadius: 10, marginBottom: 12,
                        background: '#f0f9ff', border: '1px solid #bae6fd'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {ModuleIcon && <ModuleIcon style={{ width: 18, height: 18, color: '#0284c7' }} />}
                            <span style={{ fontWeight: 600, color: '#0369a1', fontSize: 14 }}>Modul {activeModule}</span>
                            <span style={{ fontSize: 12, color: '#64748b' }}>
                                — Role: <strong style={{ color: '#334155' }}>{roles.find(r => r.id === activeRole)?.label}</strong>
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button
                                onClick={() => setAllPermsForModule(activeRole, activeModule, true)}
                                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', cursor: 'pointer' }}
                            >
                                Izinkan Semua
                            </button>
                            <button
                                onClick={() => setAllPermsForModule(activeRole, activeModule, false)}
                                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 7, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', cursor: 'pointer' }}
                            >
                                Tolak Semua
                            </button>
                        </div>
                    </div>

                    {/* Permission Table */}
                    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#ffffff' }}>
                            <thead>
                                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', width: 200, whiteSpace: 'nowrap' }}>
                                        Menu / Fitur
                                    </th>
                                    <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                        Semua
                                    </th>
                                    {PERMISSION_COLS.map(col => (
                                        <th key={col.key} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentMenus.map((menu, idx) => {
                                    const perms = permissions[activeRole]?.[menu.code] || DEFAULT_PERMS();
                                    const allOn = PERMISSION_COLS.every(c => perms[c.key]);
                                    const someOn = PERMISSION_COLS.some(c => perms[c.key]);
                                    return (
                                        <tr key={menu.code}
                                            style={{ background: idx % 2 === 0 ? '#ffffff' : '#f9fafb', borderBottom: '1px solid #f3f4f6' }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#eff6ff'}
                                            onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f9fafb'}
                                        >
                                            <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 500, color: '#111827', whiteSpace: 'nowrap' }}>
                                                {menu.label}
                                            </td>
                                            {/* Toggle All */}
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setAllPermsForMenu(activeRole, menu.code, !allOn)}
                                                    style={{
                                                        width: 20, height: 20, borderRadius: 4, border: `2px solid ${allOn ? '#2563eb' : someOn ? '#93c5fd' : '#d1d5db'}`,
                                                        background: allOn ? '#2563eb' : someOn ? '#dbeafe' : '#ffffff',
                                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                        cursor: 'pointer', transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {allOn
                                                        ? <Check style={{ width: 12, height: 12, color: '#fff' }} />
                                                        : someOn
                                                            ? <Minus style={{ width: 12, height: 12, color: '#2563eb' }} />
                                                            : null}
                                                </button>
                                            </td>
                                            {/* Individual Perms */}
                                            {PERMISSION_COLS.map(col => (
                                                <td key={col.key} style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => togglePerm(activeRole, menu.code, col.key)}
                                                        style={{
                                                            width: 20, height: 20, borderRadius: 4,
                                                            border: `2px solid ${perms[col.key] ? '#2563eb' : '#d1d5db'}`,
                                                            background: perms[col.key] ? '#2563eb' : '#ffffff',
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            cursor: 'pointer', transition: 'all 0.15s'
                                                        }}
                                                    >
                                                        {perms[col.key] && <Check style={{ width: 12, height: 12, color: '#fff' }} />}
                                                    </button>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Save Row */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={savePermissions}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 smooth-transition disabled:opacity-60"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Menyimpan...' : 'Simpan Pengaturan Role'}
                        </button>
                    </div>

                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {roles.map(role => {
                    const totalMenus = Object.values(MODULE_MENUS).reduce((s, m) => s + m.menus.length, 0);
                    const grantedMenus = Object.values(MODULE_MENUS).reduce((s, m) =>
                        s + m.menus.filter(menu => isMenuFullyGranted(role.id, menu.code)).length, 0);
                    const pct = totalMenus ? Math.round((grantedMenus / totalMenus) * 100) : 0;
                    return (
                        <button
                            key={role.id}
                            onClick={() => setActiveRole(role.id)}
                            className={`p-3 rounded-xl border smooth-transition text-left ${activeRole === role.id
                                ? 'bg-accent-blue/10 border-accent-blue/40'
                                : 'glass-card border-dark-border hover:border-dark-border/80'
                                }`}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Shield className="w-4 h-4 text-silver-dark" />
                                <span className="text-sm font-medium text-silver-light truncate">{role.label}</span>
                            </div>
                            <div className="text-xs text-silver-dark mb-1.5">{grantedMenus} / {totalMenus} menu diizinkan</div>
                            <div className="w-full bg-dark-border rounded-full h-1.5">
                                <div
                                    className="h-1.5 rounded-full bg-gradient-to-r from-accent-blue to-accent-cyan"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

        </div>
    );
};

export default RolePermissions;
