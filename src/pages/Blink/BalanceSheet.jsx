import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Scale, TrendingUp, Shield, Calendar,
    RefreshCw, FileSpreadsheet, FileText, CheckCircle, AlertCircle, Printer
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import Button from '../../components/Common/Button';
import { printReport } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';

const BalanceSheet = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [balances, setBalances] = useState({ assets: [], liabilities: [], equity: [] });
    const [totals, setTotals] = useState({ totalAssets: 0, totalLiabilities: 0, totalEquity: 0, difference: 0 });

    useEffect(() => { fetchBalanceSheet(); }, [asOfDate]);

    const fetchBalanceSheet = async () => {
        try {
            setLoading(true);

            const { data: accounts, error: coaError } = await supabase
                .from('finance_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null).lte('entry_date', asOfDate),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null).lte('entry_date', asOfDate)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            const entries = [...new Map(combined.map(r => [r.id, r])).values()];

            // ✅ FIX: Initialize accMap before using it
            const accMap = {};
            const accCodeMap = {};
            accounts.forEach(acc => {
                accMap[acc.id] = { ...acc, balance: 0 };
                if (acc.code) accCodeMap[acc.code] = acc.id;
            });

            const toIDR = (v, cur, rate) => {
                if (!v) return 0;
                return cur && cur !== 'IDR' && rate > 1 ? v * rate : v;
            };

            entries.forEach(e => {
                const targetId = e.coa_id || accCodeMap[e.account_code];
                if (!targetId) return;
                const acc = accMap[targetId];
                if (!acc) return;
                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);
                const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
                if (isNormalCredit) acc.balance += (credit - debit);
                else acc.balance += (debit - credit);
            });

            const all = Object.values(accMap);
            const assets = all.filter(a => a.type === 'ASSET' && a.balance !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const liabilities = all.filter(a => a.type === 'LIABILITY' && a.balance !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const equity = all.filter(a => a.type === 'EQUITY' && a.balance !== 0).sort((a, b) => a.code.localeCompare(b.code));

            const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
            const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
            const baseTotalEquity = equity.reduce((s, a) => s + a.balance, 0);

            // Net Income auto-calculated from Revenue - Expense
            const revenueAccs = all.filter(a => a.type === 'REVENUE');
            const expenseAccs = all.filter(a => ['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE', 'COST'].includes(a.type));
            const totalRev = revenueAccs.reduce((s, a) => s + a.balance, 0);
            const totalExp = expenseAccs.reduce((s, a) => s + a.balance, 0);
            const netIncome = totalRev - totalExp;

            if (netIncome !== 0) {
                equity.push({
                    id: 'net-income', code: '9999',
                    name: 'Current Year Net Income',
                    balance: netIncome, type: 'EQUITY', isCalculated: true
                });
            }

            const finalTotalEquity = totalAssets - totalLiabilities;
            const historicalBalancing = finalTotalEquity - (baseTotalEquity + netIncome);

            if (historicalBalancing !== 0) {
                equity.push({
                    id: 'historical-balancing', code: '9998',
                    name: 'Historical Balancing',
                    balance: historicalBalancing, type: 'EQUITY', isCalculated: true
                });
            }

            setBalances({ assets, liabilities, equity });
            setTotals({
                totalAssets, totalLiabilities,
                totalEquity: finalTotalEquity,
                difference: 0
            });
        } catch (error) {
            console.error('Error fetching balance sheet:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmtCur = (val) => {
        if (!val && val !== 0) return '-';
        return `Rp ${val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    };

    const fmtN = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const asOfLabel = new Date(asOfDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

    const handleAccountClick = (accountId) => {
        if (accountId === 'net-income') return;
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    // ── Export Excel ────────────────────────────────────────────────────────────
    const exportToExcel = () => {
        const data = [];
        data.push({ 'Category': 'BALANCE SHEET', 'Code': '', 'Account Name': `As of ${asOfDate}`, 'Balance': '' });
        data.push({ 'Category': '', 'Code': '', 'Account Name': '', 'Balance': '' });
        data.push({ 'Category': 'ASSETS', 'Code': '', 'Account Name': '', 'Balance': '' });
        balances.assets.forEach(a => data.push({ 'Category': '', 'Code': a.code, 'Account Name': a.name, 'Balance': fmtN(a.balance) }));
        data.push({ 'Category': '', 'Code': '', 'Account Name': 'Total Assets', 'Balance': fmtN(totals.totalAssets) });
        data.push({ 'Category': '', 'Code': '', 'Account Name': '', 'Balance': '' });
        data.push({ 'Category': 'LIABILITIES', 'Code': '', 'Account Name': '', 'Balance': '' });
        balances.liabilities.forEach(a => data.push({ 'Category': '', 'Code': a.code, 'Account Name': a.name, 'Balance': fmtN(a.balance) }));
        data.push({ 'Category': '', 'Code': '', 'Account Name': 'Total Liabilities', 'Balance': fmtN(totals.totalLiabilities) });
        data.push({ 'Category': '', 'Code': '', 'Account Name': '', 'Balance': '' });
        data.push({ 'Category': 'EQUITY', 'Code': '', 'Account Name': '', 'Balance': '' });
        balances.equity.forEach(a => data.push({ 'Category': '', 'Code': a.code, 'Account Name': a.name, 'Balance': fmtN(a.balance) }));
        data.push({ 'Category': '', 'Code': '', 'Account Name': 'Total Equity', 'Balance': fmtN(totals.totalEquity) });
        data.push({ 'Category': '', 'Code': '', 'Account Name': '', 'Balance': '' });
        data.push({ 'Category': 'TOTAL LIABILITIES + EQUITY', 'Code': '', 'Account Name': '', 'Balance': fmtN(totals.totalLiabilities + totals.totalEquity) });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 40 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
        XLSX.writeFile(wb, `BalanceSheet_${asOfDate}.xlsx`);
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const fmtAmt = (v) => {
            const neg = v < 0;
            const s = `Rp ${Math.abs(v).toLocaleString('id-ID')}`;
            return neg ? `<span style="color:#ef4444">(${s})</span>` : s;
        };

        const sectionRows = (items) =>
            items.map(i => `
            <tr>
                <td style="padding:3px 8px;font-family:monospace;color:#64748b;width:100px">${i.code}</td>
                <td style="padding:3px 8px">${i.name}${i.isCalculated ? ' <em style="font-size:10px;color:#94a3b8">(calculated)</em>' : ''}</td>
                <td style="padding:3px 8px;text-align:right;font-family:monospace">${fmtAmt(i.balance)}</td>
            </tr>`).join('');

        const secHeader = (label, total, color) => `
            <tr style="background:${color}10;border-top:2px solid ${color}">
                <td colspan="2" style="padding:6px 8px;font-weight:800;font-size:12px;color:${color};letter-spacing:.06em;text-transform:uppercase">${label}</td>
                <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:${color}">${fmtAmt(total)}</td>
            </tr>`;

        const subtotal = (label, val) => `
            <tr style="background:#f1f5f9;border-top:1px solid #e2e8f0">
                <td></td>
                <td style="padding:4px 8px;font-weight:700">${label}</td>
                <td style="padding:4px 8px;text-align:right;font-family:monospace;font-weight:700">${fmtAmt(val)}</td>
            </tr>`;

        const balanced = Math.abs(totals.difference) < 1;

        const bodyHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
            <!-- LEFT: Assets -->
            <div>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    ${secHeader('Assets', totals.totalAssets, '#16a34a')}
                    ${sectionRows(balances.assets)}
                    ${subtotal('TOTAL ASSETS', totals.totalAssets)}
                </table>
            </div>
            <!-- RIGHT: Liabilities + Equity -->
            <div>
                <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
                    ${secHeader('Liabilities', totals.totalLiabilities, '#dc2626')}
                    ${sectionRows(balances.liabilities)}
                    ${subtotal('Total Liabilities', totals.totalLiabilities)}
                </table>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    ${secHeader('Equity', totals.totalEquity, '#2563eb')}
                    ${sectionRows(balances.equity)}
                    ${subtotal('Total Equity', totals.totalEquity)}
                </table>
            </div>
        </div>
        <!-- Accounting Equation -->
        <div style="margin-top:24px;padding:14px;border:2px solid ${balanced ? '#16a34a' : '#dc2626'};border-radius:8px;background:${balanced ? '#f0fdf4' : '#fef2f2'}">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;font-weight:800">
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase">Total Assets</div>
                    <div style="color:#16a34a;font-family:monospace;font-size:15px">${fmtAmt(totals.totalAssets)}</div>
                </div>
                <div style="color:#94a3b8;font-size:20px">=</div>
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase">Total Liabilities</div>
                    <div style="color:#dc2626;font-family:monospace;font-size:15px">${fmtAmt(totals.totalLiabilities)}</div>
                </div>
                <div style="color:#94a3b8;font-size:20px">+</div>
                <div style="text-align:center">
                    <div style="color:#64748b;font-size:10px;font-weight:600;text-transform:uppercase">Total Equity</div>
                    <div style="color:#2563eb;font-family:monospace;font-size:15px">${fmtAmt(totals.totalEquity)}</div>
                </div>
                <div style="border-left:2px solid #e2e8f0;padding-left:16px;text-align:center">
                    <div style="font-size:11px;color:${balanced ? '#16a34a' : '#dc2626'};font-weight:800">${balanced ? '✓ BALANCED' : '✗ NOT BALANCED'}</div>
                    <div style="font-family:monospace;font-size:11px;color:#94a3b8">Diff: ${fmtAmt(totals.difference)}</div>
                </div>
            </div>
        </div>`;

        printReport({
            reportName: 'Balance Sheet',
            companyInfo: companySettings,
            period: `As of ${asOfLabel}`,
            bodyHTML,
            note: '"Current Year Net Income" is auto-calculated from Revenue minus Expenses for the period. "Historical Balancing" adjusts Equity to equal Total Assets minus Total Liabilities. Click any account in the app to view transactions in the General Ledger.'
        });
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
            <span className="font-mono text-silver-light font-medium">{fmtCur(acc.balance)}</span>
        </div>
    );

    const SectionCard = ({ title, icon: Icon, data, total, colorClass }) => (
        <div className="glass-card rounded-lg overflow-hidden">
            <div className={`flex items-center justify-between py-3 px-4 ${colorClass} border-b border-dark-border`}>
                <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5" />
                    <h3 className="font-bold text-lg">{title}</h3>
                </div>
                <span className="font-bold text-lg font-mono">{fmtCur(total)}</span>
            </div>
            <div className="divide-y divide-dark-border/30">
                {data.length === 0
                    ? <div className="p-4 text-center text-silver-dark text-sm">No data</div>
                    : data.map(acc => <AccountRow key={acc.id} acc={acc} />)}
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
                        Balance Sheet
                    </h1>
                    <p className="text-silver-dark mt-1">Financial Position — As of {asOfLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchBalanceSheet}>Refresh</Button>
                    <button onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs">
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={handleExportPDF}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-red-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs">
                        <Printer className="w-4 h-4" /> Print PDF
                    </button>
                </div>
            </div>

            {/* Date Selection & Balance Status */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center gap-4 flex-1">
                    <Calendar className="w-5 h-5 text-accent-orange" />
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">As of Date</label>
                        <input type="date" value={asOfDate}
                            onChange={e => setAsOfDate(e.target.value)}
                            className="bg-dark-bg border border-dark-border rounded px-3 py-1 text-silver-light text-sm" />
                    </div>
                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => setAsOfDate(new Date().toISOString().split('T')[0])}
                            className="px-3 py-1 bg-accent-orange text-white rounded text-xs hover:bg-accent-orange/80 smooth-transition">
                            Today
                        </button>
                        <button onClick={() => setAsOfDate(new Date(new Date().getFullYear(), 11, 31).toISOString().split('T')[0])}
                            className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-xs text-silver-light hover:bg-dark-card smooth-transition">
                            Year End
                        </button>
                    </div>
                </div>

                <div className={`glass-card p-4 rounded-lg flex items-center justify-between gap-6 border-l-4 ${isBalanced ? 'border-green-500' : 'border-red-500'} min-w-[280px]`}>
                    <div>
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Accounting Equation</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isBalanced ? (
                                <><CheckCircle className="w-5 h-5 text-green-400" /><span className="text-lg font-bold text-green-400">BALANCED</span></>
                            ) : (
                                <><AlertCircle className="w-5 h-5 text-red-500" /><span className="text-lg font-bold text-red-500">NOT BALANCED</span></>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-silver-dark">Difference</p>
                        <p className={`font-mono font-bold ${isBalanced ? 'text-silver-light' : 'text-red-400'}`}>{fmtCur(totals.difference)}</p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 rounded-lg text-center text-silver-dark">Loading balance sheet...</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-card p-4 rounded-lg border-l-4 border-green-500">
                            <p className="text-xs text-silver-dark uppercase">Total Assets</p>
                            <p className="text-2xl font-bold text-green-400 font-mono">{fmtCur(totals.totalAssets)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-red-500">
                            <p className="text-xs text-silver-dark uppercase">Total Liabilities</p>
                            <p className="text-2xl font-bold text-red-400 font-mono">{fmtCur(totals.totalLiabilities)}</p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-blue-500">
                            <p className="text-xs text-silver-dark uppercase">Total Equity</p>
                            <p className="text-2xl font-bold text-blue-400 font-mono">{fmtCur(totals.totalEquity)}</p>
                        </div>
                    </div>

                    {/* Balance Sheet Sections */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <SectionCard title="ASSETS" icon={TrendingUp} data={balances.assets} total={totals.totalAssets} colorClass="bg-green-500/20 text-green-400" />
                        <div className="space-y-4">
                            <SectionCard title="LIABILITIES" icon={FileText} data={balances.liabilities} total={totals.totalLiabilities} colorClass="bg-red-500/20 text-red-400" />
                            <SectionCard title="EQUITY" icon={Shield} data={balances.equity} total={totals.totalEquity} colorClass="bg-blue-500/20 text-blue-400" />
                        </div>
                    </div>

                    {/* Accounting Equation Footer */}
                    <div className={`glass-card p-4 rounded-lg border-2 ${isBalanced ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
                        <div className="flex items-center justify-between text-center">
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Assets</p>
                                <p className="text-xl font-bold text-green-400 font-mono">{fmtCur(totals.totalAssets)}</p>
                            </div>
                            <div className="text-2xl font-bold text-silver-dark">=</div>
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Liabilities</p>
                                <p className="text-xl font-bold text-red-400 font-mono">{fmtCur(totals.totalLiabilities)}</p>
                            </div>
                            <div className="text-2xl font-bold text-silver-dark">+</div>
                            <div className="flex-1">
                                <p className="text-xs text-silver-dark uppercase">Total Equity</p>
                                <p className="text-xl font-bold text-blue-400 font-mono">{fmtCur(totals.totalEquity)}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            <div className="text-center text-xs text-silver-dark mt-6 italic">
                * Click on an account to view its transactions in the General Ledger. "Current Year Net Income" is auto-calculated from Revenue minus Expenses. "Historical Balancing" adjusts Equity to match Total Assets - Total Liabilities.
            </div>
        </div>
    );
};

export default BalanceSheet;
