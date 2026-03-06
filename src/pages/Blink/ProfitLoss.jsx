import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    TrendingUp, TrendingDown, DollarSign, Calendar,
    Download, RefreshCw, ChevronDown, ChevronRight,
    FileSpreadsheet, FileText, Printer
} from 'lucide-react';
import Button from '../../components/Common/Button';
import { printReport, fmtPrint } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';

const ProfitLoss = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(true);
    const [reportMonths, setReportMonths] = useState([]);
    const [reportData, setReportData] = useState({
        revenue: [], cogs: [], expenses: [], other_income: [], other_expense: []
    });
    const [totals, setTotals] = useState({
        totalRevenue: 0, totalCOGS: 0, grossProfit: 0,
        totalExpenses: 0, operatingProfit: 0,
        totalOtherIncome: 0, totalOtherExpense: 0, netIncome: 0,
        byMonth: {}
    });
    const [expandedSections, setExpandedSections] = useState({
        revenue: true, cogs: true, expenses: true, other: false
    });

    useEffect(() => { fetchReportData(); }, [dateRange]);

    const toggleSection = (section) =>
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const { data: coaData, error: coaError } = await supabase
                .from('finance_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            const [r1, r2] = await Promise.all([
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null)
                    .gte('entry_date', dateRange.startDate).lte('entry_date', dateRange.endDate),
                supabase.from('blink_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .gte('entry_date', dateRange.startDate).lte('entry_date', dateRange.endDate)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            const entries = [...new Map(combined.map(r => [r.id, r])).values()];

            const d1 = new Date(dateRange.startDate + 'T00:00:00');
            const d2 = new Date(dateRange.endDate + 'T00:00:00');
            const monthsList = [];
            let cd = new Date(d1.getFullYear(), d1.getMonth(), 1);
            const ed = new Date(d2.getFullYear(), d2.getMonth(), 1);
            while (cd <= ed) {
                const yyyy = cd.getFullYear();
                const mm = String(cd.getMonth() + 1).padStart(2, '0');
                monthsList.push(`${yyyy}-${mm}`);
                cd.setMonth(cd.getMonth() + 1);
            }
            if (monthsList.length === 0 && dateRange.startDate) {
                monthsList.push(dateRange.startDate.substring(0, 7));
            }

            const coaMap = {};
            const accCodeMap = {};
            (coaData || []).forEach(coa => {
                const byMonth = {};
                monthsList.forEach(m => byMonth[m] = 0);
                coaMap[coa.id] = { ...coa, amount: 0, byMonth };
                if (coa.code) accCodeMap[coa.code] = coa.id;
            });

            const toIDR = (v, cur, rate) => {
                if (!v) return 0;
                return cur && cur !== 'IDR' && rate > 1 ? v * rate : v;
            };

            entries.forEach(e => {
                const targetId = e.coa_id || accCodeMap[e.account_code];
                if (!targetId) return;
                const acc = coaMap[targetId];
                if (!acc) return;
                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);

                let val = 0;
                if (['REVENUE', 'OTHER_INCOME'].includes(acc.type)) val = (credit - debit);
                else if (['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(acc.type)) val = (debit - credit);

                acc.amount += val;
                const mKey = e.entry_date.substring(0, 7);
                if (acc.byMonth && acc.byMonth[mKey] !== undefined) {
                    acc.byMonth[mKey] += val;
                }
            });

            const all = Object.values(coaMap);
            const revenue = all.filter(a => a.type === 'REVENUE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const cogs = all.filter(a => ['COGS', 'DIRECT_COST'].includes(a.type) && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const expenses = all.filter(a => a.type === 'EXPENSE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const other_income = all.filter(a => a.type === 'OTHER_INCOME' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const other_expense = all.filter(a => a.type === 'OTHER_EXPENSE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));

            const totalRevenue = revenue.reduce((s, a) => s + a.amount, 0);
            const totalCOGS = cogs.reduce((s, a) => s + a.amount, 0);
            const grossProfit = totalRevenue - totalCOGS;
            const totalExpenses = expenses.reduce((s, a) => s + a.amount, 0);
            const operatingProfit = grossProfit - totalExpenses;
            const totalOtherIncome = other_income.reduce((s, a) => s + a.amount, 0);
            const totalOtherExpense = other_expense.reduce((s, a) => s + a.amount, 0);
            const netIncome = operatingProfit + totalOtherIncome - totalOtherExpense;

            const byMonth = {};
            monthsList.forEach(m => {
                const mRev = revenue.reduce((s, a) => s + a.byMonth[m], 0);
                const mCogs = cogs.reduce((s, a) => s + a.byMonth[m], 0);
                const mGross = mRev - mCogs;
                const mExp = expenses.reduce((s, a) => s + a.byMonth[m], 0);
                const mOp = mGross - mExp;
                const mOtherInc = other_income.reduce((s, a) => s + a.byMonth[m], 0);
                const mOtherExp = other_expense.reduce((s, a) => s + a.byMonth[m], 0);
                byMonth[m] = {
                    totalRevenue: mRev, totalCOGS: mCogs, grossProfit: mGross,
                    totalExpenses: mExp, operatingProfit: mOp,
                    totalOtherIncome: mOtherInc, totalOtherExpense: mOtherExp,
                    netIncome: mOp + mOtherInc - mOtherExp
                };
            });

            setReportMonths(monthsList);
            setReportData({ revenue, cogs, expenses, other_income, other_expense });
            setTotals({ totalRevenue, totalCOGS, grossProfit, totalExpenses, operatingProfit, totalOtherIncome, totalOtherExpense, netIncome, byMonth });
        } catch (error) {
            console.error('Error fetching P&L data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatNumber = (amount) => {
        if (amount === 0) return '-';
        const neg = amount < 0;
        const s = Math.abs(amount).toLocaleString('id-ID');
        return neg ? `(${s})` : s;
    };

    const fmtN = (val) => {
        if (!val && val !== 0) return '-';
        return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    };

    const period = `${new Date(dateRange.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(dateRange.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

    const handleAccountClick = (accountId) =>
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });

    // ── Export Excel ────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();
        const headerRow = ['CODE', 'DESCRIPTION', ...reportMonths, 'TOTAL (IDR)'];
        const emptyCols = reportMonths.map(() => '');

        const rows = [
            ['INCOME STATEMENT (PROFIT & LOSS)'],
            [`Period: ${dateRange.startDate} to ${dateRange.endDate}`],
            [''],
            headerRow,
            ['', 'REVENUE', ...emptyCols, ''],
            ...reportData.revenue.map(i => [i.code, `    ${i.name}`, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Revenue', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalRevenue || 0)), fmtN(totals.totalRevenue)],
            [''],
            ['', 'COST OF GOODS SOLD (COGS)', ...emptyCols, ''],
            ...reportData.cogs.map(i => [i.code, `    ${i.name}`, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total COGS', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalCOGS || 0)), fmtN(totals.totalCOGS)],
            [''],
            ['', 'GROSS PROFIT', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.grossProfit || 0)), fmtN(totals.grossProfit)],
            [''],
            ['', 'OPERATING EXPENSES', ...emptyCols, ''],
            ...reportData.expenses.map(i => [i.code, `    ${i.name}`, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Operating Expenses', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalExpenses || 0)), fmtN(totals.totalExpenses)],
            [''],
            ['', 'OPERATING PROFIT', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.operatingProfit || 0)), fmtN(totals.operatingProfit)],
            [''],
            ['', 'OTHER INCOME', ...emptyCols, ''],
            ...reportData.other_income.map(i => [i.code, `    ${i.name}`, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Other Income', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalOtherIncome || 0)), fmtN(totals.totalOtherIncome)],
            [''],
            ['', 'OTHER EXPENSES', ...emptyCols, ''],
            ...reportData.other_expense.map(i => [i.code, `    ${i.name}`, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Other Expenses', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalOtherExpense || 0)), fmtN(totals.totalOtherExpense)],
            [''],
            ['', 'NET INCOME', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.netIncome || 0)), fmtN(totals.netIncome)],
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 15 }, { wch: 45 }, ...reportMonths.map(() => ({ wch: 15 })), { wch: 20 }];
        XLSX.utils.book_append_sheet(wb, ws, 'Income Statement');
        XLSX.writeFile(wb, `IncomeStatement_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
    };

    // ── Export CSV ──────────────────────────────────────────────────────────────
    const handleExportCSV = () => {
        const headerRow = ['CODE', 'DESCRIPTION', ...reportMonths, 'AMOUNT'];
        const emptyCols = reportMonths.map(() => '');
        const rows = [
            ['INCOME STATEMENT (PROFIT & LOSS)'],
            [`Period: ${dateRange.startDate} to ${dateRange.endDate}`],
            [''],
            headerRow,
            ['', 'REVENUE', ...emptyCols, ''],
            ...reportData.revenue.map(i => [i.code, i.name, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Revenue', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalRevenue || 0)), fmtN(totals.totalRevenue)],
            [''],
            ['', 'COGS', ...emptyCols, ''],
            ...reportData.cogs.map(i => [i.code, i.name, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total COGS', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalCOGS || 0)), fmtN(totals.totalCOGS)],
            [''],
            ['', 'GROSS PROFIT', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.grossProfit || 0)), fmtN(totals.grossProfit)],
            [''],
            ['', 'OPERATING EXPENSES', ...emptyCols, ''],
            ...reportData.expenses.map(i => [i.code, i.name, ...reportMonths.map(m => fmtN(i.byMonth[m])), fmtN(i.amount)]),
            ['', 'Total Operating Expenses', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.totalExpenses || 0)), fmtN(totals.totalExpenses)],
            [''],
            ['', 'OPERATING PROFIT', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.operatingProfit || 0)), fmtN(totals.operatingProfit)],
            [''],
            ['', 'NET INCOME', ...reportMonths.map(m => fmtN(totals.byMonth?.[m]?.netIncome || 0)), fmtN(totals.netIncome)],
        ];
        const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
        const link = document.createElement('a');
        link.setAttribute('href', encodeURI(csvContent));
        link.setAttribute('download', `IncomeStatement_${dateRange.startDate}_${dateRange.endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const fmtAmt = (v) => {
            const neg = v < 0;
            const s = `Rp ${Math.abs(v).toLocaleString('id-ID')}`;
            return neg ? `<span style="color:#ef4444">(${s})</span>` : s;
        };

        const colCount = reportMonths.length + 3;

        const headerCols = reportMonths.map(m => {
            const [y, mm] = m.split('-');
            const d = new Date(parseInt(y), parseInt(mm) - 1, 1);
            return `<th style="padding:6px 8px;text-align:right;font-size:11px;color:#475569;border-bottom:2px solid #cbd5e1">${d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}</th>`;
        }).join('');

        const headerRowHTML = `
            <tr>
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#475569;border-bottom:2px solid #cbd5e1">CODE</th>
                <th style="padding:6px 8px;text-align:left;font-size:11px;color:#475569;border-bottom:2px solid #cbd5e1">ACCOUNT / DESCRIPTION</th>
                ${headerCols}
                <th style="padding:6px 8px;text-align:right;font-size:11px;color:#475569;border-bottom:2px solid #cbd5e1">TOTAL (IDR)</th>
            </tr>`;

        const sectionRows = (items) =>
            items.map(i => {
                const monthCols = reportMonths.map(m => `<td style="padding:3px 8px;text-align:right;font-family:monospace;white-space:nowrap">${fmtAmt(i.byMonth?.[m] || 0)}</td>`).join('');
                return `
                <tr>
                    <td style="padding:3px 8px;font-family:monospace;color:#64748b;width:120px">${i.code}</td>
                    <td style="padding:3px 8px;padding-left:2rem">${i.name}</td>
                    ${monthCols}
                    <td style="padding:3px 8px;text-align:right;font-family:monospace;white-space:nowrap;font-weight:600">${fmtAmt(i.amount)}</td>
                </tr>`;
            }).join('');

        const subtotalRow = (label, val, keysMap = null, color = '#0f172a') => {
            const monthCols = reportMonths.map(m => `<td style="padding:4px 8px;text-align:right;font-family:monospace;font-weight:700;color:${color}">${fmtAmt(keysMap ? (totals.byMonth?.[m]?.[keysMap] || 0) : 0)}</td>`).join('');
            return `
            <tr style="background:#f1f5f9;border-top:1px solid #e2e8f0">
                <td></td>
                <td style="padding:4px 8px;font-weight:700;color:${color}">${label}</td>
                ${monthCols}
                <td style="padding:4px 8px;text-align:right;font-family:monospace;font-weight:700;color:${color}">${fmtAmt(val)}</td>
            </tr>`;
        };

        const divRow = (label) => `
            <tr style="background:#e2e8f0">
                <td colspan="${colCount}" style="padding:6px 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#475569">${label}</td>
            </tr>`;

        const breakRow = () => `<tr><td colspan="${colCount}" style="padding:6px 0"></td></tr>`;

        const netColor = totals.netIncome >= 0 ? '#0070BB' : '#ef4444';

        const bodyHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:11px">
            ${headerRowHTML}
            ${divRow('Revenue')}
            ${sectionRows(reportData.revenue)}
            ${subtotalRow('Total Revenue', totals.totalRevenue, 'totalRevenue', '#16a34a')}
            ${breakRow()}
            ${divRow('Cost of Goods Sold (COGS)')}
            ${sectionRows(reportData.cogs)}
            ${subtotalRow('Total COGS', totals.totalCOGS, 'totalCOGS')}
            ${breakRow()}
            <tr style="background:#dbeafe;border-top:2px solid #93c5fd">
                <td></td>
                <td style="padding:6px 8px;font-weight:800;color:#1d4ed8;font-size:12px">GROSS PROFIT</td>
                ${reportMonths.map(m => `<td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:${(totals.byMonth?.[m]?.grossProfit || 0) >= 0 ? '#16a34a' : '#ef4444'};font-size:12px">${fmtAmt(totals.byMonth?.[m]?.grossProfit || 0)}</td>`).join('')}
                <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:#1d4ed8;font-size:12px">${fmtAmt(totals.grossProfit)}</td>
            </tr>
            ${breakRow()}
            ${divRow('Operating Expenses')}
            ${sectionRows(reportData.expenses)}
            ${subtotalRow('Total Operating Expenses', totals.totalExpenses, 'totalExpenses', '#dc2626')}
            ${breakRow()}
            <tr style="background:#fef9c3;border-top:2px solid #fde047">
                <td></td>
                <td style="padding:6px 8px;font-weight:800;color:#854d0e;font-size:12px">OPERATING PROFIT</td>
                ${reportMonths.map(m => `<td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:${(totals.byMonth?.[m]?.operatingProfit || 0) >= 0 ? '#0f172a' : '#ef4444'};font-size:12px">${fmtAmt(totals.byMonth?.[m]?.operatingProfit || 0)}</td>`).join('')}
                <td style="padding:6px 8px;text-align:right;font-family:monospace;font-weight:800;color:#854d0e;font-size:12px">${fmtAmt(totals.operatingProfit)}</td>
            </tr>
            ${reportData.other_income.length > 0 || reportData.other_expense.length > 0 ? `
            ${breakRow()}
            ${divRow('Other Income')}
            ${sectionRows(reportData.other_income)}
            ${subtotalRow('Total Other Income', totals.totalOtherIncome, 'totalOtherIncome', '#16a34a')}
            ${divRow('Other Expenses')}
            ${sectionRows(reportData.other_expense)}
            ${subtotalRow('Total Other Expenses', totals.totalOtherExpense, 'totalOtherExpense', '#dc2626')}
            ` : ''}
            <tr><td colspan="${colCount}" style="padding:8px 0;border-top:3px double ${netColor}"></td></tr>
            <tr style="background:${totals.netIncome >= 0 ? '#eff6ff' : '#fef2f2'}">
                <td></td>
                <td style="padding:10px 8px;font-weight:900;font-size:14px;color:${netColor};letter-spacing:.05em">NET INCOME</td>
                ${reportMonths.map(m => `<td style="padding:10px 8px;text-align:right;font-family:monospace;font-weight:900;font-size:13px;color:${(totals.byMonth?.[m]?.netIncome || 0) >= 0 ? '#0070BB' : '#ef4444'}">${fmtAmt(totals.byMonth?.[m]?.netIncome || 0)}</td>`).join('')}
                <td style="padding:10px 8px;text-align:right;font-family:monospace;font-weight:900;font-size:14px;color:${netColor};text-decoration:underline;text-decoration-style:double">${fmtAmt(totals.netIncome)}</td>
            </tr>
        </table>`;

        printReport({
            reportName: 'Income Statement (Profit & Loss)',
            companyInfo: companySettings,
            period,
            bodyHTML,
            note: 'Click on an account in the application to view its detail in the General Ledger. Revenue increases with credit; Expenses increase with debit.',
            direction: 'landscape' // add landscape mode as there are more cols
        });
    };

    const ReportRow = ({ item, isTotal = false, indent = 0, totalsKey = null }) => (
        <div
            onClick={() => !isTotal && handleAccountClick(item.id)}
            className={`flex items-center py-1.5 px-4 border-b border-dark-border/30 text-sm hover:bg-dark-surface/50 smooth-transition ${isTotal ? 'font-bold bg-dark-surface/30 cursor-default' : 'bg-white cursor-pointer group'}`}
        >
            <div className="flex items-center gap-4 flex-1 min-w-[300px]" style={{ paddingLeft: `${indent * 1.5}rem` }}>
                {!isTotal && <span className="text-sm font-mono text-silver-dark min-w-[7rem] flex-shrink-0 group-hover:underline">{item.code || '0000'}</span>}
                <span className="text-silver-light font-medium truncate pr-4">{item.name}</span>
            </div>

            <div className="flex items-center justify-end gap-6 flex-shrink-0">
                {reportMonths.map(m => (
                    <span key={m} className={`font-mono tabular-nums text-silver-light text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'}`}>
                        {formatNumber(isTotal ? (totals.byMonth?.[m]?.[totalsKey] || 0) : (item.byMonth?.[m] || 0))}
                    </span>
                ))}
                <span className={`font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${isTotal ? 'text-accent-blue dark:text-accent-orange' : 'text-silver-light font-semibold'}`}>
                    {formatNumber(item.amount)}
                </span>
            </div>
        </div>
    );

    const SectionHeader = ({ title, total, type, isOpen, onToggle, totalsKey }) => (
        <div
            className="flex items-center py-2 px-3 bg-dark-surface/80 cursor-pointer hover:bg-dark-border/30 smooth-transition border-y border-dark-border mt-1"
            onClick={() => onToggle(type)}
        >
            <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                {isOpen ? <ChevronDown className="w-4 h-4 text-silver-dark" /> : <ChevronRight className="w-4 h-4 text-silver-muted" />}
                <h3 className="font-semibold text-sm text-silver-light uppercase tracking-wider">{title}</h3>
            </div>
            <div className="flex items-center justify-end gap-6 flex-shrink-0 pl-1 pr-1">
                {reportMonths.map(m => (
                    <span key={m} className={`font-bold text-sm text-silver-light font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'}`}>
                        {formatNumber(totals.byMonth?.[m]?.[totalsKey] || 0)}
                    </span>
                ))}
                <span className={`font-bold text-sm text-silver-light font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'}`}>{formatNumber(total)}</span>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-silver-light flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-accent-orange" />
                        Income Statement (Profit & Loss)
                    </h1>
                    <p className="text-silver-dark text-xs">Period: {period}</p>
                </div>

                <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-dark-border shadow-sm">
                    <div className="flex items-center px-2 border-r border-gray-200 dark:border-dark-border/50">
                        <Calendar className="w-3 h-3 text-gray-500 dark:text-silver-dark mr-2" />
                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Range:</span>
                        <input type="date" value={dateRange.startDate}
                            onChange={e => setDateRange({ ...dateRange, startDate: e.target.value })}
                            style={{ color: '#000000', colorScheme: 'light' }}
                            className="bg-transparent border-none text-xs focus:ring-0 p-0 w-24" />
                        <span className="text-gray-400 dark:text-silver-dark mx-1">–</span>
                        <input type="date" value={dateRange.endDate}
                            onChange={e => setDateRange({ ...dateRange, endDate: e.target.value })}
                            style={{ color: '#000000', colorScheme: 'light' }}
                            className="bg-transparent border-none text-xs focus:ring-0 p-0 w-24" />
                    </div>
                    <button onClick={fetchReportData} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-gray-600 dark:text-silver-light" title="Refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <button onClick={handleExportExcel} className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors text-green-600 dark:text-green-400" title="Export Excel (.xlsx)">
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button onClick={handleExportCSV} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors text-blue-600 dark:text-blue-400" title="Export CSV">
                            <FileText className="w-4 h-4" />
                        </button>
                        <button onClick={handleExportPDF} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors text-red-600 dark:text-red-400" title="Print PDF">
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Financial Report Container */}
            <div className="bg-white dark:bg-dark-surface/20 min-w-[800px] border border-gray-200 dark:border-dark-border rounded-lg overflow-x-auto shadow-lg dark:shadow-xl dark:backdrop-blur-sm">
                <div className="flex items-center py-2 px-4 bg-[#0070BB] dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                    <span className="text-xs font-bold text-white dark:text-silver-dark uppercase tracking-widest pl-32 flex-1 min-w-[300px]">Account / Description</span>
                    <div className="flex items-center justify-end gap-6 flex-shrink-0 pr-1">
                        {reportMonths.map(m => (
                            <span key={m} className={`text-xs font-bold text-white dark:text-silver-dark uppercase tracking-widest text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'}`}>
                                {(() => {
                                    const [y, mm] = m.split('-');
                                    const d = new Date(parseInt(y), parseInt(mm) - 1, 1);
                                    return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
                                })()}
                            </span>
                        ))}
                        <span className={`text-xs font-bold text-white dark:text-silver-dark uppercase tracking-widest text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'}`}>Total (IDR)</span>
                    </div>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="p-12 text-center text-silver-dark">Loading data...</div>
                    ) : (
                        <>
                            {/* REVENUE */}
                            <SectionHeader title="Revenue" total={totals.totalRevenue} totalsKey="totalRevenue" type="revenue" isOpen={expandedSections.revenue} onToggle={toggleSection} />
                            {expandedSections.revenue && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.revenue.length === 0
                                        ? <div className="p-4 text-center text-silver-dark text-sm">No revenue data</div>
                                        : reportData.revenue.map(item => <ReportRow key={item.id} item={item} indent={1} />)}
                                    <ReportRow item={{ name: 'Total Revenue', amount: totals.totalRevenue }} isTotal indent={1} totalsKey="totalRevenue" />
                                </div>
                            )}

                            {/* COGS */}
                            <SectionHeader title="Cost of Goods Sold (COGS)" total={totals.totalCOGS} totalsKey="totalCOGS" type="cogs" isOpen={expandedSections.cogs} onToggle={toggleSection} />
                            {expandedSections.cogs && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.cogs.length === 0
                                        ? <div className="p-4 text-center text-silver-dark text-sm">No COGS data</div>
                                        : reportData.cogs.map(item => <ReportRow key={item.id} item={item} indent={1} />)}
                                    <ReportRow item={{ name: 'Total COGS', amount: totals.totalCOGS }} isTotal indent={1} totalsKey="totalCOGS" />
                                </div>
                            )}

                            {/* GROSS PROFIT */}
                            <div className="flex items-center py-1.5 px-4 bg-gray-50 dark:bg-dark-surface/40 border-y border-gray-200 dark:border-dark-border my-0.5">
                                <span className="font-bold text-sm text-silver-light ml-4 flex-1 min-w-[300px]">GROSS PROFIT</span>
                                <div className="flex items-center justify-end gap-6 flex-shrink-0 pr-1">
                                    {reportMonths.map(m => (
                                        <span key={m} className={`font-bold text-sm font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${(totals.byMonth?.[m]?.grossProfit || 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatNumber(totals.byMonth?.[m]?.grossProfit || 0)}
                                        </span>
                                    ))}
                                    <span className={`font-bold text-sm font-mono text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${totals.grossProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatNumber(totals.grossProfit)}
                                    </span>
                                </div>
                            </div>

                            {/* EXPENSES */}
                            <SectionHeader title="Operating Expenses" total={totals.totalExpenses} totalsKey="totalExpenses" type="expenses" isOpen={expandedSections.expenses} onToggle={toggleSection} />
                            {expandedSections.expenses && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.expenses.length === 0
                                        ? <div className="p-4 text-center text-silver-dark text-sm">No operating expense data</div>
                                        : reportData.expenses.map(item => <ReportRow key={item.id} item={item} indent={1} />)}
                                    <ReportRow item={{ name: 'Total Operating Expenses', amount: totals.totalExpenses }} isTotal indent={1} totalsKey="totalExpenses" />
                                </div>
                            )}

                            {/* OPERATING PROFIT */}
                            <div className="flex items-center py-1.5 px-4 bg-gray-50 dark:bg-dark-surface/40 border-y border-gray-200 dark:border-dark-border my-0.5">
                                <span className="font-bold text-sm text-silver-light ml-4 flex-1 min-w-[300px]">OPERATING PROFIT</span>
                                <div className="flex items-center justify-end gap-6 flex-shrink-0 pr-1">
                                    {reportMonths.map(m => (
                                        <span key={m} className={`font-bold text-sm font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${(totals.byMonth?.[m]?.operatingProfit || 0) >= 0 ? 'text-silver-light' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatNumber(totals.byMonth?.[m]?.operatingProfit || 0)}
                                        </span>
                                    ))}
                                    <span className={`font-bold text-sm font-mono text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${totals.operatingProfit >= 0 ? 'text-silver-light' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatNumber(totals.operatingProfit)}
                                    </span>
                                </div>
                            </div>

                            {/* OTHER INCOME/EXPENSE */}
                            <SectionHeader title="Other Income & Expenses" total={totals.totalOtherIncome - totals.totalOtherExpense} totalsKey="totalOtherNet" type="other" isOpen={expandedSections.other} onToggle={toggleSection} />
                            {expandedSections.other && (
                                <div className="bg-white dark:bg-dark-bg/20">
                                    {reportData.other_income.length > 0 && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-silver-dark uppercase">Other Income:</div>
                                            {reportData.other_income.map(item => <ReportRow key={item.id} item={item} indent={1} />)}
                                        </>
                                    )}
                                    {reportData.other_expense.length > 0 && (
                                        <>
                                            <div className="px-4 py-1 text-xs text-silver-dark uppercase">Other Expenses:</div>
                                            {reportData.other_expense.map(item => <ReportRow key={item.id} item={{ ...item, amount: -item.amount }} indent={1} />)}
                                        </>
                                    )}
                                    <ReportRow item={{ name: 'Total Other (Net)', amount: totals.totalOtherIncome - totals.totalOtherExpense }} isTotal indent={1} totalsKey="totalOtherNet" />
                                </div>
                            )}

                            {/* NET INCOME */}
                            <div className="flex items-center py-3 px-4 bg-[#0070BB]/10 dark:bg-accent-orange/10 border-t-2 border-[#0070BB] dark:border-accent-orange mt-2">
                                <span className="font-bold text-base text-[#0070BB] dark:text-accent-orange uppercase tracking-wider flex-1 min-w-[300px]">Net Income</span>
                                <div className="flex items-center justify-end gap-6 flex-shrink-0 pr-1">
                                    {reportMonths.map(m => (
                                        <span key={m} className={`font-bold text-lg font-mono tabular-nums text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${(totals.byMonth?.[m]?.netIncome || 0) >= 0 ? 'text-[#0070BB] dark:text-accent-orange' : 'text-red-600 dark:text-red-400'}`}>
                                            {formatNumber(totals.byMonth?.[m]?.netIncome || 0)}
                                        </span>
                                    ))}
                                    <span className={`font-bold text-xl font-mono underline decoration-double underline-offset-4 text-right ${reportMonths.length > 4 ? 'w-24' : 'w-28'} ${totals.netIncome >= 0 ? 'text-[#0070BB] dark:text-accent-orange' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatNumber(totals.netIncome)}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-silver-dark mt-6 italic">
                * Click on an account to view its details in the General Ledger. Data sourced from General Journal.
            </div>
        </div>
    );
};

export default ProfitLoss;
