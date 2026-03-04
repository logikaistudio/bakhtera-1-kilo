import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    Scale, Search, Calendar, Download, Filter,
    CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import XLSX from 'xlsx-js-style';

const TrialBalance = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [balances, setBalances] = useState([]);
    const [totals, setTotals] = useState({ opening: 0, debit: 0, credit: 0, closing: 0 });

    // Default: Current Year
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchTrialBalance();
    }, [dateRange]);

    const fetchTrialBalance = async () => {
        try {
            setLoading(true);

            // 1. Fetch COA
            const { data: accounts, error: coaError } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (coaError) throw coaError;

            // 2. Fetch Journal Entries (ALL TIME for Integrity, but split by logic)
            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null)
                    .lte('entry_date', dateRange.end),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .lte('entry_date', dateRange.end)
            ]);

            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            // deduplicate by id
            const entries = [...new Map(combined.map(r => [r.id, r])).values()];

            // 3. Process Data
            // 3. Process Data
            const accMap = {};
            const accCodeMap = {};

            accounts.forEach(acc => {
                accMap[acc.id] = {
                    ...acc,
                    opening: 0,
                    debitPeriod: 0,
                    creditPeriod: 0,
                    closing: 0
                };
                if (acc.code) accCodeMap[acc.code] = acc.id;
            });

            // Conversion helper
            const toIDR = (value, currency, exchangeRate) => {
                if (!value) return 0;
                if (currency && currency !== 'IDR' && exchangeRate > 1) {
                    return value * exchangeRate;
                }
                return value;
            };

            entries.forEach(e => {
                // Match by ID first, fallback to code
                const targetId = e.coa_id || accCodeMap[e.account_code];
                if (!targetId) return;

                const acc = accMap[targetId];
                if (!acc) return; // Should not happen if referential integrity is good

                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);

                if (e.entry_date < dateRange.start) {
                    // It's Opening Balance
                    // Normal Balance Logic? 
                    // Trial Balance usually shows Debit/Credit raw sum, OR Net Balance.
                    // Usually: Opening (Net), Debit Mutation, Credit Mutation, Closing (Net).

                    const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                    if (isNormalCredit) {
                        acc.opening += (credit - debit);
                    } else {
                        acc.opening += (debit - credit);
                    }
                } else {
                    // It's Period Movement
                    acc.debitPeriod += debit;
                    acc.creditPeriod += credit;
                }
            });

            // Calculate Closing
            let totalOpening = 0;
            let totalDebit = 0;
            let totalCredit = 0;
            let totalClosing = 0;

            const processed = Object.values(accMap).map(acc => {
                const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);

                // Closing Balance Calculation
                // Closing = Opening + (Debit/Credit depending on type)
                // Actually: Opening + PeriodMovementNet
                if (isNormalCredit) {
                    acc.closing = acc.opening + acc.creditPeriod - acc.debitPeriod;
                } else {
                    acc.closing = acc.opening + acc.debitPeriod - acc.creditPeriod;
                }

                // If values are all zero, maybe filter out? But usually TB shows all active accounts.
                // Should at least show if there's any history or balance.

                return acc;
            }).filter(acc => acc.opening !== 0 || acc.debitPeriod !== 0 || acc.creditPeriod !== 0);

            // Compute Report Totals
            // Note: For "Total Opening" and "Total Closing", simply summing mixed Debit/Credit normal balances might be zero (if balanced).
            // Standard TB shows Total Debit Column vs Total Credit Column for Closing. 
            // Here we show Net Balances, so Sum should be 0.

            processed.forEach(acc => {
                totalDebit += acc.debitPeriod;
                totalCredit += acc.creditPeriod;

                // For totals of Net balances (Opening/Closing), it should sum to 0
                totalOpening += acc.opening;
                totalClosing += acc.closing; // Should be near 0
            });

            setBalances(processed);
            setTotals({
                opening: totalOpening,
                debit: totalDebit,
                credit: totalCredit,
                closing: totalClosing
            });

        } catch (error) {
            console.error('Error fetching TB:', error);
        } finally {
            setLoading(false);
        }
    };

    // Grouping Logic - Scontro Style (Debit Side vs Credit Side)
    // Left: Assets, Expenses
    // Right: Liabilities, Equity, Revenue
    const groupedBalances = {
        ASSET: balances.filter(b => b.type === 'ASSET'),
        LIABILITY: balances.filter(b => b.type === 'LIABILITY'),
        EQUITY: balances.filter(b => b.type === 'EQUITY'),
        REVENUE: balances.filter(b => ['REVENUE', 'OTHER_INCOME'].includes(b.type)),
        EXPENSE: balances.filter(b => ['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(b.type)),
    };

    const handleAccountClick = (accountId) => {
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    const formatCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Compact Account Table for Scontro View
    const AccountGroupTable = ({ title, data, colorClass = "text-silver-light" }) => {
        if (data.length === 0) return null;

        const groupTotal = data.reduce((acc, curr) => ({
            opening: acc.opening + curr.opening,
            debit: acc.debit + curr.debitPeriod,
            credit: acc.credit + curr.creditPeriod,
            closing: acc.closing + curr.closing
        }), { opening: 0, debit: 0, credit: 0, closing: 0 });

        return (
            <div className="mb-6">
                <div className={`flex items-center justify-between mb-2 pl-3 border-l-4 ${colorClass.replace('text-', 'border-')}`}>
                    <h3 className={`font-bold text-base ${colorClass}`}>{title}</h3>
                    <span className="text-xs font-mono font-bold text-silver-dark opacity-70">
                        Total: {formatCurrency(groupTotal.closing)}
                    </span>
                </div>

                <div className="glass-card rounded-lg overflow-hidden border border-white/5">
                    <table className="w-full text-xs">
                        <thead className="bg-dark-surface border-b border-dark-border/50">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold w-16 text-silver-dark uppercase tracking-wider">Kode</th>
                                <th className="px-3 py-2 text-left font-semibold text-silver-dark uppercase tracking-wider">Akun</th>
                                <th className="px-3 py-2 text-right font-semibold text-silver-dark uppercase tracking-wider">Saldo</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border/30">
                            {data.map(acc => (
                                <tr
                                    key={acc.id}
                                    onClick={() => handleAccountClick(acc.id)}
                                    className="hover:bg-white/5 smooth-transition cursor-pointer group"
                                >
                                    <td className="px-3 py-1.5 font-mono text-accent-orange/80 group-hover:text-accent-orange">{acc.code}</td>
                                    <td className="px-3 py-1.5 text-silver-light truncate max-w-[150px]">{acc.name}</td>
                                    <td className={`px-3 py-1.5 text-right font-mono font-medium ${acc.closing < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {formatCurrency(acc.closing)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-dark-surface/30 font-bold border-t border-dark-border/50">
                            <tr>
                                <td colSpan="2" className="px-3 py-2 text-right text-[10px] uppercase tracking-wider text-silver-dark">Total {title}</td>
                                <td className="px-3 py-2 text-right font-mono text-silver-light">{formatCurrency(groupTotal.closing)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    const formatExportCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const getExportData = () => {
        // Flatten list for export
        const allBalances = [
            ...groupedBalances.ASSET,
            ...groupedBalances.LIABILITY,
            ...groupedBalances.EQUITY,
            ...groupedBalances.REVENUE,
            ...groupedBalances.EXPENSE
        ];

        const rows = allBalances.map(acc => ({
            'Kode Akun': acc.code,
            'Nama Akun': acc.name,
            'Tipe': acc.type,
            'Saldo Awal': formatExportCurrency(acc.opening),
            'Mutasi Debit': formatExportCurrency(acc.debitPeriod),
            'Mutasi Kredit': formatExportCurrency(acc.creditPeriod),
            'Saldo Akhir': formatExportCurrency(acc.closing)
        }));

        const totalRow = {
            'Kode Akun': 'TOTAL',
            'Nama Akun': '',
            'Tipe': '',
            'Saldo Awal': formatExportCurrency(totals.opening),
            'Mutasi Debit': formatExportCurrency(totals.debit),
            'Mutasi Kredit': formatExportCurrency(totals.credit),
            'Saldo Akhir': formatExportCurrency(totals.closing)
        };

        return [...rows, totalRow];
    };

    const exportToExcel = () => {
        const data = getExportData();
        const ws = XLSX.utils.json_to_sheet(data);

        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Kode Akun
            { wch: 40 }, // Nama Akun
            { wch: 15 }, // Tipe
            { wch: 18 }, // Saldo Awal
            { wch: 18 }, // Mutasi Debit
            { wch: 18 }, // Mutasi Kredit
            { wch: 18 }  // Saldo Akhir
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
        XLSX.writeFile(wb, `NeracaSaldo_${dateRange.start}_${dateRange.end}.xlsx`);
    };

    const exportToCSV = () => {
        const data = getExportData();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
        XLSX.writeFile(wb, `NeracaSaldo_${dateRange.start}_${dateRange.end}.csv`);
    };

    const isBalanced = Math.abs(totals.closing) < 1; // Tolerance for float

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Scale className="w-8 h-8" />
                        Neraca Saldo
                    </h1>
                    <p className="text-silver-dark mt-1">Trial Balance Scontro View - Ringkasan Saldo Akun</p>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchTrialBalance}>
                        Refresh
                    </Button>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button
                        onClick={exportToCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-blue-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs"
                    >
                        <FileText className="w-4 h-4" /> CSV
                    </button>
                </div>
            </div>

            {/* Controls & Summary */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center gap-4 flex-1">
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Periode Awal</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-silver-light text-sm"
                        />
                    </div>
                    <div className="h-px w-4 bg-silver-dark"></div>
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Periode Akhir</label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-silver-light text-sm"
                        />
                    </div>
                </div>

                <div className={`glass-card p-4 rounded-lg flex items-center justify-between gap-6 border-l-4 ${isBalanced ? 'border-green-500' : 'border-red-500'} min-w-[300px]`}>
                    <div>
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Status Balance</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isBalanced ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    <span className="text-lg font-bold text-green-400">SEIMBANG</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-lg font-bold text-red-500">TIDAK BALANCE</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-silver-dark">Selisih</p>
                        <p className={`font-mono font-bold ${isBalanced ? 'text-silver-light' : 'text-red-400'}`}>
                            {formatCurrency(totals.closing)}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-silver-dark">Loading financial data...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Left Column: Aktiva & Beban */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-green-400 mb-2 border-b border-dark-border pb-2">
                            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
                            <h2 className="font-bold uppercase tracking-wider text-sm">Debit Side (Harta & Beban)</h2>
                        </div>
                        <AccountGroupTable title="HARTA (ASSETS)" data={groupedBalances.ASSET} colorClass="text-green-400" />
                        <AccountGroupTable title="BEBAN (EXPENSES)" data={groupedBalances.EXPENSE} colorClass="text-orange-400" />
                    </div>

                    {/* Right Column: Pasiva & Pendapatan */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-blue-400 mb-2 border-b border-dark-border pb-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500/50"></div>
                            <h2 className="font-bold uppercase tracking-wider text-sm">Credit Side (Kewajiban, Modal & Pendapatan)</h2>
                        </div>
                        <AccountGroupTable title="KEWAJIBAN (LIABILITIES)" data={groupedBalances.LIABILITY} colorClass="text-red-400" />
                        <AccountGroupTable title="MODAL (EQUITY)" data={groupedBalances.EQUITY} colorClass="text-blue-400" />
                        <AccountGroupTable title="PENDAPATAN (REVENUE)" data={groupedBalances.REVENUE} colorClass="text-cyan-400" />
                    </div>
                </div>
            )}
            <div className="text-center text-xs text-silver-dark mt-6 italic bg-dark-surface/30 p-4 rounded border border-white/5">
                Note: Dalam tampilan Scontro ini, akun dikelompokkan berdasarkan sisi normalnya. Harta dan Beban di sisi Kiri (Debit), sedangkan Kewajiban, Modal, dan Pendapatan di sisi Kanan (Kredit).
            </div>
        </div>
    );
};

export default TrialBalance;
