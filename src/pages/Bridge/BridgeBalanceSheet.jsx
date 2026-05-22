import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import {
    Scale, Calendar,
    RefreshCw, FileSpreadsheet, Printer
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import Button from '../../components/Common/Button';
import { printReport } from '../../utils/printPDF';
import { useData } from '../../context/DataContext';

// ── COA Group Definitions ────────────────────────────────────────────────────
const ASSET_GROUPS = [
    { prefix: '1-01', label: 'CURRENT ASSETS', totalLabel: 'TOTAL CURRENT ASSETS' },
    { prefix: '1-02', label: 'FIXED ASSETS', totalLabel: 'TOTAL FIXED ASSETS' },
    { prefix: '1-03', label: 'OTHER ASSETS', totalLabel: 'TOTAL OTHER ASSETS' },
];
const LIABILITY_GROUPS = [
    { prefix: '2-01', label: 'CURRENT PAYABLE', totalLabel: 'TOTAL CURRENT PAYABLE' },
    { prefix: '2-02', label: 'LONG TERM PAYABLE', totalLabel: 'TOTAL LONG TERM PAYABLE' },
];
const EQUITY_GROUPS = [
    { prefix: '3-01', label: 'STOCKHOLDERS', totalLabel: 'TOTAL STOCKHOLDERS' },
    { prefix: '3-02', label: 'PROFIT / LOSS', totalLabel: 'TOTAL PROFIT / LOSS' },
];

function groupAccounts(accounts, groupDefs) {
    const grouped = groupDefs.map(g => ({
        ...g,
        items: accounts.filter(a => a.code && a.code.startsWith(g.prefix) && !a.isHeader),
        total: 0
    }));
    // Uncategorised bucket
    const categorised = new Set(grouped.flatMap(g => g.items.map(i => i.id)));
    const uncategorised = accounts.filter(a => !categorised.has(a.id) && !a.isHeader);
    if (uncategorised.length > 0) {
        grouped.push({ prefix: '_other', label: 'OTHER', totalLabel: 'TOTAL OTHER', items: uncategorised, total: 0 });
    }
    grouped.forEach(g => { g.total = g.items.reduce((s, a) => s + a.balance, 0); });
    return grouped;
}

const BridgeBalanceSheet = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [totals, setTotals] = useState({ totalAssets: 0, totalLiabilities: 0, totalEquity: 0 });
    const [tableMode, setTableMode] = useState('stafel'); // 'stafel' | 'scontro'
    const [printOrientation, setPrintOrientation] = useState('auto'); // 'auto' | 'portrait' | 'landscape'
    const [printPageSize, setPrintPageSize] = useState('A4'); // 'A4' | 'Letter' | 'Legal'

    useEffect(() => { fetchBalanceSheet(); }, [asOfDate]);

    const fetchBalanceSheet = async () => {
        try {
            setLoading(true);

            const { data: accounts, error: coaError } = await supabase
                .from('bridge_coa').select('*').order('code', { ascending: true });
            if (coaError) throw coaError;

            const [r1, r2] = await Promise.all([
                supabase.from('bridge_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .not('coa_id', 'is', null).lte('entry_date', asOfDate),
                supabase.from('bridge_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null).lte('entry_date', asOfDate)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...(r1.data || []), ...(r2.data || [])];
            const entries = [...new Map(combined.map(r => [r.id, r])).values()];

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
            // Filter: only leaf-level accounts with balance, exclude header rows (level <=2 with xxx-000 pattern)
            const isHeader = (a) => a.level <= 2 || /^\d-\d{2}-000/.test(a.code) || /^\d-00-000/.test(a.code);
            const assets = all.filter(a => a.type === 'ASSET' && a.balance !== 0 && !isHeader(a)).sort((a, b) => a.code.localeCompare(b.code));
            const liabilities = all.filter(a => a.type === 'LIABILITY' && a.balance !== 0 && !isHeader(a)).sort((a, b) => a.code.localeCompare(b.code));
            const equity = all.filter(a => a.type === 'EQUITY' && a.balance !== 0 && !isHeader(a)).sort((a, b) => a.code.localeCompare(b.code));

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
                    id: 'net-income', code: '3-02-900-0-1-00',
                    name: 'LABA / RUGI PERIODE BERJALAN',
                    balance: netIncome, type: 'EQUITY', isCalculated: true
                });
            }

            const finalTotalEquity = totalAssets - totalLiabilities;
            const historicalBalancing = finalTotalEquity - (baseTotalEquity + netIncome);

            if (Math.abs(historicalBalancing) > 0.5) {
                equity.push({
                    id: 'historical-balancing', code: '3-02-800-0-1-00',
                    name: 'HISTORICAL BALANCING',
                    balance: historicalBalancing, type: 'EQUITY', isCalculated: true
                });
            }

            const assetGroups = groupAccounts(assets, ASSET_GROUPS);
            const liabilityGroups = groupAccounts(liabilities, LIABILITY_GROUPS);
            const equityGroups = groupAccounts(equity, EQUITY_GROUPS);

            setReportData({ assetGroups, liabilityGroups, equityGroups, assets, liabilities, equity });
            setTotals({ totalAssets, totalLiabilities, totalEquity: finalTotalEquity });
        } catch (error) {
            console.error('Error fetching balance sheet:', error);
        } finally {
            setLoading(false);
        }
    };

    const fmtCur = (val) => {
        if (val === null || val === undefined) return '-';
        const neg = val < 0;
        const s = `Rp. ${Math.abs(val).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        return neg ? `Rp.(${Math.abs(val).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : s;
    };

    const asOfLabel = new Date(asOfDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });

    const handleAccountClick = (accountId) => {
        if (accountId === 'net-income' || accountId === 'historical-balancing') return;
        navigate('/blink/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    // ── Export Excel ────────────────────────────────────────────────────────────
    const exportToExcel = () => {
        if (!reportData) return;
        const data = [];
        data.push({ 'Account': 'BALANCE SHEET', 'Amount': `Per ${asOfLabel}` });
        data.push({ 'Account': '', 'Amount': '' });

        const addGroup = (mainLabel, groups, grandTotal, grandLabel) => {
            data.push({ 'Account': mainLabel, 'Amount': '' });
            data.push({ 'Account': '', 'Amount': '' });
            groups.forEach(g => {
                if (g.items.length === 0) return;
                data.push({ 'Account': `  ${g.label}`, 'Amount': '' });
                g.items.forEach(a => data.push({ 'Account': `      ${a.name}`, 'Amount': fmtCur(a.balance) }));
                data.push({ 'Account': '', 'Amount': '' });
                data.push({ 'Account': `            ${g.totalLabel}`, 'Amount': fmtCur(g.total) });
                data.push({ 'Account': '', 'Amount': '' });
            });
            data.push({ 'Account': '', 'Amount': '' });
            data.push({ 'Account': `            ${grandLabel}`, 'Amount': fmtCur(grandTotal) });
            data.push({ 'Account': '', 'Amount': '' });
        };

        addGroup('ASSETS', reportData.assetGroups, totals.totalAssets, 'TOTAL ASSETS');
        addGroup('LIABILITIES', reportData.liabilityGroups, totals.totalLiabilities, 'TOTAL LIABILITIES');
        addGroup('EQUITY', reportData.equityGroups, totals.totalEquity, 'TOTAL EQUITY');
        data.push({ 'Account': '', 'Amount': '' });
        data.push({ 'Account': '            TOTAL LIABILITIES DAN EQUITY', 'Amount': fmtCur(totals.totalLiabilities + totals.totalEquity) });

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 55 }, { wch: 25 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Balance Sheet');
        XLSX.writeFile(wb, `BalanceSheet_${asOfDate}.xlsx`);
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        if (!reportData) return;
        const fmtAmt = (v) => {
            if (v === null || v === undefined) return '';
            const neg = v < 0;
            const s = `Rp. ${Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            return neg ? `Rp.(${Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : s;
        };

        const doubleUnderline = `border-top:1px solid #000;border-bottom:3px double #000;`;

        const toPrintRows = (label, groups, totalLabel, totalValue) => {
            const rows = [{ kind: 'section', label, value: '' }];
            groups.forEach((g) => {
                if (!g.items.length) return;
                rows.push({ kind: 'group', label: g.label, value: '' });
                g.items.forEach((acc) => rows.push({ kind: 'item', label: acc.name, value: fmtAmt(acc.balance) }));
                rows.push({ kind: 'subtotal', label: g.totalLabel, value: fmtAmt(g.total) });
                rows.push({ kind: 'space', label: '', value: '' });
            });
            rows.push({ kind: 'grand', label: totalLabel, value: fmtAmt(totalValue) });
            return rows;
        };

        const buildAlignedSectionRows = ({
            leftSectionLabel,
            leftGroups,
            leftTotalLabel,
            leftTotalValue,
            rightSectionLabel,
            rightGroups,
            rightTotalLabel,
            rightTotalValue,
            fmtValue
        }) => {
            const leftRows = [{ kind: 'section', label: leftSectionLabel, value: '' }];
            const rightRows = [{ kind: 'section', label: rightSectionLabel, value: '' }];

            const maxGroups = Math.max(leftGroups.length, rightGroups.length);
            for (let gIdx = 0; gIdx < maxGroups; gIdx += 1) {
                const leftGroup = leftGroups[gIdx];
                const rightGroup = rightGroups[gIdx];

                const hasLeft = leftGroup && leftGroup.items && leftGroup.items.length;
                const hasRight = rightGroup && rightGroup.items && rightGroup.items.length;
                if (!hasLeft && !hasRight) continue;

                leftRows.push(hasLeft ? { kind: 'group', label: leftGroup.label, value: '' } : { kind: 'space', label: '', value: '' });
                rightRows.push(hasRight ? { kind: 'group', label: rightGroup.label, value: '' } : { kind: 'space', label: '', value: '' });

                const leftItems = hasLeft ? leftGroup.items : [];
                const rightItems = hasRight ? rightGroup.items : [];
                const maxItems = Math.max(leftItems.length, rightItems.length);

                for (let i = 0; i < maxItems; i += 1) {
                    const li = leftItems[i];
                    const ri = rightItems[i];

                    leftRows.push(li ? { kind: 'item', label: li.name, value: fmtValue(li.balance), accId: li.id, isCalculated: li.isCalculated } : { kind: 'space', label: '', value: '' });
                    rightRows.push(ri ? { kind: 'item', label: ri.name, value: fmtValue(ri.balance), accId: ri.id, isCalculated: ri.isCalculated } : { kind: 'space', label: '', value: '' });
                }

                leftRows.push(hasLeft ? { kind: 'subtotal', label: leftGroup.totalLabel, value: fmtValue(leftGroup.total) } : { kind: 'space', label: '', value: '' });
                rightRows.push(hasRight ? { kind: 'subtotal', label: rightGroup.totalLabel, value: fmtValue(rightGroup.total) } : { kind: 'space', label: '', value: '' });

                leftRows.push({ kind: 'space', label: '', value: '' });
                rightRows.push({ kind: 'space', label: '', value: '' });
            }

            leftRows.push({ kind: 'grand', label: leftTotalLabel, value: fmtValue(leftTotalValue) });
            rightRows.push({ kind: 'grand', label: rightTotalLabel, value: fmtValue(rightTotalValue) });

            return { leftRows, rightRows };
        };

        const renderGroup = (groups) => groups.map(g => {
            if (g.items.length === 0) return '';
            return `
                <tr><td colspan="2" style="padding:8px 0 2px 32px;font-weight:700;font-size:12px">${g.label}</td></tr>
                ${g.items.map(i => `
                    <tr>
                        <td style="padding:1px 0 1px 64px;font-size:11px">${i.name}${i.isCalculated ? ' <em style="font-size:9px;color:#888">(calc)</em>' : ''}</td>
                        <td style="text-align:right;padding:1px 8px;font-size:11px;white-space:nowrap">${fmtAmt(i.balance)}</td>
                    </tr>
                `).join('')}
                <tr><td></td><td style="padding:4px 0"></td></tr>
                <tr>
                    <td style="text-align:right;padding:2px 16px 2px 0;font-weight:800;font-size:11px">${g.totalLabel}</td>
                    <td style="text-align:right;padding:2px 8px;font-weight:800;font-size:12px;${doubleUnderline}">${fmtAmt(g.total)}</td>
                </tr>
                <tr><td colspan="2" style="padding:6px 0"></td></tr>
            `;
        }).join('');

        const stafelBodyHTML = `
        <table style="width:100%;border-collapse:collapse;font-family:'Times New Roman',Times,serif;border:2px solid #334155">
            <!-- ASSETS -->
            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">ASSETS</td></tr>
            ${renderGroup(reportData.assetGroups)}
            <tr>
                <td style="text-align:right;padding:8px 16px 4px 0;font-weight:900;font-size:13px">TOTAL ASSETS</td>
                <td style="text-align:right;padding:8px 8px 4px;font-weight:900;font-size:13px;${doubleUnderline}">${fmtAmt(totals.totalAssets)}</td>
            </tr>
            <tr><td colspan="2" style="padding:16px 0;border-bottom:2px solid #334155"></td></tr>

            <!-- LIABILITIES -->
            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">LIABILITIES</td></tr>
            ${renderGroup(reportData.liabilityGroups)}
            <tr><td colspan="2" style="padding:8px 0"></td></tr>

            <!-- EQUITY -->
            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">EQUITY</td></tr>
            ${renderGroup(reportData.equityGroups)}
            <tr><td colspan="2" style="padding:8px 0"></td></tr>

            <tr>
                <td style="text-align:right;padding:8px 16px 4px 0;font-weight:900;font-size:13px">TOTAL LIABILITIES DAN EQUITY</td>
                <td style="text-align:right;padding:8px 8px 4px;font-weight:900;font-size:13px;${doubleUnderline}">${fmtAmt(totals.totalLiabilities + totals.totalEquity)}</td>
            </tr>
            <tr><td colspan="2" style="padding:8px 0"></td></tr>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:32px;font-size:11px;font-family:'Times New Roman',Times,serif">
            <div style="text-align:center;min-width:180px"><div>Approved By,</div><div style="margin-top:48px;border-top:1px solid #000;padding-top:4px">________________</div></div>
            <div style="text-align:center;min-width:180px"><div>Created By,</div><div style="margin-top:48px;border-top:1px solid #000;padding-top:4px">________________</div></div>
        </div>`;

        const alignedPrint = buildAlignedSectionRows({
            leftSectionLabel: 'ASSETS',
            leftGroups: reportData.assetGroups,
            leftTotalLabel: 'TOTAL ASSETS',
            leftTotalValue: totals.totalAssets,
            rightSectionLabel: 'LIABILITIES',
            rightGroups: reportData.liabilityGroups,
            rightTotalLabel: 'TOTAL LIABILITIES',
            rightTotalValue: totals.totalLiabilities,
            fmtValue: fmtAmt
        });

        const printEquityRows = toPrintRows('EQUITY', reportData.equityGroups, 'TOTAL EQUITY', totals.totalEquity);
        const printRightTail = [
            { kind: 'space', label: '', value: '' },
            ...printEquityRows,
            { kind: 'grand', label: 'TOTAL LIABILITIES DAN EQUITY', value: fmtAmt(totals.totalLiabilities + totals.totalEquity) }
        ];

        const scontroLeftRows = [
            ...alignedPrint.leftRows,
            ...Array.from({ length: printRightTail.length }, () => ({ kind: 'space', label: '', value: '' }))
        ];

        const scontroRightRows = [
            ...alignedPrint.rightRows,
            ...printRightTail
        ];
        const maxRows = Math.max(scontroLeftRows.length, scontroRightRows.length);

        const renderPrintCell = (row) => {
            if (!row || row.kind === 'space') return `<td colspan="2" style="padding:4px 6px"></td>`;
            if (row.kind === 'section') return `<td colspan="2" style="padding:6px 8px;font-weight:800;font-size:12px;border-bottom:1px solid #ddd">${row.label}</td>`;
            if (row.kind === 'group') return `<td colspan="2" style="padding:5px 8px;font-weight:700;font-size:11px;background:#f5f5f5">${row.label}</td>`;
            if (row.kind === 'subtotal') {
                return `
                    <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700">${row.label}</td>
                    <td style="padding:4px 8px;text-align:right;font-size:10px;font-weight:700;white-space:nowrap">${row.value}</td>
                `;
            }
            if (row.kind === 'grand') {
                return `
                    <td style="padding:6px 8px;text-align:right;font-size:11px;font-weight:800">${row.label}</td>
                    <td style="padding:6px 8px;text-align:right;font-size:11px;font-weight:800;white-space:nowrap">${row.value}</td>
                `;
            }
            return `
                <td style="padding:3px 8px;text-align:right;font-size:10px;font-weight:700">${row.label}</td>
                <td style="padding:3px 8px;text-align:right;font-size:10px;white-space:nowrap">${row.value}</td>
            `;
        };

        const scontroBodyHTML = `
        <table style="width:100%;border-collapse:collapse;font-family:'Times New Roman',Times,serif;border:2px solid #334155">
            <colgroup>
                <col style="width:auto" />
                <col style="width:170px" />
                <col style="width:12px" />
                <col style="width:auto" />
                <col style="width:170px" />
            </colgroup>
            <thead>
                <tr>
                    <th colspan="2" style="background:#0f6fb8;color:#fff;padding:8px 10px;text-align:left;font-size:11px;letter-spacing:0.7px">ASSETS</th>
                    <th style="width:12px;padding:0;background:transparent"></th>
                    <th colspan="2" style="background:#0f6fb8;color:#fff;padding:8px 10px;text-align:left;font-size:11px;letter-spacing:0.7px">LIABILITIES & EQUITY</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from({ length: maxRows }).map((_, idx) => {
                    const left = scontroLeftRows[idx];
                    const right = scontroRightRows[idx];
                    return `
                        <tr style="border-bottom:1px solid #e2e8f0;vertical-align:top">
                            ${renderPrintCell(left)}
                            <td style="width:12px;padding:0;background:transparent"></td>
                            ${renderPrintCell(right)}
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div style="display:flex;justify-content:space-between;margin-top:32px;font-size:11px;font-family:'Times New Roman',Times,serif">
            <div style="text-align:center;min-width:180px"><div>Approved By,</div><div style="margin-top:48px;border-top:1px solid #000;padding-top:4px">________________</div></div>
            <div style="text-align:center;min-width:180px"><div>Created By,</div><div style="margin-top:48px;border-top:1px solid #000;padding-top:4px">________________</div></div>
        </div>`;

        printReport({
            reportName: 'BALANCE SHEET',
            companyInfo: companySettings,
            period: `Per ${asOfLabel} (${tableMode === 'scontro' ? 'Scontro' : 'Stafel'})`,
            bodyHTML: tableMode === 'scontro' ? scontroBodyHTML : stafelBodyHTML,
            note: '',
            orientation: printOrientation,
            pageSize: printPageSize
        });
    };

    // ── Sub-Components ──────────────────────────────────────────────────────────
    const DoubleUnderline = () => (
        <div className="flex flex-col gap-[2px] mt-1 ml-auto" style={{ width: '140px' }}>
            <div className="border-t border-silver-light/60" />
            <div className="border-t-2 border-silver-light/60" />
        </div>
    );

    const AccountRow = ({ acc }) => (
        <div
            onClick={() => handleAccountClick(acc.id)}
            className={`flex justify-between items-center py-[3px] pl-16 pr-4 text-sm hover:bg-dark-surface/50 smooth-transition ${acc.isCalculated ? 'cursor-default italic text-silver-dark' : 'cursor-pointer group'}`}
        >
            <span className={`text-silver-light ${acc.isCalculated ? 'text-silver-dark italic' : 'group-hover:text-accent-orange'}`}>{acc.name}</span>
            <span className="font-mono text-silver-light text-xs min-w-[160px] text-right">{fmtCur(acc.balance)}</span>
        </div>
    );

    const SubGroupHeader = ({ label }) => (
        <div className="py-2 pl-8 pr-4">
            <span className="text-sm font-bold text-silver-light tracking-wide">{label}</span>
        </div>
    );

    const SubTotal = ({ label, value }) => (
        <div className="flex justify-end items-center py-1 pr-4 mt-1">
            <span className="text-sm font-bold text-silver-light mr-6 tracking-wide">{label}</span>
            <div className="min-w-[160px] text-right">
                <span className="font-mono text-sm font-bold text-silver-light">{fmtCur(value)}</span>
                <DoubleUnderline />
            </div>
        </div>
    );

    const GrandTotal = ({ label, value }) => (
        <div className="flex justify-end items-center py-3 pr-4 mt-2">
            <span className="text-base font-extrabold text-white mr-6 tracking-wide">{label}</span>
            <div className="min-w-[160px] text-right">
                <span className="font-mono text-base font-extrabold text-white">{fmtCur(value)}</span>
                <div className="flex flex-col gap-[2px] mt-1 ml-auto" style={{ width: '160px' }}>
                    <div className="border-t border-white/60" />
                    <div className="border-t-2 border-white/60" />
                </div>
            </div>
        </div>
    );

    const SectionHeader = ({ label }) => (
        <div className="py-3 pl-4 pr-4 border-b border-dark-border/40">
            <span className="text-lg font-extrabold text-white tracking-wider">{label}</span>
        </div>
    );

    const renderGroupedSection = (groups) => (
        groups.map((g, i) => {
            if (g.items.length === 0) return null;
            return (
                <div key={i} className="mb-2">
                    <SubGroupHeader label={g.label} />
                    {g.items.map(acc => <AccountRow key={acc.id} acc={acc} />)}
                    <div className="h-2" />
                    <SubTotal label={g.totalLabel} value={g.total} />
                    <div className="h-4" />
                </div>
            );
        })
    );

    const renderSectionBlock = (label, groups, totalLabel, totalValue) => (
        <>
            <SectionHeader label={label} />
            {renderGroupedSection(groups)}
            <GrandTotal label={totalLabel} value={totalValue} />
        </>
    );

    const toScontroRows = (label, groups, totalLabel, totalValue) => {
        const rows = [{ kind: 'section', label, value: '' }];
        groups.forEach((g) => {
            if (!g.items.length) return;
            rows.push({ kind: 'group', label: g.label, value: '' });
            g.items.forEach((acc) => {
                rows.push({ kind: 'item', label: acc.name, value: fmtCur(acc.balance), accId: acc.id, isCalculated: acc.isCalculated });
            });
            rows.push({ kind: 'subtotal', label: g.totalLabel, value: fmtCur(g.total) });
            rows.push({ kind: 'space', label: '', value: '' });
        });
        rows.push({ kind: 'grand', label: totalLabel, value: fmtCur(totalValue) });
        return rows;
    };

    const buildAlignedSectionRows = ({
        leftSectionLabel,
        leftGroups,
        leftTotalLabel,
        leftTotalValue,
        rightSectionLabel,
        rightGroups,
        rightTotalLabel,
        rightTotalValue,
        fmtValue
    }) => {
        const leftRows = [{ kind: 'section', label: leftSectionLabel, value: '' }];
        const rightRows = [{ kind: 'section', label: rightSectionLabel, value: '' }];

        const maxGroups = Math.max(leftGroups.length, rightGroups.length);
        for (let gIdx = 0; gIdx < maxGroups; gIdx += 1) {
            const leftGroup = leftGroups[gIdx];
            const rightGroup = rightGroups[gIdx];

            const hasLeft = leftGroup && leftGroup.items && leftGroup.items.length;
            const hasRight = rightGroup && rightGroup.items && rightGroup.items.length;
            if (!hasLeft && !hasRight) continue;

            leftRows.push(hasLeft ? { kind: 'group', label: leftGroup.label, value: '' } : { kind: 'space', label: '', value: '' });
            rightRows.push(hasRight ? { kind: 'group', label: rightGroup.label, value: '' } : { kind: 'space', label: '', value: '' });

            const leftItems = hasLeft ? leftGroup.items : [];
            const rightItems = hasRight ? rightGroup.items : [];
            const maxItems = Math.max(leftItems.length, rightItems.length);

            for (let i = 0; i < maxItems; i += 1) {
                const li = leftItems[i];
                const ri = rightItems[i];

                leftRows.push(li ? { kind: 'item', label: li.name, value: fmtValue(li.balance), accId: li.id, isCalculated: li.isCalculated } : { kind: 'space', label: '', value: '' });
                rightRows.push(ri ? { kind: 'item', label: ri.name, value: fmtValue(ri.balance), accId: ri.id, isCalculated: ri.isCalculated } : { kind: 'space', label: '', value: '' });
            }

            leftRows.push(hasLeft ? { kind: 'subtotal', label: leftGroup.totalLabel, value: fmtValue(leftGroup.total) } : { kind: 'space', label: '', value: '' });
            rightRows.push(hasRight ? { kind: 'subtotal', label: rightGroup.totalLabel, value: fmtValue(rightGroup.total) } : { kind: 'space', label: '', value: '' });

            leftRows.push({ kind: 'space', label: '', value: '' });
            rightRows.push({ kind: 'space', label: '', value: '' });
        }

        leftRows.push({ kind: 'grand', label: leftTotalLabel, value: fmtValue(leftTotalValue) });
        rightRows.push({ kind: 'grand', label: rightTotalLabel, value: fmtValue(rightTotalValue) });

        return { leftRows, rightRows };
    };

    const alignedScreen = buildAlignedSectionRows({
        leftSectionLabel: 'ASSETS',
        leftGroups: reportData?.assetGroups || [],
        leftTotalLabel: 'TOTAL ASSETS',
        leftTotalValue: totals.totalAssets,
        rightSectionLabel: 'LIABILITIES',
        rightGroups: reportData?.liabilityGroups || [],
        rightTotalLabel: 'TOTAL LIABILITIES',
        rightTotalValue: totals.totalLiabilities,
        fmtValue: fmtCur
    });

    const equityRows = toScontroRows('EQUITY', reportData?.equityGroups || [], 'TOTAL EQUITY', totals.totalEquity);
    const rightTailRows = [
        { kind: 'space', label: '', value: '' },
        ...equityRows,
        {
            kind: 'grand',
            label: 'TOTAL LIABILITIES DAN EQUITY',
            value: fmtCur(totals.totalLiabilities + totals.totalEquity)
        }
    ];

    const assetScontroRows = [
        ...alignedScreen.leftRows,
        ...Array.from({ length: rightTailRows.length }, () => ({ kind: 'space', label: '', value: '' }))
    ];

    const rightScontroRows = [
        ...alignedScreen.rightRows,
        ...rightTailRows
    ];

    const scontroMaxRows = Math.max(assetScontroRows.length, rightScontroRows.length);

    const renderScontroCell = (row) => {
        if (!row) return <td className="px-4 py-2" colSpan={2} />;
        if (row.kind === 'space') return <td className="px-4 py-2" colSpan={2} />;

        if (row.kind === 'section') {
            return (
                <td colSpan={2} className="px-4 py-2.5 border-b border-dark-border/40 bg-dark-surface/20">
                    <span className="text-sm font-extrabold text-white tracking-wider">{row.label}</span>
                </td>
            );
        }

        if (row.kind === 'group') {
            return (
                <td colSpan={2} className="px-6 py-2.5 bg-dark-surface/10">
                    <span className="text-xs font-extrabold text-white tracking-wide">{row.label}</span>
                </td>
            );
        }

        if (row.kind === 'subtotal') {
            return (
                <>
                    <td className="px-6 py-2.5 text-right text-xs font-bold text-silver-light">{row.label}</td>
                    <td className="scontro-amount-cell px-4 py-2.5 text-right text-xs font-bold text-silver-light font-mono whitespace-nowrap">{row.value}</td>
                </>
            );
        }

        if (row.kind === 'grand') {
            return (
                <>
                    <td className="px-6 py-3 text-right text-sm font-extrabold text-accent-orange">{row.label}</td>
                    <td className="scontro-amount-cell px-4 py-3 text-right text-sm font-extrabold text-accent-orange font-mono whitespace-nowrap">{row.value}</td>
                </>
            );
        }

        return (
            <>
                <td
                    className={`px-8 py-2 text-xs text-right ${row.isCalculated ? 'italic text-silver-dark cursor-default font-semibold' : 'text-silver-light cursor-pointer hover:text-accent-orange font-bold'}`}
                    onClick={() => {
                        if (!row.accId || row.isCalculated) return;
                        handleAccountClick(row.accId);
                    }}
                >
                    {row.label}
                </td>
                <td className="scontro-amount-cell px-4 py-1.5 text-right text-xs text-silver-light font-mono whitespace-nowrap">{row.value}</td>
            </>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Scale className="w-8 h-8" />
                        Balance Sheet
                    </h1>
                    <p className="text-silver-dark mt-1">Financial Position — Per {asOfLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchBalanceSheet}>Refresh</Button>
                    <button onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-green-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs">
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <select
                        value={printOrientation}
                        onChange={(e) => setPrintOrientation(e.target.value)}
                        className="px-2 py-2 bg-dark-surface border border-dark-border rounded-lg text-xs text-silver-light hover:bg-dark-card smooth-transition"
                        title="Orientasi cetak"
                    >
                        <option value="auto">Auto</option>
                        <option value="portrait">Portrait</option>
                        <option value="landscape">Landscape</option>
                    </select>
                    <select
                        value={printPageSize}
                        onChange={(e) => setPrintPageSize(e.target.value)}
                        className="px-2 py-2 bg-dark-surface border border-dark-border rounded-lg text-xs text-silver-light hover:bg-dark-card smooth-transition"
                        title="Ukuran kertas"
                    >
                        <option value="A4">A4</option>
                        <option value="Letter">Letter</option>
                        <option value="Legal">Legal</option>
                    </select>
                    <button onClick={handleExportPDF}
                        className="flex items-center gap-2 px-3 py-2 bg-dark-surface text-red-400 hover:bg-dark-card smooth-transition rounded-lg border border-dark-border text-xs">
                        <Printer className="w-4 h-4" /> Print PDF
                    </button>
                </div>
            </div>

            {/* Date Selection */}
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

                {/* Summary Cards */}
                <div className="flex gap-3">
                    <div className="glass-card p-3 rounded-lg border-l-4 border-green-500 min-w-[180px]">
                        <p className="text-[10px] text-silver-dark uppercase">Total Assets</p>
                        <p className="text-lg font-bold text-green-400 font-mono">{fmtCur(totals.totalAssets)}</p>
                    </div>
                    <div className="glass-card p-3 rounded-lg border-l-4 border-red-500 min-w-[180px]">
                        <p className="text-[10px] text-silver-dark uppercase">Total Liabilities</p>
                        <p className="text-lg font-bold text-red-400 font-mono">{fmtCur(totals.totalLiabilities)}</p>
                    </div>
                    <div className="glass-card p-3 rounded-lg border-l-4 border-blue-500 min-w-[180px]">
                        <p className="text-[10px] text-silver-dark uppercase">Total Equity</p>
                        <p className="text-lg font-bold text-blue-400 font-mono">{fmtCur(totals.totalEquity)}</p>
                    </div>
                </div>
            </div>

            {/* Table Mode Toggle */}
            <div className="glass-card p-3 rounded-lg flex items-center gap-3">
                <span className="text-xs text-silver-dark uppercase tracking-wide">Table Mode</span>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setTableMode('scontro')}
                        className={`px-3 py-1.5 rounded text-xs border smooth-transition ${
                            tableMode === 'scontro'
                                ? 'bg-accent-orange text-white border-accent-orange'
                                : 'bg-dark-surface text-silver-light border-dark-border hover:bg-dark-card'
                        }`}
                    >
                        Scontro
                    </button>
                    <button
                        onClick={() => setTableMode('stafel')}
                        className={`px-3 py-1.5 rounded text-xs border smooth-transition ${
                            tableMode === 'stafel'
                                ? 'bg-accent-orange text-white border-accent-orange'
                                : 'bg-dark-surface text-silver-light border-dark-border hover:bg-dark-card'
                        }`}
                    >
                        Stafel
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 rounded-lg text-center text-silver-dark">Loading balance sheet...</div>
            ) : reportData ? (
                tableMode === 'stafel' ? (
                    <div className="glass-card rounded-lg overflow-hidden border border-dark-border/50">
                        {/* ── ASSETS ── */}
                        {renderSectionBlock('ASSETS', reportData.assetGroups, 'TOTAL ASSETS', totals.totalAssets)}
                        <div className="border-t-2 border-dark-border/40 mx-4" />

                        {/* ── LIABILITIES ── */}
                        <div className="mt-4" />
                        {renderSectionBlock('LIABILITIES', reportData.liabilityGroups, 'TOTAL LIABILITIES', totals.totalLiabilities)}
                        <div className="border-t-2 border-dark-border/40 mx-4" />

                        {/* ── EQUITY ── */}
                        <div className="mt-4" />
                        <SectionHeader label="EQUITY" />
                        {renderGroupedSection(reportData.equityGroups)}

                        {/* Net Income line */}
                        <div className="flex justify-between items-center py-[3px] pl-8 pr-4 text-sm mt-2">
                            <span className="text-silver-dark italic">LABA / RUGI Per {asOfLabel}</span>
                            <span className="font-mono text-silver-light text-xs min-w-[160px] text-right italic">{fmtCur(
                                (() => {
                                    const niAcc = reportData.equity.find(a => a.id === 'net-income');
                                    return niAcc ? niAcc.balance : 0;
                                })()
                            )}</span>
                        </div>
                        <div className="h-4" />

                        <GrandTotal label="TOTAL EQUITY" value={totals.totalEquity} />
                        <div className="border-t-2 border-dark-border/40 mx-4" />

                        {/* ── TOTAL LIABILITIES + EQUITY ── */}
                        <div className="py-4 pr-4 mt-2 mb-2 flex justify-end items-center bg-dark-surface/30">
                            <span className="text-base font-extrabold text-accent-orange mr-6 tracking-wide">TOTAL LIABILITIES DAN EQUITY</span>
                            <div className="min-w-[160px] text-right">
                                <span className="font-mono text-base font-extrabold text-accent-orange">{fmtCur(totals.totalLiabilities + totals.totalEquity)}</span>
                                <div className="flex flex-col gap-[2px] mt-1 ml-auto" style={{ width: '160px' }}>
                                    <div className="border-t border-accent-orange/60" />
                                    <div className="border-t-2 border-accent-orange/60" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card rounded-lg overflow-hidden border border-dark-border/50">
                        <div className="px-4 py-2 text-[11px] text-silver-dark border-b border-dark-border/40">
                            Mode Scontro: sisi kiri ASSETS dan sisi kanan LIABILITIES + EQUITY ditampilkan berdampingan.
                        </div>
                        <div className="overflow-x-auto">
                            <table className="balance-sheet-scontro-table w-full min-w-[1200px] text-sm table-auto">
                                <colgroup>
                                    <col style={{ width: 'auto' }} />
                                    <col style={{ width: '220px' }} />
                                    <col style={{ width: '12px' }} />
                                    <col style={{ width: 'auto' }} />
                                    <col style={{ width: '220px' }} />
                                </colgroup>
                                <thead>
                                    <tr className="border-b border-dark-border/40 bg-transparent">
                                        <th className="px-4 py-2.5 text-left text-xs text-white font-extrabold tracking-[1px] uppercase bg-[#0f6fb8]" colSpan={2}>ASSETS</th>
                                        <th className="scontro-divider" />
                                        <th className="px-4 py-2.5 text-left text-xs text-white font-extrabold tracking-[1px] uppercase bg-[#0f6fb8]" colSpan={2}>LIABILITIES & EQUITY</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: scontroMaxRows }).map((_, idx) => {
                                        const left = assetScontroRows[idx];
                                        const right = rightScontroRows[idx];
                                        return (
                                            <tr key={`scontro-row-${idx}`} className="border-b border-dark-border/20 last:border-b-0 align-top">
                                                {renderScontroCell(left)}
                                                <td className="scontro-divider" />
                                                {renderScontroCell(right)}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            ) : null}

            <div className="text-center text-xs text-silver-dark mt-6 italic">
                * Click on an account to view its transactions in the General Ledger. "LABA / RUGI PERIODE BERJALAN" is auto-calculated from Revenue minus Expenses.
            </div>
        </div>
    );
};

export default BridgeBalanceSheet;
