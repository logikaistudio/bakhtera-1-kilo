import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    DollarSign, TrendingUp, TrendingDown, AlertTriangle,
    Download, Calendar, FileText, Users, Package, X, ExternalLink, Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BridgeFinanceReports = () => {
    const [invoices, setInvoices] = useState([]);
    const [pos, setPOs] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    // Drill-down modal state
    const [showDrillDown, setShowDrillDown] = useState(false);
    const [drillDownData, setDrillDownData] = useState({ type: '', bucket: '', items: [] });
    // Forecast Data
    const [forecastData, setForecastData] = useState([]);
    const [forecastSummary, setForecastSummary] = useState({ projectedInflow: 0, projectedOutflow: 0, netForecast: 0 });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Bridge invoices
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('bridge_invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (invoiceError) throw invoiceError;

            // Fetch Bridge POs
            const { data: poData, error: poError } = await supabase
                .from('bridge_pos')
                .select('*')
                .order('created_at', { ascending: false });

            if (poError) throw poError;

            // Fetch Bridge payments for trend analysis
            const { data: paymentData, error: paymentError } = await supabase
                .from('bridge_payments')
                .select('*')
                .order('payment_date', { ascending: false });

            if (paymentError) throw paymentError;

            setInvoices(invoiceData || []);
            setPOs(poData || []);
            setPayments(paymentData || []);

            // Process Forecast Data
            processForecastData(invoiceData || [], poData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Failed to load data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const processForecastData = (invData, poData) => {
        // Forecast for next 4 weeks
        const weeks = [];
        const today = new Date();
        const currentSummary = { projectedInflow: 0, projectedOutflow: 0, netForecast: 0 };

        for (let i = 0; i < 4; i++) {
            const start = new Date(today);
            start.setDate(today.getDate() + (i * 7));
            const end = new Date(start);
            end.setDate(start.getDate() + 6);

            weeks.push({
                name: `Week ${ i + 1 } `,
                startDate: start,
                endDate: end,
                inflow: 0,
                outflow: 0,
                label: `${ start.getDate() } /${start.getMonth()+1} - ${end.getDate()}/${ end.getMonth() + 1 } `
            });
        }

        // Process Inflows (Unpaid Invoices)
        invData.forEach(inv => {
            if (inv.status === 'paid' || inv.status === 'cancelled' || !inv.due_date) return;

            const dueDate = new Date(inv.due_date);
            const amount = inv.outstanding_amount || inv.grand_total || 0;

            // Find matching week bucket
            const weekBucket = weeks.find(w => dueDate >= w.startDate && dueDate <= w.endDate);
            if (weekBucket) {
                weekBucket.inflow += amount;
                currentSummary.projectedInflow += amount;
            } else if (dueDate < today) {
                // If overdue, add to Week 1 as "Immediate Collection"
                weeks[0].inflow += amount;
                currentSummary.projectedInflow += amount;
            }
        });

        // Process Outflows (Outstanding POs)
        poData.forEach(po => {
            if (po.status === 'paid' || po.status === 'cancelled' || !po.po_date) return;

            // Assume Payment Due Date = PO Date + Term (approx 30 days if term missing)
            let dueDate = new Date(po.po_date);
            if (po.payment_terms) {
                const days = parseInt(po.payment_terms.match(/\d+/) || [30]);
                dueDate.setDate(dueDate.getDate() + days);
            } else {
                dueDate.setDate(dueDate.getDate() + 30);
            }

            const amount = po.outstanding_amount || po.grand_total || 0;

            const weekBucket = weeks.find(w => dueDate >= w.startDate && dueDate <= w.endDate);
            if (weekBucket) {
                weekBucket.outflow += amount;
                currentSummary.projectedOutflow += amount;
            } else if (dueDate < today) {
                weeks[0].outflow += amount;
                currentSummary.projectedOutflow += amount;
            }
        });

        currentSummary.netForecast = currentSummary.projectedInflow - currentSummary.projectedOutflow;
        setForecastData(weeks);
        setForecastSummary(currentSummary);
    };

    const formatCurrency = (value, currency = 'IDR') => {
        if (currency === 'USD') {
            return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2 });
        }
        return 'Rp ' + value.toLocaleString('id-ID');
    };

    // Calculate summary metrics
    const totalRevenue = invoices
        .filter(inv => inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

    const totalExpenses = pos
        .filter(po => po.status !== 'cancelled')
        .reduce((sum, po) => sum + (po.grand_total || 0), 0);

    const outstandingAR = invoices
        .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
        .reduce((sum, inv) => sum + ((inv.grand_total || 0) - (inv.paid_amount || 0)), 0);

    const outstandingAP = pos
        .filter(po => po.status === 'approved')
        .reduce((sum, po) => sum + ((po.grand_total || 0) - (po.paid_amount || 0)), 0);

    const profitMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0;

    // Prepare chart data
    const revenueByMonth = invoices.reduce((acc, inv) => {
        if (inv.status === 'cancelled') return acc;
        const month = new Date(inv.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + (inv.grand_total || 0);
        return acc;
    }, {});

    const expenseByMonth = pos.reduce((acc, po) => {
        if (po.status === 'cancelled') return acc;
        const month = new Date(po.po_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + (po.grand_total || 0);
        return acc;
    }, {});

    const chartData = Object.keys({ ...revenueByMonth, ...expenseByMonth }).map(month => ({
        month,
        revenue: revenueByMonth[month] || 0,
        expenses: expenseByMonth[month] || 0,
        profit: (revenueByMonth[month] || 0) - (expenseByMonth[month] || 0)
    }));

    // Pie chart data for AR/AP status
    const arStatusData = [
        { name: 'Paid', value: totalRevenue - outstandingAR, color: '#22c55e' },
        { name: 'Outstanding', value: outstandingAR, color: '#f59e0b' }
    ].filter(item => item.value > 0);

    const apStatusData = [
        { name: 'Paid', value: totalExpenses - outstandingAP, color: '#22c55e' },
        { name: 'Outstanding', value: outstandingAP, color: '#ef4444' }
    ].filter(item => item.value > 0);

    const handleDrillDown = (type, bucket) => {
        let items = [];
        if (type === 'revenue') {
            items = invoices.filter(inv => {
                const month = new Date(inv.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return month === bucket && inv.status !== 'cancelled';
            });
        } else if (type === 'expenses') {
            items = pos.filter(po => {
                const month = new Date(po.po_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return month === bucket && po.status !== 'cancelled';
            });
        }

        setDrillDownData({ type, bucket, items });
        setShowDrillDown(true);
    };

    const exportReport = () => {
        const csvContent = [
            ['Bridge Finance Report', '', '', ''],
            ['Period', `${dateRange.start} to ${dateRange.end}`, '', ''],
            ['', '', '', ''],
            ['Summary Metrics', '', '', ''],
            ['Total Revenue', formatCurrency(totalRevenue), '', ''],
            ['Total Expenses', formatCurrency(totalExpenses), '', ''],
            ['Net Profit', formatCurrency(totalRevenue - totalExpenses), '', ''],
            ['Profit Margin', `${profitMargin.toFixed(2)}%`, '', ''],
            ['Outstanding AR', formatCurrency(outstandingAR), '', ''],
            ['Outstanding AP', formatCurrency(outstandingAP), '', ''],
            ['', '', '', ''],
            ['Monthly Breakdown', '', '', ''],
            ['Month', 'Revenue', 'Expenses', 'Profit']
        ];

        chartData.forEach(row => {
            csvContent.push([
                row.month,
                formatCurrency(row.revenue),
                formatCurrency(row.expenses),
                formatCurrency(row.profit)
            ]);
        });

        const csvString = csvContent.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bridge_finance_report_${dateRange.start}_to_${dateRange.end}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-500" />
                        Bridge Finance Reports
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Comprehensive financial overview for Bridge module
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportReport} variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Date Range Filter */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            End Date
                        </label>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalRevenue)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Expenses</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalExpenses)}</p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Outstanding AR</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(outstandingAR)}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Outstanding AP</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(outstandingAP)}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue vs Expenses Chart */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue vs Expenses Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis tickFormatter={(value) => formatCurrency(value)} />
                            <Tooltip formatter={(value) => formatCurrency(value)} />
                            <Legend />
                            <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* AR/AP Status */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">AR/AP Status</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accounts Receivable</h4>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie
                                        data={arStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={60}
                                        dataKey="value"
                                    >
                                        {arStatusData.map((entry, index) => (
                                            <Cell key={`ar-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-2">
                                {arStatusData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{entry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Accounts Payable</h4>
                            <ResponsiveContainer width="100%" height={150}>
                                <PieChart>
                                    <Pie
                                        data={apStatusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={30}
                                        outerRadius={60}
                                        dataKey="value"
                                    >
                                        {apStatusData.map((entry, index) => (
                                            <Cell key={`ap-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => formatCurrency(value)} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-2">
                                {apStatusData.map((entry, index) => (
                                    <div key={index} className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">{entry.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cash Flow Forecast */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Cash Flow Forecast</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-600 dark:text-green-400">Projected Inflow</p>
                        <p className="text-xl font-bold text-green-700 dark:text-green-300">{formatCurrency(forecastSummary.projectedInflow)}</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400">Projected Outflow</p>
                        <p className="text-xl font-bold text-red-700 dark:text-red-300">{formatCurrency(forecastSummary.projectedOutflow)}</p>
                    </div>
                    <div className={`text-center p-4 rounded-lg ${forecastSummary.netForecast >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                        <p className={`text-sm ${forecastSummary.netForecast >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>Net Forecast</p>
                        <p className={`text-xl font-bold ${forecastSummary.netForecast >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>{formatCurrency(forecastSummary.netForecast)}</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Week</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Period</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Inflow</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outflow</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Net</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {forecastData.map((week, index) => (
                                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{week.name}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{week.label}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-green-600 dark:text-green-400">{formatCurrency(week.inflow)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600 dark:text-red-400">{formatCurrency(week.outflow)}</td>
                                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${week.inflow - week.outflow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {formatCurrency(week.inflow - week.outflow)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Drill Down Modal */}
            {showDrillDown && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                {drillDownData.type === 'revenue' ? 'Revenue' : 'Expense'} Details - {drillDownData.bucket}
                            </h2>
                            <button
                                onClick={() => setShowDrillDown(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                    <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                {drillDownData.type === 'revenue' ? 'Invoice #' : 'PO #'}
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                {drillDownData.type === 'revenue' ? 'Customer' : 'Vendor'}
                                            </th>
                                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                                Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {drillDownData.items.map((item, index) => (
                                            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                    {item.invoice_number || item.po_number}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(item.date || item.po_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                                    {item.customer_name || item.vendor_name || '-'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 dark:text-white">
                                                    {formatCurrency(item.grand_total)}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-center">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        item.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                        item.status === 'sent' || item.status === 'approved' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                                                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
                            <Button onClick={() => setShowDrillDown(false)}>
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BridgeFinanceReports;