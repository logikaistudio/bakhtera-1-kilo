import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    DollarSign, Calendar, RefreshCw, ChevronDown, ChevronRight,
    FileSpreadsheet, Printer
} from 'lucide-react';
import { useData } from '../../context/DataContext';

const ProfitLoss = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [loading, setLoading] = useState(true);
    const [taxRate, setTaxRate] = useState(22);
    const reportMonths = ['current', 'previous', 'ytd'];
    const [reportData, setReportData] = useState({
        revenue: { groups: [], total: 0 },
        cogs: { groups: [], total: 0 },
        expenses: { groups: [], total: 0 },
        other_income: { groups: [], total: 0 },
        other_expense: { groups: [], total: 0 },
    });
    const [totals, setTotals] = useState({
        totalRevenue: 0, totalCOGS: 0, grossProfit: 0,
        totalExpenses: 0, operatingProfit: 0,
        totalOtherIncome: 0, totalOtherExpense: 0,
        otherNet: 0, netIncomeBeforeTax: 0,
        taxAmount: 0, netIncomeAfterTax: 0
    });
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedSections, setExpandedSections] = useState({
        revenue: true, cogs: true, expenses: true, other_income: true, other_expense: true
    });

    useEffect(() => { fetchReportData(); }, [selectedMonth]);

    useEffect(() => {
        if (totals.netIncomeBeforeTax !== undefined) {
            const taxAmount = totals.netIncomeBeforeTax > 0 ? totals.netIncomeBeforeTax * (taxRate / 100) : 0;
            setTotals(prev => ({ ...prev, taxAmount, netIncomeAfterTax: prev.netIncomeBeforeTax - taxAmount }));
        }
    }, [taxRate]);

    const toggleGroup = (key) =>
        setExpandedGroups(prev => ({ ...prev, [key]: prev[key] === false ? true : false }));

    const toggleSection = (s) =>
        setExpandedSections(prev => ({ ...prev, [s]: !prev[s] }));

    const getMonthName = (offset) => {
        const [y, mm] = selectedMonth.split('-');
        const date = new Date(parseInt(y, 10), parseInt(mm, 10) - 1 + offset, 1);
        return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    };

    const mLabel = (m) => {
        if (m === 'current') return getMonthName(0);
        if (m === 'previous') return getMonthName(-1);
        if (m === 'ytd') return 'YTD';
        return m;
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const { data: coaData, error: coaError } = await supabase
                .from('finance_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            const [year, month] = selectedMonth.split('-');
            const targetYear = parseInt(year, 10);
            const targetMonth = parseInt(month, 10);
            let prevYear = targetYear;
            let prevMonth = targetMonth - 1;
            if (prevMonth === 0) {
                prevMonth = 12;
                prevYear -= 1;
            }
            const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
            const queryStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`;
            const queryEnd = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(new Date(targetYear, targetMonth, 0).getDate()).padStart(2, '0')}`;

            const res = await supabase.from('blink_journal_entries')
                .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                .not('coa_id', 'is', null)
                .gte('entry_date', queryStart).lte('entry_date', queryEnd);
            if (res.error) throw res.error;
            const entries = [...new Map((res.data || []).map(r => [r.id, r])).values()];

            const coaMap = {};
            const codeToMeta = {};
            (coaData || []).forEach(coa => {
                const byMonth = { current: 0, previous: 0, ytd: 0 };
                coaMap[coa.id] = { ...coa, amount: 0, byMonth };
                if (coa.code) {
                    codeToMeta[coa.code] = coa;
                }
            });

            const toIDR = (v, cur, rate) => {
                if (!v) return 0;
                return cur && cur !== 'IDR' && rate > 1 ? v * rate : v;
            };

            const getCodePrefix = (code) => code ? code.charAt(0) : null;

            entries.forEach(e => {
                const targetId = e.coa_id; // only use explicit coa_id
                if (!targetId) return;
                const acc = coaMap[targetId];
                if (!acc) return; // skip if coa_id doesn't exist in master
                const debit = toIDR(e.debit, e.currency, e.exchange_rate);
                const credit = toIDR(e.credit, e.currency, e.exchange_rate);
                const prefix = getCodePrefix(acc.code);
                let val = 0;
                if (prefix === '4' || prefix === '7' || prefix === '8') {
                    val = (credit - debit);
                } else {
                    val = (debit - credit);
                }
                acc.amount += val;
                const mKey = e.entry_date?.substring(0, 7);
                if (!mKey) return;
                if (mKey === selectedMonth) acc.byMonth.current += val;
                if (mKey === prevMonthKey) acc.byMonth.previous += val;
                if (mKey.startsWith(`${targetYear}-`) && mKey <= selectedMonth) acc.byMonth.ytd += val;
            });

            const all = Object.values(coaMap);

            const groupByParent = (accounts) => {
                const groups = {};
                const orphans = [];
                accounts.forEach(acc => {
                    const parent = acc.parent_code;
                    if (parent) {
                        if (!groups[parent]) {
                            groups[parent] = { parentCode: parent, items: [] };
                        }
                        groups[parent].items.push(acc);
                    } else {
                        orphans.push(acc);
                    }
                });
                return { groups, orphans };
            };

            const buildGroupedData = (accounts) => {
                const { groups, orphans } = groupByParent(accounts);
                const result = [];
                orphans.forEach(acc => result.push({ item: acc, isParent: false }));
                Object.values(groups).forEach(g => {
                    const totalAmount = g.items.reduce((s, i) => s + (i.byMonth?.ytd || 0), 0);
                    const byMonthTotal = {};
                    reportMonths.forEach(m => {
                        byMonthTotal[m] = g.items.reduce((s, i) => s + (i.byMonth?.[m] || 0), 0);
                    });
                    result.push({
                        parent: {
                            code: g.parentCode,
                            name: g.items[0]?.name?.split(' - ')[0] || g.parentCode,
                            amount: totalAmount,
                            byMonth: byMonthTotal
                        },
                        items: g.items,
                        isParent: true
                    });
                });
                return result;
            };

            const revenue = all.filter(a => {
                const prefix = getCodePrefix(a.code);
                return prefix === '4' && a.amount !== 0;
            }).sort((a, b) => a.code.localeCompare(b.code));

            const cogs = all.filter(a => {
                const prefix = getCodePrefix(a.code);
                return prefix === '5' && a.amount !== 0;
            }).sort((a, b) => a.code.localeCompare(b.code));

            // Code 6 → Administrasi & General Expenses
            const expenses = all.filter(a => {
                const prefix = getCodePrefix(a.code);
                return prefix === '6' && a.amount !== 0;
            }).sort((a, b) => a.code.localeCompare(b.code));

            // Code 7 & 8 → Other Income (ALL 7xx and 8xx accounts go here)
            const other_income = all.filter(a => {
                const prefix = getCodePrefix(a.code);
                return (prefix === '7' || prefix === '8') && a.amount !== 0;
            }).sort((a, b) => a.code.localeCompare(b.code));

            // Other Expense: Only non-7/8 accounts with OTHER_EXPENSE type
            const other_expense = all.filter(a => {
                const prefix = getCodePrefix(a.code);
                if (prefix === '7' || prefix === '8') return false;
                if (prefix === '6') return false;
                return a.type === 'OTHER_EXPENSE' && a.amount !== 0;
            }).sort((a, b) => a.code.localeCompare(b.code));

            const groupedRevenue = buildGroupedData(revenue);
            const groupedCogs = buildGroupedData(cogs);
            const groupedExpenses = buildGroupedData(expenses);
            const groupedOtherIncome = buildGroupedData(other_income);
            const groupedOtherExpense = buildGroupedData(other_expense);

            const totalRevenue = revenue.reduce((s, a) => s + (a.byMonth?.ytd || 0), 0);
            const totalCOGS = cogs.reduce((s, a) => s + (a.byMonth?.ytd || 0), 0);
            const grossProfit = totalRevenue - totalCOGS;
            const totalExpenses = expenses.reduce((s, a) => s + (a.byMonth?.ytd || 0), 0);
            const operatingProfit = grossProfit - totalExpenses;
            const totalOtherIncome = other_income.reduce((s, a) => s + (a.byMonth?.ytd || 0), 0);
            const totalOtherExpense = other_expense.reduce((s, a) => s + (a.byMonth?.ytd || 0), 0);
            const otherNet = totalOtherIncome - totalOtherExpense;
            const netIncomeBeforeTax = operatingProfit + otherNet;
            const taxAmount = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * (taxRate / 100) : 0;
            const netIncomeAfterTax = netIncomeBeforeTax - taxAmount;

            setReportData({
                revenue: groupedRevenue,
                cogs: groupedCogs,
                expenses: groupedExpenses,
                other_income: groupedOtherIncome,
                other_expense: groupedOtherExpense,
            });
            setTotals({ totalRevenue, totalCOGS, grossProfit, totalExpenses, operatingProfit, totalOtherIncome, totalOtherExpense, otherNet, netIncomeBeforeTax, taxAmount, netIncomeAfterTax });
        } catch (error) {
            console.error('Error fetching P&L data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => {
        if (!amount || amount === 0) return '';
        const neg = amount < 0;
        const s = Math.abs(amount).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        return neg ? `(${s})` : s;
    };

    const [selY, selM] = selectedMonth.split('-');
    const firstDate = new Date(parseInt(selY, 10), parseInt(selM, 10) - 1, 1);
    const lastDate = new Date(parseInt(selY, 10), parseInt(selM, 10), 0);
    const formatDate = (d) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const period = `Periode: ${formatDate(firstDate)} - ${formatDate(lastDate)}`;

    // ── Export Excel ─────────────────────────────────────────────────
    const handleExportExcel = () => {
        const cs = companySettings;
        const wb = XLSX.utils.book_new();
        const rows = [];

        // KOP SURAT — dari Blink Module Settings
        rows.push([{ v: cs?.company_name || 'PT. BAKHTERA', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } } }]);
        rows.push([{ v: cs?.company_address || '', s: { alignment: { horizontal: 'center', wrapText: true } } }]);

        const contactParts = [
            cs?.company_phone ? `Telp: ${cs.company_phone}` : '',
            cs?.company_fax ? `Fax: ${cs.company_fax}` : '',
            cs?.company_email ? `Email: ${cs.company_email}` : ''
        ].filter(Boolean);
        if (contactParts.length > 0) rows.push([{ v: contactParts.join('  |  '), s: { alignment: { horizontal: 'center' } } }]);

        if (cs?.company_npwp) rows.push([{ v: `NPWP: ${cs.company_npwp}`, s: { alignment: { horizontal: 'center' } } }]);

        rows.push([{ v: '' }]);
        rows.push([{ v: 'LAPORAN LABA RUGI (PROFIT & LOSS)', s: { font: { bold: true, sz: 12, color: { rgb: 'CC0000' } }, alignment: { horizontal: 'center' } } }]);
        rows.push([{ v: `Periode: ${period}`, s: { alignment: { horizontal: 'center' } } }]);
        rows.push([{ v: '' }]);

        const headerCols = ['DESCRIPTION', ...reportMonths.map(m => mLabel(m)), 'TOTAL'];
        rows.push(headerCols.map(h => ({ v: h, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0070BB' } }, alignment: { horizontal: 'center' } } })));

        const addSection = (label) => {
            rows.push([{ v: label, s: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'E2E8F0' } } } }, ...Array(reportMonths.length + 1).fill({ v: '' })]);
        };
        const addParent = (name, code, byMonth, total) => {
            rows.push([
                { v: `  ${name} (${code})`, s: { font: { bold: true }, fill: { fgColor: { rgb: 'FEF08A' } } } },
                ...reportMonths.map(m => ({ v: byMonth?.[m] || 0, t: 'n', s: { numFmt: '#,##0', fill: { fgColor: { rgb: 'FEF08A' } } } })),
                { v: total, t: 'n', s: { numFmt: '#,##0', font: { bold: true }, fill: { fgColor: { rgb: 'FEF08A' } } } }
            ]);
        };
        const addItem = (name, byMonth, total) => {
            rows.push([
                { v: `      ${name}` },
                ...reportMonths.map(m => ({ v: byMonth?.[m] || 0, t: 'n', s: { numFmt: '#,##0' } })),
                { v: total, t: 'n', s: { numFmt: '#,##0' } }
            ]);
        };
        const addTotal = (label, byMonthFn, total, color = '1E293B') => {
            rows.push([
                { v: label, s: { font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } } },
                ...reportMonths.map(m => ({ v: byMonthFn ? byMonthFn(m) : 0, t: 'n', s: { numFmt: '#,##0', font: { bold: true }, fill: { fgColor: { rgb: 'F1F5F9' } } } })),
                { v: total, t: 'n', s: { numFmt: '#,##0', font: { bold: true, color: { rgb: color } }, fill: { fgColor: { rgb: 'F1F5F9' } } } }
            ]);
        };
        const mSum = (groups, m) => groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);

        const renderGroupsToExcel = (sectionData) => {
            sectionData.groups.forEach(group => {
                if (group.parent) addParent(group.parent.name, group.parent.code, group.parent.byMonth, group.items.reduce((s, a) => s + a.amount, 0));
                group.items.forEach(item => addItem(item.name, item.byMonth, item.amount));
            });
        };

        addSection('INCOME');
        renderGroupsToExcel(reportData.revenue);
        addTotal('TOTAL SALES INCOME', m => mSum(reportData.revenue.groups, m), totals.totalRevenue, '16A34A');
        rows.push([{ v: '' }]);

        addSection('COST OF GOOD SOLD');
        renderGroupsToExcel(reportData.cogs);
        addTotal('TOTAL COST OF GOOD SOLD', m => mSum(reportData.cogs.groups, m), totals.totalCOGS);
        rows.push([{ v: '' }]);

        addTotal('TOTAL OPERATION INCOME (GROSS PROFIT)', m => mSum(reportData.revenue.groups, m) - mSum(reportData.cogs.groups, m), totals.grossProfit, '1D4ED8');
        rows.push([{ v: '' }]);

        addSection('ADMINISTRASI & GENERAL EXPENSES');
        renderGroupsToExcel(reportData.expenses);
        addTotal('TOTAL ADMINISTRASI & GENERAL EXPENSES', m => mSum(reportData.expenses.groups, m), totals.totalExpenses, 'DC2626');
        rows.push([{ v: '' }]);

        addSection('OTHER INCOME / EXPENSES');
        if (reportData.other_income && reportData.other_income.length > 0) {
            renderGroupsToExcel(reportData.other_income);
            addTotal('TOTAL OTHER INCOME', m => mSum(reportData.other_income.groups, m), totals.totalOtherIncome, '16A34A');
        }
        if (reportData.other_expense && reportData.other_expense.length > 0) {
            renderGroupsToExcel(reportData.other_expense);
            addTotal('TOTAL OTHER EXPENSES', m => -mSum(reportData.other_expense.groups, m), -totals.totalOtherExpense, 'DC2626');
        }
        rows.push([{ v: '' }]);

        addTotal('TOTAL OTHER INCOME / EXPENSES', m => mSum(reportData.other_income.groups, m) - mSum(reportData.other_expense.groups, m), totals.otherNet);
        addTotal('TOTAL NET INCOME BEFORE TAX', null, totals.netIncomeBeforeTax, '1D4ED8');
        rows.push([
            { v: `CORPORATE INCOME TAX (${taxRate}%)`, s: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'DC2626' } } } },
            ...Array(reportMonths.length).fill({ v: '' }),
            { v: -totals.taxAmount, t: 'n', s: { numFmt: '#,##0', font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'DC2626' } } } }
        ]);
        addTotal('TOTAL NET INCOME AFTER TAX', null, totals.netIncomeAfterTax, totals.netIncomeAfterTax >= 0 ? '1D4ED8' : 'DC2626');

        const nCols = reportMonths.length + 2;
        // Count kop rows dynamically: name + address + (contact?) + (npwp?) + blank + title + period + blank
        const kopRowCount = 2 + (contactParts.length > 0 ? 1 : 0) + (cs?.company_npwp ? 1 : 0);
        const kopMergeIndices = Array.from({ length: kopRowCount }, (_, i) => i)
            .concat([kopRowCount + 1, kopRowCount + 2]); // title + period rows

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!cols'] = [{ wch: 50 }, ...reportMonths.map(() => ({ wch: 14 })), { wch: 18 }];
        ws['!merges'] = kopMergeIndices.map(r => ({ s: { r, c: 0 }, e: { r, c: nCols - 1 } }));

        XLSX.utils.book_append_sheet(wb, ws, 'Profit & Loss');
        XLSX.writeFile(wb, `ProfitLoss_${dateRange.startDate}_${dateRange.endDate}.xlsx`);
    };

    // ── Export PDF ───────────────────────────────────────────────────
    const handleExportPDF = () => {
        const cs = companySettings;
        const fmtAmt = (v) => {
            if (!v || v === 0) return '-';
            const neg = v < 0;
            const s = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
            return neg ? `<span style="color:#dc2626">(${s})</span>` : s;
        };
        const mSum = (groups, m) => groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);

        const thStyle = 'padding:4px 8px;text-align:right;font-size:10px;background:#0070BB;color:#fff;border:1px solid #0060AA;white-space:nowrap';
        const thDescStyle = 'padding:4px 8px;text-align:left;font-size:10px;background:#0070BB;color:#fff;border:1px solid #0060AA;min-width:200px';
        const monthHeaders = reportMonths.map(m => `<th style="${thStyle}">${mLabel(m)}</th>`).join('');
        const headerRow = `<tr><th style="${thDescStyle}">DESCRIPTION</th>${monthHeaders}<th style="${thStyle}">TOTAL</th></tr>`;

        const sectionRow = (label) =>
            `<tr><td colspan="${reportMonths.length + 2}" style="padding:5px 8px;font-size:10px;font-weight:800;text-transform:uppercase;background:#E2E8F0;color:#334155;letter-spacing:.06em">${label}</td></tr>`;

        const parentRow = (name, code, byMonth, total) =>
            `<tr style="background:#FEF9C3">
                <td style="padding:3px 8px 3px 24px;font-size:10px;font-weight:700;color:#713F12">${name} <span style="font-weight:400;color:#92400E">(${code})</span></td>
                ${reportMonths.map(m => `<td style="padding:3px 8px;text-align:right;font-size:10px;font-family:monospace;color:#713F12">${fmtAmt(byMonth?.[m] || 0)}</td>`).join('')}
                <td style="padding:3px 8px;text-align:right;font-size:10px;font-weight:700;font-family:monospace;color:#713F12">${fmtAmt(total)}</td>
            </tr>`;

        const itemRow = (name, byMonth, total) =>
            `<tr>
                <td style="padding:2px 8px 2px 48px;font-size:10px">${name}</td>
                ${reportMonths.map(m => `<td style="padding:2px 8px;text-align:right;font-size:10px;font-family:monospace;color:#475569">${fmtAmt(byMonth?.[m] || 0)}</td>`).join('')}
                <td style="padding:2px 8px;text-align:right;font-size:10px;font-family:monospace">${fmtAmt(total)}</td>
            </tr>`;

        const totalRow = (label, byMonthFn, total, bg = '#F1F5F9', color = '#0F172A', indent = false) =>
            `<tr style="background:${bg}">
                <td style="padding:4px 8px ${indent ? '4px 32px' : ''};font-size:10px;font-weight:700;color:${color}">${label}</td>
                ${reportMonths.map(m => `<td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700;font-family:monospace;color:${color}">${byMonthFn ? fmtAmt(byMonthFn(m)) : '-'}</td>`).join('')}
                <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700;font-family:monospace;color:${color}">${fmtAmt(total)}</td>
            </tr>`;

        const renderGroupsHTML = (sectionData) =>
            sectionData.groups.map(group => [
                group.parent ? parentRow(group.parent.name, group.parent.code, group.parent.byMonth, group.items.reduce((s, a) => s + a.amount, 0)) : '',
                ...group.items.map(item => itemRow(item.name, item.byMonth, item.amount))
            ].join('')).join('');

        const tableHTML = `
        <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif">
            ${headerRow}
            ${sectionRow('INCOME')}
            ${renderGroupsHTML(reportData.revenue)}
            ${totalRow('TOTAL SALES INCOME', m => mSum(reportData.revenue.groups, m), totals.totalRevenue, '#DCFCE7', '#15803D')}
            ${sectionRow('COST OF GOOD SOLD')}
            ${renderGroupsHTML(reportData.cogs)}
            ${totalRow('TOTAL COST OF GOOD SOLD', m => mSum(reportData.cogs.groups, m), totals.totalCOGS)}
            ${totalRow('TOTAL OPERATION INCOME (GROSS PROFIT)', m => mSum(reportData.revenue.groups, m) - mSum(reportData.cogs.groups, m), totals.grossProfit, '#DBEAFE', '#1D4ED8')}
            ${sectionRow('ADMINISTRASI & GENERAL EXPENSES')}
            ${renderGroupsHTML(reportData.expenses)}
            ${totalRow('TOTAL ADMINISTRASI & GENERAL EXPENSES', m => mSum(reportData.expenses.groups, m), totals.totalExpenses, '#FEE2E2', '#DC2626')}
            ${sectionRow('OTHER INCOME / EXPENSES')}
            ${reportData.other_income && reportData.other_income.length > 0 ? renderGroupsHTML(reportData.other_income) + totalRow('TOTAL OTHER INCOME', m => mSum(reportData.other_income.groups, m), totals.totalOtherIncome, '#DCFCE7', '#15803D', true) : ''}
            ${reportData.other_expense && reportData.other_expense.length > 0 ? renderGroupsHTML(reportData.other_expense) + totalRow('TOTAL OTHER EXPENSES', m => -mSum(reportData.other_expense.groups, m), -totals.totalOtherExpense, '#FEE2E2', '#DC2626', true) : ''}
            <tr><td colspan="${reportMonths.length + 2}" style="padding:4px 0;border-top:2px solid #94A3B8"></td></tr>
            ${totalRow('TOTAL OTHER INCOME / EXPENSES', m => mSum(reportData.other_income.groups, m) - mSum(reportData.other_expense.groups, m), totals.otherNet)}
            ${totalRow('TOTAL NET INCOME BEFORE TAX', null, totals.netIncomeBeforeTax, '#EFF6FF', '#1D4ED8')}
            <tr style="background:#FEE2E2">
                <td style="padding:4px 8px;font-size:10px;font-weight:700;color:#DC2626">CORPORATE INCOME TAX (${taxRate}%)</td>
                ${reportMonths.map(() => '<td></td>').join('')}
                <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700;font-family:monospace;color:#DC2626">${fmtAmt(-totals.taxAmount)}</td>
            </tr>
            ${totalRow('TOTAL NET INCOME AFTER TAX', null, totals.netIncomeAfterTax, totals.netIncomeAfterTax >= 0 ? '#DBEAFE' : '#FEE2E2', totals.netIncomeAfterTax >= 0 ? '#1D4ED8' : '#DC2626')}
        </table>`;

        const kopHTML = `
            <div style="display:flex;align-items:flex-start;gap:16px;margin-bottom:10px;padding-bottom:10px;border-bottom:3px double #0070BB">
                ${cs?.logo_url ? `<img src="${cs.logo_url}" alt="Logo" style="height:70px;object-fit:contain;flex-shrink:0" />` : ''}
                <div style="text-align:left">
                    <div style="font-size:17px;font-weight:900;color:#0070BB;letter-spacing:.04em;line-height:1.2">${cs?.company_name || 'PT. BAKHTERA'}</div>
                    ${cs?.company_address ? `<div style="font-size:10px;color:#475569;margin-top:2px">${cs.company_address.replace(/\n/g, ', ')}</div>` : ''}
                    <div style="font-size:10px;color:#475569;margin-top:1px">
                        ${[cs?.company_phone ? `Telp: ${cs.company_phone}` : '', cs?.company_fax ? `Fax: ${cs.company_fax}` : '', cs?.company_email ? `Email: ${cs.company_email}` : ''].filter(Boolean).join('  &nbsp;&bull;&nbsp;  ')}
                    </div>
                    ${cs?.company_npwp ? `<div style="font-size:10px;color:#64748B;margin-top:1px">NPWP: ${cs.company_npwp}</div>` : ''}
                </div>
                <div style="margin-left:auto;text-align:right;flex-shrink:0">
                    <div style="font-size:14px;font-weight:800;color:#DC2626;letter-spacing:.08em">PROFIT &amp; LOSS</div>
                    <div style="font-size:10px;color:#64748B;margin-top:2px">Periode:</div>
                    <div style="font-size:10px;color:#334155;font-weight:600">${period}</div>
                </div>
            </div>`;

        const win = window.open('', '_blank');
        if (!win) { alert('Popup diblokir. Izinkan popup untuk halaman ini lalu coba lagi.'); return; }
        win.document.write(`<!DOCTYPE html><html><head><title>Profit &amp; Loss - ${period}</title>
            <style>
                @page { size: landscape; margin: 12mm; }
                body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
                table { page-break-inside: auto; }
                tr { page-break-inside: avoid; }
            </style>
            </head><body>${kopHTML}${tableHTML}</body></html>`);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 600);
    };

    // ── Render Helpers ────────────────────────────────────────────────

    const SectionLabel = ({ label }) => (
        <div className="px-4 py-2 bg-slate-100 dark:bg-dark-surface/70 border-b border-t border-slate-200 dark:border-dark-border mt-2">
            <span className="text-xs font-extrabold text-slate-800 dark:text-silver-light uppercase tracking-widest">{label}</span>
        </div>
    );

    const colW = 'w-[120px] min-w-[120px]';
    const totalW = 'w-[120px] min-w-[120px]';

    const ItemRow = ({ item }) => (
        <div
            onClick={() => navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: item.id } })}
            className="flex items-center border-b border-gray-100 dark:border-dark-border/20 hover:bg-gray-50 dark:hover:bg-dark-surface/40 cursor-pointer group"
        >
            <div className={`w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center`}>
                <span className="text-[11px] text-slate-600 dark:text-silver-dark font-mono whitespace-nowrap">{item.code}</span>
            </div>
            <div className="text-[12px] text-slate-700 dark:text-silver-light group-hover:underline flex-1 min-w-[300px] px-2 py-2 whitespace-nowrap" title={item.name}>
                {item.name}
            </div>
            <div className="flex items-center flex-shrink-0 pr-2">
                {reportMonths.map(m => (
                    <div key={m} className={`flex items-center justify-end text-[11px] font-mono text-slate-500 dark:text-silver-dark ${colW} px-1`} title={fmt(item.byMonth?.[m] || 0)}>
                        {fmt(item.byMonth?.[m] || 0)}
                    </div>
                ))}
                <div className={`flex items-center justify-end text-[12px] font-mono text-slate-800 dark:text-silver-light ${totalW} px-1`} title={fmt(item.amount)}>{fmt(item.amount)}</div>
            </div>
        </div>
    );

    const renderSection = (groupedData, sectionKey) => {
        if (!groupedData || groupedData.length === 0) return <div className="px-6 py-2 text-[11px] text-silver-dark italic">No data</div>;
        
        return groupedData.map((group, idx) => {
            if (group.isParent) {
                return (
                    <div key={`parent-${group.parent.code}`}>
                        <div className="flex items-center bg-slate-50 dark:bg-transparent border-b border-slate-200 dark:border-dark-border/30">
                            <div className="w-[140px] flex-shrink-0 pl-4 pr-2 py-2 flex items-center">
                                <span className="text-[11px] text-slate-600 dark:text-silver-dark font-bold font-mono whitespace-nowrap">{group.parent.code}</span>
                            </div>
                            <div className="text-[12px] text-slate-700 dark:text-silver-light font-bold flex-1 min-w-[300px] px-2 py-2 whitespace-nowrap" title={group.parent.name}>
                                {group.parent.name}
                            </div>
                            <div className="flex items-center flex-shrink-0 pr-2">
                                {reportMonths.map(m => (
                                    <div key={m} className={`flex items-center justify-end text-[11px] font-mono text-slate-600 dark:text-silver-dark font-bold ${colW} px-1`} title={fmt(group.parent.byMonth?.[m] || 0)}>
                                        {fmt(group.parent.byMonth?.[m] || 0)}
                                    </div>
                                ))}
                                <div className={`flex items-center justify-end text-[12px] font-mono text-slate-700 dark:text-silver-light font-bold ${totalW} px-1`} title={fmt(group.parent.amount)}>{fmt(group.parent.amount)}</div>
                            </div>
                        </div>
                        {group.items.map(item => <ItemRow key={item.id} item={item} />)}
                    </div>
                );
            }
            return <ItemRow key={group.item.id} item={group.item} />;
        });
    };

    const TotalRow = ({ label, amount, byMonthFn, highlight, thick, indent }) => {
        const colors = {
            green: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-800 dark:text-green-500',
            blue: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-500',
            red: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400',
        };
        const cls = highlight ? colors[highlight] : 'bg-slate-50 dark:bg-transparent border-slate-200 dark:border-dark-border/30 text-slate-800 dark:text-silver-light';
        return (
            <div className={`flex items-center border-y ${cls} ${thick ? 'border-t-2' : ''}`}>
                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                <div className={`text-[12px] font-bold uppercase flex-1 min-w-[300px] px-2 py-2 whitespace-nowrap ${indent ? 'pl-6' : ''}`} title={label}>{label}</div>
                <div className="flex items-center flex-shrink-0 pr-2">
                    {reportMonths.map(m => (
                        <div key={m} className={`flex items-center justify-end text-[11px] font-bold font-mono ${colW} px-1 py-2 ${highlight ? '' : 'text-slate-600 dark:text-silver-dark'}`} title={fmt(byMonthFn ? byMonthFn(m) : 0)}>
                            {byMonthFn ? fmt(byMonthFn(m)) : ''}
                        </div>
                    ))}
                    <div className={`flex items-center justify-end text-[12px] font-bold font-mono ${totalW} px-1 py-2 ${highlight ? '' : 'text-slate-800 dark:text-silver-light'}`} title={fmt(amount)}>{fmt(amount)}</div>
                </div>
            </div>
        );
    };

    // ── Main Render ────────────────────────────────────────────────────
    return (
        <div className="w-full px-4 xl:px-8 mx-auto pb-20">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-silver-light flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-accent-orange" />
                        Profit & Loss
                    </h1>
                    <p className="text-slate-500 dark:text-silver-dark text-xs">Period: {period}</p>
                </div>
                <div className="flex items-center gap-2 bg-white dark:bg-dark-surface p-1 rounded-lg border border-gray-200 dark:border-dark-border shadow-sm">
                    <div className="flex items-center px-2 border-r border-gray-200 dark:border-dark-border/50">
                        <Calendar className="w-3 h-3 text-gray-500 dark:text-silver-dark mr-2" />
                        <span className="text-xs text-gray-500 dark:text-silver-dark mr-2">Periode:</span>
                        <input type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            className="bg-transparent border-none text-xs text-slate-800 dark:text-white focus:ring-0 p-0 w-32" />
                    </div>
                    <button onClick={fetchReportData} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors" title="Refresh">
                        <RefreshCw className={`w-4 h-4 text-slate-600 dark:text-silver-light ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {/* Tax Rate */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <span className="text-xs text-slate-500 dark:text-silver-dark">Tax:</span>
                        <input
                            type="number" value={taxRate}
                            onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                            className="w-10 text-xs bg-transparent border border-gray-300 dark:border-dark-border rounded px-1 py-0.5 text-slate-800 dark:text-silver-light text-center focus:outline-none focus:border-accent-blue"
                            min="0" max="100" step="0.5"
                        />
                        <span className="text-xs text-slate-500 dark:text-silver-dark">%</span>
                    </div>
                    {/* Export buttons */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <button onClick={handleExportExcel}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-slate-600 dark:text-silver-light"
                            title="Export Excel (dengan kop surat)">
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button onClick={handleExportPDF}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors text-slate-600 dark:text-silver-light"
                            title="Export PDF / Cetak">
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Card */}
            <div className="bg-white dark:bg-dark-surface/20 border border-gray-200 dark:border-dark-border rounded-lg shadow-lg overflow-hidden">
                <div className="w-full overflow-x-auto">
                    <div className="w-max min-w-full">
                        {/* Title */}
                        <div className="text-center py-4 border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface/40">
                            <h2 className="text-base font-extrabold text-slate-800 dark:text-silver-light tracking-widest uppercase">Profit & Loss</h2>
                            <p className="text-xs text-slate-500 dark:text-silver-dark mt-1">{period}</p>
                        </div>

                        <div className="flex items-center bg-slate-100 dark:bg-dark-surface/70 border-b border-slate-200 dark:border-dark-border">
                            <div className="text-[11px] font-bold uppercase tracking-wider w-[140px] flex-shrink-0 pl-4 pr-2 py-2.5 text-slate-800 dark:text-silver-light">Code</div>
                            <div className="text-[11px] font-bold uppercase tracking-wider flex-1 min-w-[300px] px-2 py-2.5 text-slate-800 dark:text-silver-light">Description</div>
                            <div className="flex items-center flex-shrink-0 pr-2">
                                {reportMonths.map(m => (
                                    <div key={m} className={`flex items-center justify-end text-[11px] font-bold uppercase ${colW} px-1 py-2.5 text-slate-800 dark:text-silver-light`}>
                                        {mLabel(m)}
                                    </div>
                                ))}
                                <div className={`flex items-center justify-end text-[11px] font-bold uppercase ${totalW} px-1 py-2.5 text-slate-800 dark:text-silver-light`}>Total</div>
                            </div>
                        </div>

                {loading ? (
                    <div className="p-12 text-center text-slate-500 dark:text-silver-dark">Loading data...</div>
                ) : (
                    <>
                        {/* ── INCOME ── */}
                        <SectionLabel label="INCOME" />
                        {renderSection(reportData.revenue, 'revenue')}
                        <TotalRow label="Total Sales Income" amount={totals.totalRevenue} highlight="green"
                            byMonthFn={m => reportData.revenue.reduce((s, g) => {
                                if (g.isParent) return s + (g.parent?.byMonth?.[m] || 0);
                                return s + (g.item?.byMonth?.[m] || 0);
                            }, 0)} />

                        {/* ── COST OF GOOD SOLD ── */}
                        <SectionLabel label="Cost of Good Sold" />
                        {renderSection(reportData.cogs, 'cogs')}
                        <TotalRow label="Total Cost of Good Sold" amount={totals.totalCOGS}
                            byMonthFn={m => reportData.cogs.reduce((s, g) => {
                                if (g.isParent) return s + (g.parent?.byMonth?.[m] || 0);
                                return s + (g.item?.byMonth?.[m] || 0);
                            }, 0)} />

                        {/* ── GROSS PROFIT ── */}
                        <TotalRow label="Total Operation Income ( Gross Profit )"
                            amount={totals.grossProfit}
                            byMonthFn={m => {
                                const mRev = reportData.revenue.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0);
                                const mCogs = reportData.cogs.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0);
                                return mRev - mCogs;
                            }}
                            highlight={totals.grossProfit >= 0 ? 'blue' : 'red'} thick />

                        {/* ── ADMINISTRASI & GENERAL EXPENSES ── */}
                        <SectionLabel label="Administrasi & General Expenses" />
                        {renderSection(reportData.expenses, 'expenses')}
                        <TotalRow label="Total Administrasi & General Expenses" amount={totals.totalExpenses}
                            byMonthFn={m => reportData.expenses.reduce((s, g) => {
                                if (g.isParent) return s + (g.parent?.byMonth?.[m] || 0);
                                return s + (g.item?.byMonth?.[m] || 0);
                            }, 0)} />

                        {/* ── OTHER INCOME / EXPENSES ── */}
                        <SectionLabel label="Other Income / Expenses" />
                        {reportData.other_income && reportData.other_income.length > 0 && (
                            <>
                                {renderSection(reportData.other_income, 'other_income')}
                                <TotalRow label="Total Other Income" amount={totals.totalOtherIncome} indent
                                    byMonthFn={m => reportData.other_income.reduce((s, g) => {
                                if (g.isParent) return s + (g.parent?.byMonth?.[m] || 0);
                                return s + (g.item?.byMonth?.[m] || 0);
                            }, 0)} />
                            </>
                        )}
                        {reportData.other_expense && reportData.other_expense.length > 0 && (
                            <>
                                {renderSection(reportData.other_expense, 'other_expense')}
                                <TotalRow label="Total Other Expenses" amount={-totals.totalOtherExpense} indent
                                    byMonthFn={m => -reportData.other_expense.reduce((s, g) => {
                                if (g.isParent) return s + (g.parent?.byMonth?.[m] || 0);
                                return s + (g.item?.byMonth?.[m] || 0);
                            }, 0)} />
                            </>
                        )}

                        {/* ── Summary ── */}
                        <div className="border-t-2 border-slate-300 dark:border-dark-border mt-1">
                            <TotalRow label="Total Other Income / Expenses" amount={totals.otherNet} byMonthFn={m => {
                                const mOI = reportData.other_income.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0);
                                const mOE = reportData.other_expense.reduce((s, a) => s + (a.byMonth?.[m] || 0), 0);
                                return mOI - mOE;
                            }} />
                            <TotalRow label="Total Income" amount={totals.operatingProfit + totals.otherNet} highlight="blue" />
                            <TotalRow label="Total Net Income Before Tax" amount={totals.netIncomeBeforeTax} />

                            {/* Corporate Income Tax */}
                            <div className="flex items-center bg-red-50 dark:bg-red-500/10 border-y border-red-200 dark:border-red-500/30">
                                <div className="w-[140px] flex-shrink-0 px-2 py-2"></div>
                                <span className="text-[12px] font-bold text-red-600 dark:text-red-400 uppercase flex-1 min-w-0 px-2 py-2" title={`Corporate Income Tax (${taxRate}%)`}>
                                    Corporate Income Tax ({taxRate}%)
                                </span>
                                <div className="flex items-center flex-shrink-0 pr-2">
                                    {reportMonths.map(m => (
                                        <span key={m} className={`text-[11px] font-bold font-mono text-right ${colW} px-1 py-2`}></span>
                                    ))}
                                    <span className={`text-[12px] font-bold font-mono text-red-600 dark:text-red-400 text-right ${totalW} px-1 py-2`} title={fmt(-totals.taxAmount)}>
                                        {fmt(-totals.taxAmount)}
                                    </span>
                                </div>
                            </div>

                            <TotalRow label="Total Net Income After Tax" amount={totals.netIncomeAfterTax}
                                highlight={totals.netIncomeAfterTax >= 0 ? 'blue' : 'red'} thick />
                        </div>
                    </>
                )}
                    </div>
                </div>
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-silver-dark mt-6 italic">
                * Klik pada akun untuk melihat detail di General Ledger.
            </div>
        </div>
    );
};

export default ProfitLoss;
