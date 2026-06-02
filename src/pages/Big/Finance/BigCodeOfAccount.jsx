import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/Common/Button';
import { useAuth } from '../../../context/AuthContext';
import {
    Plus, Search, Edit2, Trash2, ChevronDown, ChevronRight, Save, X, FileSpreadsheet
} from 'lucide-react';

const BigCodeOfAccount = () => {
    const { canCreate, canEdit, canDelete } = useAuth();
    const hasCreate = canCreate('big_coa');
    const hasEdit   = canEdit('big_coa');
    const hasDelete = canDelete('big_coa');

    const [accounts, setAccounts]         = useState([]);
    const [loading, setLoading]           = useState(true);
    const [searchTerm, setSearchTerm]     = useState('');
    const [showModal, setShowModal]       = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
    const [filterGroup, setFilterGroup]   = useState('all');

    const GROUPS = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

    const emptyForm = {
        code: '',
        name: '',
        parent_code: '',
        type: 'ASSET',
        level: 1,
        is_trial_balance: true,
        is_profit_loss: false,
        is_balance_sheet: false,
        is_ar: false,
        is_ap: false,
        is_cashflow: false,
        description: '',
    };

    const [form, setForm] = useState(emptyForm);

    useEffect(() => { fetchAccounts(); }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('big_coa')
                .select('*')
                .order('code', { ascending: true });
            if (error) throw error;
            setAccounts(data || []);
        } catch (err) {
            console.error('Error fetching Big COA:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        try {
            if (editingAccount) {
                const { error } = await supabase
                    .from('big_coa')
                    .update({
                        code: form.code,
                        name: form.name,
                        parent_code: form.parent_code || null,
                        type: form.type,
                        level: parseInt(form.level) || 1,
                        is_trial_balance: form.is_trial_balance,
                        is_profit_loss: form.is_profit_loss,
                        is_balance_sheet: form.is_balance_sheet,
                        is_ar: form.is_ar,
                        is_ap: form.is_ap,
                        is_cashflow: form.is_cashflow,
                        description: form.description,
                    })
                    .eq('id', editingAccount.id);
                if (error) throw error;
                alert('✅ Akun berhasil diperbarui');
            } else {
                const { error } = await supabase
                    .from('big_coa')
                    .insert([{
                        ...form,
                        parent_code: form.parent_code || null,
                        level: parseInt(form.level) || 1,
                        is_active: true,
                    }]);
                if (error) throw error;
                alert('✅ Akun berhasil ditambahkan');
            }
            setShowModal(false);
            setEditingAccount(null);
            setForm(emptyForm);
            fetchAccounts();
        } catch (err) {
            console.error('Error saving Big COA:', err);
            alert('❌ Error: ' + err.message);
        }
    };

    const handleEdit = (account) => {
        if (!hasEdit) return;
        setEditingAccount(account);
        setForm({
            code: account.code || '',
            name: account.name || '',
            parent_code: account.parent_code || '',
            type: account.type || 'ASSET',
            level: account.level || 1,
            is_trial_balance: account.is_trial_balance ?? true,
            is_profit_loss: account.is_profit_loss ?? false,
            is_balance_sheet: account.is_balance_sheet ?? false,
            is_ar: account.is_ar ?? false,
            is_ap: account.is_ap ?? false,
            is_cashflow: account.is_cashflow ?? false,
            description: account.description || '',
        });
        setShowModal(true);
    };

    const handleDelete = async (account) => {
        if (!hasDelete) return;
        if (!confirm(`Hapus akun ${account.code} - ${account.name}?`)) return;
        try {
            const { error } = await supabase
                .from('big_coa')
                .update({ is_active: false })
                .eq('id', account.id);
            if (error) throw error;
            alert('✅ Akun dinonaktifkan');
            fetchAccounts();
        } catch (err) {
            console.error('Error deleting Big COA:', err);
            alert('❌ Error: ' + err.message);
        }
    };

    const handleDeleteAll = async () => {
        if (!hasDelete || accounts.length === 0) return;
        if (!confirm(`⚠️ Hapus SELURUH ${accounts.length} akun COA Big? Tindakan ini tidak dapat dibatalkan.`)) return;
        if (prompt('Ketik "HAPUS" untuk konfirmasi:') !== 'HAPUS') {
            alert('Konfirmasi tidak sesuai. Dibatalkan.');
            return;
        }
        try {
            setLoading(true);
            const { error } = await supabase
                .from('big_coa')
                .update({ is_active: false })
                .eq('is_active', true);
            if (error) throw error;
            alert('✅ Seluruh COA Big dinonaktifkan');
            fetchAccounts();
        } catch (err) {
            alert('❌ Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleGroup = (group) =>
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );

    const GROUP_STYLE = {
        ASSET:     { label: 'text-blue-400',   bg: 'bg-blue-500/10'   },
        LIABILITY: { label: 'text-red-400',    bg: 'bg-red-500/10'    },
        EQUITY:    { label: 'text-purple-400', bg: 'bg-purple-500/10' },
        REVENUE:   { label: 'text-green-400',  bg: 'bg-green-500/10'  },
        EXPENSE:   { label: 'text-orange-400', bg: 'bg-orange-500/10' },
    };

    const filtered = accounts.filter(acc => {
        const matchSearch =
            acc.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchGroup = filterGroup === 'all' || acc.type === filterGroup;
        return matchSearch && matchGroup;
    });

    const grouped = filtered.reduce((acc, a) => {
        const key = a.type || 'OTHER';
        if (!acc[key]) acc[key] = [];
        acc[key].push(a);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">COA Master — BIG</h1>
                    <p className="text-silver-dark mt-1">Master data kode akun keuangan BIG (Event Organizer)</p>
                </div>
                <div className="flex gap-2">
                    {hasDelete && accounts.length > 0 && (
                        <Button variant="danger" icon={Trash2} onClick={handleDeleteAll}>
                            Hapus Semua
                        </Button>
                    )}
                    {hasCreate && (
                        <Button
                            icon={Plus}
                            onClick={() => {
                                setForm(emptyForm);
                                setEditingAccount(null);
                                setShowModal(true);
                            }}
                        >
                            Tambah Akun
                        </Button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {GROUPS.map(group => {
                    const style = GROUP_STYLE[group] || {};
                    return (
                        <div
                            key={group}
                            className={`glass-card p-3 rounded-lg cursor-pointer hover:scale-105 transition-transform ${filterGroup === group ? 'ring-2 ring-orange-400' : ''}`}
                            onClick={() => setFilterGroup(filterGroup === group ? 'all' : group)}
                        >
                            <p className="text-xs text-silver-dark">{group}</p>
                            <p className={`text-xl font-bold ${style.label}`}>
                                {accounts.filter(a => a.type === group).length}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Search */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari kode atau nama akun..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                    />
                </div>
                {filterGroup !== 'all' && (
                    <Button variant="secondary" onClick={() => setFilterGroup('all')}>
                        <X className="w-4 h-4 mr-1" /> Clear
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Kode</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Nama Akun</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Master Code</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Grup</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Lvl</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">TB</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">P&L</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">BS</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">AR</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">AP</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">CF</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {Object.entries(grouped).map(([group, accts]) => {
                                const style = GROUP_STYLE[group] || { label: 'text-silver', bg: 'bg-white/5' };
                                return (
                                    <React.Fragment key={group}>
                                        <tr
                                            className={`${style.bg} ${style.label} cursor-pointer hover:opacity-80`}
                                            onClick={() => toggleGroup(group)}
                                        >
                                            <td colSpan="12" className="px-4 py-2">
                                                <div className="flex items-center gap-2 font-bold">
                                                    {expandedGroups.includes(group)
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />
                                                    }
                                                    {group} ({accts.length} akun)
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedGroups.includes(group) && accts.map(acc => (
                                            <tr key={acc.id} className="hover:bg-dark-surface/50">
                                                <td className="px-4 py-2 text-sm font-mono font-medium text-orange-400"
                                                    style={{ paddingLeft: `${16 + ((acc.level || 1) - 1) * 16}px` }}>
                                                    {acc.code}
                                                </td>
                                                <td className="px-4 py-2 text-sm text-silver-light">{acc.name}</td>
                                                <td className="px-4 py-2 text-sm text-silver-dark font-mono">{acc.parent_code || '–'}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${style.bg} ${style.label}`}>
                                                        {acc.type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-center text-sm text-silver-light">{acc.level}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_trial_balance ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_profit_loss ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_balance_sheet ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_ar ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_ap ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center text-xs">{acc.is_cashflow ? '✅' : ''}</td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        {hasEdit && (
                                                            <button
                                                                onClick={() => handleEdit(acc)}
                                                                className="p-1.5 rounded hover:bg-blue-500/20 text-blue-400"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                        {hasDelete && (
                                                            <button
                                                                onClick={() => handleDelete(acc)}
                                                                className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan="12" className="px-4 py-8 text-center text-silver-dark">
                                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>Tidak ada akun ditemukan</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-dark-card border border-dark-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-dark-border">
                            <h2 className="text-xl font-bold text-silver-light">
                                {editingAccount ? 'Edit Akun' : 'Tambah Akun Baru'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-silver-dark hover:text-silver-light"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Code & Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-silver-dark mb-1">Kode Akun *</label>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        placeholder="mis. 1-1100"
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light font-mono focus:border-orange-400 outline-none"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver-dark mb-1">Nama Akun *</label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Nama akun"
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Master Code, Type, Level */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-silver-dark mb-1">Master Code</label>
                                    <select
                                        value={form.parent_code}
                                        onChange={(e) => setForm({ ...form, parent_code: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                                    >
                                        <option value="">-- Tidak ada (top level) --</option>
                                        {accounts
                                            .filter(a => a.code !== form.code)
                                            .map(a => (
                                                <option key={a.id} value={a.code}>
                                                    {a.code} – {a.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver-dark mb-1">Grup / Tipe *</label>
                                    <select
                                        value={form.type}
                                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                                        required
                                    >
                                        {GROUPS.map(g => (
                                            <option key={g} value={g}>{g}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver-dark mb-1">Level</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.level}
                                        onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                                    />
                                </div>
                            </div>

                            {/* Report Classification */}
                            <div>
                                <label className="block text-sm font-medium text-silver-dark mb-2">Klasifikasi Laporan</label>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                    {[
                                        { key: 'is_trial_balance', label: 'Trial Balance' },
                                        { key: 'is_profit_loss',   label: 'Laba Rugi'    },
                                        { key: 'is_balance_sheet', label: 'Neraca'        },
                                        { key: 'is_ar',            label: 'AR'            },
                                        { key: 'is_ap',            label: 'AP'            },
                                        { key: 'is_cashflow',      label: 'Cashflow'      },
                                    ].map(item => (
                                        <label
                                            key={item.key}
                                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                                form[item.key]
                                                    ? 'border-orange-400 bg-orange-400/10'
                                                    : 'border-dark-border hover:border-silver-dark'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form[item.key]}
                                                onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <span className={`text-xs ${form[item.key] ? 'text-orange-400' : 'text-silver-dark'}`}>
                                                {form[item.key] ? '✓' : '○'} {item.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-silver-dark mb-1">Deskripsi</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Opsional..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-orange-400 outline-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                                    Batal
                                </Button>
                                {(!editingAccount || hasEdit) && (
                                    <Button type="submit" icon={Save}>
                                        {editingAccount ? 'Simpan Perubahan' : 'Tambah Akun'}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BigCodeOfAccount;
