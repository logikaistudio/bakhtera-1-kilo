import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import Button from '../../../components/Common/Button';
import {
    BookOpen, Search, Calendar, Download, RefreshCw,
    ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown,
    FileText, ExternalLink, Info, ChevronDown, ChevronRight,
    BarChart2, Filter, X, DollarSign, Layers, Tag, Printer
} from 'lucide-react';
import { printReport, fmtDatePrint } from '../../../utils/printPDF';
import { journalEntriesHasColumn } from '../../../utils/journalHelper';
import { useData } from '../../../context/DataContext';

// ─── COA Type Config ─────────────────────────────────────────────────────────
const COA_TYPE_CONFIG = {
    ASSET: { label: 'Asset', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', normalBalance: 'DEBIT', accent: '#3b82f6' },
    LIABILITY: { label: 'Liability', color: 'bg-red-500/20 text-red-400 border-red-500/30', normalBalance: 'CREDIT', accent: '#ef4444' },
    EQUITY: { label: 'Equity', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', normalBalance: 'CREDIT', accent: '#a855f7' },
    REVENUE: { label: 'Revenue', color: 'bg-green-500/20 text-green-400 border-green-500/30', normalBalance: 'CREDIT', accent: '#22c55e' },
    EXPENSE: { label: 'Expense', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', normalBalance: 'DEBIT', accent: '#f97316' },
    COGS: { label: 'COGS', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', normalBalance: 'DEBIT', accent: '#eab308' },
};

// ─── Source Config ────────────────────────────────────────────────────────────
const SOURCE_CONFIG = {
    ar_payment: { label: 'AR Payment', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
    ap_payment: { label: 'AP Payment', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
    invoice: { label: 'Invoice', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    ar_invoice: { label: 'AR Invoice', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    po: { label: 'Purchase Order', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    ap: { label: 'AP Entry', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
    manual: { label: 'Manual', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    adjustment: { label: 'Adjustment', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    auto: { label: 'Auto', color: 'bg-dark-surface text-silver-dark border-dark-border' },
};

const getSourceConfig = (entry) => {
    const key = entry.reference_type || entry.entry_type || (entry.source === 'manual' ? 'manual' : 'auto');
    return SOURCE_CONFIG[key] || SOURCE_CONFIG.auto;
};

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtIDR = (value, showSign = false) => {
    if (value === undefined || value === null) return '-';
    const neg = value < 0;
    const abs = Math.abs(value);
    const str = `Rp ${abs.toLocaleString('id-ID')}`;
    if (neg) return `(${str})`;
    if (showSign && value > 0) return `+${str}`;
    return str;
};

const fmtUSD = (value) => {
    if (!value || value === 0) return null;
    return `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
};

const hasRealRate = (currency, exchangeRate) => {
    if (!currency || currency === 'IDR') return false;
    return (exchangeRate || 1) > 1;
};

// Returns IDR equivalent (null if USD with no real rate)
const toIDR = (value, currency, exchangeRate) => {
    if (!value) return 0;
    if (hasRealRate(currency, exchangeRate)) return (value || 0) * exchangeRate;
    if (!currency || currency === 'IDR') return (value || 0);
    return null;
};

// Smart display: IDR if convertible, original currency otherwise
const fmtAmount = (value, currency, exchangeRate) => {
    if (!value || value === 0) return null;
    if (hasRealRate(currency, exchangeRate)) {
        return { primary: `Rp ${Math.abs((value || 0) * exchangeRate).toLocaleString('id-ID')}`, secondary: fmtUSD(value) };
    }
    if (currency === 'USD') return { primary: `$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, secondary: null };
    return { primary: `Rp ${Math.abs(value).toLocaleString('id-ID')}`, secondary: null };
};

// Mini sparkline SVG
const Sparkline = ({ data, color = '#f97316', width = 80, height = 24 }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const pts = data.map((v, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((v - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    }).join(' ');
    return (
        <svg width={width} height={height} className="opacity-60">
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

const BigGeneralLedger = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useData();

    // ─── State ─────────────────────────────────────────────────────────────────
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
    const [showDrillDown, setShowDrillDown] = useState(false);
    const [drillDownData, setDrillDownData] = useState(null);
    const [expandedAccounts, setExpandedAccounts] = useState(new Set());

    // ─── Data Fetching ─────────────────────────────────────────────────────────
    useEffect(() => {
        fetchAccounts();
    }, []);

    const fetchAccounts = async () => {
        try {
            setLoading(true);

            // Fetch Big COA
            const { data: coaData, error: coaError } = await supabase
                .from('big_coa')
                .select('*')
                .eq('is_active', true)
                .order('code');

            if (coaError) throw coaError;

            // Process accounts with balance calculations
            const processedAccounts = await Promise.all(
                coaData.map(async (account) => {
                    const balance = await calculateAccountBalance(account.id, dateRange);
                    return {
                        ...account,
                        balance: balance.closing,
                        debit: balance.totalDebit,
                        credit: balance.totalCredit,
                        transactions: balance.transactionCount
                    };
                })
            );

            setAccounts(processedAccounts);
        } catch (error) {
            console.error('Error fetching accounts:', error);
            alert('Failed to load accounts: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateAccountBalance = async (accountId, dateRange) => {
        try {
            // Get journal entries for this account within date range
            const { data: entries, error } = await supabase
                .from('big_journal_line_items')
                .select(`
                    debit, credit, entry_date,
                    big_journal_entries!inner(entry_date)
                `)
                .eq('coa_id', accountId)
                .gte('big_journal_entries.entry_date', dateRange.start)
                .lte('big_journal_entries.entry_date', dateRange.end)
                .order('big_journal_entries.entry_date');

            if (error) throw error;

            let totalDebit = 0;
            let totalCredit = 0;

            entries.forEach(entry => {
                totalDebit += entry.debit || 0;
                totalCredit += entry.credit || 0;
            });

            // Calculate closing balance based on account type
            const account = accounts.find(acc => acc.id === accountId);
            const normalBalance = account ? COA_TYPE_CONFIG[account.type]?.normalBalance : 'DEBIT';

            const closing = normalBalance === 'DEBIT'
                ? totalDebit - totalCredit
                : totalCredit - totalDebit;

            return {
                totalDebit,
                totalCredit,
                closing,
                transactionCount: entries.length
            };
        } catch (error) {
            console.error('Error calculating balance:', error);
            return { totalDebit: 0, totalCredit: 0, closing: 0, transactionCount: 0 };
        }
    };

    // ─── Filtering & Search ───────────────────────────────────────────────────
    const filteredAccounts = useMemo(() => {
        return accounts.filter(account => {
            const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                account.code.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'ALL' || account.type === filterType;
            return matchesSearch && matchesType;
        });
    }, [accounts, searchTerm, filterType]);

    // ─── Drill Down ───────────────────────────────────────────────────────────
    const handleDrillDown = async (account) => {
        try {
            const { data: entries, error } = await supabase
                .from('big_journal_line_items')
                .select(`
                    *,
                    big_journal_entries!inner(
                        entry_number, entry_date, description, reference_type, reference_number
                    )
                `)
                .eq('coa_id', account.id)
                .gte('big_journal_entries.entry_date', dateRange.start)
                .lte('big_journal_entries.entry_date', dateRange.end)
                .order('big_journal_entries.entry_date', { ascending: false });

            if (error) throw error;

            setDrillDownData({
                account,
                entries: entries || []
            });
            setShowDrillDown(true);
        } catch (error) {
            console.error('Error fetching drill-down data:', error);
            alert('Failed to load transaction details: ' + error.message);
        }
    };

    // ─── Export ───────────────────────────────────────────────────────────────
    const exportToPDF = (selectedAccount, accountInfo, dateRange, openingBalance, totalDebit, totalCredit, closingBalance, rows, typeConfig, companyInfo) => {
        // PDF export implementation (similar to Blink version but for Big)
        const printWindow = window.open('', '_blank');
        const content = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Big General Ledger - ${selectedAccount?.name || 'All Accounts'}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .account-info { margin: 20px 0; padding: 15px; background: #f5f5f5; }
        .summary { margin: 20px 0; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
        .debit { text-align: right; color: #d32f2f; }
        .credit { text-align: right; color: #2e7d32; }
        .balance { text-align: right; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Big General Ledger</h1>
        <h2>${selectedAccount?.name || 'All Accounts'}</h2>
        <p>Period: ${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}</p>
    </div>

    <div class="account-info">
        <h3>Account Information</h3>
        <p><strong>Code:</strong> ${selectedAccount?.code || '-'}</p>
        <p><strong>Name:</strong> ${selectedAccount?.name || '-'}</p>
        <p><strong>Type:</strong> ${selectedAccount?.type || '-'}</p>
    </div>

    <div class="summary">
        <div>
            <strong>Opening Balance:</strong> ${fmtIDR(openingBalance)}
        </div>
        <div>
            <strong>Total Debit:</strong> ${fmtIDR(totalDebit)}
            <strong>Total Credit:</strong> ${fmtIDR(totalCredit)}
        </div>
        <div>
            <strong>Closing Balance:</strong> ${fmtIDR(closingBalance)}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Reference</th>
                <th class="debit">Debit</th>
                <th class="credit">Credit</th>
                <th class="balance">Balance</th>
            </tr>
        </thead>
        <tbody>
            ${rows.map(row => `
                <tr>
                    <td>${row.date}</td>
                    <td>${row.description}</td>
                    <td>${row.reference}</td>
                    <td class="debit">${fmtIDR(row.debit)}</td>
                    <td class="credit">${fmtIDR(row.credit)}</td>
                    <td class="balance">${fmtIDR(row.balance)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.print();
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BookOpen className="h-6 w-6 text-blue-500" />
                        Big General Ledger
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Chart of Accounts and transaction details for Big module
                    </p>
                </div>
                <Button
                    onClick={fetchAccounts}
                    variant="outline"
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Account Type
                        </label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="ALL">All Types</option>
                            <option value="ASSET">Assets</option>
                            <option value="LIABILITY">Liabilities</option>
                            <option value="EQUITY">Equity</option>
                            <option value="REVENUE">Revenue</option>
                            <option value="EXPENSE">Expenses</option>
                            <option value="COGS">COGS</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Search
                        </label>
                        <input
                            type="text"
                            placeholder="Search accounts..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Accounts Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Account
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Type
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Debit
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Credit
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Balance
                                </th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredAccounts.map((account) => {
                                const typeConfig = COA_TYPE_CONFIG[account.type] || COA_TYPE_CONFIG.ASSET;
                                return (
                                    <tr key={account.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div>
                                                <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                    {account.code}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {account.name}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeConfig.color}`}>
                                                {typeConfig.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                            {fmtIDR(account.debit)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                            {fmtIDR(account.credit)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900 dark:text-white">
                                            {fmtIDR(account.balance)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            <Button
                                                onClick={() => handleDrillDown(account)}
                                                variant="outline"
                                                size="sm"
                                                className="flex items-center gap-1"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                View
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drill Down Modal */}
            {showDrillDown && drillDownData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Transaction Details - {drillDownData.account.name}
                            </h2>
                            <button
                                onClick={() => setShowDrillDown(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Description
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Reference
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Debit
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Credit
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {drillDownData.entries.map((entry, index) => (
                                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                    {new Date(entry.big_journal_entries?.entry_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {entry.big_journal_entries?.description || '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {entry.big_journal_entries?.reference_number || '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-red-600 dark:text-red-400">
                                                    {fmtIDR(entry.debit)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-green-600 dark:text-green-400">
                                                    {fmtIDR(entry.credit)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                            <Button
                                onClick={() => exportToPDF(drillDownData.account, {}, dateRange, 0, 0, 0, 0, drillDownData.entries, {}, {})}
                                variant="outline"
                                className="flex items-center gap-2"
                            >
                                <Download className="h-4 w-4" />
                                Export PDF
                            </Button>
                            <Button onClick={() => setShowDrillDown(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BigGeneralLedger;