import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, DollarSign, Calendar,
    Download, RefreshCw, ChevronDown, ChevronRight,
    FileSpreadsheet, FileText
} from 'lucide-react';
import Button from '../../components/Common/Button';

const ProfitLoss = () => {
    const navigate = useNavigate();
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState({
        revenue: [],
        cogs: [],
        expenses: [],
        other_income: [],
        other_expense: []
    });
    const [totals, setTotals] = useState({
        totalRevenue: 0,
        totalCOGS: 0,
        grossProfit: 0,
        totalExpenses: 0,
        operatingProfit: 0,
        totalOtherIncome: 0,
        totalOtherExpense: 0,
        netIncome: 0
    });
    const [expandedSections, setExpandedSections] = useState({
        revenue: true,
        cogs: true,
        expenses: true,
        other: false
    });

    useEffect(() => {
        fetchReportData();
    }, [dateRange]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);

            // 1. Fetch COA Map
            const { data: coaData, error: coaError } = await supabase
                .from('finance_coa')
                .select('*')
                .order('code', { ascending: true });

            if (coaError) throw coaError;

            // Removed the old coaMap initialization to use the new one below after fetching entries.

            // 2. Fetch Journal Entries within date range
            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null)
                    .gte('entry_date', dateRange.startDate)
                    .lte('entry_date', dateRange.endDate),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .gte('entry_date', dateRange.startDate)
                    .lte('entry_date', dateRange.endDate)
            ]);

            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            // deduplicate by id
            const entries = [...new Map(combined.map(r => [r.id, r])).values()];

            // 3. Aggregate by COA
            const coaMap = {};
            const accCodeMap = {};

            (coaData || []).forEach(coa => {
                coaMap[coa.id] = { ...coa, amount: 0 };
                if (coa.code) accCodeMap[coa.code] = coa.id;
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

                const acc = coaMap[targetId];
                if (!acc) return;

                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);

                // P&L accounts: Revenue increases with Credit, Expense increases with Debit
                if (['REVENUE', 'OTHER_INCOME'].includes(acc.type)) {
                    acc.amount += (credit - debit);
                } else if (['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(acc.type)) {
                    acc.amount += (debit - credit);
                }
            });

            // 4. Categorize accounts
            const allAccounts = Object.values(coaMap);

            const revenue = allAccounts
                .filter(a => a.type === 'REVENUE' && a.amount !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const cogs = allAccounts
                .filter(a => ['COGS', 'DIRECT_COST'].includes(a.type) && a.amount !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const expenses = allAccounts
                .filter(a => a.type === 'EXPENSE' && a.amount !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const other_income = allAccounts
                .filter(a => a.type === 'OTHER_INCOME' && a.amount !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            const other_expense = allAccounts
                .filter(a => a.type === 'OTHER_EXPENSE' && a.amount !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            // 5. Calculate Totals
            const totalRevenue = revenue.reduce((sum, a) => sum + a.amount, 0);
            const totalCOGS = cogs.reduce((sum, a) => sum + a.amount, 0);
            const grossProfit = totalRevenue - totalCOGS;
            const totalExpenses = expenses.reduce((sum, a) => sum + a.amount, 0);
            const operatingProfit = grossProfit - totalExpenses;
            const totalOtherIncome = other_income.reduce((sum, a) => sum + a.amount, 0);
            const totalOtherExpense = other_expense.reduce((sum, a) => sum + a.amount, 0);
            const netIncome = operatingProfit + totalOtherIncome - totalOtherExpense;

            setReportData({ revenue, cogs, expenses, other_income, other_expense });
            setTotals({
                totalRevenue,
                totalCOGS,
                grossProfit,
                totalExpenses,
                operatingProfit,
                totalOtherIncome,
                totalOtherExpense,
                netIncome
            });

        } catch (error) {
            console.error('Error fetching P&L data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount);
    };

    const formatExportCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const handleAccountClick = (accountId) => {
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        const wsData = [
            ['LAPORAN LABA RUGI'],
            [`Periode: ${dateRange.startDate} s/d ${dateRange.endDate}`],
            [''],
            ['KODE', 'KETERANGAN', 'JUMLAH (IDR)'],
            ['', 'PENDAPATAN USAHA', ''],
            ...reportData.revenue.map(item => [item.code, `    ${item.name}`, formatExportCurrency(item.amount)]),
            ['', 'Total Pendapatan Usaha', formatExportCurrency(totals.totalRevenue)],
            [''],
            ['', 'HARGA POKOK PENJUALAN', ''],
            ...reportData.cogs.map(item => [item.code, `    ${item.name}`, formatExportCurrency(item.amount)]),
            ['', 'Total HPP', formatExportCurrency(totals.totalCOGS)],
            [''],
            ['', 'LABA KOTOR', formatExportCurrency(totals.grossProfit)],
            [''],
            ['', 'BEBAN OPERASIONAL', ''],
            ...reportData.expenses.map(item => [item.code, `    ${item.name}`, formatExportCurrency(item.amount)]),
            ['', 'Total Beban Operasional', formatExportCurrency(totals.totalExpenses)],
            [''],
            ['', 'LABA OPERASIONAL', formatExportCurrency(totals.operatingProfit)],
            [''],
            ['', 'PENDAPATAN LAIN-LAIN', ''],
            ...reportData.other_income.map(item => [item.code, `    ${item.name}`, formatExportCurrency(item.amount)]),
            ['', 'Total Pendapatan Lain', formatExportCurrency(totals.totalOtherIncome)],
            [''],
            ['', 'BEBAN LAIN-LAIN', ''],
            ...reportData.other_expense.map(item => [item.code, `    ${item.name}`, formatExportCurrency(item.amount)]),
            ['', 'Total Beban Lain', formatExportCurrency(totals.totalOtherExpense)],
            [''],
            ['', 'LABA BERSIH', formatExportCurrency(totals.netIncome)],
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        ws['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 20 }];

        XLSX.utils.book_append_sheet(wb, ws, 'Laba Rugi');
        XLSX.writeFile(wb, `LabaRugi_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
    };

    const handleExportCSV = () => {
        const csvRows = [
            ['LAPORAN LABA RUGI'],
            [`Periode: ${dateRange.startDate} s/d ${dateRange.endDate}`],
            [''],
            ['KODE', 'KETERANGAN', 'JUMLAH'],
            ['', 'PENDAPATAN USAHA', ''],
            ...reportData.revenue.map(item => [item.code, item.name, formatExportCurrency(item.amount)]),
            ['', 'Total Pendapatan Usaha', formatExportCurrency(totals.totalRevenue)],
            [''],
            ['', 'HARGA POKOK PENJUALAN', ''],
            ...reportData.cogs.map(item => [item.code, item.name, formatExportCurrency(item.amount)]),
            ['', 'Total HPP', formatExportCurrency(totals.totalCOGS)],
            [''],
            ['', 'LABA KOTOR', formatExportCurrency(totals.grossProfit)],
            [''],
            ['', 'BEBAN OPERASIONAL', ''],
            ...reportData.expenses.map(item => [item.code, item.name, formatExportCurrency(item.amount)]),
            ['', 'Total Beban Operasional', formatExportCurrency(totals.totalExpenses)],
            [''],
            ['', 'LABA OPERASIONAL', formatExportCurrency(totals.operatingProfit)],
            [''],
            ['', 'LABA BERSIH', formatExportCurrency(totals.netIncome)],
        ];

        const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `LabaRugi_${dateRange.startDate}_${dateRange.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const ReportRow = ({ item, isTotal = false, indent = 0 }) => (
        <div
            onClick={() => !isTotal && handleAccountClick(item.id)}
            className={`flex justify-between items-center py-1.5 px-4 border-b border-gray-200 dark:border-dark-border/30 text-sm hover:bg-gray-50 dark:hover:bg-dark-surface/50 smooth-transition ${isTotal ? 'font-bold bg-gray-50 dark:bg-dark-surface/30 cursor-default' : 'bg-white dark:bg-transparent cursor-pointer group'}`}
        >
            <div className="flex items-center gap-4" style={{ paddingLeft: `${indent * 1.5}rem` }}>
                {!isTotal && <span className="text-sm font-mono text-gray-600 dark:text-gray-400 min-w-[10rem] flex-shrink-0 group-hover:underline">{item.code || '0000'}</span>}
                <span className={`${isTotal ? 'text-gray-900 dark:text-silver-light' : 'text-gray-700 dark:text-silver'}`}>{item.name}</span>
            </div>
            <span className={`font-mono tabular-nums ${isTotal ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-silver'}`}>
                {item.amount < 0 ? `(${formatCurrency(Math.abs(item.amount))})` : formatCurrency(item.amount)}
            </span>
        </div>
    );

    const SectionHeader = ({ title, total, type, isOpen, onToggle }) => (
        <div
            className="flex justify-between items-center py-2 px-3 bg-gray-100 dark:bg-dark-surface/80 cursor-pointer hover:bg-gray-200 dark:hover:bg-dark-surface smooth-transition border-y border-gray-300 dark:border-dark-border mt-1"
            onClick={() => onToggle(type)}
        >
            <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-600 dark:text-white" /> : <ChevronRight className="w-4 h-4 text-gray-500 dark:text-white/70" />}
                <h3 className="font-semibold text-sm text-gray-800 dark:text-white uppercase tracking-wider">{title}</h3>
            </div>
            <span className="font-bold text-sm text-gray-800 dark:text-white font-mono tabular-nums">{formatCurrency(total)}</span>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-[#0070BB] dark:text-accent-orange" />
                        Laporan Laba Rugi
                    </h1>
                    <p className="text-gray-500 dark:text-silver-dark text-xs">Periode: {new Date(dateRange.startDate).toLocaleDateString('id-ID')} - {new Date(dateRange.endDate).toLocaleDateString('id-ID')}</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-dark-border shadow-sm">
                    <div className="flex items-center px-2 border-r border-gray-200 dark:border-dark-border/50">
                        <Calendar className="w-3 h-3 text-gray-500 dark:text-silver-dark mr-2" />
                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Range:</span>
                        <input
                            type="date"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            className="bg-transparent border-none text-xs text-gray-700 dark:text-white focus:ring-0 p-0 w-24"
                        />
                        <span className="text-gray-400 dark:text-silver-dark mx-1">-</span>
                        <input
                            type="date"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            className="bg-transparent border-none text-xs text-gray-700 dark:text-white focus:ring-0 p-0 w-24"
                        />
                    </div>

                    <button
                        onClick={fetchReportData}
                        className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-gray-600 dark:text-silver-light"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <button
                            onClick={handleExportExcel}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors text-green-600 dark:text-green-400"
                            title="Export Excel (.xlsx)"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleExportCSV}
                            className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors text-blue-600 dark:text-blue-400"
                            title="Export CSV"
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Financial Report Container */}
            <div className="bg-white dark:bg-dark-surface/20 border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden shadow-lg dark:shadow-xl dark:backdrop-blur-sm">

                {/* Header Row */}
                <div className="flex justify-between items-center py-2 px-4 bg-[#0070BB] dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                    <span className="text-xs font-bold text-white dark:text-silver-dark uppercase tracking-widest pl-32">Akun / Keterangan</span>
                    <span className="text-xs font-bold text-white dark:text-silver-dark uppercase tracking-widest">Jumlah (IDR)</span>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-12 text-center text-silver-dark">Loading data...</div>
                    ) : (
                        <>
                            {/* REVENUE */}
                            <SectionHeader title="Pendapatan Usaha" total={totals.totalRevenue} type="revenue" isOpen={expandedSections.revenue} onToggle={toggleSection} />
                            {expandedSections.revenue && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.revenue.length === 0 ? (
                                        <div className="p-4 text-center text-silver-dark text-sm">Tidak ada data pendapatan</div>
                                    ) : (
                                        reportData.revenue.map(item => <ReportRow key={item.id} item={item} indent={1} />)
                                    )}
                                    <ReportRow item={{ name: 'Total Pendapatan Usaha', amount: totals.totalRevenue }} isTotal indent={1} />
                                </div>
                            )}

                            {/* COGS */}
                            <SectionHeader title="Harga Pokok Penjualan" total={totals.totalCOGS} type="cogs" isOpen={expandedSections.cogs} onToggle={toggleSection} />
                            {expandedSections.cogs && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.cogs.length === 0 ? (
                                        <div className="p-4 text-center text-silver-dark text-sm">Tidak ada data HPP</div>
                                    ) : (
                                        reportData.cogs.map(item => <ReportRow key={item.id} item={item} indent={1} />)
                                    )}
                                    <ReportRow item={{ name: 'Total HPP', amount: totals.totalCOGS }} isTotal indent={1} />
                                </div>
                            )}

                            {/* GROSS PROFIT */}
                            <div className="flex justify-between items-center py-1.5 px-4 bg-gray-50 dark:bg-dark-surface/40 border-y border-gray-200 dark:border-dark-border my-0.5">
                                <span className="font-bold text-sm text-gray-800 dark:text-silver-light ml-4">LABA KOTOR</span>
                                <span className={`font-bold text-sm font-mono ${totals.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(totals.grossProfit)}
                                </span>
                            </div>

                            {/* EXPENSES */}
                            <SectionHeader title="Beban Operasional" total={totals.totalExpenses} type="expenses" isOpen={expandedSections.expenses} onToggle={toggleSection} />
                            {expandedSections.expenses && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.expenses.length === 0 ? (
                                        <div className="p-4 text-center text-silver-dark text-sm">Tidak ada data beban</div>
                                    ) : (
                                        reportData.expenses.map(item => <ReportRow key={item.id} item={item} indent={1} />)
                                    )}
                                    <ReportRow item={{ name: 'Total Beban Operasional', amount: totals.totalExpenses }} isTotal indent={1} />
                                </div>
                            )}

                            {/* OPERATING PROFIT */}
                            <div className="flex justify-between items-center py-1.5 px-4 bg-gray-50 dark:bg-dark-surface/40 border-y border-gray-200 dark:border-dark-border my-0.5">
                                <span className="font-bold text-sm text-gray-800 dark:text-silver-light ml-4">LABA OPERASIONAL</span>
                                <span className={`font-bold text-sm font-mono ${totals.operatingProfit >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(totals.operatingProfit)}
                                </span>
                            </div>

                            {/* OTHER INCOME/EXPENSE */}
                            <SectionHeader title="Pendapatan & Beban Lain" total={totals.totalOtherIncome - totals.totalOtherExpense} type="other" isOpen={expandedSections.other} onToggle={toggleSection} />
                            {expandedSections.other && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.other_income.length > 0 && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-silver-dark uppercase">Pendapatan Lain:</div>
                                            {reportData.other_income.map(item => <ReportRow key={item.id} item={item} indent={1} />)}
                                        </>
                                    )}
                                    {reportData.other_expense.length > 0 && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-silver-dark uppercase">Beban Lain:</div>
                                            {reportData.other_expense.map(item => <ReportRow key={item.id} item={{ ...item, amount: -item.amount }} indent={1} />)}
                                        </>
                                    )}
                                    <ReportRow item={{ name: 'Total Lain-lain', amount: totals.totalOtherIncome - totals.totalOtherExpense }} isTotal indent={1} />
                                </div>
                            )}

                            {/* NET INCOME */}
                            <div className="flex justify-between items-center py-3 px-4 bg-[#0070BB]/10 dark:bg-accent-orange/10 border-t-2 border-[#0070BB] dark:border-accent-orange mt-2">
                                <span className="font-bold text-base text-[#0070BB] dark:text-accent-orange uppercase tracking-wider">Laba Bersih</span>
                                <span className={`font-bold text-xl font-mono underline decoration-double underline-offset-4 ${totals.netIncome >= 0 ? 'text-[#0070BB] dark:text-accent-orange' : 'text-red-600 dark:text-red-400'}`}>
                                    {formatCurrency(totals.netIncome)}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-silver-dark mt-6 italic">
                * Klik pada akun untuk melihat detail di Buku Besar. Data diambil dari Jurnal Umum.
            </div>
        </div>
    );
};

export default ProfitLoss;
