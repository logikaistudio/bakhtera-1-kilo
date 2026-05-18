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

const ensureArray = (value) => Array.isArray(value) ? value : [];

const normalizeGroups = (groups) => ensureArray(groups).map((group) => ({
    ...group,
    items: ensureArray(group?.items),
}));

function groupAccounts(accounts, groupDefs) {
    const safeAccounts = ensureArray(accounts);
    const safeGroupDefs = ensureArray(groupDefs);
    const grouped = safeGroupDefs.map((groupDef) => ({
        ...groupDef,
        items: safeAccounts.filter((account) => account.code && account.code.startsWith(groupDef.prefix) && !account.isHeader),
        total: 0
    }));
    const categorised = new Set(grouped.flatMap((group) => ensureArray(group.items).map((item) => item.id)));
    const uncategorised = safeAccounts.filter((account) => !categorised.has(account.id) && !account.isHeader);
    if (uncategorised.length > 0) {
        grouped.push({ prefix: '_other', label: 'OTHER', totalLabel: 'TOTAL OTHER', items: uncategorised, total: 0 });
    }
    grouped.forEach((group) => {
        group.total = ensureArray(group.items).reduce((sum, account) => sum + Number(account.balance || 0), 0);
    });
    return grouped;
}

const BridgeBalanceSheet = () => {
    const navigate = useNavigate();
    const { companySettings } = useData();
    const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
    const [loading, setLoading] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [totals, setTotals] = useState({ totalAssets: 0, totalLiabilities: 0, totalEquity: 0 });
    const [tableMode, setTableMode] = useState('stafel');
    const [printOrientation, setPrintOrientation] = useState('auto');
    const [printPageSize, setPrintPageSize] = useState('A4');

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
                    .not('coa_id', 'is', null)
                    .lte('entry_date', asOfDate),
                supabase.from('bridge_journal_entries')
                    .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
                    .is('coa_id', null)
                    .lte('entry_date', asOfDate)
            ]);
            if (r1.error) throw r1.error;
            if (r2.error) throw r2.error;

            const combined = [...ensureArray(r1.data), ...ensureArray(r2.data)];
            const entries = [...new Map(combined.map((row) => [row.id, row])).values()];

            const accountMap = {};
            const accountCodeMap = {};
            ensureArray(accounts).forEach((account) => {
                accountMap[account.id] = { ...account, balance: 0 };
                if (account.code) accountCodeMap[account.code] = account.id;
            });

            const toIDR = (value, currency, rate) => {
                if (!value) return 0;
                return currency && currency !== 'IDR' && rate > 1 ? value * rate : value;
            };

            entries.forEach((entry) => {
                const targetId = entry.coa_id || accountCodeMap[entry.account_code];
                if (!targetId) return;
                const account = accountMap[targetId];
                if (!account) return;
                const debit = toIDR(entry.debit, entry.currency, entry.exchange_rate);
                const credit = toIDR(entry.credit, entry.currency, entry.exchange_rate);
                const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(account.type);
                if (isNormalCredit) account.balance += (credit - debit);
                else account.balance += (debit - credit);
            });

            const allAccounts = Object.values(accountMap);
            const isHeader = (account) => account.level <= 2 || /^\d-\d{2}-000/.test(account.code) || /^\d-00-000/.test(account.code);
            const assets = allAccounts.filter((account) => account.type === 'ASSET' && account.balance !== 0 && !isHeader(account)).sort((left, right) => left.code.localeCompare(right.code));
            const liabilities = allAccounts.filter((account) => account.type === 'LIABILITY' && account.balance !== 0 && !isHeader(account)).sort((left, right) => left.code.localeCompare(right.code));
            const equity = allAccounts.filter((account) => account.type === 'EQUITY' && account.balance !== 0 && !isHeader(account)).sort((left, right) => left.code.localeCompare(right.code));

            const totalAssets = assets.reduce((sum, account) => sum + account.balance, 0);
            const totalLiabilities = liabilities.reduce((sum, account) => sum + account.balance, 0);
            const baseTotalEquity = equity.reduce((sum, account) => sum + account.balance, 0);

            const revenueAccounts = allAccounts.filter((account) => account.type === 'REVENUE');
            const expenseAccounts = allAccounts.filter((account) => ['EXPENSE', 'COGS', 'DIRECT_COST', 'OTHER_EXPENSE', 'COST'].includes(account.type));
            const totalRevenue = revenueAccounts.reduce((sum, account) => sum + account.balance, 0);
            const totalExpense = expenseAccounts.reduce((sum, account) => sum + account.balance, 0);
            const netIncome = totalRevenue - totalExpense;

            if (netIncome !== 0) {
                equity.push({
                    id: 'net-income',
                    code: '3-02-900-0-1-00',
                    name: 'LABA / RUGI PERIODE BERJALAN',
                    balance: netIncome,
                    type: 'EQUITY',
                    isCalculated: true
                });
            }

            const finalTotalEquity = totalAssets - totalLiabilities;
            const historicalBalancing = finalTotalEquity - (baseTotalEquity + netIncome);
            if (Math.abs(historicalBalancing) > 0.5) {
                equity.push({
                    id: 'historical-balancing',
                    code: '3-02-800-0-1-00',
                    name: 'HISTORICAL BALANCING',
                    balance: historicalBalancing,
                    type: 'EQUITY',
                    isCalculated: true
                });
            }

            setReportData({
                assetGroups: groupAccounts(assets, ASSET_GROUPS),
                liabilityGroups: groupAccounts(liabilities, LIABILITY_GROUPS),
                equityGroups: groupAccounts(equity, EQUITY_GROUPS),
                assets,
                liabilities,
                equity
            });
            setTotals({ totalAssets, totalLiabilities, totalEquity: finalTotalEquity });
        } catch (error) {
            console.error('Error fetching balance sheet:', error);
            setReportData({ assetGroups: [], liabilityGroups: [], equityGroups: [], assets: [], liabilities: [], equity: [] });
        } finally {
            setLoading(false);
        }
    };

    const fmtCur = (value) => {
        if (value === null || value === undefined) return '-';
        const negative = value < 0;
        const absValue = Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return negative ? `Rp.(${absValue})` : `Rp. ${absValue}`;
    };

    const asOfLabel = new Date(asOfDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
    const assetGroups = normalizeGroups(reportData?.assetGroups);
    const liabilityGroups = normalizeGroups(reportData?.liabilityGroups);
    const equityGroups = normalizeGroups(reportData?.equityGroups);
    const equityAccounts = ensureArray(reportData?.equity);

    const handleAccountClick = (accountId) => {
        if (accountId === 'net-income' || accountId === 'historical-balancing') return;
        navigate('/bridge/finance/general-ledger', { state: { preSelectedAccount: accountId } });
    };

    const exportToExcel = () => {
        const rows = [];
        rows.push({ Account: 'BALANCE SHEET', Amount: `Per ${asOfLabel}` });
        rows.push({ Account: '', Amount: '' });

        const addGroup = (mainLabel, groups, grandTotal, grandLabel) => {
            rows.push({ Account: mainLabel, Amount: '' });
            rows.push({ Account: '', Amount: '' });
            normalizeGroups(groups).forEach((group) => {
                if (!group.items.length) return;
                rows.push({ Account: `  ${group.label}`, Amount: '' });
                group.items.forEach((account) => rows.push({ Account: `      ${account.name}`, Amount: fmtCur(account.balance) }));
                rows.push({ Account: '', Amount: '' });
                rows.push({ Account: `            ${group.totalLabel}`, Amount: fmtCur(group.total) });
                rows.push({ Account: '', Amount: '' });
            });
            rows.push({ Account: '', Amount: '' });
            rows.push({ Account: `            ${grandLabel}`, Amount: fmtCur(grandTotal) });
            rows.push({ Account: '', Amount: '' });
        };

        addGroup('ASSETS', assetGroups, totals.totalAssets, 'TOTAL ASSETS');
        addGroup('LIABILITIES', liabilityGroups, totals.totalLiabilities, 'TOTAL LIABILITIES');
        addGroup('EQUITY', equityGroups, totals.totalEquity, 'TOTAL EQUITY');
        rows.push({ Account: '', Amount: '' });
        rows.push({ Account: '            TOTAL LIABILITIES DAN EQUITY', Amount: fmtCur(totals.totalLiabilities + totals.totalEquity) });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        worksheet['!cols'] = [{ wch: 55 }, { wch: 25 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Balance Sheet');
        XLSX.writeFile(workbook, `BalanceSheet_Bridge_${asOfDate}.xlsx`);
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
        const safeLeftGroups = normalizeGroups(leftGroups);
        const safeRightGroups = normalizeGroups(rightGroups);
        const leftRows = [{ kind: 'section', label: leftSectionLabel, value: '' }];
        const rightRows = [{ kind: 'section', label: rightSectionLabel, value: '' }];
        const maxGroups = Math.max(safeLeftGroups.length, safeRightGroups.length);

        for (let index = 0; index < maxGroups; index += 1) {
            const leftGroup = safeLeftGroups[index];
            const rightGroup = safeRightGroups[index];
            const hasLeft = leftGroup && leftGroup.items.length;
            const hasRight = rightGroup && rightGroup.items.length;
            if (!hasLeft && !hasRight) continue;

            leftRows.push(hasLeft ? { kind: 'group', label: leftGroup.label, value: '' } : { kind: 'space', label: '', value: '' });
            rightRows.push(hasRight ? { kind: 'group', label: rightGroup.label, value: '' } : { kind: 'space', label: '', value: '' });

            const leftItems = hasLeft ? leftGroup.items : [];
            const rightItems = hasRight ? rightGroup.items : [];
            const maxItems = Math.max(leftItems.length, rightItems.length);

            for (let itemIndex = 0; itemIndex < maxItems; itemIndex += 1) {
                const leftItem = leftItems[itemIndex];
                const rightItem = rightItems[itemIndex];
                leftRows.push(leftItem ? { kind: 'item', label: leftItem.name, value: fmtValue(leftItem.balance), accId: leftItem.id, isCalculated: leftItem.isCalculated } : { kind: 'space', label: '', value: '' });
                rightRows.push(rightItem ? { kind: 'item', label: rightItem.name, value: fmtValue(rightItem.balance), accId: rightItem.id, isCalculated: rightItem.isCalculated } : { kind: 'space', label: '', value: '' });
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

    const toScontroRows = (label, groups, totalLabel, totalValue) => {
        const rows = [{ kind: 'section', label, value: '' }];
        normalizeGroups(groups).forEach((group) => {
            if (!group.items.length) return;
            rows.push({ kind: 'group', label: group.label, value: '' });
            group.items.forEach((account) => {
                rows.push({ kind: 'item', label: account.name, value: fmtCur(account.balance), accId: account.id, isCalculated: account.isCalculated });
            });
            rows.push({ kind: 'subtotal', label: group.totalLabel, value: fmtCur(group.total) });
            rows.push({ kind: 'space', label: '', value: '' });
        });
        rows.push({ kind: 'grand', label: totalLabel, value: fmtCur(totalValue) });
        return rows;
    };

    const handleExportPDF = () => {
        const fmtAmt = (value) => {
            if (value === null || value === undefined) return '';
            const negative = value < 0;
            const absValue = Math.abs(value).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            return negative ? `Rp.(${absValue})` : `Rp. ${absValue}`;
        };

        const doubleUnderline = 'border-top:1px solid #000;border-bottom:3px double #000;';

        const renderGroup = (groups) => normalizeGroups(groups).map((group) => {
            if (!group.items.length) return '';
            return `
                <tr><td colspan="2" style="padding:8px 0 2px 32px;font-weight:700;font-size:12px">${group.label}</td></tr>
                ${group.items.map((item) => `
                    <tr>
                        <td style="padding:1px 0 1px 64px;font-size:11px">${item.name}${item.isCalculated ? ' <em style="font-size:9px;color:#888">(calc)</em>' : ''}</td>
                        <td style="text-align:right;padding:1px 8px;font-size:11px;white-space:nowrap">${fmtAmt(item.balance)}</td>
                    </tr>
                `).join('')}
                <tr><td></td><td style="padding:4px 0"></td></tr>
                <tr>
                    <td style="text-align:right;padding:2px 16px 2px 0;font-weight:800;font-size:11px">${group.totalLabel}</td>
                    <td style="text-align:right;padding:2px 8px;font-weight:800;font-size:12px;${doubleUnderline}">${fmtAmt(group.total)}</td>
                </tr>
                <tr><td colspan="2" style="padding:6px 0"></td></tr>
            `;
        }).join('');

        const stafelBodyHTML = `
        <table style="width:100%;border-collapse:collapse;font-family:'Times New Roman',Times,serif;border:2px solid #334155">
            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">ASSETS</td></tr>
            ${renderGroup(assetGroups)}
            <tr>
                <td style="text-align:right;padding:8px 16px 4px 0;font-weight:900;font-size:13px">TOTAL ASSETS</td>
                <td style="text-align:right;padding:8px 8px 4px;font-weight:900;font-size:13px;${doubleUnderline}">${fmtAmt(totals.totalAssets)}</td>
            </tr>
            <tr><td colspan="2" style="padding:16px 0;border-bottom:2px solid #334155"></td></tr>

            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">LIABILITIES</td></tr>
            ${renderGroup(liabilityGroups)}
            <tr><td colspan="2" style="padding:8px 0"></td></tr>

            <tr><td colspan="2" style="padding:12px 16px 4px;font-weight:800;font-size:14px;border-bottom:1px solid #e2e8f0">EQUITY</td></tr>
            ${renderGroup(equityGroups)}
            <tr><td colspan="2" style="padding:8px 0"></td></tr>

            <tr>
                <td style="text-align:right;padding:8px 16px 4px 0;font-weight:900;font-size:13px">TOTAL LIABILITIES DAN EQUITY</td>
                <td style="text-align:right;padding:8px 8px 4px;font-weight:900;font-size:13px;${doubleUnderline}">${fmtAmt(totals.totalLiabilities + totals.totalEquity)}</td>
            </tr>
            <tr><td colspan="2" style="padding:8px 0"></td></tr>
        </table>`;

        const alignedPrint = buildAlignedSectionRows({
            leftSectionLabel: 'ASSETS',
            leftGroups: assetGroups,
            leftTotalLabel: 'TOTAL ASSETS',
            leftTotalValue: totals.totalAssets,
            rightSectionLabel: 'LIABILITIES',
            rightGroups: liabilityGroups,
            rightTotalLabel: 'TOTAL LIABILITIES',
            rightTotalValue: totals.totalLiabilities,
            fmtValue: fmtAmt
        });

        const printEquityRows = toScontroRows('EQUITY', equityGroups, 'TOTAL EQUITY', totals.totalEquity);
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
            if (!row || row.kind === 'space') return '<td colspan="2" style="padding:4px 6px"></td>';
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
                ${Array.from({ length: maxRows }).map((_, index) => {
                    const left = scontroLeftRows[index];
                    const right = scontroRightRows[index];
                    return `
                        <tr style="border-bottom:1px solid #e2e8f0;vertical-align:top">
                            ${renderPrintCell(left)}
                            <td style="width:12px;padding:0;background:transparent"></td>
                            ${renderPrintCell(right)}
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>`;

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

    const renderGroupedSection = (groups) => normalizeGroups(groups).map((group, index) => {
        if (!group.items.length) return null;
        return (
            <div key={`${group.label}-${index}`} className="mb-2">
                <SubGroupHeader label={group.label} />
                {group.items.map((account) => <AccountRow key={account.id} acc={account} />)}
                <div className="h-2" />
                <SubTotal label={group.totalLabel} value={group.total} />
                <div className="h-4" />
            </div>
        );
    });

    const renderSectionBlock = (label, groups, totalLabel, totalValue) => (
        <>
            <SectionHeader label={label} />
            {renderGroupedSection(groups)}
            <GrandTotal label={totalLabel} value={totalValue} />
        </>
    );

    const alignedScreen = buildAlignedSectionRows({
        leftSectionLabel: 'ASSETS',
        leftGroups: assetGroups,
        leftTotalLabel: 'TOTAL ASSETS',
        leftTotalValue: totals.totalAssets,
        rightSectionLabel: 'LIABILITIES',
        rightGroups: liabilityGroups,
        rightTotalLabel: 'TOTAL LIABILITIES',
        rightTotalValue: totals.totalLiabilities,
        fmtValue: fmtCur
    });
    const equityRows = toScontroRows('EQUITY', equityGroups, 'TOTAL EQUITY', totals.totalEquity);
    const rightTailRows = [
        { kind: 'space', label: '', value: '' },
        ...equityRows,
        { kind: 'grand', label: 'TOTAL LIABILITIES DAN EQUITY', value: fmtCur(totals.totalLiabilities + totals.totalEquity) }
    ];
    const assetScontroRows = [...alignedScreen.leftRows, ...Array.from({ length: rightTailRows.length }, () => ({ kind: 'space', label: '', value: '' }))];
    const rightScontroRows = [...alignedScreen.rightRows, ...rightTailRows];
    const scontroMaxRows = Math.max(assetScontroRows.length, rightScontroRows.length);

    const renderScontroCell = (row) => {
        if (!row || row.kind === 'space') return <td className="px-4 py-2" colSpan={2} />;
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

            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-lg flex items-center gap-4 flex-1">
                    <Calendar className="w-5 h-5 text-accent-orange" />
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">As of Date</label>
                        <input type="date" value={asOfDate}
                            onChange={(e) => setAsOfDate(e.target.value)}
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
                        {renderSectionBlock('ASSETS', assetGroups, 'TOTAL ASSETS', totals.totalAssets)}
                        <div className="border-t-2 border-dark-border/40 mx-4" />

                        <div className="mt-4" />
                        {renderSectionBlock('LIABILITIES', liabilityGroups, 'TOTAL LIABILITIES', totals.totalLiabilities)}
                        <div className="border-t-2 border-dark-border/40 mx-4" />

                        <div className="mt-4" />
                        <SectionHeader label="EQUITY" />
                        {renderGroupedSection(equityGroups)}
                        <div className="flex justify-between items-center py-[3px] pl-8 pr-4 text-sm mt-2">
                            <span className="text-silver-dark italic">LABA / RUGI Per {asOfLabel}</span>
                            <span className="font-mono text-silver-light text-xs min-w-[160px] text-right italic">{fmtCur(equityAccounts.find((account) => account.id === 'net-income')?.balance || 0)}</span>
                        </div>
                        <div className="h-4" />

                        <GrandTotal label="TOTAL EQUITY" value={totals.totalEquity} />
                        <div className="border-t-2 border-dark-border/40 mx-4" />

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
                                    {Array.from({ length: scontroMaxRows }).map((_, index) => {
                                        const left = assetScontroRows[index];
                                        const right = rightScontroRows[index];
                                        return (
                                            <tr key={`scontro-row-${index}`} className="border-b border-dark-border/20 last:border-b-0 align-top">
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
