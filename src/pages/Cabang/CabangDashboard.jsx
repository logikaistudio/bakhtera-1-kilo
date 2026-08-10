import React, { useMemo } from 'react';
import { Building2, DollarSign, FileText, TrendingUp, Users } from 'lucide-react';

const fmtIDR = (value) => {
    const n = Number(value || 0);
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}M`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    return `Rp ${n.toLocaleString('id-ID')}`;
};

const BRANCH_SUMMARY = [
    { id: 'CBG-JKT', name: 'Cabang Jakarta', salesOrders: 86, invoices: 41, revenue: 1450000000, arOutstanding: 210000000 },
    { id: 'CBG-SBY', name: 'Cabang Surabaya', salesOrders: 57, invoices: 33, revenue: 980000000, arOutstanding: 130000000 },
    { id: 'CBG-DPS', name: 'Cabang Denpasar', salesOrders: 28, invoices: 19, revenue: 460000000, arOutstanding: 72000000 },
];

const CabangDashboard = () => {
    const totals = useMemo(() => {
        return BRANCH_SUMMARY.reduce(
            (acc, row) => {
                acc.branchCount += 1;
                acc.salesOrders += row.salesOrders;
                acc.invoices += row.invoices;
                acc.revenue += row.revenue;
                acc.arOutstanding += row.arOutstanding;
                return acc;
            },
            { branchCount: 0, salesOrders: 0, invoices: 0, revenue: 0, arOutstanding: 0 }
        );
    }, []);

    const cards = [
        { title: 'Total Cabang Aktif', value: totals.branchCount, icon: Building2, color: 'text-cyan-300', bg: 'bg-cyan-500/15' },
        { title: 'Sales Order Berjalan', value: totals.salesOrders, icon: FileText, color: 'text-blue-300', bg: 'bg-blue-500/15' },
        { title: 'Invoice Aktif', value: totals.invoices, icon: DollarSign, color: 'text-emerald-300', bg: 'bg-emerald-500/15' },
        { title: 'Revenue Cabang', value: fmtIDR(totals.revenue), icon: TrendingUp, color: 'text-orange-300', bg: 'bg-orange-500/15' },
        { title: 'AR Outstanding', value: fmtIDR(totals.arOutstanding), icon: Users, color: 'text-amber-300', bg: 'bg-amber-500/15' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-silver-light">Dashboard Cabang</h1>
                <p className="text-sm text-silver-dark mt-1">Ringkasan gabungan Sales dan Finance level Cabang.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                {cards.map(({ title, value, icon: Icon, color, bg }) => (
                    <div key={title} className="glass-card rounded-xl p-4 border border-dark-border">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-wide text-silver-dark">{title}</p>
                            <span className={`p-2 rounded-lg ${bg}`}>
                                <Icon className={`w-4 h-4 ${color}`} />
                            </span>
                        </div>
                        <p className={`mt-4 text-2xl font-bold ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            <div className="glass-card rounded-xl border border-dark-border overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-silver-light">Performa per Cabang</h2>
                    <span className="text-xs text-silver-dark">Mode awal: data mock, siap dihubungkan API</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-dark-border/80 bg-dark-surface/40">
                                <th className="text-left px-5 py-3 text-silver-dark">Kode</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Nama Cabang</th>
                                <th className="text-right px-5 py-3 text-silver-dark">SO</th>
                                <th className="text-right px-5 py-3 text-silver-dark">Invoice</th>
                                <th className="text-right px-5 py-3 text-silver-dark">Revenue</th>
                                <th className="text-right px-5 py-3 text-silver-dark">AR Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {BRANCH_SUMMARY.map((item) => (
                                <tr key={item.id} className="border-b border-dark-border/40 hover:bg-dark-surface/40 smooth-transition">
                                    <td className="px-5 py-3 text-silver-light font-medium">{item.id}</td>
                                    <td className="px-5 py-3 text-silver">{item.name}</td>
                                    <td className="px-5 py-3 text-right text-blue-300">{item.salesOrders}</td>
                                    <td className="px-5 py-3 text-right text-emerald-300">{item.invoices}</td>
                                    <td className="px-5 py-3 text-right text-orange-300">{fmtIDR(item.revenue)}</td>
                                    <td className="px-5 py-3 text-right text-amber-300">{fmtIDR(item.arOutstanding)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CabangDashboard;
