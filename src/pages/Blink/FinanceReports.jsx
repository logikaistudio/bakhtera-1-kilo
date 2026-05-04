import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    DollarSign, TrendingUp, TrendingDown, AlertTriangle,
    Download, Calendar, FileText, Users, Package, X, ExternalLink, Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const FinanceReports = () => {
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

            // Fetch invoices
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('blink_invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (invoiceError) throw invoiceError;

            // Fetch POs
            const { data: poData, error: poError } = await supabase
                .from('blink_pos')
                .select('*')
                .order('created_at', { ascending: false });

            if (poError) throw poError;

            // Fetch payments for trend analysis
            const { data: paymentData, error: paymentError } = await supabase
                .from('blink_payments')
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

        // Process Inflows (Unpaid and Partially Paid Invoices)
        invData.forEach(inv => {
            if (inv.status === 'paid' || inv.status === 'cancelled' || !inv.due_date) return;
            if (inv.status === 'partially_paid' && (inv.outstanding_amount || 0) <= 0) return;
            
            const dueDate = new Date(inv.due_date);
            const amount = inv.outstanding_amount || inv.total || 0;

            // Find matching week bucket
            const weekBucket = weeks.find(w => dueDate >= w.startDate && dueDate <= w.endDate);
            if (weekBucket) {
                weekBucket.inflow += amount;
                currentSummary.projectedInflow += amount;
            } else if (dueDate < today) {
                // If overdue, maybe add to Week 1 or separate bucket? For now add to Week 1 as "Immediate Collection"
                weeks[0].inflow += amount;
                currentSummary.projectedInflow += amount;
            }
        });

        // Process Outflows (Outstanding and Partially Paid POs)
        poData.forEach(po => {
            if (po.status === 'received' || po.status === 'cancelled' || !po.delivery_date) return;
            if (po.status === 'paid' && (po.outstanding_amount || 0) <= 0) return;
            if (po.status === 'partially_paid' && (po.outstanding_amount || 0) <= 0) return;
            
            // Assume Payment Due Date = Delivery Date + Term (approx 30 days if term missing)
            let dueDate = new Date(po.delivery_date);
            if (po.payment_terms) {
                const days = parseInt(po.payment_terms.match(/\d+/) || [30]);
                dueDate.setDate(dueDate.getDate() + days);
            } else {
                dueDate.setDate(dueDate.getDate() + 30);
            }

            const amount = po.outstanding_amount || po.total_amount || 0;

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
            return '$' + value.toLocaleString('id-ID');
        }
        return 'Rp ' + value.toLocaleString('id-ID');
    };

    // Calculate AR Outstanding - include unpaid and partially paid
    const totalAROutstanding = invoices
        .filter(inv => 
            inv.status !== 'cancelled' && 
            inv.status !== 'paid' &&
            inv.status !== 'partially_paid'
        )
        .reduce((sum, inv) => sum + (inv.outstanding_amount || inv.total_amount || 0), 0);

    // Calculate AP Outstanding - include unpaid and partially paid
    const totalAPOutstanding = pos
        .filter(po => 
            po.status !== 'cancelled' && 
            po.status !== 'received' &&
            po.status !== 'paid'
        )
        .reduce((sum, po) => sum + (po.outstanding_amount || po.total_amount || 0), 0);

    // Net Position
    const netPosition = totalAROutstanding - totalAPOutstanding;

    // Overdue counts - include overdue unpaid and partially paid
    const overdueInvoices = invoices.filter(inv => {
        if (!inv.due_date || inv.status === 'paid' || inv.status === 'cancelled' || inv.status === 'partially_paid') return false;
        return new Date(inv.due_date) < new Date();
    }).length;

    const overduePOs = pos.filter(po => {
        if (!po.delivery_date || po.status === 'received' || po.status === 'cancelled' || po.status === 'paid') return false;
        const dueDate = new Date(po.delivery_date);
        if (po.payment_terms) {
            const days = parseInt(po.payment_terms.match(/\d+/) || [30]);
            dueDate.setDate(dueDate.getDate() + days);
        }
        return dueDate < new Date();
    }).length;

    // AR Aging calculation - include partially paid
    const calculateARAging = () => {
        const today = new Date();
        const aging = {
            current: { count: 0, amount: 0, invoices: [] },
            '1-30': { count: 0, amount: 0, invoices: [] },
            '31-60': { count: 0, amount: 0, invoices: [] },
            '61-90': { count: 0, amount: 0, invoices: [] },
            '90+': { count: 0, amount: 0, invoices: [] }
        };

        invoices.forEach(inv => {
            if (inv.status === 'cancelled' || inv.status === 'paid' || !inv.due_date) return;
            if (inv.status === 'partially_paid' && (inv.outstanding_amount || 0) <= 0) return;

            const dueDate = new Date(inv.due_date);
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            const outstanding = inv.outstanding_amount || 0;

            if (daysOverdue < 0) {
                aging.current.count++;
                aging.current.amount += outstanding;
                aging.current.invoices.push(inv);
            } else if (daysOverdue <= 30) {
                aging['1-30'].count++;
                aging['1-30'].amount += outstanding;
                aging['1-30'].invoices.push(inv);
            } else if (daysOverdue <= 60) {
                aging['31-60'].count++;
                aging['31-60'].amount += outstanding;
                aging['31-60'].invoices.push(inv);
            } else if (daysOverdue <= 90) {
                aging['61-90'].count++;
                aging['61-90'].amount += outstanding;
                aging['61-90'].invoices.push(inv);
            } else {
                aging['90+'].count++;
                aging['90+'].amount += outstanding;
                aging['90+'].invoices.push(inv);
            }
        });

        return aging;
    };

    // AP Aging calculation
    const calculateAPAging = () => {
        const today = new Date();
        const aging = {
            current: { count: 0, amount: 0, pos: [] },
            '1-30': { count: 0, amount: 0, pos: [] },
            '31-60': { count: 0, amount: 0, pos: [] },
            '61-90': { count: 0, amount: 0, pos: [] },
            '90+': { count: 0, amount: 0, pos: [] }
        };

        pos.forEach(po => {
            if (po.status === 'cancelled' || po.status === 'received' || !po.delivery_date) return;
            if (po.status === 'paid' && (po.outstanding_amount || 0) <= 0) return;
            // Handle partially paid - check if there's still outstanding
            if (po.status === 'partially_paid' && (po.outstanding_amount || 0) <= 0) return;

            let dueDate = new Date(po.delivery_date);
            // Calculate actual due date based on payment terms
            if (po.payment_terms) {
                const days = parseInt(po.payment_terms.match(/\d+/) || [30]);
                dueDate.setDate(dueDate.getDate() + days);
            }
            
            const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
            const outstanding = po.outstanding_amount || po.total_amount || 0;

            if (daysOverdue < 0) {
                aging.current.count++;
                aging.current.amount += outstanding;
                aging.current.pos.push(po);
            } else if (daysOverdue <= 30) {
                aging['1-30'].count++;
                aging['1-30'].amount += outstanding;
                aging['1-30'].pos.push(po);
            } else if (daysOverdue <= 60) {
                aging['31-60'].count++;
                aging['31-60'].amount += outstanding;
                aging['31-60'].pos.push(po);
            } else if (daysOverdue <= 90) {
                aging['61-90'].count++;
                aging['61-90'].amount += outstanding;
                aging['61-90'].pos.push(po);
            } else {
                aging['90+'].count++;
                aging['90+'].amount += outstanding;
                aging['90+'].pos.push(po);
            }
        });

        return aging;
    };

    const arAging = calculateARAging();
    const apAging = calculateAPAging();

    // Export to CSV
    const exportToCSV = (type) => {
        let csvContent = '';
        let filename = '';

        if (type === 'ar') {
            filename = 'AR_Aging_Report_' + new Date().toISOString().split('T')[0] + '.csv';
            csvContent = 'Age Bucket,Invoice Count,Total Amount\n';
            Object.entries(arAging).forEach(([bucket, data]) => {
                csvContent += '"' + bucket + '",' + data.count + ',"' + formatCurrency(data.amount) + '"\n';
            });
        } else if (type === 'ap') {
            filename = 'AP_Aging_Report_' + new Date().toISOString().split('T')[0] + '.csv';
            csvContent = 'Age Bucket,PO Count,Total Amount\n';
            Object.entries(apAging).forEach(([bucket, data]) => {
                csvContent += '"' + bucket + '",' + data.count + ',"' + formatCurrency(data.amount) + '"\n';
            });
        }

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    // Helper: Get color class for aging bucket
    const getBucketColor = (bucket) => {
        const colors = {
            'current': 'text-green-400 bg-green-400',
            '1-30': 'text-blue-400 bg-blue-400',
            '31-60': 'text-yellow-400 bg-yellow-400',
            '61-90': 'text-orange-400 bg-orange-400',
            '90+': 'text-red-400 bg-red-400'
        };
        return colors[bucket] || 'text-silver-light bg-silver-light';
    };

    // Handle drill-down click
    const handleBucketClick = (type, bucket, items) => {
        setDrillDownData({ type, bucket, items });
        setShowDrillDown(true);
    };

    // Prepare chart data for AR Aging
    const arChartData = Object.entries(arAging).map(([bucket, data]) => ({
        name: bucket === 'current' ? 'Current' : bucket + ' days',
        value: data.amount,
        count: data.count,
        percentage: totalAROutstanding > 0 ? ((data.amount / totalAROutstanding) * 100).toFixed(1) : 0
    }));

    // Prepare chart data for AP Aging
    const apChartData = Object.entries(apAging).map(([bucket, data]) => ({
        name: bucket === 'current' ? 'Current' : bucket + ' days',
        value: data.amount,
        count: data.count,
        percentage: totalAPOutstanding > 0 ? ((data.amount / totalAPOutstanding) * 100).toFixed(1) : 0
    }));

    // Colors for charts
    const CHART_COLORS = ['#4ade80', '#60a5fa', '#facc15', '#fb923c', '#f87171'];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-silver-dark">Loading reports...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Financial Reports</h1>
                    <p className="text-silver-dark mt-1">AR/AP aging analysis and financial insights</p>
                </div>
            </div>

            {/* Overview Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">AR Outstanding</p>
                        <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <p className="text-2xl font-bold text-green-400">{formatCurrency(totalAROutstanding)}</p>
                    <p className="text-xs text-silver-dark mt-1">{invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled').length} invoices</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">AP Outstanding</p>
                        <TrendingDown className="w-5 h-5 text-red-400" />
                    </div>
                    <p className="text-2xl font-bold text-red-400">{formatCurrency(totalAPOutstanding)}</p>
                    <p className="text-xs text-silver-dark mt-1">{pos.filter(p => p.status !== 'received' && p.status !== 'cancelled').length} POs</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Net Position</p>
                        <DollarSign className={`w - 5 h - 5 ${ netPosition >= 0 ? 'text-green-400' : 'text-red-400' } `} />
                    </div>
                    <p className={`text - 2xl font - bold ${ netPosition >= 0 ? 'text-green-400' : 'text-red-400' } `}>
                        {formatCurrency(netPosition)}
                    </p>
                    <p className="text-xs text-silver-dark mt-1">AR - AP</p>
                </div>

                <div className="glass-card p-6 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-silver-dark">Overdue Items</p>
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-bold text-yellow-400">{overdueInvoices + overduePOs}</p>
                        <p className="text-xs text-silver-dark">total</p>
                    </div>
                    <p className="text-xs text-silver-dark mt-1">{overdueInvoices} invoices, {overduePOs} POs</p>
                </div>
            </div>

            {/* Cash Flow Forecast Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Forecast Summary */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="glass-card p-5 rounded-lg border-l-4 border-accent-blue">
                        <div className="flex items-center gap-2 mb-2">
                            <Activity className="w-5 h-5 text-accent-blue" />
                            <h3 className="font-bold text-silver-light">Cash Flow Forecast (30 Days)</h3>
                        </div>
                        <p className="text-xs text-silver-dark mb-4">Proyeksi arus kas berdasarkan tanggal jatuh tempo Invoice dan PO.</p>
                        
                        <div className="space-y-4">
                            <div>
                                <p className="text-xs text-silver-dark">Proj. Inflow (AR)</p>
                                <p className="text-xl font-bold text-emerald-400">{formatCurrency(forecastSummary.projectedInflow)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-silver-dark">Proj. Outflow (AP)</p>
                                <p className="text-xl font-bold text-red-400">{formatCurrency(forecastSummary.projectedOutflow)}</p>
                            </div>
                            <div className="pt-3 border-t border-dark-border">
                                <p className="text-xs text-silver-dark">Est. Net Position</p>
                                <p className={`text - 2xl font - bold ${ forecastSummary.netForecast >= 0 ? 'text-accent-blue' : 'text-orange-400' } `}>
                                    {formatCurrency(forecastSummary.netForecast)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Forecast Chart */}
                <div className="lg:col-span-2 glass-card p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-silver-light mb-6">Weekly Cash Flow Projection</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={forecastData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="label" stroke="#888" fontSize={12} />
                                <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `${ val / 1000000 } M`} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Legend />
                                <Bar dataKey="inflow" name="Inflow (AR)" fill="#10B981" radius={[4, 4, 0, 0]} barSize={30} />
                                <Bar dataKey="outflow" name="Outflow (AP)" fill="#EF4444" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* AR Aging Report */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <FileText className="w-6 h-6 text-green-400" />
                        <h2 className="text-xl font-bold text-silver-light">Accounts Receivable Aging</h2>
                    </div>
                    <Button
                        onClick={() => exportToCSV('ar')}
                        icon={Download}
                        variant="secondary"
                        size="sm"
                    >
                        Export CSV
                    </Button>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Pie Chart */}
                    <div className="glass-card p-4 rounded-lg bg-dark-surface/50">
                        <h3 className="font-semibold text-silver-light mb-4 text-center">AR Distribution by Age</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={arChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percentage }) => `${ name }: ${ percentage }% `}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {arChartData.map((entry, index) => (
                                        <Cell key={`cell - ${ index } `} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Bar Chart */}
                    <div className="glass-card p-4 rounded-lg bg-dark-surface/50">
                        <h3 className="font-semibold text-silver-light mb-4 text-center">Amount by Aging Bucket</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={arChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `${ (value / 1000000).toFixed(0) } M`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                                <Bar dataKey="value" fill="#4ade80" radius={[8, 8, 0, 0]}>
                                    {arChartData.map((entry, index) => (
                                        <Cell key={`cell - ${ index } `} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver-light uppercase">Age Bucket</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">Count</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver-light uppercase">Total Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver-light uppercase">% of Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {Object.entries(arAging).map(([bucket, data]) => {
                                const percentage = totalAROutstanding > 0 
                                    ? ((data.amount / totalAROutstanding) * 100).toFixed(1) 
                                    : 0;
                                const colorClass = getBucketColor(bucket);

                                return (
                                    <tr 
                                        key={bucket} 
                                        onClick={() => data.count > 0 && handleBucketClick('AR', bucket, data.invoices)}
                                        className={`hover: bg - dark - surface smooth - transition ${ data.count > 0 ? 'cursor-pointer hover:scale-[1.01]' : 'opacity-50' } `}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w - 3 h - 3 rounded - full ${ colorClass.split(' ')[1] } `}></div>
                                                <span className={`font - medium ${ colorClass.split(' ')[0] } `}>
                                                    {bucket === 'current' ? 'Current (Not Due)' : `${ bucket } Days Overdue`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-silver-light">{data.count}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-silver-light">
                                            {formatCurrency(data.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="flex-1 max-w-[120px] bg-dark-surface rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className={`h - full ${ colorClass.split(' ')[1] } transition - all duration - 300`}
                                                        style={{ width: `${ percentage }% ` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-silver-dark w-12 text-right">{percentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-accent-orange/10 font-bold">
                                <td className="px-4 py-3 text-silver-light">TOTAL</td>
                                <td className="px-4 py-3 text-center text-silver-light">
                                    {Object.values(arAging).reduce((sum, data) => sum + data.count, 0)}
                                </td>
                                <td className="px-4 py-3 text-right text-accent-orange">
                                    {formatCurrency(totalAROutstanding)}
                                </td>
                                <td className="px-4 py-3 text-right text-silver-light">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AP Aging Report */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-red-400" />
                        <h2 className="text-xl font-bold text-silver-light">Accounts Payable Aging</h2>
                    </div>
                    <Button
                        onClick={() => exportToCSV('ap')}
                        icon={Download}
                        variant="secondary"
                        size="sm"
                    >
                        Export CSV
                    </Button>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Pie Chart */}
                    <div className="glass-card p-4 rounded-lg bg-dark-surface/50">
                        <h3 className="font-semibold text-silver-light mb-4 text-center">AP Distribution by Age</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie
                                    data={apChartData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percentage }) => `${ name }: ${ percentage }% `}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {apChartData.map((entry, index) => (
                                        <Cell key={`cell - ${ index } `} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Bar Chart */}
                    <div className="glass-card p-4 rounded-lg bg-dark-surface/50">
                        <h3 className="font-semibold text-silver-light mb-4 text-center">Amount by Aging Bucket</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={apChartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="name" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} tickFormatter={(value) => `${ (value / 1000000).toFixed(0) } M`} />
                                <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                                <Bar dataKey="value" fill="#f87171" radius={[8, 8, 0, 0]}>
                                    {apChartData.map((entry, index) => (
                                        <Cell key={`cell - ${ index } `} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-silver-light uppercase">Age Bucket</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">Count</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver-light uppercase">Total Amount</th>
                                <th className="px-4 py-3 text-right text-xs font-semibold text-silver-light uppercase">% of Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {Object.entries(apAging).map(([bucket, data]) => {
                                const percentage = totalAPOutstanding > 0 
                                    ? ((data.amount / totalAPOutstanding) * 100).toFixed(1) 
                                    : 0;
                                const colorClass = getBucketColor(bucket);

                                return (
                                    <tr 
                                        key={bucket} 
                                        onClick={() => data.count > 0 && handleBucketClick('AP', bucket, data.pos)}
                                        className={`hover: bg - dark - surface smooth - transition ${ data.count > 0 ? 'cursor-pointer hover:scale-[1.01]' : 'opacity-50' } `}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <div className={`w - 3 h - 3 rounded - full ${ colorClass.split(' ')[1] } `}></div>
                                                <span className={`font - medium ${ colorClass.split(' ')[0] } `}>
                                                    {bucket === 'current' ? 'Current (Not Due)' : `${ bucket } Days Overdue`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center text-silver-light">{data.count}</td>
                                        <td className="px-4 py-3 text-right font-semibold text-silver-light">
                                            {formatCurrency(data.amount)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="flex-1 max-w-[120px] bg-dark-surface rounded-full h-2 overflow-hidden">
                                                    <div 
                                                        className={`h - full ${ colorClass.split(' ')[1] } transition - all duration - 300`}
                                                        style={{ width: `${ percentage }% ` }}
                                                    />
                                                </div>
                                                <span className="text-sm text-silver-dark w-12 text-right">{percentage}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            <tr className="bg-accent-orange/10 font-bold">
                                <td className="px-4 py-3 text-silver-light">TOTAL</td>
                                <td className="px-4 py-3 text-center text-silver-light">
                                    {Object.values(apAging).reduce((sum, data) => sum + data.count, 0)}
                                </td>
                                <td className="px-4 py-3 text-right text-accent-orange">
                                    {formatCurrency(totalAPOutstanding)}
                                </td>
                                <td className="px-4 py-3 text-right text-silver-light">100%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Activity Summary */}
            <div className="glass-card p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                    <DollarSign className="w-6 h-6 text-blue-400" />
                    <h2 className="text-xl font-bold text-silver-light">Payment Activity</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30">
                        <p className="text-sm text-silver-dark mb-1">Total Incoming</p>
                        <p className="text-xl font-bold text-green-400">
                            {formatCurrency(payments.filter(p => p.payment_type === 'incoming' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            {payments.filter(p => p.payment_type === 'incoming').length} payments
                        </p>
                    </div>

                    <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/30">
                        <p className="text-sm text-silver-dark mb-1">Total Outgoing</p>
                        <p className="text-xl font-bold text-red-400">
                            {formatCurrency(payments.filter(p => p.payment_type === 'outgoing' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0))}
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            {payments.filter(p => p.payment_type === 'outgoing').length} payments
                        </p>
                    </div>

                    <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30">
                        <p className="text-sm text-silver-dark mb-1">Net Cash Flow</p>
                        <p className="text-xl font-bold text-blue-400">
                            {formatCurrency(
                                payments.filter(p => p.payment_type === 'incoming' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0) -
                                payments.filter(p => p.payment_type === 'outgoing' && p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)
                            )}
                        </p>
                        <p className="text-xs text-silver-dark mt-1">
                            {payments.filter(p => p.status === 'completed').length} total payments
                        </p>
                    </div>
                </div>
            </div>

            {/* Drill-Down Modal */}
            {showDrillDown && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card p-6 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-auto">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between mb-6 sticky top-0 bg-dark-card/95 backdrop-blur-sm pb-4 border-b border-dark-border">
                            <div>
                                <h2 className="text-2xl font-bold text-silver-light">
                                    {drillDownData.type} Aging - {drillDownData.bucket === 'current' ? 'Current (Not Due)' : `${ drillDownData.bucket } Days Overdue`}
                                </h2>
                             <p className="text-sm text-silver-dark mt-1">
                                    {drillDownData.items.length} {drillDownData.type === 'AR' ? 'Invoices' : 'Purchase Orders'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDrillDown(false)}
                                className="text-silver-light hover:text-white smooth-transition p-2 hover:bg-dark-surface rounded-lg"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-surface sticky top-16">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-light uppercase">
                                            {drillDownData.type === 'AR' ? 'Invoice #' : 'PO #'}
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-silver-light uppercase">
                                            {drillDownData.type === 'AR' ? 'Customer' : 'Vendor'}
                                        </th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold text-silver-light uppercase">Amount</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">
                                            {drillDownData.type === 'AR' ? 'Due Date' : 'Delivery Date'}
                                        </th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">Days {drillDownData.bucket === 'current' ? 'Until Due' : 'Overdue'}</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">Status</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-silver-light uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {drillDownData.items.map((item, idx) => {
                                        const today = new Date();
                                        const dueDate = new Date(drillDownData.type === 'AR' ? item.due_date : item.delivery_date);
                                        const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                                        const outstanding = drillDownData.type === 'AR' 
                                            ? item.outstanding_amount 
                                            : (item.outstanding_amount || item.total_amount);

                                        return (
                                            <tr key={idx} className="hover:bg-dark-surface smooth-transition">
                                                <td className="px-4 py-3">
                                                    <span className="font-medium text-accent-orange">
                                                        {drillDownData.type === 'AR' ? item.invoice_number : item.po_number}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-silver-light">
                                                    {drillDownData.type === 'AR' ? item.customer_name : item.vendor_name}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-silver-light">
                                                    {formatCurrency(outstanding, item.currency)}
                                                </td>
                                                <td className="px-4 py-3 text-center text-silver-light">
                                                    {new Date(drillDownData.type === 'AR' ? item.due_date : item.delivery_date).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`font - semibold ${
    daysOverdue < 0 ? 'text-green-400' :
        daysOverdue <= 30 ? 'text-blue-400' :
            daysOverdue <= 60 ? 'text-yellow-400' :
                daysOverdue <= 90 ? 'text-orange-400' :
                    'text-red-400'
} `}>
                                                        {Math.abs(daysOverdue)} days
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px - 2 py - 1 rounded text - xs font - semibold ${
    item.status === 'paid' || item.status === 'received' ? 'bg-green-500/20 text-green-400' :
        item.status === 'partially_paid' ? 'bg-yellow-500/20 text-yellow-400' :
            item.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                'bg-blue-500/20 text-blue-400'
} `}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => {
                                                            // Navigate to detail view
                                                            if (drillDownData.type === 'AR') {
                                                                window.open(`/ blink / finance / invoices ? id = ${ item.id } `, '_blank');
                                                            } else {
                                                                window.open(`/ blink / finance / purchase - orders ? id = ${ item.id } `, '_blank');
                                                            }
                                                        }}
                                                        className="text-accent-orange hover:text-accent-orange/80 smooth-transition"
                                                    >
                                                        <ExternalLink className="w-4 h-4 inline" />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="mt-6 pt-4 border-t border-dark-border flex justify-between items-center">
                            <div className="text-sm text-silver-dark">
                                Total: <span className="font-bold text-accent-orange">
                                    {formatCurrency(drillDownData.items.reduce((sum, item) => {
                                        const amt = drillDownData.type === 'AR' 
                                            ? item.outstanding_amount 
                                            : (item.outstanding_amount || item.total_amount);
                                        return sum + amt;
                                    }, 0))}
                                </span>
                            </div>
                            <Button onClick={() => setShowDrillDown(false)} variant="secondary">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinanceReports;
