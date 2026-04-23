import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import { TrendingUp, RefreshCw } from 'lucide-react';

const fmtIDR = (v) => v != null ? 'Rp ' + Number(v).toLocaleString('id-ID') : 'Rp 0';

const BigProfitLoss = () => {
    const [data, setData] = useState({ revenue: [], cogs: [], expenses: [] });
    const [loading, setLoading] = useState(true);
    const today = new Date();
    const [dateRange, setDateRange] = useState({
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
    });

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

    const totalRevenue = data.revenue.reduce((s, a) => s + a.net, 0);
    const totalCogs = data.cogs.reduce((s, a) => s + a.net, 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = data.expenses.reduce((s, a) => s + a.net, 0);
    const netIncome = grossProfit - totalExpenses;

    const Section = ({ title, items, total, totalLabel, totalColor = 'text-silver-light' }) => (
        <div className="glass-card rounded-xl overflow-hidden mb-4">
            <div className="bg-[#0070BB] px-4 py-2.5">
                <span className="text-white font-semibold text-sm uppercase tracking-wider">{title}</span>
            </div>
            <table className="w-full text-sm">
                <tbody className="divide-y divide-dark-border/30">
                    {items.length === 0 ? (
                        <tr><td colSpan={2} className="px-4 py-3 text-silver-dark italic text-xs">Tidak ada transaksi</td></tr>
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
                <Button variant="secondary" icon={RefreshCw} onClick={fetchPL}>Refresh</Button>
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
