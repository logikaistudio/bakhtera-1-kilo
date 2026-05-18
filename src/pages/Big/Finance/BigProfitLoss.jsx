import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/Common/Button';
import { TrendingUp, RefreshCw, FileSpreadsheet, Printer } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { printReport } from '../../../utils/printPDF';

const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';
const ensureArray = (value) => Array.isArray(value) ? value : [];

const BigProfitLoss = () => {
    const { companySettings } = useData();
    const [data, setData] = useState({ revenue: [], cogs: [], expenses: [] });
    const [loading, setLoading] = useState(true);
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
    });
    const [printOrientation, setPrintOrientation] = useState('auto'); // 'auto' | 'portrait' | 'landscape'
    const [printPageSize, setPrintPageSize] = useState('A4'); // 'A4' | 'Letter' | 'Legal'

    useEffect(() => { fetchPL(); }, [dateRange]);

    const fetchPL = async () => {
        setLoading(true);
        try {
            const [{ data: accounts }, { data: entries }] = await Promise.all([
                supabase.from('big_coa').select('*').order('code'),
                supabase.from('big_journal_line_items')
                    .select('coa_id, debit, credit, big_journal_entries!inner(entry_date)')
                    .gte('big_journal_entries.entry_date', dateRange.start)
                    .lte('big_journal_entries.entry_date', dateRange.end),
            ]);

            const totals = {};
            (entries || []).forEach(e => {
                if (!totals[e.coa_id]) totals[e.coa_id] = { debit: 0, credit: 0 };
                totals[e.coa_id].debit += e.debit || 0;
                totals[e.coa_id].credit += e.credit || 0;
            });

            const revenue = [], cogs = [], expenses = [];
            (accounts || []).forEach(acc => {
                const t = totals[acc.id];
                if (!t) return;
                const net = t.credit - t.debit;
                if (acc.type === 'REVENUE' && net !== 0) revenue.push({ ...acc, net });
                else if (acc.type === 'COGS' && (t.debit - t.credit) !== 0) cogs.push({ ...acc, net: t.debit - t.credit });
                else if (acc.type === 'EXPENSE' && (t.debit - t.credit) !== 0) expenses.push({ ...acc, net: t.debit - t.credit });
            });

            setData({ revenue, cogs, expenses });
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalRevenue = ensureArray(data.revenue).reduce((s, a) => s + a.net, 0);
    const totalCogs = ensureArray(data.cogs).reduce((s, a) => s + a.net, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = ensureArray(data.expenses).reduce((s, a) => s + a.net, 0);
    const netIncome = grossProfit - totalExpenses;

    // ── Export Excel ────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        const ws = [];
        const cs = companySettings;
        const dateLabel = `${new Date(dateRange.start).toLocaleDateString('id-ID')} - ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
        
        // KOP SURAT
        ws.push([cs?.company_name || 'Big Module']);
        ws.push([cs?.company_address || '']);
        if (cs?.company_phone) ws.push([`Telp: ${cs.company_phone}`]);
        if (cs?.company_npwp) ws.push([`NPWP: ${cs.company_npwp}`]);
        ws.push([]);
        ws.push(['LAPORAN LABA RUGI (PROFIT & LOSS)']);
        ws.push([`Periode: ${dateLabel}`]);
        ws.push([]);
        
        ws.push(['PENDAPATAN (REVENUE)', fmtIDR(totalRevenue)]);
        ensureArray(data.revenue).forEach(a => ws.push([`  ${a.name}`, fmtIDR(a.net)]));
        ws.push([]);
        
        ws.push(['HARGA POKOK (COGS)', fmtIDR(totalCogs)]);
        ensureArray(data.cogs).forEach(a => ws.push([`  ${a.name}`, fmtIDR(a.net)]));
        ws.push([]);
        
        ws.push(['LABA KOTOR (GROSS PROFIT)', fmtIDR(grossProfit)]);
        ws.push([]);
        
        ws.push(['BIAYA OPERASIONAL (EXPENSES)', fmtIDR(totalExpenses)]);
        ensureArray(data.expenses).forEach(a => ws.push([`  ${a.name}`, fmtIDR(a.net)]));
        ws.push([]);
        
        ws.push(['LABA BERSIH (NET INCOME)', fmtIDR(netIncome)]);
        
        const csv = ws.map(r => r.join('\t')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `ProfitLoss_Big_${dateRange.start}_${dateRange.end}.csv`;
        link.click();
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const dateLabel = `${new Date(dateRange.start).toLocaleDateString('id-ID')} - ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
        const bodyHTML = `
        <h2 style="text-align:center;margin-bottom:16px">LAPORAN LABA RUGI (PROFIT & LOSS)</h2>
        <p style="text-align:center;font-size:11px;margin-bottom:16px">Periode: ${dateLabel}</p>
        
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <thead><tr style="background:#0070BB;color:white;font-weight:bold"><th style="border:1px solid #ccc;padding:8px;text-align:left">PENDAPATAN (REVENUE)</th><th style="border:1px solid #ccc;padding:8px;text-align:right">Jumlah</th></tr></thead>
            <tbody>${ensureArray(data.revenue).map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}<tr style="background:#f5f5f5;font-weight:bold"><td style="border:1px solid #ccc;padding:8px">TOTAL PENDAPATAN</td><td style="text-align:right;border:1px solid #ccc;padding:8px">${fmtIDR(totalRevenue)}</td></tr></tbody>
        </table>
        
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <thead><tr style="background:#0070BB;color:white;font-weight:bold"><th style="border:1px solid #ccc;padding:8px;text-align:left">HARGA POKOK (COGS)</th><th style="border:1px solid #ccc;padding:8px;text-align:right">Jumlah</th></tr></thead>
            <tbody>${ensureArray(data.cogs).map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}<tr style="background:#f5f5f5;font-weight:bold"><td style="border:1px solid #ccc;padding:8px">TOTAL COGS</td><td style="text-align:right;border:1px solid #ccc;padding:8px">${fmtIDR(totalCogs)}</td></tr></tbody>
        </table>
        
        <div style="background:#f0f0f0;padding:12px;margin-bottom:16px;border:1px solid #ccc;border-radius:4px">
            <div style="display:flex;justify-content:space-between;font-weight:bold">
                <span>LABA KOTOR (GROSS PROFIT)</span>
                <span>${fmtIDR(grossProfit)}</span>
            </div>
        </div>
        
        <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
            <thead><tr style="background:#0070BB;color:white;font-weight:bold"><th style="border:1px solid #ccc;padding:8px;text-align:left">BIAYA OPERASIONAL (EXPENSES)</th><th style="border:1px solid #ccc;padding:8px;text-align:right">Jumlah</th></tr></thead>
            <tbody>${ensureArray(data.expenses).map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}<tr style="background:#f5f5f5;font-weight:bold"><td style="border:1px solid #ccc;padding:8px">TOTAL BIAYA</td><td style="text-align:right;border:1px solid #ccc;padding:8px">${fmtIDR(totalExpenses)}</td></tr></tbody>
        </table>
        
        <div style="background:${netIncome >= 0 ? '#d4edda' : '#f8d7da'};padding:12px;border:2px solid ${netIncome >= 0 ? '#28a745' : '#dc3545'};border-radius:4px">
            <div style="display:flex;justify-content:space-between;font-weight:bold;color:${netIncome >= 0 ? '#155724' : '#721c24'}">
                <span>LABA BERSIH (NET INCOME)</span>
                <span>${fmtIDR(netIncome)}</span>
            </div>
        </div>`;
        printReport({
            reportName: 'PROFIT & LOSS',
            company: 'Big Module',
            companyInfo: companySettings,
            period: `Periode: ${dateLabel}`,
            bodyHTML,
            note: '',
            orientation: printOrientation,
            pageSize: printPageSize
        });
    };

    const Section = ({ title, items, total, totalLabel, totalColor = 'text-silver-light' }) => (
        <div className="glass-card rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0070BB] px-4 py-2.5">
                <span className="text-white font-semibold text-sm uppercase tracking-wider">{title}</span>
            </div>
            <table className="w-full text-sm">
                <tbody className="divide-y divide-dark-border/30">
                    {ensureArray(items).length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-3 text-silver-dark italic text-xs">Tidak ada transaksi</td></tr>
                    ) : ensureArray(items).map(acc => (
                        <tr key={acc.id} className="hover:bg-white/5">
                            <td className="px-4 py-2.5">
                                <span className="font-mono text-accent-orange text-xs mr-3">{acc.code}</span>
                                <span className="text-silver-light">{acc.name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-silver-light">{fmtIDR(acc.net)}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-dark-surface/50 font-semibold border-t border-dark-border">
                    <tr>
                        <td className="px-4 py-3 text-silver-light">{totalLabel}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${totalColor}`}>{fmtIDR(total)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <TrendingUp className="w-8 h-8" /> Profit & Loss — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Laporan laba rugi Big module</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchPL}>Refresh</Button>
                    <button onClick={handleExportExcel}
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

            <div className="glass-card p-4 rounded-xl flex items-center gap-4">
                <div>
                    <label className="block text-xs text-silver-dark uppercase mb-1">Mulai</label>
                    <input type="date" value={dateRange.start}
                        onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                        className="bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-sm" />
                </div>
                <div className="h-px w-4 bg-silver-dark" />
                <div>
                    <label className="block text-xs text-silver-dark uppercase mb-1">Sampai</label>
                    <input type="date" value={dateRange.end}
                        onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                        className="bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-sm" />
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 text-center text-silver-dark rounded-xl">Memuat data...</div>
            ) : (
                <div className="max-w-3xl">
                    <Section title="Pendapatan (Revenue)" items={data.revenue} total={totalRevenue} totalLabel="Total Pendapatan" totalColor="text-green-400" />
                    <Section title="Harga Pokok (COGS)" items={data.cogs} total={totalCogs} totalLabel="Total COGS" totalColor="text-orange-400" />

                    <div className="glass-card rounded-xl mb-4 border border-blue-500/30">
                        <div className="flex justify-between items-center px-4 py-4">
                            <span className="text-blue-400 font-bold text-base">Laba Kotor (Gross Profit)</span>
                            <span className={`text-2xl font-bold font-mono ${grossProfit >= 0 ? 'text-blue-400' : 'text-red-400'}`}>{fmtIDR(grossProfit)}</span>
                        </div>
                    </div>

                    <Section title="Biaya Operasional (Expenses)" items={data.expenses} total={totalExpenses} totalLabel="Total Biaya" totalColor="text-red-400" />

                    <div className={`glass-card rounded-xl border-2 ${netIncome >= 0 ? 'border-green-500' : 'border-red-500'}`}>
                        <div className="flex justify-between items-center px-4 py-5">
                            <span className={`font-bold text-xl ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {netIncome >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}
                            </span>
                            <span className={`text-3xl font-bold font-mono ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtIDR(netIncome)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BigProfitLoss;
