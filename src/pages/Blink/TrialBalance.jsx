import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    Scale, Search, Calendar, Download, Filter,
    CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, FileText, Printer
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import XLSX from 'xlsx-js-style';
import { printReport, fmtPrint, fmtDatePrint } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';

const TrialBalance = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
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
            
            // Enhanced deduplication: use composite key (entry_number + entry_date + debit + credit)
            // to catch duplicates from different fetch sources
            const uniqueMap = new Map();
            combined.forEach(r => {
                const key = `${r.id}-${r.entry_date}-${r.debit}-${r.credit}`;
                if (!uniqueMap.has(key)) {
                    uniqueMap.set(key, r);
                }
            });
            const entries = Array.from(uniqueMap.values());

            // 3. Process Data
            // 3. Process Data
            const accMap = {};
            const accCodeMap = {};
            const accNameMap = {};

            accounts.forEach(acc => {
                accMap[acc.id] = {
                    ...acc,
                    opening: 0,
                    debitPeriod: 0,
                    creditPeriod: 0,
                    closing: 0
                };
                if (acc.code) accCodeMap[acc.code] = acc.id;
                if (acc.name) accNameMap[acc.name.toLowerCase().trim()] = acc.id;
            });

            // Conversion helper with edge case handling
            const toIDR = (value, currency, exchangeRate) => {
                if (!value || !Number.isFinite(value)) return 0;
                if (currency && currency !== 'IDR' && (exchangeRate || 1) > 1) {
                    return value * exchangeRate;
                }
                return value;
            };

            entries.forEach(e => {
                // Match by ID first, fallback to code
                let targetId = e.coa_id || accCodeMap[e.account_code];
                if (!targetId && e.account_name) {
                    targetId = accNameMap[e.account_name.toLowerCase().trim()];
                }
                if (!targetId) {
                    targetId = `unclassified_${e.account_code || 'unknown'}`;
                    if (!accMap[targetId]) {
                        accMap[targetId] = {
                            id: targetId,
                            code: e.account_code || 'UNMAPPED',
                            name: (e.account_name || 'Unknown Account') + ' (Unmapped)',
                            type: 'ASSET', // default assumptions
                            opening: 0,
                            debitPeriod: 0,
                            creditPeriod: 0,
                            closing: 0
                        };
                    }
                }

                const acc = accMap[targetId];
                if (!acc) return;

                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);

                if (!Number.isFinite(debit) || !Number.isFinite(credit)) return;

                if (e.entry_date < dateRange.start) {
                    // It's Opening Balance
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

            // Calculate Closing with edge case handling
            let totalOpening = 0;
            let totalDebit = 0;
            let totalCredit = 0;
            let totalClosing = 0;

            const processed = Object.values(accMap)
                .map(acc => {
                    const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);

                    // Closing Balance Calculation based on normal balance rules
                    if (isNormalCredit) {
                        acc.closing = acc.opening + acc.creditPeriod - acc.debitPeriod;
                    } else {
                        acc.closing = acc.opening + acc.debitPeriod - acc.creditPeriod;
                    }

                    // Accumulate totals with NaN check
                    if (Number.isFinite(acc.opening)) totalOpening += acc.opening;
                    if (Number.isFinite(acc.debitPeriod)) totalDebit += acc.debitPeriod;
                    if (Number.isFinite(acc.creditPeriod)) totalCredit += acc.creditPeriod;
                    if (Number.isFinite(acc.closing)) totalClosing += acc.closing;

                    return acc;
                })
                .filter(acc => acc.opening !== 0 || acc.debitPeriod !== 0 || acc.creditPeriod !== 0) // Hide zero balance accounts
                .sort((a, b) => a.code.localeCompare(b.code)); // Sort strictly by Account Code

            // Set balanced totals
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

    const handleAccountClick = (accountId) => {
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    const formatCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    // Helper to format money with Parenthesis if negative (Credit)
    const formatBalance = (val) => {
        if (!val && val !== 0) return '-';
        const formatted = Math.abs(val).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        return val < 0 ? `(${formatted})` : formatted;
    };

    const formatExportCurrency = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const getExportData = () => {
        const rows = balances.map(acc => ({
            'Account Code': acc.code,
            'Account Name': acc.name,
            'Level': acc.level || '-',
            'Opening Balance': formatExportCurrency(acc.opening),
            'Debit': formatExportCurrency(acc.debitPeriod),
            'Credit': formatExportCurrency(acc.creditPeriod),
            'Closing Balance': formatExportCurrency(acc.closing)
        }));

        const totalRow = {
            'Account Code': 'TOTAL',
            'Account Name': '',
            'Level': '',
            'Opening Balance': formatExportCurrency(totals.opening),
            'Debit': formatExportCurrency(totals.debit),
            'Credit': formatExportCurrency(totals.credit),
            'Closing Balance': formatExportCurrency(totals.closing)
        };

        return [...rows, totalRow];
    };

    const exportToExcel = () => {
        const data = getExportData();
        const ws = XLSX.utils.json_to_sheet(data);

        // Set column widths
        ws['!cols'] = [
            { wch: 15 }, // Kode
            { wch: 40 }, // Nama
            { wch: 10 }, // Level
            { wch: 18 }, // Awal
            { wch: 18 }, // Debit
            { wch: 18 }, // Kredit
            { wch: 18 }  // Akhir
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
        XLSX.writeFile(wb, `TrialBalance_${dateRange.start}_${dateRange.end}.xlsx`);
    };

    const exportToCSV = () => {
        const data = getExportData();
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "TrialBalance");
        XLSX.writeFile(wb, `TrialBalance_${dateRange.start}_${dateRange.end}.csv`);
    };

    const exportToPDF = () => {
        const isBalanced = Math.abs(totals.closing) < 1;
        const period = `${fmtDatePrint(dateRange.start)} – ${fmtDatePrint(dateRange.end)}`;

        const rows = balances.map(acc => {
            const isHeader = acc.level === '1' || acc.level === '2';
            return `<tr class="${isHeader ? 'row-header' : ''}">
                <td class="code">${acc.code}</td>
                <td>${acc.name}</td>
                <td class="text-center muted">${acc.level || '-'}</td>
                <td class="text-right mono ${acc.opening !== 0 ? '' : 'muted'}">${formatBalance(acc.opening)}</td>
                <td class="text-right mono ${acc.debitPeriod !== 0 ? 'blue' : 'muted'}">${formatCurrency(acc.debitPeriod)}</td>
                <td class="text-right mono ${acc.creditPeriod !== 0 ? '' : 'muted'}">${formatCurrency(acc.creditPeriod)}</td>
                <td class="text-right mono bold ${acc.closing < 0 ? 'red' : acc.closing > 0 ? 'green' : 'muted'}">${formatBalance(acc.closing)}</td>
            </tr>`;
        }).join('');

        const bodyHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <div>
                    <span class="badge ${isBalanced ? 'badge-balanced' : 'badge-unbalanced'}">
                        ${isBalanced ? '✓ BALANCED' : '✗ OUT OF BALANCE'}
                    </span>
                    <span style="font-size:9px;color:#64748b;margin-left:8px">Difference: ${formatBalance(totals.closing)}</span>
                </div>
                <div style="font-size:9px;color:#64748b">${balances.length} accounts with activity</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="min-width:90px">COA Code</th>
                        <th style="min-width:200px">Account Name</th>
                        <th class="text-center" style="width:50px">Level</th>
                        <th class="text-right" style="min-width:120px">Prev Balance</th>
                        <th class="text-right" style="min-width:120px">Debit</th>
                        <th class="text-right" style="min-width:120px">Credit</th>
                        <th class="text-right" style="min-width:120px">Balance</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="3" style="text-align:right;text-transform:uppercase;letter-spacing:.05em">Grand Total</td>
                        <td class="text-right">${formatBalance(totals.opening)}</td>
                        <td class="text-right">${formatCurrency(totals.debit)}</td>
                        <td class="text-right">${formatCurrency(totals.credit)}</td>
                        <td class="text-right">${formatBalance(totals.closing)}</td>
                    </tr>
                </tfoot>
            </table>`;

        printReport({
            reportName: 'Trial Balance',
            companyInfo: companySettings,
            period,
            bodyHTML,
            note: 'Values in parentheses ( ) represent Credit-normal balances (Liabilities / Equity / Revenue). Total Debit and Credit movements must always be balanced.'
        });
    };

    const isBalanced = Math.abs(totals.closing) < 1; // Tolerance for float

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Scale className="w-8 h-8" />
                        Trial Balance
                    </h1>
                    <p className="text-silver-dark mt-1">Account balances and period movements</p>
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
                    <button
                        onClick={exportToPDF}
                        disabled={loading || balances.length === 0}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-red-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs disabled:opacity-40"
                    >
                        <Printer className="w-4 h-4" /> Print PDF
                    </button>
                </div>
            </div>

            {/* Controls & Summary */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center gap-4 flex-1">
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Start Date</label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-dark-bg border border-dark-border rounded px-2 py-1 text-silver-light text-sm"
                        />
                    </div>
                    <div className="h-px w-4 bg-silver-dark"></div>
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">End Date</label>
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
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Balance Status</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isBalanced ? (
                                <>
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    <span className="text-lg font-bold text-green-400">BALANCED</span>
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                    <span className="text-lg font-bold text-red-500">OUT OF BALANCE</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-silver-dark">Difference</p>
                        <p className={`font-mono font-bold ${isBalanced ? 'text-silver-light' : 'text-red-400'}`}>
                            {formatCurrency(totals.closing)}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-silver-dark border border-dark-border rounded-lg bg-dark-surface/30">Loading financial data...</div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-white/10">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0070BB] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">COA Code</th>
                                    <th className="px-4 py-3 text-left font-semibold uppercase tracking-wider">Account Name</th>
                                    <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider">Level</th>
                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Prev Balance</th>
                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Debit</th>
                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Credit</th>
                                    <th className="px-4 py-3 text-right font-semibold uppercase tracking-wider">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/40">
                                {balances.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-4 py-8 text-center text-silver-dark">No transaction data found.</td>
                                    </tr>
                                ) : (
                                    balances.map(acc => {
                                        // Level-based indentation logic (optional visual enhancement)
                                        const indent = acc.level ? (parseInt(acc.level) - 1) * 1.5 : 0;
                                        const isHeader = acc.level === '1' || acc.level === '2';

                                        return (
                                            <tr
                                                key={acc.id}
                                                onClick={() => handleAccountClick(acc.id)}
                                                className={`hover:bg-white/5 smooth-transition cursor-pointer group ${isHeader ? 'bg-dark-surface/50 font-semibold' : ''}`}
                                            >
                                                <td className="px-4 py-2 font-mono text-accent-orange/90 group-hover:text-accent-orange align-top">
                                                    {acc.code}
                                                </td>
                                                <td className="px-4 py-2 text-silver-light align-top truncate max-w-[250px]" style={{ paddingLeft: `${Math.max(1, indent)}rem` }}>
                                                    {acc.name}
                                                </td>
                                                <td className="px-4 py-2 text-center font-mono text-xs text-silver-dark align-top">
                                                    {acc.level || '-'}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono align-top ${acc.opening !== 0 ? 'text-silver-light' : 'text-silver-dark opacity-50'}`}>
                                                    {formatBalance(acc.opening)}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono align-top ${acc.debitPeriod !== 0 ? 'text-blue-400' : 'text-silver-dark opacity-50'}`}>
                                                    {formatCurrency(acc.debitPeriod)}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono align-top ${acc.creditPeriod !== 0 ? 'text-orange-400' : 'text-silver-dark opacity-50'}`}>
                                                    {formatCurrency(acc.creditPeriod)}
                                                </td>
                                                <td className={`px-4 py-2 text-right font-mono font-medium align-top ${acc.closing < 0 ? 'text-red-400' : acc.closing > 0 ? 'text-emerald-400' : 'text-silver-dark'}`}>
                                                    {formatBalance(acc.closing)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-[#0070BB]/10 border-t-2 border-[#0070BB] font-bold">
                                <tr>
                                    <td colSpan="3" className="px-4 py-3 text-right uppercase tracking-wider text-silver-light">GRAND TOTAL</td>
                                    <td className="px-4 py-3 text-right font-mono text-silver-light">{formatBalance(totals.opening)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-400">{formatCurrency(totals.debit)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-orange-400">{formatCurrency(totals.credit)}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${totals.closing !== 0 ? (Math.abs(totals.closing) > 1 ? 'text-red-400' : 'text-emerald-400') : 'text-silver-light'}`}>
                                        {formatBalance(totals.closing)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
            <div className="text-center text-xs text-silver-dark mt-6 italic bg-dark-surface/30 p-4 rounded border border-white/5">
                Note: Values in parentheses ( ) represent Credit-normal balances (Liabilities / Equity / Revenue). Total Debit and Credit movements must always be balanced.
            </div>
        </div>
    );
};

export default TrialBalance;
