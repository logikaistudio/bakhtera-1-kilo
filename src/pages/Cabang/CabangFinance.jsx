import React from 'react';
import { BadgeDollarSign, FileClock, HandCoins, PlusCircle } from 'lucide-react';

const INVOICE_ROWS = [
    { invNo: 'INV-CBG-JKT-1001', customer: 'PT Nusantara Freight', dueDate: '2026-09-03', status: 'Open', amount: 82000000 },
    { invNo: 'INV-CBG-SBY-0992', customer: 'CV Kencana Abadi', dueDate: '2026-08-19', status: 'Overdue', amount: 41000000 },
    { invNo: 'INV-CBG-DPS-0978', customer: 'PT Samudra Dewata', dueDate: '2026-09-12', status: 'Partially Paid', amount: 36000000 },
];

const fmtIDR = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

const statusCls = {
    Open: 'bg-blue-500/15 text-blue-300 border border-blue-500/30',
    Overdue: 'bg-red-500/15 text-red-300 border border-red-500/30',
    'Partially Paid': 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
};

const CabangFinance = () => {
    const totalInvoice = INVOICE_ROWS.reduce((acc, row) => acc + row.amount, 0);
    const overdue = INVOICE_ROWS.filter((row) => row.status === 'Overdue').reduce((acc, row) => acc + row.amount, 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-silver-light">Cabang Finance</h1>
                    <p className="text-sm text-silver-dark mt-1">Pengelolaan invoice, AR/AP, dan ringkasan kas per cabang.</p>
                </div>
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-500/90 smooth-transition">
                    <PlusCircle className="w-4 h-4" />
                    Buat Invoice
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card border border-dark-border rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-silver-dark">Total Invoice</p>
                    <p className="text-2xl font-bold text-emerald-300 mt-3">{fmtIDR(totalInvoice)}</p>
                </div>
                <div className="glass-card border border-dark-border rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-silver-dark">Outstanding Overdue</p>
                    <p className="text-2xl font-bold text-red-300 mt-3">{fmtIDR(overdue)}</p>
                </div>
                <div className="glass-card border border-dark-border rounded-xl p-4">
                    <p className="text-xs uppercase tracking-wide text-silver-dark">Jumlah Invoice</p>
                    <p className="text-2xl font-bold text-blue-300 mt-3">{INVOICE_ROWS.length}</p>
                </div>
            </div>

            <div className="glass-card border border-dark-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-border flex items-center justify-between">
                    <h2 className="text-base font-semibold text-silver-light inline-flex items-center gap-2">
                        <BadgeDollarSign className="w-4 h-4 text-emerald-300" />
                        Invoice Cabang
                    </h2>
                    <div className="text-xs text-silver-dark inline-flex items-center gap-1">
                        <FileClock className="w-4 h-4" />
                        Last update: realtime
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-dark-surface/40 border-b border-dark-border/80">
                                <th className="text-left px-5 py-3 text-silver-dark">No Invoice</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Customer</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Status</th>
                                <th className="text-left px-5 py-3 text-silver-dark">Due Date</th>
                                <th className="text-right px-5 py-3 text-silver-dark">Nominal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {INVOICE_ROWS.map((row) => (
                                <tr key={row.invNo} className="border-b border-dark-border/40 hover:bg-dark-surface/40 smooth-transition">
                                    <td className="px-5 py-3 text-silver-light font-medium">{row.invNo}</td>
                                    <td className="px-5 py-3 text-silver">{row.customer}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex px-2 py-1 rounded-md text-xs ${statusCls[row.status] || statusCls.Open}`}>
                                            {row.status}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-silver">{row.dueDate}</td>
                                    <td className="px-5 py-3 text-right text-emerald-300">{fmtIDR(row.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="glass-card border border-dark-border rounded-xl p-4 flex items-center gap-3">
                <HandCoins className="w-5 h-5 text-amber-300" />
                <p className="text-sm text-silver">
                    Modul ini siap disambungkan ke transaksi AR/AP cabang dan jurnal otomatis setelah endpoint backend cabang diaktifkan.
                </p>
            </div>
        </div>
    );
};

export default CabangFinance;
