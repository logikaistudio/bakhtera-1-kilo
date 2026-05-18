import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/Common/Button';
import { Scale, RefreshCw, FileSpreadsheet, Printer } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { printReport } from '../../../utils/printPDF';

const fmtNum = (v) => {
    if (!v && v !== 0) return '-';
    const abs = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 0 });
    return v < 0 ? `(${abs})` : abs;
};

const BigTrialBalance = () => {
    const { companySettings } = useData();
    const [balances, setBalances] = useState([]);
    const [totals, setTotals] = useState({ opening: 0, debit: 0, credit: 0, closing: 0 });
    const [loading, setLoading] = useState(true);
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
    });
    const [printOrientation, setPrintOrientation] = useState('auto'); // 'auto' | 'portrait' | 'landscape'
    const [printPageSize, setPrintPageSize] = useState('A4'); // 'A4' | 'Letter' | 'Legal'

    useEffect(() => { fetchTB(); }, [dateRange]);

    const fetchTB = async () => {
        setLoading(true);
        try {
            const [{ data: accounts }, { data: entries }] = await Promise.all([
                supabase.from('big_coa').select('*').order('code'),
                supabase.from('big_journal_line_items')
                    .select('coa_id, debit, credit, big_journal_entries!inner(entry_date)')
                    .lte('big_journal_entries.entry_date', dateRange.end),
            ]);

            const accMap = {};
            (accounts || []).forEach(a => {
                accMap[a.id] = { ...a, opening: 0, debitPeriod: 0, creditPeriod: 0, closing: 0 };
            });

            const isNormalCredit = (type) => ['LIABILITY', 'EQUITY', 'REVENUE'].includes(type);

            (entries || []).forEach(e => {
                const acc = accMap[e.coa_id];
                if (!acc) return;
                const d = e.debit || 0, cr = e.credit || 0;
                const entDate = e.big_journal_entries?.entry_date;
                if (entDate < dateRange.start) {
                    acc.opening += isNormalCredit(acc.type) ? (cr - d) : (d - cr);
                } else {
                    acc.debitPeriod += d;
                    acc.creditPeriod += cr;
                }
            });

            let tOp = 0, tD = 0, tCr = 0, tCl = 0;
            const processed = Object.values(accMap)
                .map(a => {
                    a.closing = isNormalCredit(a.type)
                        ? a.opening + a.creditPeriod - a.debitPeriod
                        : a.opening + a.debitPeriod - a.creditPeriod;
                    return a;
                })
                .filter(a => a.opening !== 0 || a.debitPeriod !== 0 || a.creditPeriod !== 0)
                .sort((a, b) => a.code.localeCompare(b.code));

            processed.forEach(a => { tOp += a.opening; tD += a.debitPeriod; tCr += a.creditPeriod; tCl += a.closing; });
            setBalances(processed);
            setTotals({ opening: tOp, debit: tD, credit: tCr, closing: tCl });
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    // ── Export Excel ────────────────────────────────────────────────────────────
    const handleExportExcel = () => {
        const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';
        const ws = [];
        const cs = companySettings;
        const dateLabel = `${new Date(dateRange.start).toLocaleDateString('id-ID')} - ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
        
        // KOP SURAT
        ws.push([cs?.company_name || 'Big Module']);
        ws.push([cs?.company_address || '']);
        if (cs?.company_phone) ws.push([`Telp: ${cs.company_phone}`]);
        if (cs?.company_npwp) ws.push([`NPWP: ${cs.company_npwp}`]);
        ws.push([]);
        ws.push(['TRIAL BALANCE']);
        ws.push([`Periode: ${dateLabel}`]);
        ws.push([]);
        
        ws.push(['CODE', 'ACCOUNT NAME', 'OPENING', 'DEBIT', 'CREDIT', 'CLOSING']);
        balances.forEach(a => ws.push([
            a.code, a.name, fmtNum(a.opening), fmtNum(a.debitPeriod), 
            fmtNum(a.creditPeriod), fmtNum(a.closing)
        ]));
        ws.push(['TOTAL', '', fmtNum(totals.opening), fmtNum(totals.debit), 
            fmtNum(totals.credit), fmtNum(totals.closing)]);
        
        const csv = ws.map(r => r.join('\t')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `TrialBalance_Big_${dateRange.start}_${dateRange.end}.csv`;
        link.click();
    };

    // ── Export PDF ──────────────────────────────────────────────────────────────
    const handleExportPDF = () => {
        const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';
        const dateLabel = `${new Date(dateRange.start).toLocaleDateString('id-ID')} - ${new Date(dateRange.end).toLocaleDateString('id-ID')}`;
        const bodyHTML = `
        <h2 style="text-align:center;margin-bottom:16px">TRIAL BALANCE</h2>
        <p style="text-align:center;font-size:11px;margin-bottom:16px">Periode: ${dateLabel}</p>
        
        <table style="width:100%;border-collapse:collapse;font-size:11px">
            <thead>
                <tr style="background:#0070BB;color:white;font-weight:bold">
                    <th style="border:1px solid #ccc;padding:8px;text-align:left">CODE</th>
                    <th style="border:1px solid #ccc;padding:8px;text-align:left">ACCOUNT NAME</th>
                    <th style="border:1px solid #ccc;padding:8px;text-align:right">OPENING</th>
                    <th style="border:1px solid #ccc;padding:8px;text-align:right">DEBIT</th>
                    <th style="border:1px solid #ccc;padding:8px;text-align:right">CREDIT</th>
                    <th style="border:1px solid #ccc;padding:8px;text-align:right">CLOSING</th>
                </tr>
            </thead>
            <tbody>
                ${balances.map(a => `<tr style="border:1px solid #e0e0e0">
                    <td style="padding:6px;font-family:monospace">${a.code}</td>
                    <td style="padding:6px">${a.name}</td>
                    <td style="text-align:right;padding:6px;font-family:monospace">${fmtNum(a.opening)}</td>
                    <td style="text-align:right;padding:6px;font-family:monospace">${fmtNum(a.debitPeriod)}</td>
                    <td style="text-align:right;padding:6px;font-family:monospace">${fmtNum(a.creditPeriod)}</td>
                    <td style="text-align:right;padding:6px;font-family:monospace">${fmtNum(a.closing)}</td>
                </tr>`).join('')}
                <tr style="background:#f5f5f5;font-weight:bold;border-top:2px solid #333">
                    <td colSpan="2" style="padding:8px">TOTAL</td>
                    <td style="text-align:right;padding:8px;font-family:monospace">${fmtNum(totals.opening)}</td>
                    <td style="text-align:right;padding:8px;font-family:monospace">${fmtNum(totals.debit)}</td>
                    <td style="text-align:right;padding:8px;font-family:monospace">${fmtNum(totals.credit)}</td>
                    <td style="text-align:right;padding:8px;font-family:monospace">${fmtNum(totals.closing)}</td>
                </tr>
            </tbody>
        </table>`;
        printReport({
            reportName: 'TRIAL BALANCE',
            company: 'Big Module',
            companyInfo: companySettings,
            period: `Periode: ${dateLabel}`,
            bodyHTML,
            note: '',
            orientation: printOrientation,
            pageSize: printPageSize
        });
    };

    const isBalanced = Math.abs(totals.closing) < 1;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
                        <Scale className="w-8 h-8" /> Trial Balance — Big
                    </h1>
                    <p className="text-silver-dark mt-1">Saldo akun dan mutasi periode Big module</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="secondary" icon={RefreshCw} onClick={fetchTB}>Refresh</Button>
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

            <div className="flex flex-col md:flex-row gap-4">
                <div className="glass-card p-4 rounded-xl flex items-center gap-4">
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">Start Date</label>
                        <input type="date" value={dateRange.start}
                            onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                            className="bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-sm" />
                    </div>
                    <div className="h-px w-4 bg-silver-dark" />
                    <div>
                        <label className="block text-xs text-silver-dark uppercase mb-1">End Date</label>
                        <input type="date" value={dateRange.end}
                            onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                            className="bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-sm" />
                    </div>
                </div>
                <div className={`glass-card p-4 rounded-xl flex items-center gap-4 border-l-4 ${isBalanced ? 'border-green-500' : 'border-red-500'}`}>
                    <div>
                        <p className="text-xs text-silver-dark uppercase tracking-wider">Balance Status</p>
                        <p className={`text-lg font-bold mt-1 ${isBalanced ? 'text-green-400' : 'text-red-400'}`}>
                            {isBalanced ? 'BALANCED ✓' : 'OUT OF BALANCE ✗'}
                        </p>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="glass-card p-12 text-center text-silver-dark rounded-xl">Memuat data...</div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-white/10">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#0070BB] text-white">
                                <tr>
                                    <th className="px-4 py-3 text-left">Kode COA</th>
                                    <th className="px-4 py-3 text-left">Nama Akun</th>
                                    <th className="px-4 py-3 text-center">Tipe</th>
                                    <th className="px-4 py-3 text-right">Saldo Awal</th>
                                    <th className="px-4 py-3 text-right">Debit</th>
                                    <th className="px-4 py-3 text-right">Kredit</th>
                                    <th className="px-4 py-3 text-right">Saldo Akhir</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/40">
                                {balances.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center py-10 text-silver-dark italic">Tidak ada transaksi pada periode ini</td></tr>
                                ) : balances.map(acc => (
                                    <tr key={acc.id} className="hover:bg-white/5 smooth-transition">
                                        <td className="px-4 py-2 font-mono text-accent-orange text-xs">{acc.code}</td>
                                        <td className="px-4 py-2 text-silver-light">{acc.name}</td>
                                        <td className="px-4 py-2 text-center text-xs text-silver-dark">{acc.type}</td>
                                        <td className="px-4 py-2 text-right font-mono text-silver-light">{fmtNum(acc.opening)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-blue-400">{fmtNum(acc.debitPeriod)}</td>
                                        <td className="px-4 py-2 text-right font-mono text-orange-400">{fmtNum(acc.creditPeriod)}</td>
                                        <td className={`px-4 py-2 text-right font-mono font-medium ${acc.closing < 0 ? 'text-red-400' : acc.closing > 0 ? 'text-emerald-400' : 'text-silver-dark'}`}>
                                            {fmtNum(acc.closing)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[#0070BB]/10 border-t-2 border-[#0070BB] font-bold">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider text-silver-light">GRAND TOTAL</td>
                                    <td className="px-4 py-3 text-right font-mono text-silver-light">{fmtNum(totals.opening)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-400">{fmtNum(totals.debit)}</td>
                                    <td className="px-4 py-3 text-right font-mono text-orange-400">{fmtNum(totals.credit)}</td>
                                    <td className={`px-4 py-3 text-right font-mono ${Math.abs(totals.closing) > 1 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {fmtNum(totals.closing)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BigTrialBalance;
