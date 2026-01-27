import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    ChevronDown,
    ChevronRight,
    Save,
    X,
    FileSpreadsheet,
    Filter
} from 'lucide-react';

const CodeOfAccount = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
    const [filterGroup, setFilterGroup] = useState('all');

    const [form, setForm] = useState({
        code: '',
        name: '',
        master_code: '',
        account_group: 'Asset',
        level: 1,
        in_trial_balance: true,
        in_profit_loss: false,
        in_balance_sheet: false,
        is_ar: false,
        is_ap: false,
        in_cashflow: false,
        description: ''
    });

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('code_of_accounts')
                .select('*')
                .eq('is_active', true)
                .order('code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e?.preventDefault();

        try {
            if (editingAccount) {
                const { error } = await supabase
                    .from('code_of_accounts')
                    .update({
                        code: form.code,
                        name: form.name,
                        master_code: form.master_code || null,
                        account_group: form.account_group,
                        level: form.level,
                        in_trial_balance: form.in_trial_balance,
                        in_profit_loss: form.in_profit_loss,
                        in_balance_sheet: form.in_balance_sheet,
                        is_ar: form.is_ar,
                        is_ap: form.is_ap,
                        in_cashflow: form.in_cashflow,
                        description: form.description
                    })
                    .eq('id', editingAccount.id);

                if (error) throw error;
                alert('✅ Account updated successfully');
            } else {
                const { error } = await supabase
                    .from('code_of_accounts')
                    .insert([{
                        ...form,
                        master_code: form.master_code || null
                    }]);

                if (error) throw error;
                alert('✅ Account created successfully');
            }

            setShowModal(false);
            setEditingAccount(null);
            resetForm();
            fetchAccounts();
        } catch (error) {
            console.error('Error saving account:', error);
            alert('❌ Error: ' + error.message);
        }
    };

    const handleEdit = (account) => {
        setEditingAccount(account);
        setForm({
            code: account.code,
            name: account.name,
            master_code: account.master_code || '',
            account_group: account.account_group,
            level: account.level,
            in_trial_balance: account.in_trial_balance,
            in_profit_loss: account.in_profit_loss,
            in_balance_sheet: account.in_balance_sheet,
            is_ar: account.is_ar,
            is_ap: account.is_ap,
            in_cashflow: account.in_cashflow,
            description: account.description || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (account) => {
        if (!confirm(`Delete account ${account.code} - ${account.name}?`)) return;

        try {
            const { error } = await supabase
                .from('code_of_accounts')
                .update({ is_active: false })
                .eq('id', account.id);

            if (error) throw error;
            alert('✅ Account deleted');
            fetchAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('❌ Error: ' + error.message);
        }
    };

    const resetForm = () => {
        setForm({
            code: '',
            name: '',
            master_code: '',
            account_group: 'Asset',
            level: 1,
            in_trial_balance: true,
            in_profit_loss: false,
            in_balance_sheet: false,
            is_ar: false,
            is_ap: false,
            in_cashflow: false,
            description: ''
        });
    };

    const toggleGroup = (group) => {
        setExpandedGroups(prev =>
            prev.includes(group)
                ? prev.filter(g => g !== group)
                : [...prev, group]
        );
    };

    const groupColors = {
        'Asset': 'text-blue-400 bg-blue-500/10',
        'Liability': 'text-red-400 bg-red-500/10',
        'Equity': 'text-purple-400 bg-purple-500/10',
        'Revenue': 'text-green-400 bg-green-500/10',
        'Expense': 'text-orange-400 bg-orange-500/10'
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch =
            acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesGroup = filterGroup === 'all' || acc.account_group === filterGroup;
        return matchesSearch && matchesGroup;
    });

    // Group accounts by account_group
    const groupedAccounts = filteredAccounts.reduce((acc, account) => {
        const group = account.account_group;
        if (!acc[group]) acc[group] = [];
        acc[group].push(account);
        return acc;
    }, {});

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-orange"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Code of Account</h1>
                    <p className="text-silver-dark mt-1">Master data kode akun untuk klasifikasi anggaran</p>
                </div>
                <Button
                    icon={Plus}
                    onClick={() => {
                        resetForm();
                        setEditingAccount(null);
                        setShowModal(true);
                    }}
                >
                    Add Account
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(group => (
                    <div
                        key={group}
                        className={`glass-card p-3 rounded-lg cursor-pointer hover:scale-105 transition-transform ${filterGroup === group ? 'ring-2 ring-accent-orange' : ''}`}
                        onClick={() => setFilterGroup(filterGroup === group ? 'all' : group)}
                    >
                        <p className="text-xs text-silver-dark">{group}</p>
                        <p className={`text-xl font-bold ${groupColors[group]?.split(' ')[0]}`}>
                            {accounts.filter(a => a.account_group === group).length}
                        </p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search by code or name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                    />
                </div>
                {filterGroup !== 'all' && (
                    <Button variant="outline" onClick={() => setFilterGroup('all')}>
                        <X className="w-4 h-4 mr-1" /> Clear Filter
                    </Button>
                )}
            </div>

            {/* Account List */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-silver-dark uppercase">Master Code #</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Group</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Level</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Trial Balance</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Profit & Loss</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Balance Sheet</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">AR</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">AP</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Cashflow</th>
                                <th className="px-4 py-3 text-center text-xs font-bold text-silver-dark uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {Object.entries(groupedAccounts).map(([group, accts]) => (
                                <React.Fragment key={group}>
                                    {/* Group Header */}
                                    <tr
                                        className={`${groupColors[group]} cursor-pointer hover:opacity-80`}
                                        onClick={() => toggleGroup(group)}
                                    >
                                        <td colSpan="12" className="px-4 py-2">
                                            <div className="flex items-center gap-2 font-bold">
                                                {expandedGroups.includes(group) ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                                {group} ({accts.length} accounts)
                                            </div>
                                        </td>
                                    </tr>
                                    {/* Account Rows */}
                                    {expandedGroups.includes(group) && accts.map(account => (
                                        <tr key={account.id} className="hover:bg-dark-surface/50">
                                            <td className="px-4 py-2 text-sm">
                                                <span
                                                    className="font-mono font-medium text-accent-orange"
                                                    style={{ paddingLeft: `${(account.level - 1) * 16}px` }}
                                                >
                                                    {account.code}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver-light">
                                                <span style={{ paddingLeft: `${(account.level - 1) * 16}px` }}>
                                                    {account.name}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-silver-dark font-mono">
                                                {account.master_code || '-'}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <span className={`px-2 py-0.5 rounded text-xs ${groupColors[account.account_group]}`}>
                                                    {account.account_group}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-center text-sm text-silver-light">
                                                {account.level}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.in_trial_balance ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.in_profit_loss ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.in_balance_sheet ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.is_ar ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.is_ap ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {account.in_cashflow ? '✅' : ''}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => handleEdit(account)}
                                                        className="p-1.5 rounded hover:bg-blue-500/20 text-blue-400"
                                                        title="Edit"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(account)}
                                                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                            {filteredAccounts.length === 0 && (
                                <tr>
                                    <td colSpan="12" className="px-4 py-8 text-center text-silver-dark">
                                        <FileSpreadsheet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p>No accounts found</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-dark-card rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-dark-border">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-silver-light">
                                {editingAccount ? 'Edit Account' : 'Add New Account'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-silver-dark dark:hover:text-silver-light"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Code & Name */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                        Code *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                                        placeholder="e.g., 1-1100"
                                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light font-mono"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                        Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Account name"
                                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Master Code & Group */}
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                        Master Code #
                                    </label>
                                    <select
                                        value={form.master_code}
                                        onChange={(e) => setForm({ ...form, master_code: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                                    >
                                        <option value="">-- None (Top Level) --</option>
                                        {accounts
                                            .filter(a => a.code !== form.code)
                                            .map(a => (
                                                <option key={a.id} value={a.code}>
                                                    {a.code} - {a.name}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                        Group *
                                    </label>
                                    <select
                                        value={form.account_group}
                                        onChange={(e) => setForm({ ...form, account_group: e.target.value })}
                                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                                        required
                                    >
                                        <option value="Asset">Asset</option>
                                        <option value="Liability">Liability</option>
                                        <option value="Equity">Equity</option>
                                        <option value="Revenue">Revenue</option>
                                        <option value="Expense">Expense</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                        Level
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="9"
                                        value={form.level}
                                        onChange={(e) => setForm({ ...form, level: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                                    />
                                </div>
                            </div>

                            {/* Report Classification */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-2">
                                    Report Classification
                                </label>
                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                    {[
                                        { key: 'in_trial_balance', label: 'Trial Balance' },
                                        { key: 'in_profit_loss', label: 'Profit & Loss' },
                                        { key: 'in_balance_sheet', label: 'Balance Sheet' },
                                        { key: 'is_ar', label: 'AR' },
                                        { key: 'is_ap', label: 'AP' },
                                        { key: 'in_cashflow', label: 'Cashflow' }
                                    ].map(item => (
                                        <label
                                            key={item.key}
                                            className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${form[item.key]
                                                    ? 'border-accent-orange bg-accent-orange/10'
                                                    : 'border-dark-border hover:border-silver-dark'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={form[item.key]}
                                                onChange={(e) => setForm({ ...form, [item.key]: e.target.checked })}
                                                className="sr-only"
                                            />
                                            <span className={`text-sm ${form[item.key] ? 'text-accent-orange' : 'text-silver-dark'}`}>
                                                {form[item.key] ? '✓' : '○'} {item.label}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-silver-dark mb-1">
                                    Description
                                </label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Optional description..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setShowModal(false)}
                                >
                                    Cancel
                                </Button>
                                <Button type="submit" icon={Save}>
                                    {editingAccount ? 'Update' : 'Save'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CodeOfAccount;
