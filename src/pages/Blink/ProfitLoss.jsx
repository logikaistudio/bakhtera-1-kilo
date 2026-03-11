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
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(true);
    const [taxRate, setTaxRate] = useState(22);
    const [reportMonths, setReportMonths] = useState([]);
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

    useEffect(() => { fetchReportData(); }, [dateRange]);

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

    const mLabel = (m) => {
        const [y, mm] = m.split('-');
        return new Date(parseInt(y), parseInt(mm) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    };

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const { data: coaData, error: coaError } = await supabase
                .from('finance_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            // Build month list (max 12)
            const d1 = new Date(dateRange.startDate + 'T00:00:00');
            const d2 = new Date(dateRange.endDate + 'T00:00:00');
            const monthsList = [];
            let cd = new Date(d1.getFullYear(), d1.getMonth(), 1);
            const ed = new Date(d2.getFullYear(), d2.getMonth(), 1);
            while (cd <= ed && monthsList.length < 12) {
                monthsList.push(`${cd.getFullYear()}-${String(cd.getMonth() + 1).padStart(2, '0')}`);
                cd.setMonth(cd.getMonth() + 1);
            }

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

            const coaMap = {};
            const accCodeMap = {};
            const codeToMeta = {};
            (coaData || []).forEach(coa => {
                const byMonth = {};
                monthsList.forEach(m => byMonth[m] = 0);
                coaMap[coa.id] = { ...coa, amount: 0, byMonth };
                if (coa.code) {
                    accCodeMap[coa.code] = coa.id;
                    codeToMeta[coa.code] = coa;
                }
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
                else if (['EXPENSE', 'COGS', 'COST', 'DIRECT_COST', 'OTHER_EXPENSE'].includes(acc.type)) val = (debit - credit);
                acc.amount += val;
                const mKey = e.entry_date?.substring(0, 7);
                if (mKey && acc.byMonth && acc.byMonth[mKey] !== undefined) acc.byMonth[mKey] += val;
            });

            const buildGroups = (accounts) => {
                const groups = {};
                const ungrouped = [];
                accounts.forEach(acc => {
                    const parentMeta = acc.parent_code ? codeToMeta[acc.parent_code] : null;
                    if (parentMeta) {
                        if (!groups[acc.parent_code]) {
                            const parentByMonth = {};
                            monthsList.forEach(m => parentByMonth[m] = 0);
                            groups[acc.parent_code] = { parent: { ...parentMeta, groupAmount: 0, byMonth: parentByMonth }, items: [] };
                        }
                        groups[acc.parent_code].items.push(acc);
                        groups[acc.parent_code].parent.groupAmount += acc.amount;
                        monthsList.forEach(m => { groups[acc.parent_code].parent.byMonth[m] += (acc.byMonth?.[m] || 0); });
                    } else {
                        ungrouped.push(acc);
                    }
                });
                const sorted = Object.values(groups).sort((a, b) => a.parent.code.localeCompare(b.parent.code));
                return [...sorted, ...ungrouped.map(acc => ({ parent: null, items: [acc] }))];
            };

            const all = Object.values(coaMap);
            const revenue = all.filter(a => a.type === 'REVENUE' && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
            const cogs = all.filter(a => ['COGS', 'COST', 'DIRECT_COST'].includes(a.type) && a.amount !== 0).sort((a, b) => a.code.localeCompare(b.code));
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
            const otherNet = totalOtherIncome - totalOtherExpense;
            const netIncomeBeforeTax = operatingProfit + otherNet;
            const taxAmount = netIncomeBeforeTax > 0 ? netIncomeBeforeTax * (taxRate / 100) : 0;
            const netIncomeAfterTax = netIncomeBeforeTax - taxAmount;

            setReportMonths(monthsList);
            setReportData({
                revenue: { groups: buildGroups(revenue), total: totalRevenue },
                cogs: { groups: buildGroups(cogs), total: totalCOGS },
                expenses: { groups: buildGroups(expenses), total: totalExpenses },
                other_income: { groups: buildGroups(other_income), total: totalOtherIncome },
                other_expense: { groups: buildGroups(other_expense), total: totalOtherExpense },
            });
            setTotals({ totalRevenue, totalCOGS, grossProfit, totalExpenses, operatingProfit, totalOtherIncome, totalOtherExpense, otherNet, netIncomeBeforeTax, taxAmount, netIncomeAfterTax });
        } catch (error) {
            console.error('Error fetching P&L data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmt = (amount) => {
        if (amount === 0) return '-';
        const neg = amount < 0;
        const s = Math.abs(amount).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return neg ? `(${s})` : s;
    };

    const period = `${new Date(dateRange.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} – ${new Date(dateRange.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

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
        if (reportData.other_income.groups.length > 0) {
            renderGroupsToExcel(reportData.other_income);
            addTotal('TOTAL OTHER INCOME', m => mSum(reportData.other_income.groups, m), totals.totalOtherIncome, '16A34A');
        }
        if (reportData.other_expense.groups.length > 0) {
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
            ${reportData.other_income.groups.length > 0 ? renderGroupsHTML(reportData.other_income) + totalRow('TOTAL OTHER INCOME', m => mSum(reportData.other_income.groups, m), totals.totalOtherIncome, '#DCFCE7', '#15803D', true) : ''}
            ${reportData.other_expense.groups.length > 0 ? renderGroupsHTML(reportData.other_expense) + totalRow('TOTAL OTHER EXPENSES', m => -mSum(reportData.other_expense.groups, m), -totals.totalOtherExpense, '#FEE2E2', '#DC2626', true) : ''}
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
        <div className="px-4 py-1.5 bg-dark-surface/70 border-b border-t border-dark-border mt-2">
            <span className="text-[11px] font-extrabold text-silver-light uppercase tracking-widest">{label}</span>
        </div>
    );

    const colW = reportMonths.length > 6 ? 'min-w-[80px]' : 'min-w-[110px]';

    const ParentRow = ({ group, sectionKey, index }) => {
        const key = `${sectionKey}-${group.parent?.code || index}`;
        const isOpen = expandedGroups[key] !== false;
        const total = group.items.reduce((s, a) => s + a.amount, 0);
        return (
            <div
                className="flex items-center bg-yellow-300/20 dark:bg-yellow-500/10 border-b border-yellow-400/30 cursor-pointer hover:bg-yellow-300/30 transition-colors"
                onClick={() => toggleGroup(key)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0 px-4 py-1">
                    {isOpen
                        ? <ChevronDown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                        : <ChevronRight className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                    <span className="text-[11px] font-bold text-yellow-700 dark:text-yellow-300 uppercase truncate">
                        {group.parent.name}
                        <span className="ml-2 font-mono font-normal text-yellow-600/70 dark:text-yellow-400/60 normal-case">
                            ( {group.parent.code} )
                        </span>
                    </span>
                </div>
                <div className="flex items-center flex-shrink-0 pr-2">
                    {reportMonths.map(m => (
                        <span key={m} className={`text-[10px] font-mono text-yellow-600 dark:text-yellow-400 text-right ${colW} px-1`}>
                            {fmt(group.parent.byMonth?.[m] || 0)}
                        </span>
                    ))}
                    <span className={`text-[11px] font-bold font-mono text-yellow-700 dark:text-yellow-300 text-right ${colW} px-1`}>
                        {fmt(total)}
                    </span>
                </div>
            </div>
        );
    };

    const ItemRow = ({ item, indent }) => (
        <div
            onClick={() => navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: item.id } })}
            className="flex items-center border-b border-dark-border/20 hover:bg-dark-surface/40 cursor-pointer group"
        >
            <span className="text-[11px] text-silver-light group-hover:underline truncate flex-1 min-w-0 group-hover:underline"
                style={{ paddingLeft: indent ? '3.5rem' : '1.5rem', paddingRight: '0.5rem', paddingTop: '2px', paddingBottom: '2px' }}>
                {item.name}
            </span>
            <div className="flex items-center flex-shrink-0 pr-2">
                {reportMonths.map(m => (
                    <span key={m} className={`text-[10px] font-mono text-silver-dark text-right ${colW} px-1`}>
                        {fmt(item.byMonth?.[m] || 0)}
                    </span>
                ))}
                <span className={`text-[11px] font-mono text-silver-light text-right ${colW} px-1`}>{fmt(item.amount)}</span>
            </div>
        </div>
    );

    const renderSection = (sectionData, sectionKey) => {
        const { groups } = sectionData;
        if (groups.length === 0) return <div className="px-6 py-2 text-[11px] text-silver-dark italic">No data</div>;
        return groups.map((group, gi) => {
            const key = `${sectionKey}-${group.parent?.code || gi}`;
            const isOpen = expandedGroups[key] !== false;
            return (
                <div key={key}>
                    {group.parent
                        ? <ParentRow group={group} sectionKey={sectionKey} index={gi} />
                        : null}
                    {(group.parent ? isOpen : true) && group.items.map(item => (
                        <ItemRow key={item.id} item={item} indent={!!group.parent} />
                    ))}
                </div>
            );
        });
    };

    const TotalRow = ({ label, amount, byMonthFn, highlight, thick, indent }) => {
        const colors = {
            green: 'bg-green-500/10 border-green-500/30 text-green-400',
            blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
            red: 'bg-red-500/10 border-red-500/30 text-red-400',
        };
        const cls = highlight ? colors[highlight] : 'border-dark-border/30 text-silver-light';
        const valCls = highlight ? '' : (amount < 0 ? 'text-red-400' : '');
        return (
            <div className={`flex items-center border-y ${cls} ${thick ? 'border-t-2' : ''}`}>
                <span className={`text-[11px] font-bold uppercase flex-1 min-w-0 px-4 py-1.5 ${indent ? 'pl-8' : ''}`}>{label}</span>
                <div className="flex items-center flex-shrink-0 pr-2">
                    {reportMonths.map(m => (
                        <span key={m} className={`text-[10px] font-bold font-mono text-right ${colW} px-1 py-1.5`}>
                            {byMonthFn ? fmt(byMonthFn(m)) : '-'}
                        </span>
                    ))}
                    <span className={`text-[11px] font-bold font-mono text-right ${colW} px-1 py-1.5 ${valCls}`}>{fmt(amount)}</span>
                </div>
            </div>
        );
    };

    // ── Main Render ────────────────────────────────────────────────────
    return (
        <div className="max-w-3xl mx-auto pb-20">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-silver-light flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-accent-orange" />
                        Profit & Loss
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
                    <button onClick={fetchReportData} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors" title="Refresh">
                        <RefreshCw className={`w-4 h-4 text-silver-light ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {/* Tax Rate */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <span className="text-xs text-silver-dark">Tax:</span>
                        <input
                            type="number" value={taxRate}
                            onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                            className="w-10 text-xs bg-transparent border border-dark-border rounded px-1 py-0.5 text-silver-light text-center focus:outline-none focus:border-accent-blue"
                            min="0" max="100" step="0.5"
                        />
                        <span className="text-xs text-silver-dark">%</span>
                    </div>
                    {/* Export buttons */}
                    <div className="flex items-center gap-1 border-l border-gray-200 dark:border-dark-border/50 pl-2 ml-1">
                        <button onClick={handleExportExcel}
                            className="p-1.5 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors text-green-600 dark:text-green-400"
                            title="Export Excel (dengan kop surat)">
                            <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button onClick={handleExportPDF}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors text-red-500 dark:text-red-400"
                            title="Export PDF / Cetak">
                            <Printer className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Report Card */}
            <div className="bg-white dark:bg-dark-surface/20 border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden shadow-lg">
                {/* Title */}
                <div className="text-center py-4 border-b border-dark-border bg-white dark:bg-dark-surface/40">
                    <h2 className="text-base font-extrabold text-red-500 tracking-widest uppercase">Profit & Loss</h2>
                    <p className="text-xs text-silver-dark mt-1">{period}</p>
                </div>

                {/* Column header — putih di atas biru agar terlihat jelas */}
                <div className="flex items-center" style={{ background: '#0070BB' }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider flex-1 px-4 py-2" style={{ color: '#FFFFFF' }}>Description</span>
                    <div className="flex items-center flex-shrink-0 pr-2">
                        {reportMonths.map(m => (
                            <span key={m} className={`text-[10px] font-bold uppercase text-right ${colW} px-1 py-2`} style={{ color: '#FFFFFF' }}>
                                {mLabel(m)}
                            </span>
                        ))}
                        <span className={`text-[11px] font-bold uppercase text-right ${colW} px-1 py-2`} style={{ color: '#FFFFFF' }}>Total</span>
                    </div>
                </div>

                {loading ? (
                    <div className="p-12 text-center text-silver-dark">Loading data...</div>
                ) : (
                    <>
                        {/* ── INCOME ── */}
                        <SectionLabel label="INCOME" />
                        {renderSection(reportData.revenue, 'revenue')}
                        <TotalRow label="Total Sales Income" amount={totals.totalRevenue} highlight="green"
                            byMonthFn={m => reportData.revenue.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── COST OF GOOD SOLD ── */}
                        <SectionLabel label="Cost of Good Sold" />
                        {renderSection(reportData.cogs, 'cogs')}
                        <TotalRow label="Total Cost of Good Sold" amount={totals.totalCOGS}
                            byMonthFn={m => reportData.cogs.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── GROSS PROFIT ── */}
                        <TotalRow label="Total Operation Income ( Gross Profit )"
                            amount={totals.grossProfit}
                            byMonthFn={m => {
                                const mRev = reportData.revenue.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                const mCogs = reportData.cogs.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                return mRev - mCogs;
                            }}
                            highlight={totals.grossProfit >= 0 ? 'blue' : 'red'} thick />

                        {/* ── ADMINISTRASI & GENERAL EXPENSES ── */}
                        <SectionLabel label="Administrasi & General Expenses" />
                        {renderSection(reportData.expenses, 'expenses')}
                        <TotalRow label="Total Administrasi & General Expenses" amount={totals.totalExpenses}
                            byMonthFn={m => reportData.expenses.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />

                        {/* ── OTHER INCOME / EXPENSES ── */}
                        <SectionLabel label="Other Income / Expenses" />
                        {reportData.other_income.groups.length > 0 && (
                            <>
                                {renderSection(reportData.other_income, 'other_income')}
                                <TotalRow label="Total Other Income" amount={totals.totalOtherIncome} indent
                                    byMonthFn={m => reportData.other_income.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />
                            </>
                        )}
                        {reportData.other_expense.groups.length > 0 && (
                            <>
                                {renderSection(reportData.other_expense, 'other_expense')}
                                <TotalRow label="Total Other Expenses" amount={-totals.totalOtherExpense} indent
                                    byMonthFn={m => -reportData.other_expense.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0)} />
                            </>
                        )}

                        {/* ── Summary ── */}
                        <div className="border-t-2 border-dark-border mt-1">
                            <TotalRow label="Total Other Income / Expenses" amount={totals.otherNet} byMonthFn={m => {
                                const mOI = reportData.other_income.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                const mOE = reportData.other_expense.groups.reduce((s, g) => s + g.items.reduce((ss, a) => ss + (a.byMonth?.[m] || 0), 0), 0);
                                return mOI - mOE;
                            }} />
                            <TotalRow label="Total Income" amount={totals.operatingProfit + totals.otherNet} highlight="blue" />
                            <TotalRow label="Total Net Income Before Tax" amount={totals.netIncomeBeforeTax} />

                            {/* Corporate Income Tax */}
                            <div className="flex items-center justify-between px-4 py-1.5 bg-red-500/10 border-y border-red-500/30">
                                <span className="text-[11px] font-bold text-red-400 uppercase">
                                    Corporate Income Tax ({taxRate}%)
                                </span>
                                <span className="text-[11px] font-bold font-mono text-red-400 text-right min-w-[140px]">
                                    {fmt(-totals.taxAmount)}
                                </span>
                            </div>

                            <TotalRow label="Total Net Income After Tax" amount={totals.netIncomeAfterTax}
                                highlight={totals.netIncomeAfterTax >= 0 ? 'blue' : 'red'} thick />
                        </div>
                    </>
                )}
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-silver-dark mt-6 italic">
                * Klik pada akun untuk melihat detail di General Ledger.
            </div>
        </div>
    );
};

export default ProfitLoss;
