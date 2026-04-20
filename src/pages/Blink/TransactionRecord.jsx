import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
    FileText, 
    Calendar, 
    Filter, 
    Search,
    RefreshCw,
    DollarSign,
    Package,
    Truck,
    FileCheck,
    Send,
    XCircle,
    CheckCircle,
    Clock,
    Eye,
    Plus,
    Edit,
    Trash2
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

const ACTION_ICONS = {
    create: Plus,
    update: Edit,
    delete: Trash2,
    approve: CheckCircle,
    reject: XCircle,
    pay: DollarSign,
    cancel: Clock,
    send: Send,
    print: FileText
};

const TransactionRecord = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [count, setCount] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);
    
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        transactionType: ''
    });
    
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20
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

            const { data, error, count: totalCount } = await query
                .range(offset, offset + pagination.limit - 1);

            if (error) throw error;

            setLogs(data || []);
            setCount(totalCount || 0);
        } catch (err) {
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    const searchFilteredLogs = searchTerm
        ? logs.filter(log => 
            log.transaction_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.partner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user_email?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : logs;

    const getActionIcon = (action) => {
        const Icon = ACTION_ICONS[action] || FileText;
        return <Icon className="w-4 h-4" />;
    };

    const getTypeLabel = (type) => {
        return TRANSACTION_TYPE_LABELS[type] || type;
    };

    const totalPages = Math.ceil(count / pagination.limit);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6 text-accent-blue" />
                    <h1 className="text-2xl font-bold gradient-text">Transaction Record</h1>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-white hover:bg-white/10 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                    <div className="flex items-center gap-2 text-silver-dark text-sm">
                        <Calendar className="w-4 h-4" />
                        Period
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                            className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-white text-sm w-32"
                        />
                        <span className="text-silver-dark">-</span>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                            className="px-2 py-1 bg-dark-bg border border-dark-border rounded text-white text-sm w-32"
                        />
                    </div>
                </div>

                <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                    <div className="text-silver-dark text-sm">Transaction Type</div>
                    <select
                        value={filters.transactionType}
                        onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
                        className="mt-2 w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-white text-sm"
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
                </div>

                <div className="bg-dark-surface p-4 rounded-xl border border-dark-border">
                    <div className="flex items-center gap-2 text-silver-dark text-sm">
                        <Search className="w-4 h-4" />
                        Search
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search ID, ref, partner..."
                        className="mt-2 w-full px-2 py-1 bg-dark-bg border border-dark-border rounded text-white text-sm"
                    />
                </div>

                <div className="bg-dark-surface p-4 rounded-xl border border-dark-border flex items-center justify-center">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-white">{count}</div>
                        <div className="text-xs text-silver-dark">Total Records</div>
                    </div>
                </div>
            </div>

            <div className="bg-dark-surface rounded-xl border border-dark-border overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-silver-dark">Loading...</div>
                ) : searchFilteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-silver-dark">No transaction records found</div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {searchFilteredLogs.map((log) => (
                            <div 
                                key={log.id} 
                                className="p-4 hover:bg-white/5 cursor-pointer transition-colors"
                                onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-2 rounded-lg ${
                                        log.action === 'create' ? 'bg-green-500/20 text-green-400' :
                                        log.action === 'update' ? 'bg-blue-500/20 text-blue-400' :
                                        log.action === 'delete' ? 'bg-red-500/20 text-red-400' :
                                        log.action === 'approve' ? 'bg-green-500/20 text-green-400' :
                                        log.action === 'reject' ? 'bg-red-500/20 text-red-400' :
                                        log.action === 'pay' ? 'bg-purple-500/20 text-purple-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                        {getActionIcon(log.action)}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-white">
                                                {getTypeLabel(log.transaction_type)}
                                            </span>
                                            <span className="text-silver-dark">•</span>
                                            <span className="text-silver-dark text-sm">
                                                {formatDate(log.created_at)}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <span className="text-silver-dark font-mono">
                                                ID: {log.transaction_id}
                                            </span>
                                            {log.reference_number && (
                                                <span className="text-silver-dark font-mono">
                                                    Ref: {log.reference_number}
                                                </span>
                                            )}
                                        </div>
                                        
                                        {(log.partner_name || log.amount) && (
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                {log.partner_name && (
                                                    <span className="text-accent-blue">
                                                        {log.partner_name}
                                                    </span>
                                                )}
                                                {log.amount && (
                                                    <span className="text-white font-medium">
                                                        {formatCurrency(log.amount, log.currency)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        
                                        {selectedLog?.id === log.id && (
                                            <div className="mt-4 p-4 bg-dark-bg rounded-lg">
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-silver-dark">Module:</span>
                                                        <span className="ml-2 text-white capitalize">{log.module}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-silver-dark">Action:</span>
                                                        <span className="ml-2 text-white capitalize">{log.action}</span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-silver-dark">Description:</span>
                                                        <span className="ml-2 text-white">{log.description || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-silver-dark">User:</span>
                                                        <span className="ml-2 text-white">{log.user_email || '-'}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-silver-dark">Currency:</span>
                                                        <span className="ml-2 text-white">{log.currency || 'IDR'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-silver-dark">
                        Page {pagination.page} of {totalPages} ({count} records)
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPagination({ ...pagination, page: Math.max(1, pagination.page - 1) })}
                            disabled={pagination.page === 1}
                            className="px-3 py-1 bg-dark-surface border border-dark-border rounded text-white text-sm disabled:opacity-50"
                        >
                            Previous
                        </button>
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

export default TransactionRecord;