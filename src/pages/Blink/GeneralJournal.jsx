import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    BookOpen, Plus, Search, Calendar, Download, Filter,
    ArrowUpRight, ArrowDownLeft, CheckCircle, AlertCircle,
    FileText, DollarSign, CreditCard, Wallet, Eye, Trash2,
    RefreshCw, Database, FileSpreadsheet, ExternalLink
} from 'lucide-react';
import XLSX from 'xlsx-js-style';

const GeneralJournal = () => {
    const navigate = useNavigate();
    const [entries, setEntries] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of current year
        end: new Date().toISOString().split('T')[0]
    });

    // Modal states
    const [showNewEntryModal, setShowNewEntryModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);

    // New entry form
    const [newEntry, setNewEntry] = useState({
        entry_date: new Date().toISOString().split('T')[0],
        description: '',
        lines: [
            { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 },
            { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }
        ]
    });

    useEffect(() => {
        fetchAccounts();
        fetchEntries();
    }, [dateRange]);

    const fetchAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchEntries = async () => {
        try {
            setLoading(true);
            let query = supabase
                .from('blink_journal_entries')
                .select('*')
                .order('entry_date', { ascending: false })
                .order('created_at', { ascending: false });

            if (dateRange.start) {
                query = query.gte('entry_date', dateRange.start);
            }
            if (dateRange.end) {
                query = query.lte('entry_date', dateRange.end);
            }

            const { data, error } = await query;

            if (error) {
                if (error.message?.includes('does not exist')) {
                    alert('Database Schema Outdated: Please run migration 034 to fix missing columns.');
                }
                throw error;
            }
            setEntries(data || []);
        } catch (error) {
            console.error('Error fetching journal entries:', error);
        } finally {
            setLoading(false);
        }
    };

    // Format currency
    const formatCurrency = (value) => {
        if (!value || value === 0) return '-';
        return `Rp ${Math.abs(value).toLocaleString('id-ID')}`;
    };

    // Filter entries based on search term
    const getFilteredEntries = () => {
        let filtered = entries;

        // Search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(e =>
                e.entry_number?.toLowerCase().includes(term) ||
                e.description?.toLowerCase().includes(term) ||
                e.account_name?.toLowerCase().includes(term) ||
                e.reference_number?.toLowerCase().includes(term)
            );
        }

        return filtered;
    };

    // Group entries by batch_id or entry_number for display
    const getGroupedEntries = () => {
        const filtered = getFilteredEntries();
        const groups = {};

        filtered.forEach(entry => {
            const key = entry.batch_id || entry.entry_number || entry.id;
            if (!groups[key]) {
                groups[key] = {
                    key,
                    date: entry.entry_date,
                    entry_number: entry.entry_number,
                    description: entry.description,
                    reference_type: entry.reference_type,
                    reference_number: entry.reference_number,
                    source: entry.source || 'auto',
                    lines: []
                };
            }
            groups[key].lines.push(entry);
        });

        // Sort by date descending
        return Object.values(groups).sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );
    };

    // Calculate totals
    const calculateTotals = () => {
        const filtered = getFilteredEntries();
        const totalDebit = filtered.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = filtered.reduce((sum, e) => sum + (e.credit || 0), 0);
        return { totalDebit, totalCredit, balance: totalDebit - totalCredit };
    };

    // Handle new entry line changes
    const handleLineChange = (index, field, value) => {
        const updatedLines = [...newEntry.lines];

        if (field === 'coa_id') {
            const account = accounts.find(a => a.id === value);
            updatedLines[index] = {
                ...updatedLines[index],
                coa_id: value,
                account_code: account?.code || '',
                account_name: account?.name || ''
            };
        } else {
            updatedLines[index] = {
                ...updatedLines[index],
                [field]: field === 'debit' || field === 'credit' ? parseFloat(value) || 0 : value
            };
        }

        setNewEntry({ ...newEntry, lines: updatedLines });
    };

    // Add new line
    const addNewLine = () => {
        setNewEntry({
            ...newEntry,
            lines: [...newEntry.lines, { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }]
        });
    };

    // Remove line
    const removeLine = (index) => {
        if (newEntry.lines.length <= 2) return; // Minimum 2 lines
        const updatedLines = newEntry.lines.filter((_, i) => i !== index);
        setNewEntry({ ...newEntry, lines: updatedLines });
    };

    // Check if entry is balanced
    const isEntryBalanced = () => {
        const totalDebit = newEntry.lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const totalCredit = newEntry.lines.reduce((sum, l) => sum + (l.credit || 0), 0);
        return Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    };

    // Save new manual entry
    const saveNewEntry = async () => {
        if (!isEntryBalanced()) {
            alert('Jurnal harus balance! Total Debit harus sama dengan Total Kredit.');
            return;
        }

        if (!newEntry.description) {
            alert('Keterangan wajib diisi.');
            return;
        }

        try {
            // Generate entry number
            const entryNumber = `JE-${new Date().toISOString().slice(2, 4)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Date.now().toString().slice(-4)}`;
            const batchId = crypto.randomUUID();

            // Create entries for each line
            const entriesToInsert = newEntry.lines
                .filter(l => l.coa_id && (l.debit > 0 || l.credit > 0))
                .map(line => ({
                    entry_number: entryNumber,
                    entry_date: newEntry.entry_date,
                    entry_type: 'adjustment',
                    account_code: line.account_code,
                    account_name: line.account_name,
                    coa_id: line.coa_id,
                    debit: line.debit || 0,
                    credit: line.credit || 0,
                    description: newEntry.description,
                    batch_id: batchId,
                    source: 'manual',
                    currency: 'IDR'
                }));

            const { error } = await supabase
                .from('blink_journal_entries')
                .insert(entriesToInsert);

            if (error) throw error;

            alert('Jurnal berhasil disimpan!');
            setShowNewEntryModal(false);
            setNewEntry({
                entry_date: new Date().toISOString().split('T')[0],
                description: '',
                lines: [
                    { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 },
                    { coa_id: '', account_code: '', account_name: '', debit: 0, credit: 0 }
                ]
            });
            fetchEntries();
        } catch (error) {
            console.error('Error saving journal entry:', error);
            alert('Gagal menyimpan jurnal: ' + error.message);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        const filtered = getFilteredEntries();
        const headers = [
            'Tanggal',
            'No. Jurnal',
            'Sumber',
            'Kode Akun',
            'Nama Akun',
            'Keterangan',
            'Pihak Terkait',
            'No. Referensi',
            'Debit',
            'Kredit'
        ];

        const rows = filtered.map(e => [
            e.entry_date,
            e.entry_number,
            e.source || 'auto',
            e.account_code,
            e.account_name,
            e.description || '',
            e.party_name || '-',
            e.reference_number || '',
            e.debit || 0,
            e.credit || 0
        ]);

        // Calculate and add totals row
        const totalDebit = filtered.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = filtered.reduce((sum, e) => sum + (e.credit || 0), 0);
        rows.push([
            '', '', '', '', '', 'TOTAL', '', '',
            totalDebit,
            totalCredit
        ]);

        const escapeCsvField = (field) => {
            if (field === null || field === undefined) return '';
            const stringField = String(field);
            if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
                return `"${stringField.replace(/"/g, '""')}"`;
            }
            return stringField;
        };

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.map(escapeCsvField).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `jurnal_umum_${dateRange.start}_${dateRange.end}.csv`;
        link.click();
    };

    // Export to Excel
    const exportToExcel = () => {
        const filtered = getFilteredEntries();

        // Prepare data for Excel
        const data = filtered.map(e => ({
            'Tanggal': e.entry_date,
            'No. Jurnal': e.entry_number,
            'Sumber': e.source || 'auto',
            'Kode Akun': e.account_code,
            'Nama Akun': e.account_name,
            'Keterangan': e.description || '',
            'Pihak Terkait': e.party_name || '-',
            'No. Referensi': e.reference_number || '',
            'Debit': e.debit || 0,
            'Kredit': e.credit || 0
        }));

        // Calculate Totals
        const totalDebit = filtered.reduce((sum, e) => sum + (e.debit || 0), 0);
        const totalCredit = filtered.reduce((sum, e) => sum + (e.credit || 0), 0);

        // Add Total Row
        data.push({
            'Tanggal': '',
            'No. Jurnal': '',
            'Sumber': '',
            'Kode Akun': '',
            'Nama Akun': '',
            'Keterangan': 'TOTAL',
            'Pihak Terkait': '',
            'No. Referensi': '',
            'Debit': totalDebit,
            'Kredit': totalCredit
        });

        const worksheet = XLSX.utils.json_to_sheet(data);

        // Format Currency Columns (Debit=I, Credit=J -> indices 8, 9)
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; ++R) { // Skip header
            ['I', 'J'].forEach(col => {
                const cellRef = col + (R + 1);
                if (worksheet[cellRef]) {
                    // Indonesian format: 1.000.000 (dots for thousands)
                    // We set the format code to use thousands separator
                    worksheet[cellRef].z = '#,##0';
                }
            });
        }

        // Adjust column widths
        worksheet['!cols'] = [
            { wch: 12 }, // Tanggal
            { wch: 20 }, // No Jurnal
            { wch: 10 }, // Sumber
            { wch: 15 }, // Kode Akun
            { wch: 25 }, // Nama Akun
            { wch: 40 }, // Keterangan
            { wch: 25 }, // Pihak Terkait
            { wch: 20 }, // Referensi
            { wch: 15 }, // Debit
            { wch: 15 }  // Kredit
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Jurnal Umum");

        XLSX.writeFile(workbook, `Jurnal_Umum_${dateRange.start}_${dateRange.end}.xlsx`);
    };

    const totals = calculateTotals();
    const groupedEntries = getGroupedEntries();

    // Delete journal entry batch
    const deleteJournalEntry = async (batchId) => {
        if (!confirm('Apakah Anda yakin ingin menghapus jurnal ini? Tindakan ini tidak dapat dibatalkan.')) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('blink_journal_entries')
                .delete()
                .eq('batch_id', batchId);

            if (error) throw error;

            alert('Jurnal berhasil dihapus.');
            setShowDetailModal(false);
            fetchEntries();
        } catch (error) {
            console.error('Error deleting journal:', error);
            alert('Gagal menghapus jurnal: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Get all entries in the same batch as selectedEntry
    const selectedBatchFn = () => {
        if (!selectedEntry) return [];
        return entries.filter(e => e.batch_id === selectedEntry.batch_id);
    };

    const selectedBatch = selectedBatchFn();
    const batchTotal = selectedBatch.reduce((sum, e) => sum + (e.debit || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Jurnal Umum</h1>
                    <p className="text-silver-dark mt-1">General Journal - Pencatatan transaksi double-entry</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchEntries} title="Refresh Data">
                        Refresh
                    </Button>
                    <div className="flex rounded-lg overflow-hidden border border-dark-border">
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-silver-light hover:bg-dark-card border-r border-dark-border smooth-transition text-xs"
                        >
                            <FileText className="w-4 h-4" /> CSV
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition text-xs"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Excel
                        </button>
                    </div>
                    <Button icon={Plus} onClick={() => setShowNewEntryModal(true)}>
                        Jurnal Manual
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Debit</p>
                        <ArrowUpRight className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(totals.totalDebit)}</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Total Kredit</p>
                        <ArrowDownLeft className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(totals.totalCredit)}</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Selisih (Balance)</p>
                        {Math.abs(totals.balance) < 1 ? (
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-400" />
                        )}
                    </div>
                    <p className={`text-2xl font-bold ${Math.abs(totals.balance) < 1 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(totals.balance)}
                    </p>
                    {Math.abs(totals.balance) < 1 && (
                        <p className="text-xs text-green-400 mt-1">✓ Balanced</p>
                    )}
                </div>
            </div>

            {/* Search and Date Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari No. Jurnal, Keterangan, atau Akun..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-2.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm text-silver-dark">Periode:</span>
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                    />
                    <span className="text-silver-dark">-</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                    />
                </div>
            </div>

            {/* Journal Entries Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Tanggal</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">No. Jurnal</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Kode</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Nama Akun</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Keterangan</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Debit</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Kredit</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Sumber</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="8" className="px-3 py-12 text-center text-silver-dark">
                                        Loading journal entries...
                                    </td>
                                </tr>
                            ) : getFilteredEntries().length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-3 py-12 text-center">
                                        <BookOpen className="w-12 h-12 text-silver-dark mx-auto mb-3" />
                                        <p className="text-silver-dark">Tidak ada jurnal ditemukan</p>
                                        <p className="text-xs text-silver-dark mt-1">
                                            Jurnal akan otomatis dibuat saat Invoice/PO diproses
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                getFilteredEntries().map((entry, idx) => (
                                    <tr
                                        key={entry.id}
                                        className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                        onClick={() => {
                                            setSelectedEntry(entry);
                                            setShowDetailModal(true);
                                        }}
                                    >
                                        <td className="px-3 py-2 text-silver-dark whitespace-nowrap">
                                            {new Date(entry.entry_date).toLocaleDateString('id-ID', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="font-medium text-accent-orange">{entry.entry_number}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="font-mono text-xs text-accent-blue">{entry.account_code || '-'}</span>
                                        </td>
                                        <td className="px-3 py-2 text-silver-light whitespace-nowrap">
                                            {entry.account_name || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-silver-dark max-w-xs truncate whitespace-nowrap">
                                            {entry.description || entry.notes || '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {entry.debit > 0 ? (
                                                <span className="font-semibold text-green-400">
                                                    {formatCurrency(entry.debit)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            {entry.credit > 0 ? (
                                                <span className="font-semibold text-blue-400">
                                                    {formatCurrency(entry.credit)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold
                                                ${entry.source === 'manual'
                                                    ? 'bg-purple-500/20 text-purple-400'
                                                    : 'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {entry.source === 'manual' ? 'Manual' : 'Auto'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                        {!loading && getFilteredEntries().length > 0 && (
                            <tfoot className="bg-dark-surface border-t-2 border-accent-orange">
                                <tr>
                                    <td colSpan="5" className="px-3 py-2 text-right font-bold text-silver-light uppercase text-xs">
                                        TOTAL
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-green-400 text-sm whitespace-nowrap">
                                        {formatCurrency(totals.totalDebit)}
                                    </td>
                                    <td className="px-3 py-2 text-right font-bold text-blue-400 text-sm whitespace-nowrap">
                                        {formatCurrency(totals.totalCredit)}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* New Entry Modal */}
            {showNewEntryModal && (
                <Modal isOpen={true} onClose={() => setShowNewEntryModal(false)} maxWidth="max-w-4xl">
                    <div className="p-6">
                        <h2 className="text-2xl font-bold gradient-text mb-6">Jurnal Manual Baru</h2>

                        {/* Entry Header */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-sm font-medium text-silver-light mb-2">Tanggal</label>
                                <input
                                    type="date"
                                    value={newEntry.entry_date}
                                    onChange={(e) => setNewEntry({ ...newEntry, entry_date: e.target.value })}
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-silver-light mb-2">Keterangan</label>
                                <input
                                    type="text"
                                    placeholder="Deskripsi transaksi..."
                                    value={newEntry.description}
                                    onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                />
                            </div>
                        </div>

                        {/* Entry Lines */}
                        <div className="glass-card p-4 rounded-lg mb-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold text-silver-light">Detail Jurnal</h3>
                                <button
                                    onClick={addNewLine}
                                    className="flex items-center gap-1 text-sm text-accent-orange hover:text-accent-orange/80"
                                >
                                    <Plus className="w-4 h-4" /> Tambah Baris
                                </button>
                            </div>

                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-silver-dark uppercase">
                                        <th className="pb-2 w-1/3">Akun</th>
                                        <th className="pb-2 w-1/4 text-right">Debit</th>
                                        <th className="pb-2 w-1/4 text-right">Kredit</th>
                                        <th className="pb-2 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {newEntry.lines.map((line, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 pr-2">
                                                <select
                                                    value={line.coa_id}
                                                    onChange={(e) => handleLineChange(idx, 'coa_id', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                                                >
                                                    <option value="">Pilih Akun...</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="py-2 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    placeholder="0"
                                                    value={line.debit || ''}
                                                    onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-right"
                                                />
                                            </td>
                                            <td className="py-2 px-2">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1000"
                                                    placeholder="0"
                                                    value={line.credit || ''}
                                                    onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-right"
                                                />
                                            </td>
                                            <td className="py-2 pl-2">
                                                {newEntry.lines.length > 2 && (
                                                    <button
                                                        onClick={() => removeLine(idx)}
                                                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="border-t-2 border-dark-border">
                                    <tr>
                                        <td className="pt-3 font-semibold text-silver-light text-right">Total</td>
                                        <td className="pt-3 text-right font-bold text-green-400">
                                            {formatCurrency(newEntry.lines.reduce((sum, l) => sum + (l.debit || 0), 0))}
                                        </td>
                                        <td className="pt-3 text-right font-bold text-blue-400">
                                            {formatCurrency(newEntry.lines.reduce((sum, l) => sum + (l.credit || 0), 0))}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Balance Check */}
                        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3
                            ${isEntryBalanced()
                                ? 'bg-green-500/10 border border-green-500/30'
                                : 'bg-red-500/10 border border-red-500/30'
                            }`}>
                            {isEntryBalanced() ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    <span className="text-green-400 font-medium">Jurnal Balance ✓</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-400" />
                                    <span className="text-red-400 font-medium">
                                        Jurnal Tidak Balance! Selisih: {formatCurrency(
                                            newEntry.lines.reduce((sum, l) => sum + (l.debit || 0), 0) -
                                            newEntry.lines.reduce((sum, l) => sum + (l.credit || 0), 0)
                                        )}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowNewEntryModal(false)}
                                className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                            >
                                Batal
                            </button>
                            <Button onClick={saveNewEntry} disabled={!isEntryBalanced()}>
                                Simpan Jurnal
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Detail Modal */}
            {showDetailModal && selectedEntry && (
                <Modal isOpen={true} onClose={() => setShowDetailModal(false)} maxWidth="max-w-3xl">
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold gradient-text">Detail Transaksi Jurnal</h2>
                                <p className="text-silver-dark mt-1">No. {selectedEntry.entry_number}</p>
                            </div>
                            <div className="flex gap-2">
                                {selectedEntry.source === 'manual' ? (
                                    <button
                                        onClick={() => deleteJournalEntry(selectedEntry.batch_id)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg border border-red-500/30 smooth-transition"
                                    >
                                        <Trash2 className="w-3 h-3" /> Hapus Jurnal
                                    </button>
                                ) : (
                                    <div className="flex gap-2">
                                        {(selectedEntry.reference_type === 'invoice' || selectedEntry.reference_type === 'po') && (
                                            <button
                                                onClick={() => {
                                                    const path = selectedEntry.reference_type === 'invoice'
                                                        ? '/blink/invoices'
                                                        : '/blink/purchase-orders';
                                                    navigate(path);
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-accent-blue hover:text-white hover:bg-accent-blue/20 rounded-lg border border-accent-blue/30 smooth-transition"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                Lihat {selectedEntry.reference_type === 'invoice' ? 'Invoice' : 'PO'}
                                            </button>
                                        )}
                                        <div className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/30">
                                            Auto-Generated
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 glass-card rounded-lg">
                            <div>
                                <p className="text-xs text-silver-dark uppercase mb-1">Tanggal</p>
                                <p className="font-medium text-silver-light">
                                    {new Date(selectedEntry.entry_date).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark uppercase mb-1">Tipe</p>
                                <p className="font-medium text-silver-light capitalize">{selectedEntry.entry_type || 'General'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark uppercase mb-1">No. Referensi</p>
                                <p className="font-medium text-accent-orange">{selectedEntry.reference_number || '-'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark uppercase mb-1">Total Nilai</p>
                                <p className="font-bold text-silver-light">{formatCurrency(batchTotal)}</p>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="mb-6">
                            <p className="text-xs text-silver-dark uppercase mb-1">Keterangan / Memo</p>
                            <p className="text-sm text-silver-light p-3 bg-dark-surface rounded-lg border border-dark-border">
                                {selectedEntry.description || '-'}
                            </p>
                        </div>

                        {/* Transaction Lines Table */}
                        <div className="overflow-hidden rounded-lg border border-dark-border">
                            <table className="w-full text-sm">
                                <thead className="bg-dark-surface">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs text-silver-dark uppercase font-semibold">Akun</th>
                                        <th className="px-4 py-2 text-right text-xs text-silver-dark uppercase font-semibold">Debit</th>
                                        <th className="px-4 py-2 text-right text-xs text-silver-dark uppercase font-semibold">Kredit</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border bg-dark-card/50">
                                    {selectedBatch.map((entry, idx) => (
                                        <tr key={idx} className="hover:bg-dark-surface/50">
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs text-accent-blue mb-0.5">{entry.account_code}</span>
                                                    <span className="text-silver-light">{entry.account_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {entry.debit > 0 ? (
                                                    <span className="text-green-400">{formatCurrency(entry.debit)}</span>
                                                ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">
                                                {entry.credit > 0 ? (
                                                    <span className="text-blue-400">{formatCurrency(entry.credit)}</span>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-dark-surface border-t border-dark-border">
                                    <tr>
                                        <td className="px-4 py-2 text-right font-bold text-silver-light text-xs uppercase">Total</td>
                                        <td className="px-4 py-2 text-right font-bold text-green-400">
                                            {formatCurrency(selectedBatch.reduce((s, e) => s + (e.debit || 0), 0))}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-blue-400">
                                            {formatCurrency(selectedBatch.reduce((s, e) => s + (e.credit || 0), 0))}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                                Tutup
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div >
    );
};

export default GeneralJournal;
