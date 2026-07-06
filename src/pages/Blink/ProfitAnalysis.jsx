import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
    TrendingUp, DollarSign, ArrowUpRight, ArrowDownRight,
    Search, Filter, Briefcase, FileText, BarChart2, PieChart as PieChartIcon, Activity
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { getActiveDivision } from '../../utils/divisionContext';

const ProfitAnalysis = () => {
    const activeDivision = getActiveDivision();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [summary, setSummary] = useState({
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgMargin: 0
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Invoices (Revenue)
            const { data: invoices, error: invError } = await supabase
                .from('blink_invoices')
                .select('id, invoice_number, job_number, quotation_id, subtotal, total, status, currency, created_at')
                .eq('division', activeDivision)
                .neq('status', 'cancelled');

            if (invError) throw invError;

            // 2. Fetch Purchase Orders (Cost)
            // We need to fetch the new columns: job_number, shipment_id, quotation_id
            const { data: pos, error: poError } = await supabase
                .from('blink_purchase_orders')
                .select('id, po_number, job_number, shipment_id, quotation_id, total_amount, status, currency')
                .eq('division', activeDivision)
                .neq('status', 'cancelled');

            if (poError) throw poError;

            // 3. Process & Group Data by Job Number
            const jobMap = {};

            // Helper to get or create job entry
            const getJobEntry = (jobNumber) => {
                const key = jobNumber || 'Unallocated';
                if (!jobMap[key]) {
                    jobMap[key] = {
                        job_number: key,
                        revenue: 0,
                        cost: 0,
                        invoices: [],
                        pos: []
                    };
                }
                return jobMap[key];
            };

            // Process Invoices
            invoices?.forEach(inv => {
                // Use invoice total for revenue (excluding tax? usually revenue is subtotal, but let's use total for simple cash view or subtotal for accrual. Standard is Revenue = Subtotal (excluding tax))
                // Let's use subtotal if available, else total.
                const amount = inv.subtotal || inv.total || 0;

                // key: job_number is best. If not, maybe quotation_number? 
                // For now rely on job_number.
                const entry = getJobEntry(inv.job_number);
                entry.revenue += amount;
                entry.invoices.push(inv);
            });

            // Process POs
            pos?.forEach(po => {
                // Cost = total amount (allocating full cost including tax? usually cost is also before tax if VAT recoverable, but let's keep simple: Total Amount for now)
                const amount = po.total_amount || 0;

                // Try to find job number from PO
                let jobKey = po.job_number;

                // If PO has no job_number but has quotation link, we might try to match (omitted for speed, relying on job_number)

                const entry = getJobEntry(jobKey);
                entry.cost += amount;
                entry.pos.push(po);
            });

            // 4. Calculate Profit & Margin
            const processedJobs = Object.values(jobMap).map(job => {
                const profit = job.revenue - job.cost;
                const margin = job.revenue > 0 ? (profit / job.revenue) * 100 : 0;
                return { ...job, profit, margin };
            });

            // 5. Calculate Summary
            const totalRev = processedJobs.reduce((sum, j) => sum + j.revenue, 0);
            const totalCost = processedJobs.reduce((sum, j) => sum + j.cost, 0);
            const totalProfit = totalRev - totalCost;
            const avgMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

            setSummary({
                totalRevenue: totalRev,
                totalCost: totalCost,
                totalProfit: totalProfit,
                avgMargin: avgMargin
            });

            // Sort by Revenue desc
            setJobs(processedJobs.sort((a, b) => b.revenue - a.revenue));

        } catch (error) {
            console.error('Error fetching profit data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (val) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(val || 0);
    };

    const filteredJobs = jobs.filter(job =>
        job.job_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold gradient-text">Job Profitability</h1>
                <p className="text-silver-dark mt-1">Analisa Laba/Rugi per Pekerjaan (Job/Shipment)</p>
                <p className="text-xs text-blue-300 mt-1">Data ditampilkan sesuai divisi aktif: {activeDivision?.toUpperCase()}</p>
            </div>

            {/* Top Section: Summary & Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Summary Cards */}
                <div className="space-y-4">
                    <div className="glass-card p-6 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-silver-dark">Total Revenue</span>
                            <DollarSign className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-3xl font-bold text-silver-light">{formatCurrency(summary.totalRevenue)}</p>
                        <div className="mt-2 h-1 w-full bg-dark-bg rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 w-full"></div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-lg bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-silver-dark">Total Cost (PO)</span>
                            <Briefcase className="w-5 h-5 text-orange-400" />
                        </div>
                        <p className="text-3xl font-bold text-silver-light">{formatCurrency(summary.totalCost)}</p>
                        <div className="mt-2 h-1 w-full bg-dark-bg rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500" style={{ width: `${summary.totalRevenue ? (summary.totalCost / summary.totalRevenue * 100) : 0}%` }}></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-4 rounded-lg border-l-4 border-emerald-500">
                            <p className="text-xs text-silver-dark mb-1">Gross Profit</p>
                            <p className={`text-xl font-bold ${summary.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(summary.totalProfit)}
                            </p>
                        </div>
                        <div className="glass-card p-4 rounded-lg border-l-4 border-purple-500">
                            <p className="text-xs text-silver-dark mb-1">Avg Margin</p>
                            <div className="flex items-center gap-1">
                                <Activity className="w-4 h-4 text-purple-400" />
                                <p className="text-xl font-bold text-purple-400">
                                    {summary.avgMargin.toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Top Jobs Chart */}
                <div className="lg:col-span-2 glass-card p-6 rounded-lg">
                    <h3 className="text-lg font-bold text-silver-light mb-6 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-accent-orange" />
                        Top 5 Most Profitable Jobs
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={jobs.slice(0, 5)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="job_number" stroke="#888" fontSize={12} tickFormatter={(val) => val.length > 10 ? val.substr(0, 10) + '...' : val} />
                                <YAxis stroke="#888" fontSize={12} tickFormatter={(val) => `${val / 1000000}M`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155' }}
                                    cursor={{ fill: '#334155', opacity: 0.2 }}
                                    formatter={(value) => formatCurrency(value)}
                                />
                                <Legend />
                                <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="cost" name="Cost" fill="#F97316" radius={[4, 4, 0, 0]} barSize={20} />
                                <Bar dataKey="profit" name="Profit" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    placeholder="Search Job Number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                />
            </div>

            {/* Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-dark-surface border-b border-dark-border">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-silver-light">Job Number</th>
                                <th className="px-4 py-3 text-center font-semibold text-silver-light">Status</th>
                                <th className="px-4 py-3 text-center font-semibold text-silver-light">Inv / PO</th>
                                <th className="px-4 py-3 text-right font-semibold text-blue-400">Revenue</th>
                                <th className="px-4 py-3 text-right font-semibold text-orange-400">Cost</th>
                                <th className="px-4 py-3 text-right font-semibold text-emerald-400">Profit</th>
                                <th className="px-4 py-3 text-right font-semibold text-purple-400">Margin</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-silver-dark">Loading data...</td>
                                </tr>
                            ) : filteredJobs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center text-silver-dark">
                                        No data found. Start by creating Invoices and linking POs to Jobs.
                                    </td>
                                </tr>
                            ) : (
                                filteredJobs.map((job) => (
                                    <tr key={job.job_number} className="hover:bg-dark-surface/50 smooth-transition">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Briefcase className="w-4 h-4 text-silver-dark" />
                                                <div className="flex flex-col">
                                                    <span className={`font-medium ${job.job_number === 'Unallocated' ? 'text-red-400 italic' : 'text-silver-light'}`}>
                                                        {job.job_number}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {job.profit < 0 ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">LOSS</span>
                                            ) : job.margin > 30 ? (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HIGH</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">NORMAL</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center text-silver-dark">
                                            <span className="text-blue-300">{job.invoices.length}</span> / <span className="text-orange-300">{job.pos.length}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-silver-light font-medium">
                                            {formatCurrency(job.revenue)}
                                        </td>
                                        <td className="px-4 py-3 text-right text-silver-light font-medium">
                                            {formatCurrency(job.cost)}
                                        </td>
                                        <td className={`px-4 py-3 text-right font-bold ${job.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(job.profit)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${job.margin >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                                                job.margin >= 10 ? 'bg-yellow-500/20 text-yellow-400' :
                                                    'bg-red-500/20 text-red-400'
                                                }`}>
                                                {job.margin.toFixed(1)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProfitAnalysis;
