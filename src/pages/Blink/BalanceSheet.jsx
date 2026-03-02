import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Scale, TrendingUp, Shield, Download, Calendar,
    RefreshCw, FileSpreadsheet, FileText, CheckCircle, AlertCircle
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import Button from '../../components/Common/Button';

const BalanceSheet = () => {
    const navigate = useNavigate();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [balances, setBalances] = useState({
        assets: [],
        liabilities: [],
        equity: []
    });
    const [totals, setTotals] = useState({
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        difference: 0
    });

    useEffect(() => {
        fetchBalanceSheet();
    }, [asOfDate]);

    const fetchBalanceSheet = async () => {
        try {
            setLoading(true);

            // 1. Fetch COA
            const { data: accounts, error: coaError } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (coaError) throw coaError;

            // 2. Fetch ALL Journal Entries up to asOfDate
            const { data: entries, error: entriesError } = await supabase
                .from('blink_journal_entries')
                .select('coa_id, debit, credit, entry_date')
                .lte('entry_date', asOfDate);

            if (entriesError) throw entriesError;

            // 3. Calculate balances for each account
            const accMap = {};

            accounts.forEach(acc => {
                accMap[acc.id] = {
                    ...acc,
                    balance: 0
                };
            });

            entries.forEach(e => {
                const acc = accMap[e.coa_id];
                if (!acc) return;

                const debit = e.debit || 0;
                const credit = e.credit || 0;

                // Calculate based on normal balance
                const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                if (isNormalCredit) {
                    acc.balance += (credit - debit);
                } else {
                    acc.balance += (debit - credit);
                }
            });

            // 4. Filter only balance sheet accounts (no Revenue/Expense)
            const allAccounts = Object.values(accMap);

            const assets = allAccounts
                .filter(a => a.type === 'ASSET' && a.balance !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const liabilities = allAccounts
                .filter(a => a.type === 'LIABILITY' && a.balance !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const equity = allAccounts
                .filter(a => a.type === 'EQUITY' && a.balance !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            // 5. Calculate totals
            const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
            const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
            const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);

            // Calculate Net Income from Revenue - Expense for current retention
            // TODO: Future feature - add "Laba Ditahan" calculated from P&L
            const revenueAccounts = allAccounts.filter(a => a.type === 'REVENUE');
            const expenseAccounts = allAccounts.filter(a => ['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(a.type));

            const totalRevenue = revenueAccounts.reduce((sum, a) => sum + a.balance, 0);
            const totalExpense = expenseAccounts.reduce((sum, a) => sum + a.balance, 0);
            const netIncome = totalRevenue - totalExpense;

            // Add Net Income to Equity section as "Laba Tahun Berjalan"
            if (netIncome !== 0) {
                equity.push({
                    id: 'net-income',
                    code: '9999',
                    name: 'Laba Tahun Berjalan',
                    balance: netIncome,
                    type: 'EQUITY',
                    isCalculated: true
                });
            }

            const finalTotalEquity = totalEquity + netIncome;

            setBalances({ assets, liabilities, equity });
            setTotals({
                totalAssets,
                totalLiabilities,
                totalEquity: finalTotalEquity,
                difference: totalAssets - (totalLiabilities + finalTotalEquity)
            });

        } catch (error) {
            console.error('Error fetching balance sheet:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const formatExportCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const handleAccountClick = (accountId) => {
        if (accountId === 'net-income') return; // Calculated field, not clickable
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    const exportToExcel = () => {
        const data = [];

        // Header
        data.push({ 'Kategori': 'LAPORAN NERACA', 'Kode': '', 'Nama Akun': `Per ${asOfDate}`, 'Saldo': '' });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });

        // Assets
        data.push({ 'Kategori': 'ASET', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });
        balances.assets.forEach(acc => {
            data.push({ 'Kategori': '', 'Kode': acc.code, 'Nama Akun': acc.name, 'Saldo': formatExportCurrency(acc.balance) });
        });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': 'Total Aset', 'Saldo': formatExportCurrency(totals.totalAssets) });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });

        // Liabilities
        data.push({ 'Kategori': 'KEWAJIBAN', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });
        balances.liabilities.forEach(acc => {
            data.push({ 'Kategori': '', 'Kode': acc.code, 'Nama Akun': acc.name, 'Saldo': formatExportCurrency(acc.balance) });
        });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': 'Total Kewajiban', 'Saldo': formatExportCurrency(totals.totalLiabilities) });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });

        // Equity
        data.push({ 'Kategori': 'MODAL', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });
        balances.equity.forEach(acc => {
            data.push({ 'Kategori': '', 'Kode': acc.code, 'Nama Akun': acc.name, 'Saldo': formatExportCurrency(acc.balance) });
        });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': 'Total Modal', 'Saldo': formatExportCurrency(totals.totalEquity) });
        data.push({ 'Kategori': '', 'Kode': '', 'Nama Akun': '', 'Saldo': '' });

        // Summary
        data.push({ 'Kategori': 'TOTAL KEWAJIBAN + MODAL', 'Kode': '', 'Nama Akun': '', 'Saldo': formatExportCurrency(totals.totalLiabilities + totals.totalEquity) });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 40 }, { wch: 20 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Neraca");
        XLSX.writeFile(wb, `Neraca_${asOfDate}.xlsx`);
    };

    const isBalanced = Math.abs(totals.difference) < 1;

    const AccountRow = ({ acc }) => (
        <div
            onClick={() => handleAccountClick(acc.id)}
            className={`flex justify-between items-center py-2 px-4 border-b border-dark-border/30 text-sm hover:bg-dark-surface/50 smooth-transition ${acc.isCalculated ? 'cursor-default italic' : 'cursor-pointer group'}`}
        >
            <div className="flex items-center gap-3">
                <span className={`font-mono text-accent-orange min-w-[80px] ${acc.isCalculated ? '' : 'group-hover:underline'}`}>{acc.code}</span>
                <span className="text-silver-light">{acc.name}</span>
            </div>
            <span className="font-mono text-silver-light font-medium">{formatCurrency(acc.balance)}</span>
        </div>
    );

    const SectionCard = ({ title, icon: Icon, data, total, colorClass }) => (
        <div className="glass-card rounded-lg overflow-hidden">
            <div className={`flex items-center justify-between py-3 px-4 ${colorClass} border-b border-dark-border`}>
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <h3 className="font-bold text-lg">{title}</h3>
                </div>
                <span className="font-bold text-lg font-mono">{formatCurrency(total)}</span>
            </div>
            <div className="divide-y divide-dark-border/30">
                {data.length === 0 ? (
                    <div className="p-4 text-center text-silver-dark text-sm">No data</div>
                ) : (
                    data.map(acc => <AccountRow key={acc.id} acc={acc} />)
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Scale className="w-8 h-8" />
                        Laporan Neraca
                    </h1>
                    <p className="text-silver-dark mt-1">Balance Sheet - Posisi Keuangan</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchBalanceSheet}>
                        Refresh
                    </Button>
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                </div>
            </div>

            {/* Date Selection & Balance Status */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center gap-4 flex-1">
                    <Calendar className="w-5 h-5 text-accent-orange" />
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Per Tanggal</label>
                        <input
                            type="date"
                            value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
                            className="bg-dark-bg border border-dark-border rounded px-3 py-1 text-silver-light text-sm"
                        />
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button
                            onClick={() => setAsOfDate(new Date().toISOString().split('T')[0])}
                            className="px-3 py-1 bg-accent-orange text-white rounded text-xs hover:bg-accent-orange/80 smooth-transition"
                        >
                            Hari Ini
                        </button>
                        <button
                            onClick={() => setAsOfDate(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0])}
                            className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-xs text-silver-light hover:bg-dark-card smooth-transition"
                        >
                            Akhir Tahun
                        </button>
                    </div>
                </div>

                <div className={`glass-card p-4 rounded-lg flex items-center justify-between gap-6 border-l-4 ${isBalanced ? 'border-green-500' : 'border-red-500'} min-w-[280px]`}>
                    <div>
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Persamaan Akuntansi</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isBalanced ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    <span className="text-lg font-bold text-green-400">BALANCE</span>
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
                            {formatCurrency(totals.difference)}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 rounded-lg text-center text-silver-dark">
                    Loading balance sheet...
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-card p-4 rounded-lg border-l-4 border-green-500">
                            <p className="text-xs text-silver-dark uppercase">Total Aset</p>
                            <p className="text-2xl font-bold text-green-400 font-mono">{formatCurrency(totals.totalAssets)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-red-500">
                            <p className="text-xs text-silver-dark uppercase">Total Kewajiban</p>
                            <p className="text-2xl font-bold text-red-400 font-mono">{formatCurrency(totals.totalLiabilities)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-xs text-silver-dark uppercase">Total Modal</p>
                            <p className="text-2xl font-bold text-blue-400 font-mono">{formatCurrency(totals.totalEquity)}</p>
                        </div>
                    </div>

                    {/* Balance Sheet Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Assets */}
                        <SectionCard
                            title="ASET"
                            icon={TrendingUp}
                            data={balances.assets}
                            total={totals.totalAssets}
                            colorClass="bg-green-500/20 text-green-400"
                        />

                        {/* Right: Liabilities + Equity */}
                        <div className="space-y-4">
                            <SectionCard
                                title="KEWAJIBAN"
                                icon={FileText}
                                data={balances.liabilities}
                                total={totals.totalLiabilities}
                                colorClass="bg-red-500/20 text-red-400"
                            />
                            <SectionCard
                                title="MODAL"
                                icon={Shield}
                                data={balances.equity}
                                total={totals.totalEquity}
                                colorClass="bg-blue-500/20 text-blue-400"
                            />
                        </div>
                    </div>

                    {/* Accounting Equation Footer */}
                    <div className={`glass-card p-4 rounded-lg border-2 ${isBalanced ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <div className="flex items-center justify-between text-center">
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Aset</p>
                                <p className="text-xl font-bold text-green-400 font-mono">{formatCurrency(totals.totalAssets)}</p>
                            </div>
                            <div className="text-2xl font-bold text-silver-dark">=</div>
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Kewajiban</p>
                                <p className="text-xl font-bold text-red-400 font-mono">{formatCurrency(totals.totalLiabilities)}</p>
                            </div>
                            <div className="text-2xl font-bold text-silver-dark">+</div>
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Modal</p>
                                <p className="text-xl font-bold text-blue-400 font-mono">{formatCurrency(totals.totalEquity)}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className="text-center text-xs text-silver-dark mt-6 italic">
                * Klik pada akun untuk melihat detail di Buku Besar. "Laba Tahun Berjalan" dihitung otomatis dari Pendapatan - Beban.
            </div>
        </div>
    );
};

export default BalanceSheet;
