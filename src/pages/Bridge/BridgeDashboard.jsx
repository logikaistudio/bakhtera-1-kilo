import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, AlertTriangle, FileText, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useData } from '../../context/DataContext';
import StatCard from '../../components/Common/StatCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const BridgeDashboard = () => {
    const { inboundTransactions = [], outboundTransactions = [], rejectTransactions = [], quotations = [], invoices = [] } = useData();

    // Calculate totals
    const totalInbound = inboundTransactions.length;
    const totalOutbound = outboundTransactions.length;
    const totalReject = rejectTransactions.length;

    // Filter quotations by status
    const pendingDocs = quotations.filter(q => q.status === 'pending' || q.status === 'draft');
    const approvedDocs = quotations.filter(q => q.status === 'approved');
    const rejectedDocs = quotations.filter(q => q.status === 'rejected');

    // Prepare daily revenue data from invoices
    const dailyRevenueData = () => {
        const revenueMap = {};

        invoices.forEach(invoice => {
            const date = new Date(invoice.date || invoice.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            if (!revenueMap[date]) {
                revenueMap[date] = 0;
            }
            revenueMap[date] += invoice.grandTotal || 0;
        });

        return Object.keys(revenueMap).map(date => ({
            date,
            revenue: revenueMap[date]
        })).slice(-14); // Last 14 days
    };

    // Prepare monthly revenue data
    const monthlyRevenueData = () => {
        const revenueMap = {};

        invoices.forEach(invoice => {
            const month = new Date(invoice.date || invoice.createdAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
            if (!revenueMap[month]) {
                revenueMap[month] = 0;
            }
            revenueMap[month] += invoice.grandTotal || 0;
        });

        return Object.keys(revenueMap).map(month => ({
            month,
            revenue: revenueMap[month]
        })).slice(-6); // Last 6 months
    };

    // Format IDR for Y-axis
    const formatIDR = (value) => {
        if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}M`;
        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}jt`;
        if (value >= 1000) return `${(value / 1000).toFixed(0)}rb`;
        return value;
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-card p-3 rounded-lg border border-accent-blue">
                    <p className="text-silver-light text-sm font-medium">
                        {payload[0].payload.date || payload[0].payload.month}
                    </p>
                    <p className="text-accent-blue text-lg font-bold">
                        Rp {payload[0].value.toLocaleString('id-ID')}
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Dashboard BRIDGE TPPB</h1>
                <p className="text-silver-dark mt-1">Bounded Management - Monitoring Transaksi & Status Dokumen TPPB</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                    title="Total Barang Masuk"
                    value={totalInbound}
                    icon={ArrowDownCircle}
                    iconColor="text-accent-blue"
                    borderColor="border-accent-blue"
                />
                <StatCard
                    title="Total Barang Keluar"
                    value={totalOutbound}
                    icon={ArrowUpCircle}
                    iconColor="text-accent-orange"
                    borderColor="border-accent-orange"
                />
                <StatCard
                    title="Total Barang Reject"
                    value={totalReject}
                    icon={AlertTriangle}
                    iconColor="text-red-500"
                    borderColor="border-red-500"
                />
            </div>

            {/* Revenue Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Revenue Chart */}
                <div className="glass-card rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-dark-border">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-accent-blue" />
                            <h2 className="text-lg font-semibold text-silver-light">Pendapatan Harian</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={dailyRevenueData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#94a3b8"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tickFormatter={formatIDR}
                                    style={{ fontSize: '12px' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    dot={{ fill: '#3b82f6', r: 4 }}
                                    activeDot={{ r: 6 }}
                                    name="Pendapatan (IDR)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monthly Revenue Chart */}
                <div className="glass-card rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-dark-border">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-accent-green" />
                            <h2 className="text-lg font-semibold text-silver-light">Pendapatan Bulanan</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={monthlyRevenueData()}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                                <XAxis
                                    dataKey="month"
                                    stroke="#94a3b8"
                                    style={{ fontSize: '12px' }}
                                />
                                <YAxis
                                    stroke="#94a3b8"
                                    tickFormatter={formatIDR}
                                    style={{ fontSize: '12px' }}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ color: '#94a3b8' }} />
                                <Line
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#10b981"
                                    strokeWidth={3}
                                    dot={{ fill: '#10b981', r: 4 }}
                                    activeDot={{ r: 6 }}
                                    name="Pendapatan (IDR)"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>



            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center gap-3">
                        <Clock className="w-10 h-10 text-yellow-400" />
                        <div>
                            <p className="text-xs text-silver-dark">Pending</p>
                            <p className="text-2xl font-bold text-yellow-400">{pendingDocs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-accent-green/30">
                    <div className="flex items-center gap-3">
                        <CheckCircle className="w-10 h-10 text-accent-green" />
                        <div>
                            <p className="text-xs text-silver-dark">Approved</p>
                            <p className="text-2xl font-bold text-accent-green">{approvedDocs.length}</p>
                        </div>
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg border border-red-500/30">
                    <div className="flex items-center gap-3">
                        <XCircle className="w-10 h-10 text-red-400" />
                        <div>
                            <p className="text-xs text-silver-dark">Rejected</p>
                            <p className="text-2xl font-bold text-red-400">{rejectedDocs.length}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BridgeDashboard;
