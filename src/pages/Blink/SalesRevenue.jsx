import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    DollarSign,
    TrendingUp,
    FileText,
    CheckCircle,
    Calendar,
    BarChart3
} from 'lucide-react';

const SalesRevenue = () => {
    const [revenueData, setRevenueData] = useState({
        totalRevenue: 0,
        regularRevenue: 0,
        operationRevenue: 0,
        totalQuotations: 0,
        totalSO: 0,
        conversionRate: 0,
        monthlyRevenue: 0,
        yearlyRevenue: 0
    });

    const [monthlyTrend, setMonthlyTrend] = useState([]);
    const [salesTypeDistribution, setSalesTypeDistribution] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);

    useEffect(() => {
        fetchRevenueData();
    }, []);

    const fetchRevenueData = async () => {
        try {
            // Fetch quotations
            const { data: quotations, error: quotError } = await supabase
                .from('blink_quotations')
                .select('*');

            if (quotError) throw quotError;

            // Fetch shipments
            const { data: shipments, error: shipError } = await supabase
                .from('blink_shipments')
                .select('*');

            if (shipError) throw shipError;

            // Filter paid shipments
            const paidShipments = shipments?.filter(s =>
                s.status === 'delivered' || s.status === 'completed'
            ) || [];

            // Calculate revenues
            const regularShipments = paidShipments.filter(s => s.quotation_type === 'RG');
            const operationShipments = paidShipments.filter(s => s.quotation_type === 'OP');

            const convertToIDR = (amount, currency) => {
                return currency === 'USD' ? amount * 15000 : amount;
            };

            const regularRevenue = regularShipments.reduce((sum, s) =>
                sum + convertToIDR(s.quoted_amount || 0, s.currency), 0
            );

            const operationRevenue = operationShipments.reduce((sum, s) =>
                sum + convertToIDR(s.quoted_amount || 0, s.currency), 0
            );

            const totalRevenue = regularRevenue + operationRevenue;

            // Calculate monthly and yearly revenue
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth();
            const currentYear = currentDate.getFullYear();

            const monthlyShipments = paidShipments.filter(s => {
                const shipmentDate = new Date(s.updated_at);
                return shipmentDate.getMonth() === currentMonth &&
                    shipmentDate.getFullYear() === currentYear;
            });

            const yearlyShipments = paidShipments.filter(s => {
                const shipmentDate = new Date(s.updated_at);
                return shipmentDate.getFullYear() === currentYear;
            });

            const monthlyRevenue = monthlyShipments.reduce((sum, s) =>
                sum + convertToIDR(s.quoted_amount || 0, s.currency), 0
            );

            const yearlyRevenue = yearlyShipments.reduce((sum, s) =>
                sum + convertToIDR(s.quoted_amount || 0, s.currency), 0
            );

            // Calculate conversion rate
            const totalQuotations = quotations?.length || 0;
            const totalSO = shipments?.length || 0;
            const conversionRate = totalQuotations > 0 ? (totalSO / totalQuotations) * 100 : 0;

            setRevenueData({
                totalRevenue,
                regularRevenue,
                operationRevenue,
                totalQuotations,
                totalSO,
                conversionRate,
                monthlyRevenue,
                yearlyRevenue
            });

            // Calculate monthly trend (12 months - full year)
            const monthlyData = [];
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

            for (let month = 0; month < 12; month++) {
                const monthShipments = paidShipments.filter(s => {
                    const shipmentDate = new Date(s.updated_at);
                    return shipmentDate.getMonth() === month &&
                        shipmentDate.getFullYear() === currentYear;
                });

                const monthRevenue = monthShipments.reduce((sum, s) =>
                    sum + convertToIDR(s.quoted_amount || 0, s.currency), 0
                );

                monthlyData.push({
                    month: monthNames[month],
                    revenue: monthRevenue
                });
            }
            setMonthlyTrend(monthlyData);

            // Sales type distribution - Regular and Project only
            setSalesTypeDistribution([
                { name: 'Regular Sales', value: regularRevenue, color: '#3b82f6' },
                { name: 'Project Sales', value: operationRevenue, color: '#f59e0b' }
            ]);

            // Top customers by revenue
            const customerMap = new Map();
            paidShipments.forEach(s => {
                const customer = s.customer_name || s.customer || 'Unknown';
                const revenue = convertToIDR(s.quoted_amount || 0, s.currency);

                if (customerMap.has(customer)) {
                    customerMap.set(customer, customerMap.get(customer) + revenue);
                } else {
                    customerMap.set(customer, revenue);
                }
            });

            const topCustomersArray = Array.from(customerMap.entries())
                .map(([name, revenue]) => ({ name, revenue }))
                .filter(c => c.name !== 'Unknown')
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);

            setTopCustomers(topCustomersArray);

        } catch (error) {
            console.error('Error fetching revenue data:', error);
        }
    };

    const formatCurrency = (value) => {
        return `Rp ${value.toLocaleString('id-ID')}`;
    };

    const COLORS = ['#3b82f6', '#f59e0b'];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold gradient-text">Sales & Revenue</h1>
                <p className="text-silver-dark mt-1">Analisa revenue dari Regular Sales & Operation Sales</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Total Revenue</p>
                        <DollarSign className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(revenueData.totalRevenue)}</p>
                    <p className="text-xs text-silver-dark mt-1">All time</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Revenue Bulan Ini</p>
                        <Calendar className="w-5 h-5 text-blue-400" />
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(revenueData.monthlyRevenue)}</p>
                    <p className="text-xs text-silver-dark mt-1">{new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Revenue Tahun Ini</p>
                        <TrendingUp className="w-5 h-5 text-purple-400" />
                    </div>
                    <p className="text-2xl font-bold text-purple-400">{formatCurrency(revenueData.yearlyRevenue)}</p>
                    <p className="text-xs text-silver-dark mt-1">{new Date().getFullYear()}</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Conversion Rate</p>
                        <CheckCircle className="w-5 h-5 text-orange-400" />
                    </div>
                    <p className="text-2xl font-bold text-orange-400">{revenueData.conversionRate.toFixed(1)}%</p>
                    <p className="text-xs text-silver-dark mt-1">{revenueData.totalSO} SO dari {revenueData.totalQuotations} quotations</p>
                </div>
            </div>

            {/* Sales Type Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-lg md:col-span-1">
                    <h3 className="text-lg font-semibold text-silver-light mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-accent-orange" />
                        Revenue by Sales Type
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Regular Sales Donut */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-32 h-32">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                    <defs>
                                        <linearGradient id="gradientRegularOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" />
                                            <stop offset="100%" stopColor="#06b6d4" />
                                        </linearGradient>
                                        <linearGradient id="gradientRegularInner" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#60a5fa" />
                                            <stop offset="100%" stopColor="#22d3ee" />
                                        </linearGradient>
                                    </defs>

                                    {/* Background circles - transparent */}
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="transparent" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="28" fill="none" stroke="transparent" strokeWidth="6" />

                                    {/* Outer ring - Total SO Revenue */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="url(#gradientRegularOuter)"
                                        strokeWidth="8"
                                        strokeDasharray={`${(revenueData.regularRevenue / revenueData.totalRevenue) * 251.2} 251.2`}
                                        strokeLinecap="round"
                                    />

                                    {/* Inner ring - Paid Revenue */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="28"
                                        fill="none"
                                        stroke="url(#gradientRegularInner)"
                                        strokeWidth="6"
                                        strokeDasharray={`${(revenueData.regularRevenue / revenueData.totalRevenue) * 175.9} 175.9`}
                                        strokeLinecap="round"
                                        opacity="0.8"
                                    />
                                </svg>

                                {/* Center value */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold text-blue-400">
                                        {revenueData.totalRevenue > 0 ? ((revenueData.regularRevenue / revenueData.totalRevenue) * 100).toFixed(0) : 0}%
                                    </span>
                                    <span className="text-xs text-silver-dark">RG</span>
                                </div>
                            </div>

                            <div className="mt-3 text-center">
                                <p className="text-sm font-medium text-silver-light">Regular Sales</p>
                                <p className="text-xs text-blue-400 font-semibold">{formatCurrency(revenueData.regularRevenue)}</p>
                            </div>
                        </div>

                        {/* Operation Sales Donut */}
                        <div className="flex flex-col items-center">
                            <div className="relative w-32 h-32">
                                <svg viewBox="0 0 100 100" className="transform -rotate-90">
                                    <defs>
                                        <linearGradient id="gradientOperationOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#f97316" />
                                            <stop offset="100%" stopColor="#f59e0b" />
                                        </linearGradient>
                                        <linearGradient id="gradientOperationInner" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor="#fb923c" />
                                            <stop offset="100%" stopColor="#fbbf24" />
                                        </linearGradient>
                                    </defs>

                                    {/* Background circles - transparent */}
                                    <circle cx="50" cy="50" r="40" fill="none" stroke="transparent" strokeWidth="8" />
                                    <circle cx="50" cy="50" r="28" fill="none" stroke="transparent" strokeWidth="6" />

                                    {/* Outer ring - Total SO Revenue */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="40"
                                        fill="none"
                                        stroke="url(#gradientOperationOuter)"
                                        strokeWidth="8"
                                        strokeDasharray={`${(revenueData.operationRevenue / revenueData.totalRevenue) * 251.2} 251.2`}
                                        strokeLinecap="round"
                                    />

                                    {/* Inner ring - Paid Revenue */}
                                    <circle
                                        cx="50"
                                        cy="50"
                                        r="28"
                                        fill="none"
                                        stroke="url(#gradientOperationInner)"
                                        strokeWidth="6"
                                        strokeDasharray={`${(revenueData.operationRevenue / revenueData.totalRevenue) * 175.9} 175.9`}
                                        strokeLinecap="round"
                                        opacity="0.8"
                                    />
                                </svg>

                                {/* Center value */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-xl font-bold text-orange-400">
                                        {revenueData.totalRevenue > 0 ? ((revenueData.operationRevenue / revenueData.totalRevenue) * 100).toFixed(0) : 0}%
                                    </span>
                                    <span className="text-xs text-silver-dark">OP</span>
                                </div>
                            </div>

                            <div className="mt-3 text-center">
                                <p className="text-sm font-medium text-silver-light">Operation Sales</p>
                                <p className="text-xs text-orange-400 font-semibold">{formatCurrency(revenueData.operationRevenue)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Monthly Trend */}
                <div className="glass-card p-6 rounded-lg md:col-span-2">
                    <h3 className="text-lg font-semibold text-silver-light mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-accent-orange" />
                        Monthly Revenue Trend
                    </h3>
                    <div className="relative h-64">
                        {monthlyTrend.length > 0 && (() => {
                            const maxRevenue = Math.max(...monthlyTrend.map(m => m.revenue), 1);
                            const width = 800; // Fixed pixel width
                            const height = 200; // Fixed pixel height
                            const padding = 20;

                            // Calculate points
                            const points = monthlyTrend.map((month, index) => {
                                const x = padding + (index / (monthlyTrend.length - 1)) * (width - 2 * padding);
                                const y = height - padding - ((month.revenue / maxRevenue) * (height - 2 * padding));
                                return { x, y, revenue: month.revenue };
                            });

                            // Create smooth curve path using quadratic bezier
                            const createSmoothPath = (points) => {
                                if (points.length === 0) return '';

                                let path = `M ${points[0].x} ${points[0].y}`;

                                for (let i = 0; i < points.length - 1; i++) {
                                    const current = points[i];
                                    const next = points[i + 1];
                                    const controlX = (current.x + next.x) / 2;
                                    const controlY = (current.y + next.y) / 2;

                                    path += ` Q ${current.x} ${current.y}, ${controlX} ${controlY}`;

                                    if (i === points.length - 2) {
                                        path += ` Q ${next.x} ${next.y}, ${next.x} ${next.y}`;
                                    }
                                }

                                return path;
                            };

                            // Create area path (line + bottom)
                            const linePath = createSmoothPath(points);
                            const areaPath = linePath +
                                ` L ${points[points.length - 1].x} ${height - padding}` +
                                ` L ${points[0].x} ${height - padding} Z`;

                            return (
                                <svg
                                    viewBox={`0 0 ${width} ${height}`}
                                    className="w-full h-full"
                                    preserveAspectRatio="xMidYMid meet"
                                >
                                    <defs>
                                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.05" />
                                        </linearGradient>
                                    </defs>

                                    {/* Gradient area fill */}
                                    <path
                                        d={areaPath}
                                        fill="url(#areaGradient)"
                                    />

                                    {/* Line stroke */}
                                    <path
                                        d={linePath}
                                        fill="none"
                                        stroke="#10b981"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    {/* Data points - circular */}
                                    {points.map((point, index) => (
                                        <circle
                                            key={index}
                                            cx={point.x}
                                            cy={point.y}
                                            r="4"
                                            fill="white"
                                            stroke="#10b981"
                                            strokeWidth="2"
                                        />
                                    ))}
                                </svg>
                            );
                        })()}

                        {/* X-axis labels */}
                        <div className="flex justify-between mt-2 px-2">
                            {monthlyTrend.map((month, index) => (
                                <div key={index} className="text-xs text-silver-dark text-center" style={{ width: `${100 / monthlyTrend.length}%` }}>
                                    {month.month}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Customers */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-silver-light flex items-center gap-2">
                        <FileText className="w-5 h-5 text-accent-orange" />
                        Top 5 Customers by Revenue
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">Rank</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-silver uppercase">Customer</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-silver uppercase">Total Revenue</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-silver uppercase">Contribution</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {topCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-silver-dark">
                                        Belum ada data customer
                                    </td>
                                </tr>
                            ) : (
                                topCustomers.map((customer, index) => {
                                    const contribution = revenueData.totalRevenue > 0
                                        ? (customer.revenue / revenueData.totalRevenue) * 100
                                        : 0;

                                    return (
                                        <tr key={index} className="hover:bg-dark-surface/30">
                                            <td className="px-6 py-4">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    index === 1 ? 'bg-gray-400/20 text-gray-300' :
                                                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                                                            'bg-blue-500/20 text-blue-400'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-silver-light">
                                                {customer.name}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-right font-bold text-green-400">
                                                {formatCurrency(customer.revenue)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-semibold">
                                                    {contribution.toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesRevenue;
