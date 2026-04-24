import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Button from '../../../components/Common/Button';
import { Scale, RefreshCw, Printer, FileText } from 'lucide-react';

const fmtNum = (v) => {
    if (!v && v !== 0) return '-';
    const abs = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: 0 });
    return v < 0 ? `(${abs})` : abs;
};

const BigTrialBalance = () => {
    const [balances, setBalances] = useState([]);
    const [totals, setTotals] = useState({ opening: 0, debit: 0, credit: 0, closing: 0 });
    const [loading, setLoading] = useState(true);
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
    });

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
                <Button variant="secondary" icon={RefreshCw} onClick={fetchTB}>Refresh</Button>
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
