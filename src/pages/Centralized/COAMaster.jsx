import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import XLSX from 'xlsx-js-style';
const { read, utils } = XLSX;
import {
    Plus, Search, Edit, Trash2, FileText, CheckCircle, XCircle, Grid, List, Upload, Clock
} from 'lucide-react';

const COAMaster = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const fileInputRef = useRef(null);

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        code: '',
        name: '',
        type: 'ASSET',
        description: '',
        parent_code: '',
        is_active: true
    });

    const accountTypes = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target.result;
                const wb = read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = utils.sheet_to_json(ws);

                if (data.length === 0) {
                    alert('File Excel kosong atau format tidak sesuai.');
                    return;
                }

                // Transform and Validate Data
                // Transform and Validate Data
                const validData = data.map(row => {
                    // Map 'Group' from Excel to valid DB Schema 'Type'
                    let mappedType = 'ASSET'; // Default
                    const rawGroup = (row['Group'] || row['group'] || row['Type'] || row['type'] || '').toUpperCase();

                    if (rawGroup.includes('ASSET') || rawGroup.includes('ASET') || rawGroup.includes('LANCAR') || rawGroup.includes('TETAP') || rawGroup.includes('HARTA')) mappedType = 'ASSET';
                    else if (rawGroup.includes('LIABILITY') || rawGroup.includes('KEWAJIBAN') || rawGroup.includes('UTANG')) mappedType = 'LIABILITY';
                    else if (rawGroup.includes('EQUITY') || rawGroup.includes('MODAL') || rawGroup.includes('EKUITAS')) mappedType = 'EQUITY';
                    else if (rawGroup.includes('REVENUE') || rawGroup.includes('INCOME') || rawGroup.includes('PENDAPATAN')) mappedType = 'REVENUE';
                    else if (rawGroup.includes('EXPENSE') || rawGroup.includes('BEBAN') || rawGroup.includes('BIAYA')) mappedType = 'EXPENSE';

                    return {
                        code: row['Code'] || row['code'] ? String(row['Code'] || row['code']) : null,
                        name: row['Name'] || row['name'],
                        type: mappedType,
                        parent_code: row['Master Code #'] ? String(row['Master Code #']) : null,
                        description: `Level: ${row['Level'] || '-'}`, // Store Level in description for reference
                    };
                }).filter(item => item.code && item.name);

                if (validData.length === 0) {
                    alert('Tidak ada data valid yang ditemukan. Pastikan header sesuai screenshot (Code, Name, Master Code #, Group).');
                    return;
                }

                if (confirm(`Akan mengimport ${validData.length} akun. Lanjutkan?`)) {
                    setLoading(true);
                    const { error } = await supabase
                        .from('finance_coa')
                        .upsert(validData, { onConflict: 'code' });

                    if (error) throw error;

                    alert('Import berhasil!');
                    fetchAccounts();
                }

            } catch (error) {
                console.error('Error importing file:', error);
                alert('Gagal mengimport file: ' + error.message);
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };

        reader.readAsBinaryString(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('finance_coa')
                    .update({
                        code: formData.code,
                        name: formData.name,
                        type: formData.type,
                        description: formData.description,
                        parent_code: formData.parent_code || null,
                        // is_active: formData.is_active
                    })
                    .eq('id', formData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('finance_coa')
                    .insert([{
                        code: formData.code,
                        name: formData.name,
                        type: formData.type,
                        description: formData.description,
                        parent_code: formData.parent_code || null
                    }]);
                if (error) throw error;
            }

            await fetchAccounts();
            setShowModal(false);
            resetForm();
            alert(isEditing ? 'Account updated!' : 'Account created!');
        } catch (error) {
            console.error('Error saving account:', error);
            alert('Error saving account: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this account?')) return;
        try {
            const { error } = await supabase
                .from('finance_coa')
                .delete()
                .eq('id', id);

            if (error) throw error;
            await fetchAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Error deleting account: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            id: null,
            code: '',
            name: '',
            type: 'ASSET',
            description: '',
            parent_code: '',
            is_active: true
        });
        setIsEditing(false);
    };

    const handleEdit = (acc) => {
        setFormData(acc);
        setIsEditing(true);
        setShowModal(true);
    };

    const filteredAccounts = accounts.filter(acc => {
        const matchesSearch = acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            acc.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || acc.type === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Chart of Accounts</h1>
                    <p className="text-silver-dark mt-1">Master Data Kode Akuntansi Keuangan</p>
                </div>
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        accept=".xlsx, .xls"
                    />
                    <Button
                        variant="secondary"
                        icon={Upload}
                        onClick={() => fileInputRef.current.click()}
                    >
                        Import Excel
                    </Button>
                    <Button onClick={() => { resetForm(); setShowModal(true); }} icon={Plus}>
                        Add Account
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-silver-dark text-xs uppercase tracking-wider font-semibold">Total Akun Terdaftar</p>
                        <h3 className="text-2xl font-bold gradient-text mt-1">{accounts.length}</h3>
                    </div>
                    <div className="p-3 bg-blue-500/10 rounded-full border border-blue-500/20">
                        <Grid className="w-6 h-6 text-accent-blue" />
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <p className="text-silver-dark text-xs uppercase tracking-wider font-semibold">Terakhir Diupdate</p>
                        <h3 className="text-2xl font-bold gradient-text mt-1">
                            {accounts.length > 0
                                ? new Date(Math.max(...accounts.map(a => new Date(a.updated_at || a.created_at || Date.now())))).toLocaleDateString('id-ID', {
                                    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                })
                                : '-'}
                        </h3>
                    </div>
                    <div className="p-3 bg-green-500/10 rounded-full border border-green-500/20">
                        <Clock className="w-6 h-6 text-green-400" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search code or account name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light min-w-[200px]"
                >
                    <option value="ALL">All Types</option>
                    {accountTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface border-b border-dark-border">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Code</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Account Name</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Description</th>
                                <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-8 text-silver-dark text-xs">Loading accounts...</td></tr>
                            ) : filteredAccounts.length === 0 ? (
                                <tr><td colSpan="5" className="text-center py-8 text-silver-dark text-xs">No accounts found.</td></tr>
                            ) : (
                                filteredAccounts.map((acc) => (
                                    <tr key={acc.id} className="hover:bg-dark-surface/50 smooth-transition">
                                        <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-accent-blue font-mono">
                                            {acc.code}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs text-silver-light font-medium">
                                            {acc.name}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-xs">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border
                                                ${acc.type === 'ASSET' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    acc.type === 'LIABILITY' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        acc.type === 'EQUITY' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                            acc.type === 'REVENUE' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                                'bg-red-500/10 text-red-400 border-red-500/20'
                                                }`}>
                                                {acc.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-xs text-silver-dark truncate max-w-xs block">
                                            {acc.description || '-'}
                                        </td>
                                        <td className="px-4 py-2 text-right whitespace-nowrap text-xs font-medium">
                                            <button onClick={() => handleEdit(acc)} className="text-accent-blue hover:text-blue-400 mr-3">
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => handleDelete(acc.id)} className="text-red-400 hover:text-red-300">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <Modal isOpen={true} onClose={() => setShowModal(false)} title={isEditing ? "Edit Account" : "New Account"}>
                    <form onSubmit={handleSave} className="p-6 space-y-4">
                        <h2 className="text-xl font-bold text-silver-light mb-4">{isEditing ? 'Edit Account' : 'Create New Account'}</h2>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-1">Account Code</label>
                            <input
                                type="text"
                                value={formData.code}
                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                required
                                placeholder="e.g. 1101"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-1">Account Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                required
                                placeholder="e.g. Kas Besar"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                            >
                                {accountTypes.map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue outline-none"
                                rows="3"
                                placeholder="Optional description"
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-silver-dark hover:bg-dark-surface rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <Button type="submit">
                                {isEditing ? 'Update Account' : 'Create Account'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default COAMaster;
