import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/Common/Button';
import { BarChart2, RefreshCw, FileSpreadsheet, Printer } from 'lucide-react';
import { printReport } from '../../../utils/printPDF';

const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';

const BigBalanceSheet = () => {
    const [data, setData] = useState({ assets: [], liabilities: [], equity: [] });
    const [loading, setLoading] = useState(true);
    const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0]);
    const [printOrientation, setPrintOrientation] = useState('auto'); // 'auto' | 'portrait' | 'landscape'
    const [printPageSize, setPrintPageSize] = useState('A4'); // 'A4' | 'Letter' | 'Legal'

    useEffect(() => { fetchBS(); }, [asOf]);

    const fetchBS = async () => {
        setLoading(true);
        try {
            const [{ data: accounts }, { data: entries }] = await Promise.all([
                supabase.from('big_coa').select('*').order('code'),
                supabase.from('big_journal_line_items')
                    .select('coa_id, debit, credit, big_journal_entries!inner(entry_date)')
                    .lte('big_journal_entries.entry_date', asOf),
            ]);

            const totals = {};
            (entries || []).forEach(e => {
                if (!totals[e.coa_id]) totals[e.coa_id] = { debit: 0, credit: 0 };
                totals[e.coa_id].debit += e.debit || 0;
                totals[e.coa_id].credit += e.credit || 0;
            });

            const assets = [], liabilities = [], equity = [];
            (accounts || []).forEach(acc => {
                const t = totals[acc.id];
                if (!t) return;
                if (acc.type === 'ASSET') {
                    const net = t.debit - t.credit;
                    if (net !== 0) assets.push({ ...acc, net });
                } else if (acc.type === 'LIABILITY') {
                    const net = t.credit - t.debit;
                    if (net !== 0) liabilities.push({ ...acc, net });
                } else if (acc.type === 'EQUITY') {
                    const net = t.credit - t.debit;
                    if (net !== 0) equity.push({ ...acc, net });
                }
            });

            setData({ assets, liabilities, equity });
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const totalAssets = data.assets.reduce((s, a) => s + a.net, 0);
    const totalLiabilities = data.liabilities.reduce((s, a) => s + a.net, 0);
    const totalEquity = data.equity.reduce((s, a) => s + a.net, 0);
    const totalLE = totalLiabilities + totalEquity;
    const isBalanced = Math.abs(totalAssets - totalLE) < 1;

    // ── Export Excel ────────────────────────────────────────────────────────────
    const exportToExcel = () => {
        const ws = [];
        ws.push(['BALANCE SHEET - BIG MODULE']);
        ws.push([`Per ${new Date(asOf).toLocaleDateString('id-ID')}`]);
        ws.push([]);
        ws.push(['ASET', 'Jumlah']);
        data.assets.forEach(a => ws.push([a.name, a.net]));
        ws.push(['TOTAL ASET', totalAssets]);
        ws.push([]);
        ws.push(['KEWAJIBAN DAN EKUITAS', 'Jumlah']);
        data.liabilities.forEach(a => ws.push([a.name, a.net]));
        ws.push(['TOTAL KEWAJIBAN', totalLiabilities]);
        data.equity.forEach(a => ws.push([a.name, a.net]));
        ws.push(['TOTAL EKUITAS', totalEquity]);
        ws.push(['TOTAL KEWAJIBAN & EKUITAS', totalLE]);
        const csv = ws.map(r => r.join('\t')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `BalanceSheet_Big_${asOf}.csv`;
        link.click();
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const asOfLabel = new Date(asOf).toLocaleDateString('id-ID');
        const bodyHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#0070BB;color:white;font-weight:bold"><th style="border:1px solid #ccc;padding:8px;text-align:left">ASET</th><th style="border:1px solid #ccc;padding:8px;text-align:right">Jumlah</th></tr></thead>
            <tbody>${data.assets.map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}<tr style="background:#f5f5f5;font-weight:bold"><td style="border:1px solid #ccc;padding:8px">TOTAL ASET</td><td style="text-align:right;border:1px solid #ccc;padding:8px">${fmtIDR(totalAssets)}</td></tr></tbody>
        </table>
        <br/>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead><tr style="background:#0070BB;color:white;font-weight:bold"><th style="border:1px solid #ccc;padding:8px;text-align:left">KEWAJIBAN & EKUITAS</th><th style="border:1px solid #ccc;padding:8px;text-align:right">Jumlah</th></tr></thead>
            <tbody>${data.liabilities.map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}${data.equity.map(a => `<tr style="border:1px solid #e0e0e0"><td style="padding:6px">${a.name}</td><td style="text-align:right;padding:6px">${fmtIDR(a.net)}</td></tr>`).join('')}<tr style="background:#f5f5f5;font-weight:bold"><td style="border:1px solid #ccc;padding:8px">TOTAL KEWAJIBAN & EKUITAS</td><td style="text-align:right;border:1px solid #ccc;padding:8px">${fmtIDR(totalLE)}</td></tr></tbody>
        </table>`;
        printReport({
            reportName: 'BALANCE SHEET',
            company: 'Big Module',
            companyInfo: { name: 'Big Module' },
            period: `Per ${asOfLabel}`,
            bodyHTML,
            note: '',
            orientation: printOrientation,
            pageSize: printPageSize
        });
    };

    const Section = ({ title, items, total, color }) => (
        <div className="glass-card rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0070BB] px-4 py-2.5">
                <span className="text-white font-semibold text-sm uppercase tracking-wider">{title}</span>
            </div>
            <table className="w-full text-sm">
                <tbody className="divide-y divide-dark-border/30">
                    {items.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-3 text-silver-dark italic text-xs">Tidak ada saldo</td></tr>
                    ) : items.map(acc => (
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
                        <td className="px-4 py-3 text-silver-light">Total {title}</td>
                        <td className={`px-4 py-3 text-right font-mono font-bold ${color}`}>{fmtIDR(total)}</td>
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
                        <BarChart2 className="w-8 h-8" /> Balance Sheet — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Neraca keuangan Big module</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchBS}>Refresh</Button>
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

            <div className="glass-card p-4 rounded-xl flex items-center gap-4">
                <div>
                    <label className="block text-xs text-silver-dark uppercase mb-1">Per Tanggal</label>
                    <input type="date" value={asOf}
                        onChange={e => setAsOf(e.target.value)}
                        className="bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-sm" />
                </div>
                <div className={`ml-auto px-4 py-2 rounded-lg border ${isBalanced ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'} text-sm font-bold`}>
                    {isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗'}
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 text-center text-silver-dark rounded-xl">Memuat data...</div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Assets */}
                    <div>
                        <h2 className="text-silver-light font-semibold mb-3 uppercase tracking-wider text-xs">ASET</h2>
                        <Section title="Aset" items={data.assets} total={totalAssets} color="text-blue-400" />
                        <div className="glass-card rounded-xl border-2 border-blue-500 px-4 py-4 flex justify-between items-center">
                            <span className="text-blue-400 font-bold">TOTAL ASET</span>
                            <span className="text-2xl font-bold font-mono text-blue-400">{fmtIDR(totalAssets)}</span>
                        </div>
                    </div>

                    {/* Right: Liabilities + Equity */}
                    <div>
                        <h2 className="text-silver-light font-semibold mb-3 uppercase tracking-wider text-xs">KEWAJIBAN & EKUITAS</h2>
                        <Section title="Kewajiban (Liabilities)" items={data.liabilities} total={totalLiabilities} color="text-red-400" />
                        <Section title="Ekuitas (Equity)" items={data.equity} total={totalEquity} color="text-purple-400" />
                        <div className={`glass-card rounded-xl border-2 px-4 py-4 flex justify-between items-center ${isBalanced ? 'border-green-500' : 'border-red-500'}`}>
                            <span className={`font-bold ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>TOTAL KEWAJIBAN + EKUITAS</span>
                            <span className={`text-2xl font-bold font-mono ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>{fmtIDR(totalLE)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BigBalanceSheet;
