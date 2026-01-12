import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    BookOpen, Search, Calendar, Download, Filter,
    ArrowUpRight, ArrowDownLeft, CheckCircle, AlertCircle,
    FileText, FileSpreadsheet, ExternalLink, RefreshCw
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import { useNavigate, useLocation } from 'react-router-dom';

const GeneralLedger = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [entries, setEntries] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [loading, setLoading] = useState(false);

    // Default: Current Year (Jan 1st to Today)
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    });

    const [openingBalance, setOpeningBalance] = useState(0);

    useEffect(() => {
        fetchAccounts();
    }, []);

    // Handle deep link / navigation state from Trial Balance
    useEffect(() => {
        if (location.state?.preSelectedAccount) {
            setSelectedAccount(location.state.preSelectedAccount);
            // Optional: clear state to prevent re-triggering?
            // Usually not needed if we just set it once when location changes.
            // But React Router state persists on refresh.
        }
    }, [location.state]);

    useEffect(() => {
        if (selectedAccount && dateRange.start && dateRange.end) {
            fetchLedgerData();
        } else {
            setEntries([]);
            setOpeningBalance(0);
        }
    }, [selectedAccount, dateRange]);

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

    const fetchLedgerData = async () => {
        try {
            setLoading(true);

            // 1. Calculate Opening Balance (Sum of all transactions BEFORE start date)
            const { data: prevData, error: prevError } = await supabase
                .from('blink_journal_entries')
                .select('debit, credit')
                .eq('coa_id', selectedAccount)
                .lt('entry_date', dateRange.start);

            if (prevError) throw prevError;

            // Get Account Type logic
            const accountInfo = accounts.find(a => a.id === selectedAccount);
            const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(accountInfo?.type);

            const prevDebit = prevData.reduce((sum, e) => sum + (e.debit || 0), 0);
            const prevCredit = prevData.reduce((sum, e) => sum + (e.credit || 0), 0);

            // Calculate Initial Balance based on Type
            const initialBalance = isNormalCredit
                ? prevCredit - prevDebit
                : prevDebit - prevCredit;

            setOpeningBalance(initialBalance);

            // 2. Fetch Current Period Transactions
            const { data, error } = await supabase
                .from('blink_journal_entries')
                .select('*')
                .eq('coa_id', selectedAccount)
                .gte('entry_date', dateRange.start)
                .lte('entry_date', dateRange.end)
                .order('entry_date', { ascending: true })
                .order('created_at', { ascending: true }); // Secondary sort for stable running balance

            if (error) throw error;
            setEntries(data || []);

        } catch (error) {
            console.error('Error fetching ledger:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        if (value === undefined || value === null) return '-';
        // Check if value is negative (meaning contrary to normal balance)
        const isNegative = value < 0;
        const absVal = Math.abs(value);
        const formatted = `Rp ${absVal.toLocaleString('id-ID')}`;
        return isNegative ? `(${formatted})` : formatted;
    };

    const accountInfo = accounts.find(a => a.id === selectedAccount);
    const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(accountInfo?.type);

    const getExportData = () => {
        const formatNumber = (num) => {
            return num ? num.toLocaleString('id-ID') : '0';
        };

        let runningBalance = openingBalance;
        const rows = entries.map(e => {
            const debit = e.debit || 0;
            const credit = e.credit || 0;
            // Running Balance Logic
            if (isNormalCredit) {
                runningBalance += (credit - debit);
            } else {
                runningBalance += (debit - credit);
            }

            return {
                'Tanggal': e.entry_date,
                'No. Jurnal': e.entry_number,
                'Keterangan': e.description || '',
                'Ref': e.reference_number || '',
                'Debit': formatNumber(debit),
                'Kredit': formatNumber(credit),
                'Saldo': formatNumber(runningBalance)
            };
        });

        // Add proper headers and Opening Balance
        const openingRow = {
            'Tanggal': 'SALDO AWAL',
            'No. Jurnal': '-',
            'Keterangan': 'Opening Balance',
            'Ref': '-',
            'Debit': '0',
            'Kredit': '0',
            'Saldo': formatNumber(openingBalance)
        };

        return [openingRow, ...rows];
    };

    // Export to Excel
    const exportToExcel = () => {
        if (!selectedAccount) return;
        const data = getExportData();
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Buku Besar");
        XLSX.writeFile(workbook, `Ledger_${accountInfo?.code || 'Unknown'}_${dateRange.start}_${dateRange.end}.xlsx`);
    };

    // Export to CSV
    const exportToCSV = () => {
        if (!selectedAccount) return;
        const data = getExportData();
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Buku Besar");
        XLSX.writeFile(workbook, `Ledger_${accountInfo?.code || 'Unknown'}_${dateRange.start}_${dateRange.end}.csv`);
    };

    // Calculate aggregations for UI
    const totalDebitPeriod = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCreditPeriod = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

    const closingBalance = isNormalCredit
        ? openingBalance + totalCreditPeriod - totalDebitPeriod
        : openingBalance + totalDebitPeriod - totalCreditPeriod;

    let runningBalanceCalculator = openingBalance;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Buku Besar</h1>
                    <p className="text-silver-dark mt-1">General Ledger - Detail transaksi per akun</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchLedgerData} disabled={!selectedAccount}>
                        Refresh
                    </Button>
                    <button
                        onClick={exportToExcel}
                        disabled={!selectedAccount || loading}
                        className={`flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs
                            ${(!selectedAccount || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>
                    <button
                        onClick={exportToCSV}
                        disabled={!selectedAccount || loading}
                        className={`flex items-center gap-2 px-3 py-2 bg-dark-surface text-blue-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs
                            ${(!selectedAccount || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <FileText className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-lg flex flex-col md:flex-row gap-4 items-end md:items-center">
                <div className="flex-1 w-full md:w-auto">
                    <label className="block text-xs text-silver-dark uppercase mb-1">Pilih Akun (COA)</label>
                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light font-mono text-sm focus:border-accent-blue outline-none"
                    >
                        <option value="">-- Pilih Akun --</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="w-full md:w-auto flex gap-2 items-center">
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Dari</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                        />
                    </div>
                    <div className="h-px w-2 bg-silver-dark mt-6"></div>
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Sampai</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Content Area */}
            {selectedAccount ? (
                <>
                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="glass-card p-4 rounded-lg border-l-4 border-yellow-500">
                            <p className="text-xs text-silver-dark uppercase tracking-wider">Saldo Awal</p>
                            <p className="text-xl font-bold text-silver-light mt-1">{formatCurrency(openingBalance)}</p>
                            <p className="text-[10px] text-silver-dark mt-1">Per {new Date(dateRange.start).toLocaleDateString('id-ID')}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-green-500">
                            <p className="text-xs text-silver-dark uppercase tracking-wider">Pergerakan Debit</p>
                            <p className="text-xl font-bold text-green-400 mt-1">+{formatCurrency(totalDebitPeriod).replace('Rp ', '')}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-xs text-silver-dark uppercase tracking-wider">Pergerakan Kredit</p>
                            <p className="text-xl font-bold text-blue-400 mt-1">-{formatCurrency(totalCreditPeriod).replace('Rp ', '')}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-purple-500">
                            <p className="text-xs text-silver-dark uppercase tracking-wider">Saldo Akhir</p>
                            <p className="text-xl font-bold text-silver-light mt-1">{formatCurrency(closingBalance)}</p>
                        </div>
                    </div>

                    {/* Transaction Table */}
                    <div className="glass-card rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-dark-surface border-b border-dark-border">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Tanggal</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">No. Jurnal</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Keterangan</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Ref</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-silver-dark uppercase">Debit</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-silver-dark uppercase">Kredit</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-silver-dark uppercase">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {/* Opening Balance Row */}
                                    <tr className="bg-dark-surface/30">
                                        <td className="px-4 py-3 text-silver-dark font-medium italic" colSpan="6">
                                            Saldo Awal (Opening Balance)
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-silver-light font-mono">
                                            {formatCurrency(openingBalance)}
                                        </td>
                                    </tr>

                                    {/* Entries */}
                                    {loading ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-12 text-center text-silver-dark">
                                                Loading transactions...
                                            </td>
                                        </tr>
                                    ) : entries.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-12 text-center text-silver-dark">
                                                Tidak ada transaksi pada periode ini.
                                            </td>
                                        </tr>
                                    ) : (
                                        entries.map((entry) => {
                                            const debit = entry.debit || 0;
                                            const credit = entry.credit || 0;

                                            if (isNormalCredit) {
                                                runningBalanceCalculator += (credit - debit);
                                            } else {
                                                runningBalanceCalculator += (debit - credit);
                                            }

                                            return (
                                                <tr key={entry.id} className="hover:bg-dark-surface smooth-transition group">
                                                    <td className="px-4 py-2 text-silver-dark whitespace-nowrap">
                                                        {new Date(entry.entry_date).toLocaleDateString('id-ID', {
                                                            day: '2-digit', month: 'short', year: 'numeric'
                                                        })}
                                                    </td>
                                                    <td className="px-4 py-2 text-accent-orange text-xs whitespace-nowrap">
                                                        {entry.entry_number}
                                                    </td>
                                                    <td className="px-4 py-2 text-silver-light max-w-xs truncate" title={entry.description}>
                                                        {entry.description || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-silver-dark text-xs whitespace-nowrap">
                                                        {entry.reference_number || '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-xs">
                                                        {debit > 0 ? <span className="text-green-400">{formatCurrency(debit).replace('Rp ', '')}</span> : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono text-xs">
                                                        {credit > 0 ? <span className="text-blue-400">{formatCurrency(credit).replace('Rp ', '')}</span> : '-'}
                                                    </td>
                                                    <td className="px-4 py-2 text-right font-mono font-medium text-silver-light">
                                                        {formatCurrency(runningBalanceCalculator)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <BookOpen className="w-16 h-16 text-silver-dark mb-4" />
                    <p className="text-xl font-medium text-silver-light">Pilih Akun untuk Melihat Buku Besar</p>
                    <p className="text-sm text-silver-dark mt-2">Silakan pilih akun dari dropdown di atas</p>
                </div>
            )}
        </div>
    );
};

export default GeneralLedger;
