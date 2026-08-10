import React from 'react';
import { PlusCircle, Search, ShoppingCart, UserRound } from 'lucide-react';

const SALES_ROWS = [
    { soNo: 'SO-CBG-JKT-2401', customer: 'PT Nusantara Freight', status: 'Confirmed', amount: 132000000, assignee: 'Alya' },
    { soNo: 'SO-CBG-SBY-2398', customer: 'CV Kencana Abadi', status: 'Draft', amount: 54000000, assignee: 'Rian' },
    { soNo: 'SO-CBG-DPS-2391', customer: 'PT Samudra Dewata', status: 'In Progress', amount: 78000000, assignee: 'Dimas' },
];

const fmtIDR = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const badgeCls = {
    Draft: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',
    Confirmed: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    'In Progress': 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
};

const CabangSales = () => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-silver-light">Cabang Sales</h1>
                    <p className="text-sm text-silver-dark mt-1">Pengelolaan Sales Order dan customer per cabang.</p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent-blue text-white text-sm font-medium hover:bg-accent-blue/90 smooth-transition">
                    <PlusCircle className="w-4 h-4" />
                    Buat Sales Order
                </button>
            </div>

            <div className="glass-card border border-dark-border rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-silver-dark absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Cari SO / customer"
                            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40"
                        />
                    </div>
                    <select className="w-full px-3 py-2.5 rounded-lg bg-dark-surface border border-dark-border text-silver-light text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/40">
                        <option>Semua Cabang</option>
                        <option>Cabang Jakarta</option>
                        <option>Cabang Surabaya</option>
                        <option>Cabang Denpasar</option>
                    </select>
                </div>
            </div>

            <div className="glass-card border border-dark-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-border flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-blue-300" />
                    <h2 className="text-base font-semibold text-silver-light">Sales Order Cabang</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-dark-surface/40 border-b border-dark-border/80">
                                <th className="text-left px-5 py-3 text-silver-dark">No SO</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Customer</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Status</th>
                                <th className="text-right px-5 py-3 text-silver-dark">Nominal</th>
                                <th className="text-left px-5 py-3 text-silver-dark">PIC</th>
                            </tr>
                        </thead>
                        <tbody>
                            {SALES_ROWS.map((row) => (
                                <tr key={row.soNo} className="border-b border-dark-border/40 hover:bg-dark-surface/40 smooth-transition">
                                    <td className="px-5 py-3 text-silver-light font-medium">{row.soNo}</td>
                                    <td className="px-5 py-3 text-silver">{row.customer}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs ${badgeCls[row.status] || badgeCls.Draft}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right text-emerald-300">{fmtIDR(row.amount)}</td>
                                    <td className="px-5 py-3 text-silver inline-flex items-center gap-2">
                                        <UserRound className="w-4 h-4 text-silver-dark" />
                                        {row.assignee}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default CabangSales;
