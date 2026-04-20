import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
    FileText, 
    Download, 
    Calendar, 
    Filter, 
    ChevronDown,
    User,
    DollarSign,
    Package,
    Truck,
    FileCheck,
    Send,
    XCircle,
    CheckCircle,
    Clock
} from 'lucide-react';

const formatCurrency = (amount, currency = 'IDR') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const TRANSACTION_TYPE_LABELS = {
    invoice: 'Invoice',
    purchase_order: 'Purchase Order',
    accounts_receivable: 'Accounts Receivable',
    accounts_payable: 'Accounts Payable',
    quotation: 'Quotation',
    shipment: 'Shipment',
    sales_quotation: 'Sales Quotation',
    payment: 'Payment',
    journal: 'Journal Entry'
};

const ACTION_LABELS = {
    create: { label: 'Created', color: 'text-green-400' },
    update: { label: 'Updated', color: 'text-blue-400' },
    delete: { label: 'Deleted', color: 'text-red-400' },
    approve: { label: 'Approved', color: 'text-green-400' },
    reject: { label: 'Rejected', color: 'text-red-400' },
    pay: { label: 'Paid', color: 'text-purple-400' },
    cancel: { label: 'Cancelled', color: 'text-yellow-400' },
    send: { label: 'Sent', color: 'text-blue-400' },
    print: { label: 'Printed', color: 'text-gray-400' }
};

const TransactionReport = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(0);
    const [summary, setSummary] = useState(null);
    
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        transactionType: '',
        module: '',
        action: ''
    });
    
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 50
    });

    useEffect(() => {
        fetchLogs();
    }, [filters, pagination]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('blink_transaction_logs')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            const offset = (pagination.page - 1) * pagination.limit;
            
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate + 'T23:59:59');
            }
            if (filters.transactionType) {
                query = query.eq('transaction_type', filters.transactionType);
            }
            if (filters.module) {
                query = query.eq('module', filters.module);
            }
            if (filters.action) {
                query = query.eq('action', filters.action);
            }

            const { data, error, count: totalCount } = await query
                .range(offset, offset + pagination.limit - 1);

            if (error) throw error;

            setLogs(data || []);
            setCount(totalCount || 0);

            await fetchSummary();
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            let query = supabase
                .from('blink_transaction_logs')
                .select('transaction_type, action, module, amount, currency');

            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('created_at', filters.endDate + 'T23:59:59');
            }

            const { data, error } = await query;

            if (error) throw error;

            const summaryData = {
                totalTransactions: data?.length || 0,
                byType: {},
                byAction: {},
                byModule: {},
                totalAmount: 0,
                byCurrency: {}
            };

            data?.forEach(log => {
                summaryData.byType[log.transaction_type] = (summaryData.byType[log.transaction_type] || 0) + 1;
                summaryData.byAction[log.action] = (summaryData.byAction[log.action] || 0) + 1;
                summaryData.byModule[log.module] = (summaryData.byModule[log.module] || 0) + 1;
                
                if (log.amount) {
                    const currency = log.currency || 'IDR';
                    summaryData.totalAmount += parseFloat(log.amount);
                    summaryData.byCurrency[currency] = (summaryData.byCurrency[currency] || 0) + parseFloat(log.amount);
                }
            });

            setSummary(summaryData);
        } catch (err) {
            console.error('Error fetching summary:', err);
        }
    };

    const handleExport = () => {
        const headers = ['Date', 'Type', 'ID', 'Reference', 'Module', 'Action', 'Description', 'Amount', 'Currency', 'Partner', 'User'];
        const rows = logs.map(log => [
            formatDate(log.created_at),
            log.transaction_type,
            log.transaction_id,
            log.reference_number || '',
            log.module,
            log.action,
            log.description || '',
            log.amount || '',
            log.currency || 'IDR',
            log.partner_name || '',
            log.user_email || ''
        ]);

        const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Blink_Transaction_Report_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const clearFilters = () => {
        setFilters({
            startDate: '',
            endDate: '',
            transactionType: '',
            module: '',
            action: ''
        });
        setPagination({ page: 1, limit: 50 });
    };

    const getActionBadge = (action) => {
        const config = ACTION_LABELS[action] || { label: action, color: 'text-gray-400' };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.color} bg-white/10`}>
                {config.label}
            </span>
        );
    };

    const totalPages = Math.ceil(count / pagination.limit);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-accent-blue" />
                    <h1 className="text-2xl font-bold gradient-text">Transaction Report</h1>
                </div>
                <button
                    onClick={handleExport}
                    disabled={loading || logs.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                    <Download className="w-4 h-4" />
                    Export CSV
                </button>
            </div>

            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                        <div className="text-silver-dark text-sm">Total Transactions</div>
                        <div className="text-2xl font-bold text-white">{summary.totalTransactions}</div>
                    </div>
                    <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                        <div className="text-silver-dark text-sm">Total Amount</div>
                        <div className="text-2xl font-bold text-white">
                            {formatCurrency(summary.totalAmount)}
                        </div>
                    </div>
                    <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                        <div className="text-silver-dark text-sm">By Invoice</div>
                        <div className="text-2xl font-bold text-white">
                            {summary.byType.invoice || 0}
                        </div>
                    </div>
                    <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                        <div className="text-silver-dark text-sm">By PO</div>
                        <div className="text-2xl font-bold text-white">
                            {summary.byType.purchase_order || 0}
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-silver-dark" />
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                        />
                        <span className="text-silver-dark">to</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                        />
                    </div>

                    <select
                        value={filters.transactionType}
                        onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
                        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                    >
                        <option value="">All Types</option>
                        <option value="invoice">Invoice</option>
                        <option value="purchase_order">Purchase Order</option>
                        <option value="accounts_receivable">AR</option>
                        <option value="accounts_payable">AP</option>
                        <option value="quotation">Quotation</option>
                        <option value="shipment">Shipment</option>
                        <option value="sales_quotation">Sales Quotation</option>
                        <option value="payment">Payment</option>
                        <option value="journal">Journal</option>
                    </select>

                    <select
                        value={filters.module}
                        onChange={(e) => setFilters({ ...filters, module: e.target.value })}
                        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                    >
                        <option value="">All Modules</option>
                        <option value="finance">Finance</option>
                        <option value="operations">Operations</option>
                        <option value="sales">Sales</option>
                        <option value="approval">Approval</option>
                    </select>

                    <select
                        value={filters.action}
                        onChange={(e) => setFilters({ ...filters, action: e.target.value })}
                        className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-white text-sm"
                    >
                        <option value="">All Actions</option>
                        <option value="create">Created</option>
                        <option value="update">Updated</option>
                        <option value="approve">Approved</option>
                        <option value="reject">Rejected</option>
                        <option value="pay">Paid</option>
                        <option value="cancel">Cancelled</option>
                        <option value="send">Sent</option>
                    </select>

                    <button
                        onClick={clearFilters}
                        className="px-3 py-2 text-silver-dark hover:text-white transition-colors text-sm"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            <div className="bg-dark-surface rounded-xl border border-dark-border overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-silver-dark">Loading...</div>
                ) : logs.length === 0 ? (
                    <div className="p-8 text-center text-silver-dark">No transactions found</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-bg border-b border-dark-border">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Date</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">ID</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Reference</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Module</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Action</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Description</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold text-silver-dark uppercase">Amount</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">Partner</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-silver-dark uppercase">User</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 text-sm text-white">
                                            {formatDate(log.created_at)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white">
                                            {TRANSACTION_TYPE_LABELS[log.transaction_type] || log.transaction_type}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark font-mono">
                                            {log.transaction_id}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark font-mono">
                                            {log.reference_number || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white capitalize">
                                            {log.module}
                                        </td>
                                        <td className="px-4 py-3">
                                            {getActionBadge(log.action)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark max-w-xs truncate">
                                            {log.description || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-white text-right font-mono">
                                            {formatCurrency(log.amount, log.currency)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark">
                                            {log.partner_name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-silver-dark">
                                            {log.user_email || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-silver-dark">
                        Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, count)} of {count} transactions
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                            disabled={pagination.page === 1}
                            className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-sm text-white">
                            Page {pagination.page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPagination({ ...pagination, page: Math.min(totalPages, pagination.page + 1) })}
                            disabled={pagination.page === totalPages}
                            className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionReport;