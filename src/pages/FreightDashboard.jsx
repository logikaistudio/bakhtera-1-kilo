import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import {
    TrendingUp, Percent, Calendar, AlertTriangle,
    DollarSign, Loader2, RefreshCw
} from 'lucide-react';

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const fmtIDR = (v) => {
    if (!v && v !== 0) return 'Rp 0';
    const n = Number(v);
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)}M`;
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)}jt`;
    return `Rp ${n.toLocaleString('id-ID')}`;
};

const calcAgingBucket = (dueDate) => {
    if (!dueDate) return '0-30';
    const days = Math.floor((new Date() - new Date(dueDate)) / 86_400_000);
    if (days < 0) return '0-30';
    if (days <= 30) return '0-30';
    if (days <= 60) return '31-60';
    if (days <= 90) return '61-90';
    return '90+';
};

const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'];

const CHART_TOOLTIP_STYLE = {
    contentStyle: {
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        fontSize: '12px',
    },
    labelStyle: { color: '#e5e7eb' },
};

const FreightDashboard = () => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const weeksElapsed = Math.max(1, Math.ceil(
        (new Date() - new Date(currentYear, 0, 1)) / (7 * 86_400_000)
    ));
    const monthsElapsed = Math.max(1, currentMonth);

    const [loading, setLoading] = useState(true);
    const [blinkRevenue, setBlinkRevenue] = useState(0);
    const [bridgeRevenue, setBridgeRevenue] = useState(0);
    const [bigRevenue, setBigRevenue] = useState(0);
    const [monthlyData, setMonthlyData] = useState([]);
    const [agingData, setAgingData] = useState([]);

    useEffect(() => { fetchAllData(); }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchRevenue(), fetchAging()]);
        } finally {
            setLoading(false);
        }
    };

    const fetchRevenue = async () => {
        const yearStart = `${currentYear}-01-01`;
        const yearEnd = `${currentYear}-12-31`;

        const [blinkRes, bridgeRes, bigRes] = await Promise.all([
            supabase.from('blink_invoices')
                .select('invoice_date, total_amount')
                .gte('invoice_date', yearStart)
                .lte('invoice_date', yearEnd)
                .not('status', 'in', '("draft","cancelled")'),
            supabase.from('bridge_invoices')
                .select('invoice_date, total_amount')
                .gte('invoice_date', yearStart)
                .lte('invoice_date', yearEnd)
                .not('status', 'in', '("draft","cancelled")'),
            supabase.from('big_invoices')
                .select('invoice_date, total_amount')
                .gte('invoice_date', yearStart)
                .lte('invoice_date', yearEnd)
                .not('status', 'in', '("draft","cancelled")'),
        ]);

        const sumByMonth = (rows) => {
            const monthly = Array(12).fill(0);
            (rows || []).forEach(inv => {
                const month = new Date(inv.invoice_date).getMonth();
                monthly[month] += parseFloat(inv.total_amount || 0);
            });
            return monthly;
        };

        const bm = sumByMonth(blinkRes.data);
        const brm = sumByMonth(bridgeRes.data);
        const bgm = sumByMonth(bigRes.data);

        setBlinkRevenue(bm.reduce((a, b) => a + b, 0));
        setBridgeRevenue(brm.reduce((a, b) => a + b, 0));
        setBigRevenue(bgm.reduce((a, b) => a + b, 0));

        setMonthlyData(MONTHS_ID.map((month, i) => ({
            month,
            Blink: Math.round(bm[i]),
            Bridge: Math.round(brm[i]),
            Big: Math.round(bgm[i]),
            Total: Math.round(bm[i] + brm[i] + bgm[i]),
        })));
    };

    const fetchAging = async () => {
        const [blinkAR, bridgeAR, bigAR, blinkAP, bridgeAP, bigAP] = await Promise.all([
            supabase.from('blink_ar_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
            supabase.from('bridge_ar_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
            supabase.from('big_ar_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
            supabase.from('blink_ap_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
            supabase.from('bridge_ap_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
            supabase.from('big_ap_transactions').select('outstanding_amount, due_date').neq('status', 'paid'),
        ]);

        const buildRow = (label, type, data) => {
            const row = { label, type, total: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
            (data || []).forEach(item => {
                const amt = parseFloat(item.outstanding_amount || 0);
                const bucket = calcAgingBucket(item.due_date);
                row[bucket] += amt;
                row.total += amt;
            });
            return row;
        };

        setAgingData([
            buildRow('Blink AR', 'AR', blinkAR.data),
            buildRow('Bridge AR', 'AR', bridgeAR.data),
            buildRow('Big AR', 'AR', bigAR.data),
            buildRow('Blink AP', 'AP', blinkAP.data),
            buildRow('Bridge AP', 'AP', bridgeAP.data),
            buildRow('Big AP', 'AP', bigAP.data),
        ]);
    };

    const totalRevenue = blinkRevenue + bridgeRevenue + bigRevenue;
    const avgMonthly = totalRevenue / monthsElapsed;
    const avgWeekly = totalRevenue / weeksElapsed;
    const blinkPct = totalRevenue > 0 ? (blinkRevenue / totalRevenue) * 100 : 0;
    const bridgePct = totalRevenue > 0 ? (bridgeRevenue / totalRevenue) * 100 : 0;
    const bigPct = totalRevenue > 0 ? (bigRevenue / totalRevenue) * 100 : 0;

    const buildTotalRow = (type) => agingData
        .filter(r => r.type === type)
        .reduce(
            (acc, r) => {
                acc.total += r.total;
                AGING_BUCKETS.forEach(b => { acc[b] += r[b]; });
                return acc;
            },
            { label: `Total ${type}`, type, total: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
        );

    const allAgingRows = [
        ...agingData.slice(0, 3),
        buildTotalRow('AR'),
        ...agingData.slice(3),
        buildTotalRow('AP'),
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                <span className="ml-3 text-silver-dark">Memuat data dashboard...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">Dashboard Bakhtera-1</h1>
                </div>
                <button
                    onClick={fetchAllData}
                    className="flex items-center gap-2 px-4 py-2 glass-card rounded-lg text-silver-dark hover:text-silver-light smooth-transition text-sm"
                >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>
            </div>

            {/* ── Revenue Boxes ────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Box 1 – Total Revenue + breakdown */}
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <DollarSign className="w-5 h-5 text-emerald-400" />
                        </div>
                        <p className="text-xs text-silver-dark uppercase tracking-wide font-medium">
                            Total Revenue {currentYear}
                        </p>
                    </div>
                    <p className="text-3xl font-bold text-emerald-400 mb-5 mt-2">
                        {fmtIDR(totalRevenue)}
                    </p>
                    <div className="space-y-3 border-t border-white/10 pt-4">
                        {[
                            { label: 'Blink', value: blinkRevenue, color: 'text-blue-400', dot: 'bg-blue-400' },
                            { label: 'Bridge', value: bridgeRevenue, color: 'text-purple-400', dot: 'bg-purple-400' },
                            { label: 'Big', value: bigRevenue, color: 'text-orange-400', dot: 'bg-orange-400' },
                        ].map(({ label, value, color, dot }) => (
                            <div key={label} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
                                    <span className="text-sm text-silver-dark">{label}</span>
                                </div>
                                <span className={`text-sm font-semibold ${color}`}>{fmtIDR(value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Box 2 – Avg Revenue */}
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <Calendar className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-xs text-silver-dark uppercase tracking-wide font-medium">
                            Rata-rata Pendapatan
                        </p>
                    </div>
                    <div className="space-y-5">
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Per Bulan (rata-rata)</p>
                            <p className="text-2xl font-bold text-blue-400">{fmtIDR(avgMonthly)}</p>
                            <p className="text-xs text-silver-dark mt-1">{monthsElapsed} bulan berjalan</p>
                        </div>
                        <div className="border-t border-white/10 pt-4">
                            <p className="text-xs text-silver-dark mb-1">Per Minggu (rata-rata)</p>
                            <p className="text-2xl font-bold text-cyan-400">{fmtIDR(avgWeekly)}</p>
                            <p className="text-xs text-silver-dark mt-1">{weeksElapsed} minggu berjalan</p>
                        </div>
                    </div>
                </div>

                {/* Box 3 – Revenue Ratio */}
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <Percent className="w-5 h-5 text-amber-400" />
                        </div>
                        <p className="text-xs text-silver-dark uppercase tracking-wide font-medium">
                            Komposisi Revenue
                        </p>
                    </div>
                    <div className="space-y-4">
                        {[
                            { label: 'Blink', pct: blinkPct, bar: 'bg-blue-400', text: 'text-blue-400' },
                            { label: 'Bridge', pct: bridgePct, bar: 'bg-purple-400', text: 'text-purple-400' },
                            { label: 'Big', pct: bigPct, bar: 'bg-orange-400', text: 'text-orange-400' },
                        ].map(({ label, pct, bar, text }) => (
                            <div key={label}>
                                <div className="flex justify-between mb-1.5">
                                    <span className="text-sm text-silver-dark">{label}</span>
                                    <span className={`text-sm font-semibold ${text}`}>{pct.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${bar} smooth-transition`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Revenue Chart ────────────────────────────────────────────────── */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-6">
                    <TrendingUp className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-xl font-bold text-silver-light">
                        Grafik Revenue Tahun {currentYear}
                    </h2>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                            dataKey="month"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fill: '#9ca3af', fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v) =>
                                v >= 1e9 ? `${(v / 1e9).toFixed(1)}M`
                                    : v >= 1e6 ? `${(v / 1e6).toFixed(0)}jt`
                                        : v
                            }
                            width={55}
                        />
                        <Tooltip
                            {...CHART_TOOLTIP_STYLE}
                            formatter={(v, name) => [`Rp ${Number(v).toLocaleString('id-ID')}`, name]}
                        />
                        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                        <Line type="monotone" dataKey="Total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Blink" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Bridge" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: '#a78bfa' }} activeDot={{ r: 5 }} />
                        <Line type="monotone" dataKey="Big" stroke="#fb923c" strokeWidth={2} dot={{ r: 3, fill: '#fb923c' }} activeDot={{ r: 5 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* ── AR / AP Aging Table ──────────────────────────────────────────── */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-6">
                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                    <h2 className="text-xl font-bold text-silver-light">Aging AR / AP</h2>
                    <span className="text-xs text-silver-dark ml-1">(saldo outstanding belum lunas)</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="text-left py-2.5 px-3 text-silver-dark font-medium">Modul</th>
                                <th className="text-right py-2.5 px-3 text-silver-dark font-medium">Outstanding</th>
                                <th className="text-right py-2.5 px-3 text-green-400 font-medium">0–30 hr</th>
                                <th className="text-right py-2.5 px-3 text-yellow-400 font-medium">31–60 hr</th>
                                <th className="text-right py-2.5 px-3 text-orange-400 font-medium">61–90 hr</th>
                                <th className="text-right py-2.5 px-3 text-red-400 font-medium">90+ hr</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allAgingRows.map((row, i) => {
                                const isTotal = row.label.startsWith('Total');
                                const isAR = row.type === 'AR';
                                return (
                                    <tr
                                        key={i}
                                        className={`border-b border-white/5 ${
                                            isTotal
                                                ? 'bg-white/5 font-semibold'
                                                : 'hover:bg-white/5 smooth-transition'
                                        }`}
                                    >
                                        <td className="py-2.5 px-3">
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                                                        isAR
                                                            ? 'bg-blue-500/20 text-blue-400'
                                                            : 'bg-red-500/20 text-red-400'
                                                    }`}
                                                >
                                                    {row.type}
                                                </span>
                                                <span className={isTotal ? 'text-silver-light' : 'text-silver'}>
                                                    {row.label}
                                                </span>
                                            </span>
                                        </td>
                                        <td className="text-right py-2.5 px-3 text-silver-light">
                                            {fmtIDR(row.total)}
                                        </td>
                                        <td className="text-right py-2.5 px-3 text-green-400">
                                            {row['0-30'] > 0 ? fmtIDR(row['0-30']) : '–'}
                                        </td>
                                        <td className="text-right py-2.5 px-3 text-yellow-400">
                                            {row['31-60'] > 0 ? fmtIDR(row['31-60']) : '–'}
                                        </td>
                                        <td className="text-right py-2.5 px-3 text-orange-400">
                                            {row['61-90'] > 0 ? fmtIDR(row['61-90']) : '–'}
                                        </td>
                                        <td className="text-right py-2.5 px-3 text-red-400">
                                            {row['90+'] > 0 ? fmtIDR(row['90+']) : '–'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default FreightDashboard;
