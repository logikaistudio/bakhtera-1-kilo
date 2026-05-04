import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { createARPaymentJournal, createARReversalJournal, getAllCOA } from '../../utils/journalHelper';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    DollarSign, TrendingUp, AlertTriangle, Clock, Users,
    Search, Download, FileText, Calendar, X, CheckCircle, AlertCircle,
    Building, CreditCard, Banknote, History, Receipt, Package, MapPin
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AccountsReceivable = () => {
    const { canEdit, canCreate, canDelete } = useAuth();
    const [arTransactions, setARTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAR, setSelectedAR] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        fetchARTransactions();
    }, []);

    // Helper: Calculate aging bucket based on due date
    const calculateAgingBucket = (dueDate) => {
        const today = new Date();
        const due = new Date(dueDate);
        const daysPastDue = Math.floor((today - due) / (1000 * 60 * 60 * 24));

        if (daysPastDue < 0) return '0-30'; // Not yet due
        if (daysPastDue <= 30) return '0-30';
        if (daysPastDue <= 60) return '31-60';
        if (daysPastDue <= 90) return '61-90';
        return '90+';
    };

    // Helper: Derive AR status from payment state and due date
    const deriveStatus = (paidAmount, totalAmount, dueDate) => {
        if (paidAmount >= totalAmount) return 'paid';
        if (paidAmount > 0) return 'partial';

        const today = new Date();
        const due = new Date(dueDate);
        if (today > due) return 'overdue';
        return 'current';
    };

    const fetchARTransactions = async () => {
        try {
            setLoading(true);

            // ── BLINK ONLY: Primary source = blink_ar_transactions ──────────
            const { data: arRows, error: arError } = await supabase
                .from('blink_ar_transactions')
                .select('*')
                .order('transaction_date', { ascending: false });

            let finalRows = [];

            if (!arError && arRows && arRows.length > 0) {
                // ✅ Data exists in blink_ar_transactions — use it directly
                finalRows = arRows;
            } else {
                // ⚠️ blink_ar_transactions kosong atau error → fallback ke blink_invoices
                if (arError) {
                    console.warn('[Blink AR] blink_ar_transactions error:', arError.message);
                } else {
                    console.warn('[Blink AR] blink_ar_transactions kosong, fallback ke blink_invoices');
                }

                const { data: invoiceRows, error: invoiceError } = await supabase
                    .from('blink_invoices')
                    .select('*')
                    .neq('status', 'draft')
                    .neq('status', 'cancelled')
                    .order('invoice_date', { ascending: false });

                if (invoiceError) throw invoiceError;

                // Map invoice → format AR, dengan invoice_id = inv.id
                finalRows = (invoiceRows || []).map(inv => ({
                    id: inv.id,
                    invoice_id: inv.id,  // ← KUNCI: invoice_id selalu = inv.id di path ini
                    ar_number: `AR-${inv.invoice_number || inv.id.slice(0, 8).toUpperCase()}`,
                    invoice_number: inv.invoice_number,
                    customer_name: inv.customer_name || inv.customer_company || 'Unknown',
                    customer_id: inv.customer_id || null,
                    transaction_date: inv.invoice_date,
                    due_date: inv.due_date || inv.invoice_date,
                    original_amount: inv.total_amount || inv.subtotal || 0,
                    paid_amount: inv.paid_amount || 0,
                    outstanding_amount: Math.max(0, (inv.total_amount || inv.subtotal || 0) - (inv.paid_amount || 0)),
                    currency: inv.currency || 'IDR',
                    exchange_rate: 1,
                    status: inv.status
                }));
            }

            const arData = (finalRows || []).map(ar => {
                const fallbackInvoiceNumber = ar.invoice_number || (ar.invoice_id ? `INV-${ar.invoice_id.slice(0, 6).toUpperCase()}` : `INV-${ar.id?.slice(0, 6).toUpperCase()}`);
                return {
                    id: ar.id,
                    invoice_id: ar.invoice_id,
                    ar_number: ar.ar_number || `AR-${fallbackInvoiceNumber}`,
                    invoice_number: ar.invoice_number || fallbackInvoiceNumber,
                    customer_name: ar.customer_name || 'Unknown',
                    customer_id: ar.customer_id,
                    transaction_date: ar.transaction_date,
                    due_date: ar.due_date,
                    original_amount: ar.original_amount || ar.total_amount || 0,
                    paid_amount: ar.paid_amount || 0,
                    outstanding_amount: ar.outstanding_amount || Math.max(0, (ar.original_amount || ar.total_amount || 0) - (ar.paid_amount || 0)),
                    aging_bucket: calculateAgingBucket(ar.due_date),
                    status: ar.status || deriveStatus(ar.paid_amount || 0, ar.original_amount || ar.total_amount || 0, ar.due_date),
                    currency: ar.currency || 'IDR',
                    exchange_rate: ar.exchange_rate || 1,
                    total_amount: ar.original_amount || ar.total_amount || 0
                };
            });

            setARTransactions(arData);
        } catch (error) {
            console.error('Error fetching AR:', error);
            alert('Failed to load AR data: ' + error.message);
            setARTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'IDR') => {
        if (currency === 'USD') {
            return '$' + value.toLocaleString('id-ID');
        }
        return 'Rp ' + value.toLocaleString('id-ID');
    };

    // Calculate metrics
    // Calculate metrics
    const totalARAmount = arTransactions.reduce((sum, ar) => sum + (ar.original_amount || 0), 0);
    const totalPaidAmount = arTransactions.reduce((sum, ar) => sum + (ar.paid_amount || 0), 0);
    const totalReceivables = arTransactions.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);

    // Counts
    const paidCount = arTransactions.filter(ar => ar.status === 'paid').length;
    const outstandingCount = arTransactions.filter(ar => ar.outstanding_amount > 0).length;
    const overdueCount = arTransactions.filter(ar => ar.status === 'overdue').length;
    const overdueTotal = arTransactions.filter(ar => ar.status === 'overdue').reduce((sum, ar) => sum + ar.outstanding_amount, 0);

    const current30 = arTransactions.filter(ar => ar.aging_bucket === '0-30').reduce((sum, ar) => sum + ar.outstanding_amount, 0);
    const aged90Plus = arTransactions.filter(ar => ar.aging_bucket === '90+').reduce((sum, ar) => sum + ar.outstanding_amount, 0);

    // Aging summary
    const agingSummary = {
        '0-30': arTransactions.filter(ar => ar.aging_bucket === '0-30').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '31-60': arTransactions.filter(ar => ar.aging_bucket === '31-60').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '61-90': arTransactions.filter(ar => ar.aging_bucket === '61-90').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '90+': arTransactions.filter(ar => ar.aging_bucket === '90+').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
    };

    const filteredAR = arTransactions.filter(ar => {
        const matchesSearch = !searchTerm ||
            ar.ar_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleExportXLS = () => {
        import('../../utils/exportXLS').then(({ exportToXLS }) => {
            const headerRows = [
                { value: 'ACCOUNTS RECEIVABLE REPORT', style: 'title' },
                { value: `Report Date: ${new Date().toLocaleDateString('id-ID')}`, style: 'normal' },
                ''
            ];

            const xlsColumns = [
                { header: 'No', key: 'no', width: 5, align: 'center' },
                { header: 'AR Number', key: 'ar_number', width: 20 },
                { header: 'Invoice #', key: 'invoice_number', width: 20 },
                { header: 'Customer', key: 'customer_name', width: 25 },
                { header: 'Date', key: 'transaction_date', width: 15 },
                { header: 'Due Date', key: 'due_date', width: 15 },
                {
                    header: 'Original Amount',
                    key: 'original_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${(item.original_amount || 0).toLocaleString('id-ID')}`
                },
                {
                    header: 'Paid Amount',
                    key: 'paid_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${(item.paid_amount || 0).toLocaleString('id-ID')}`
                },
                {
                    header: 'Outstanding Amount',
                    key: 'outstanding_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${(item.outstanding_amount || 0).toLocaleString('id-ID')}`
                },
                { header: 'Aging Bucket', key: 'aging_bucket', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            exportToXLS(filteredAR, `AR_Report_${new Date().toISOString().split('T')[0]}`, headerRows, xlsColumns);
        }).catch(err => console.error("Failed to load export utility", err));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Accounts Receivable (AR)</h1>
                    <p className="text-silver-dark mt-1">Manage customer receivables</p>
                </div>
                <Button onClick={handleExportXLS} icon={Download}>Export to Excel</Button>
            </div>


            {/* Summary Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total AR Receivables</p>
                        <DollarSign className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(totalARAmount)}</p>
                    <p className="text-xs text-silver-dark">{arTransactions.length} transactions</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Received</p>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaidAmount)}</p>
                    <p className="text-xs text-silver-dark">{paidCount} paid</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Outstanding Receivables</p>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totalReceivables)}</p>
                    <p className="text-xs text-silver-dark">{outstandingCount} outstanding</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Overdue</p>
                        <Clock className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-xl font-bold text-orange-400">{overdueCount}</p>
                    <p className="text-xs text-silver-dark">{formatCurrency(overdueTotal)}</p>
                </div>
            </div>

            {/* Aging Analysis - Compact */}
            <div className="glass-card p-4 rounded-lg">
                <h2 className="text-sm font-bold text-silver-light mb-3">Aging Analysis</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(agingSummary).map(([bucket, amount]) => (
                        <div key={bucket} className="bg-dark-surface p-3 rounded-lg">
                            <p className="text-xs text-silver-dark">{bucket} Days</p>
                            <p className="text-lg font-bold text-silver-light">{formatCurrency(amount)}</p>
                            <div className="mt-1 h-1.5 bg-dark-card rounded-full overflow-hidden">
                                <div
                                    className={`h-full ${bucket === '0-30' ? 'bg-green-400' :
                                        bucket === '31-60' ? 'bg-yellow-400' :
                                            bucket === '61-90' ? 'bg-orange-400' : 'bg-red-400'
                                        }`}
                                    style={{ width: `${totalReceivables > 0 ? (amount / totalReceivables) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Search - Full Width */}
            <div className="w-full">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search AR number, invoice, or customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-base"
                    />
                </div>
            </div>

            {/* AR Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">AR Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Invoice #</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Customer</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Due Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Original</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Paid</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Outstanding</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Aging</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredAR.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-3 py-8 text-center">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2" />
                                        <p className="text-silver-dark text-sm">No AR transactions found.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAR.map((ar) => (
                                    <tr
                                        key={ar.id}
                                        onClick={() => {
                                            setSelectedAR(ar);
                                            setShowEditModal(true);
                                        }}
                                        className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="font-medium text-accent-orange">{ar.ar_number}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ar.invoice_number}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ar.customer_name}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-dark">{ar.transaction_date}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`${ar.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                                {ar.due_date}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-silver-light">{formatCurrency(ar.original_amount, ar.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-green-400">{formatCurrency(ar.paid_amount, ar.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-semibold text-yellow-400">{formatCurrency(ar.outstanding_amount, ar.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ar.aging_bucket === '0-30' ? 'bg-green-500/20 text-green-400' :
                                                ar.aging_bucket === '31-60' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    ar.aging_bucket === '61-90' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-red-500/20 text-red-400'
                                                }`}>
                                                {ar.aging_bucket}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ar.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                ar.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    ar.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                                        'bg-blue-500/20 text-blue-400'
                                                }`}>
                                                {ar.status === 'paid' ? 'Lunas' :
                                                    ar.status === 'partial' ? 'Sebagian' :
                                                        ar.status === 'overdue' ? 'Terlambat' :
                                                            'Belum Bayar'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* AR Detail Modal */}
            {showEditModal && selectedAR && (
                <ARDetailModal
                    ar={selectedAR}
                    onClose={() => setShowEditModal(false)}
                    onRecordPayment={() => setShowPaymentModal(true)}
                    formatCurrency={formatCurrency}
                    canEditAR={canEdit('blink_ar')}
                />
            )}

            {/* Payment Record Modal */}
            {showPaymentModal && selectedAR && (
                <PaymentRecordModal
                    ar={selectedAR}
                    formatCurrency={formatCurrency}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={() => {
                        setShowPaymentModal(false);
                        setShowEditModal(false);
                        fetchARTransactions();
                    }}
                />
            )}
        </div>
    );
};

// AR Detail Modal Component — mirrors AP Detail Modal format
const ARDetailModal = ({ ar, onClose, onRecordPayment, formatCurrency, canEditAR }) => {
    const [accounts, setAccounts] = useState([]);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [invoiceFull, setInvoiceFull] = useState(null);
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [savingItems, setSavingItems] = useState(false);

    useEffect(() => {
        fetchAccounts();
        fetchInvoiceDetails();
        fetchPaymentHistory();
    }, [ar.id]);

    const fetchAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', 'REVENUE')
                .eq('is_active', true)
                .order('code', { ascending: true });
            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
            // Fallback: fetch any active COA
            try {
                const { data } = await supabase.from('finance_coa').select('*').eq('is_active', true).order('code');
                setAccounts((data || []).filter(a => a.type === 'REVENUE'));
            } catch { }
        }
    };

    const fetchInvoiceDetails = async () => {
        try {
            setLoadingItems(true);
            const invoiceId = ar.invoice_id || ar.id;
            const { data, error } = await supabase
                .from('blink_invoices')
                .select('*')
                .eq('id', invoiceId)
                .limit(1);
            if (error) throw error;
            const invoice = data?.[0] || null;
            setInvoiceFull(invoice);
            const items = Array.isArray(invoice?.invoice_items) ? invoice.invoice_items : [];
            setInvoiceItems(items);
        } catch (error) {
            console.error('Error fetching invoice details:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const fetchPaymentHistory = async () => {
        try {
            setLoadingHistory(true);
            const query = supabase
                .from('blink_payments')
                .select('*')
                .eq('reference_type', 'invoice');

            if (ar.invoice_id) {
                query.eq('reference_id', ar.invoice_id);
            } else {
                query.eq('reference_id', ar.id);
            }

            query.order('payment_date', { ascending: false });
            const { data, error } = await query;
            if (error) throw error;
            setPaymentHistory(data || []);
        } catch (error) {
            console.error('Error fetching payment history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleItemCoaChange = async (index, newCoaId) => {
        if (!canEditAR) {
            alert('Anda tidak memiliki hak akses untuk mengubah akun pendapatan.');
            return;
        }
        const updatedItems = [...invoiceItems];
        updatedItems[index] = { ...updatedItems[index], coa_id: newCoaId };
        setInvoiceItems(updatedItems);
        // Auto-save on change
        try {
            await supabase
                .from('blink_invoices')
                .update({ invoice_items: updatedItems })
                .eq('id', ar.id);
        } catch (error) {
            console.error('Error auto-saving COA assignment:', error);
        }
    };

    const handleSaveChanges = async () => {
        try {
            setSavingItems(true);
            const { error } = await supabase
                .from('blink_invoices')
                .update({ invoice_items: invoiceItems })
                .eq('id', ar.id);
            if (error) throw error;
            alert('Revenue account allocation saved successfully!');
        } catch (error) {
            console.error('Error updating invoice items:', error);
            alert('Failed to save changes: ' + error.message);
        } finally {
            setSavingItems(false);
        }
    };

    const statusConfig = {
        paid: { label: 'PAID', cls: 'bg-green-500/20 text-green-400' },
        partial: { label: 'PARTIAL', cls: 'bg-yellow-500/20 text-yellow-400' },
        partially_paid: { label: 'PARTIAL', cls: 'bg-yellow-500/20 text-yellow-400' },
        overdue: { label: 'OVERDUE', cls: 'bg-red-500/20 text-red-400' },
        current: { label: 'OUTSTANDING', cls: 'bg-blue-500/20 text-blue-400' },
    };
    const sc = statusConfig[ar.status] || { label: (ar.status || 'OUTSTANDING').toUpperCase(), cls: 'bg-gray-500/20 text-gray-400' };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">AR Detail</h2>
                        <p className="text-silver-dark text-sm mt-0.5">{ar.ar_number} • {ar.transaction_date}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${sc.cls}`}>{sc.label}</span>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">AR / Invoice Number</p>
                        <p className="font-bold text-accent-orange">{ar.ar_number}</p>
                    </div>
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">Invoice Ref</p>
                        <p className="font-bold text-silver-light">{ar.invoice_number || '-'}</p>
                    </div>
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">Customer</p>
                        <p className="font-bold text-silver-light">{ar.customer_name}</p>
                    </div>
                    {invoiceFull?.job_number && (
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-xs text-silver-dark mb-1">Job Number</p>
                            <p className="font-bold text-silver-light">{invoiceFull.job_number}</p>
                        </div>
                    )}
                    {(invoiceFull?.origin || invoiceFull?.destination) && (
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-xs text-silver-dark mb-1">Route</p>
                            <p className="font-bold text-silver-light text-xs">
                                {invoiceFull.origin || '-'} → {invoiceFull.destination || '-'}
                            </p>
                        </div>
                    )}
                    {invoiceFull?.payment_terms && (
                        <div className="glass-card p-4 rounded-lg">
                            <p className="text-xs text-silver-dark mb-1">Payment Terms</p>
                            <p className="font-bold text-silver-light">{invoiceFull.payment_terms}</p>
                        </div>
                    )}
                </div>

                {/* Invoice Items Table */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center mb-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Building className="w-4 h-4" /> Item Allocation (Finance)
                        </h3>
                    </div>

                    {loadingItems ? (
                        <div className="text-center py-4 text-silver-dark text-sm animate-pulse">Loading item details...</div>
                    ) : invoiceItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#0070bc]">
                                    <tr className="text-left">
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase rounded-tl-lg">Item</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase">Description</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right">Qty</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right">Unit Price</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right rounded-tr-lg">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/50">
                                    {invoiceItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-500/5 transition-colors">
                                            <td className="py-3 px-4 text-silver-light font-medium align-top">
                                                {item.item_name || item.name || ('Item ' + (idx + 1))}
                                            </td>
                                            <td className="py-3 px-4 text-silver-light align-top">
                                                {item.description || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light align-top">
                                                {item.qty || 1} {item.unit || 'Job'}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light align-top">
                                                {formatCurrency(parseFloat(item.rate || item.unit_price) || 0, ar.currency)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light font-semibold align-top">
                                                {formatCurrency(parseFloat(item.amount) || ((item.qty || 1) * parseFloat(item.rate || item.unit_price)) || 0, ar.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-silver-dark text-sm italic">
                            No item details found for this invoice.
                        </div>
                    )}
                </div>

                {/* Financial Summary */}
                <div className="glass-card p-4 rounded-lg mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Banknote className="w-5 h-5 text-accent-orange" />
                        <h3 className="font-semibold text-silver-light">Financial Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Invoice Date</p>
                            <p className="font-medium text-silver-light">{ar.transaction_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Due Date</p>
                            <p className={`font-medium ${ar.status === 'overdue' ? 'text-red-400' : 'text-silver-light'}`}>
                                {ar.due_date}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Original Amount</p>
                            <p className="font-bold text-silver-light">{formatCurrency(ar.original_amount, ar.currency)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Paid Amount</p>
                            <p className="font-bold text-green-400">{formatCurrency(ar.paid_amount || 0, ar.currency)}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dark-border">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-silver-light">Outstanding Balance</span>
                            <span className={`text-2xl font-bold ${ar.outstanding_amount <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {formatCurrency(ar.outstanding_amount, ar.currency)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment History */}
                {paymentHistory.length > 0 && (
                    <div className="glass-card p-4 rounded-lg mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <History className="w-5 h-5 text-blue-400" />
                            <h3 className="font-semibold text-silver-light">Payment History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-dark-border">
                                        <th className="text-left py-2 text-silver-dark font-medium">Date</th>
                                        <th className="text-left py-2 text-silver-dark font-medium">Payment Number</th>
                                        <th className="text-left py-2 text-silver-dark font-medium">Method</th>
                                        <th className="text-right py-2 text-silver-dark font-medium">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paymentHistory.map((payment) => (
                                        <tr key={payment.id} className="border-b border-dark-border/50">
                                            <td className="py-2 text-silver-light">{payment.payment_date}</td>
                                            <td className="py-2 text-silver-light font-mono text-xs">{payment.payment_number}</td>
                                            <td className="py-2">
                                                <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
                                                    {payment.payment_method?.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="py-2 text-right text-green-400 font-medium">
                                                {formatCurrency(payment.amount, payment.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {loadingHistory && (
                    <div className="glass-card p-4 rounded-lg mb-6 text-center">
                        <div className="animate-spin w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full mx-auto"></div>
                        <p className="text-silver-dark text-sm mt-2">Loading payment history...</p>
                    </div>
                )}

                {/* Notes */}
                {invoiceFull?.notes && (
                    <div className="glass-card p-4 rounded-lg mb-6">
                        <p className="text-xs text-silver-dark mb-1">Notes</p>
                        <p className="text-silver-light text-sm">{invoiceFull.notes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    {ar.outstanding_amount > 0 && canEditAR && (
                        <Button icon={DollarSign} onClick={onRecordPayment}>
                            Record Payment
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// Payment Record Modal Component — AR version (mirrors APPaymentRecordModal)
const PaymentRecordModal = ({ ar, formatCurrency, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: ar.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        received_in_account: '',
        ar_coa_id: '',
        notes: ''
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [arAccountsList, setArAccountsList] = useState([]);
    const [loading, setLoading] = useState(false);
    // Success state
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);

    useEffect(() => {
        fetchBankAccounts();
        fetchARAccounts();
    }, []);

    const fetchARAccounts = async () => {
        try {
            const { data } = await supabase.from('finance_coa').select('*').eq('type', 'ASSET').order('code');
            if (data && data.length > 0) {
                setArAccountsList(data);

                // Attempt to pre-select 'Piutang Usaha'
                const match = data.find(c => c.name.toLowerCase().includes('piutang') || c.code.startsWith('1-03'));
                if (match) setFormData(prev => ({ ...prev, ar_coa_id: match.id }));
                else setFormData(prev => ({ ...prev, ar_coa_id: data[0].id }));
            }
        } catch (e) { console.error('Error fetching AR accounts:', e); }
    };

    const fetchBankAccounts = async () => {
        try {
            const { data: d1 } = await supabase.from('company_bank_accounts').select('*').order('display_order', { ascending: true });
            if (d1 && d1.length > 0) {
                setBankAccounts(d1);
                // Priority 1: match the bank account stored in the AR record
                const invoiceBankId = ar.payment_bank_account_id || ar.payment_bank_id;
                if (invoiceBankId) {
                    const match = d1.find(a => a.id === invoiceBankId);
                    if (match) { setFormData(prev => ({ ...prev, received_in_account: match.id })); return; }
                }
                // Priority 2: match same currency as AR
                const currencyMatch = d1.find(a => a.currency === ar.currency);
                if (currencyMatch) { setFormData(prev => ({ ...prev, received_in_account: currencyMatch.id })); return; }
                // Priority 3: first account
                setFormData(prev => ({ ...prev, received_in_account: d1[0].id }));
                return;
            }
            // fallback to old bank_accounts table
            const { data: d2 } = await supabase.from('bank_accounts').select('*').eq('is_active', true);
            setBankAccounts(d2 || []);
            const defaultAccount = d2?.find(acc => acc.is_default && acc.currency === ar.currency);
            if (defaultAccount) setFormData(prev => ({ ...prev, received_in_account: defaultAccount.id }));
        } catch (error) {
            console.error('Error fetching bank accounts:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.amount <= 0) {
            alert('Payment amount must be greater than 0');
            return;
        }

        if (formData.amount > ar.outstanding_amount) {
            alert(`Payment amount cannot exceed outstanding amount (${formatCurrency(ar.outstanding_amount, ar.currency)})`);
            return;
        }

        try {
            setLoading(true);

            const { data: userData } = await supabase.auth.getUser();
            const createdBy = userData?.user?.email || 'System';

            const year = new Date().getFullYear();
            const paymentNumber = `PMT-IN-${year}-${String(Date.now()).slice(-6)}`;

            const selectedBank = bankAccounts.find(b => b.id === formData.received_in_account);

            // ── Resolve invoice ID ──────────────────────────────────────────
            // ar.invoice_id = ID invoice dari blink_ar_transactions atau hasil fallback mapping
            // ar.id         = ID AR itu sendiri (bisa dari big_ar_transactions)
            let invoiceId = ar.invoice_id || null;

            // Jika invoice_id tidak ada, cari via invoice_number di blink_invoices
            if (!invoiceId && ar.invoice_number) {
                const { data: invByNum } = await supabase
                    .from('blink_invoices')
                    .select('id')
                    .eq('invoice_number', ar.invoice_number)
                    .limit(1);
                if (invByNum && invByNum.length > 0) {
                    invoiceId = invByNum[0].id;
                }
            }

            // Jika masih tidak ada, coba ar.id sebagai invoice id (fallback blink_invoices path)
            if (!invoiceId) {
                const { data: invById } = await supabase
                    .from('blink_invoices')
                    .select('id')
                    .eq('id', ar.id)
                    .limit(1);
                if (invById && invById.length > 0) {
                    invoiceId = ar.id;
                }
            }

            if (!invoiceId) {
                throw new Error(`Invoice tidak ditemukan. AR: ${ar.invoice_number || ar.id}. Silakan buka Invoice Management dan pastikan invoice sudah terbentuk.`);
            }
            // ───────────────────────────────────────────────────────────────

            // ── Save Payment Record ─────────────────────────────────────────
            const paymentData = {
                payment_number: paymentNumber,
                payment_type: 'incoming',
                payment_date: formData.payment_date,
                reference_type: 'invoice',
                reference_id: invoiceId,
                reference_number: ar.invoice_number,
                amount: parseFloat(formData.amount),
                currency: ar.currency,
                payment_method: formData.payment_method,
                bank_account: selectedBank
                    ? `${selectedBank.bank_name} - ${selectedBank.account_number}`
                    : null,
                transaction_ref: formData.reference_number || null,
                description: `Payment for ${ar.invoice_number}`,
                notes: formData.notes || null,
                status: 'completed',
                created_by: createdBy
            };

            const { error: paymentError } = await supabase
                .from('blink_payments')
                .insert([paymentData]);

            if (paymentError) {
                console.warn('[AR] Payment record insert failed:', paymentError.message, '— continuing with invoice update.');
                // Non-fatal: payment record is supplementary
            }

            // ── Update Invoice Balances ─────────────────────────────────────
            const newPaidAmount = (ar.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = Math.max(0, (ar.original_amount || 0) - newPaidAmount);

            let newStatus = 'unpaid';
            if (newOutstanding <= 0) newStatus = 'paid';
            else if (newPaidAmount > 0) newStatus = 'partially_paid';

            const { error: invoiceError } = await supabase
                .from('blink_invoices')
                .update({ paid_amount: newPaidAmount, outstanding_amount: newOutstanding, status: newStatus })
                .eq('id', invoiceId);

            if (invoiceError) throw invoiceError;

            // ── Update AR Transaction ───────────────────────────────────────
            const { error: arUpdateError } = await supabase
                .from('blink_ar_transactions')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus,
                    last_payment_date: formData.payment_date,
                    last_payment_amount: parseFloat(formData.amount),
                    invoice_id: invoiceId // ensure backfilled
                })
                .eq('id', ar.id);

            if (arUpdateError) {
                console.warn('[AR] AR transaction update warning:', arUpdateError.message);
            }

            // ── AUTO JOURNAL: Payment Only (Dr Bank / Cr Piutang) ──────────
            // CATATAN: Invoice journal (Dr Piutang / Cr Pendapatan) dibuat oleh
            // "Migrate Auto Journal" di Invoice Management — BUKAN di sini.
            // Jika dibuat di sini juga, akan terjadi duplikasi pencatatan.
            try {
                const coaList = await getAllCOA();

                // Hanya buat payment journal — TIDAK membuat invoice journal
                await createARPaymentJournal({
                    invoice: {
                        id: invoiceId,
                        invoice_number: ar.invoice_number,
                        customer_id: ar.customer_id,
                        customer_name: ar.customer_name,
                        currency: ar.currency,
                        exchange_rate: ar.exchange_rate || 1
                    },
                    paymentAmount: parseFloat(formData.amount),
                    paymentDate: formData.payment_date,
                    paymentNumber,
                    selectedBank,
                    arCOAId: formData.ar_coa_id,
                    bankCOAId: selectedBank?.coa_id || null,
                    coaList
                });
                console.log('[AR] Payment journal created for', paymentNumber);
            } catch (jeError) {
                console.warn('[AR] Payment journal warning (non-critical):', jeError.message);
            }

            // ── REVERSAL JOURNAL: Jika Lunas ───────────────────────────────
            if (newStatus === 'paid' && newOutstanding <= 0) {
                try {
                    const { data: invoiceData } = await supabase
                        .from('blink_invoices')
                        .select('*')
                        .eq('id', invoiceId)
                        .single();

                    if (invoiceData) {
                        await createARReversalJournal({
                            invoice: invoiceData,
                            coaList
                        });
                        console.log('[AR] Reversal journal created for', invoiceId);
                    }
                } catch (revError) {
                    console.warn('[AR] Reversal journal warning (non-critical):', revError.message);
                }
            }
            // ───────────────────────────────────────────────────────────────


            setSuccessData({
                paymentNumber,
                amountPaid: parseFloat(formData.amount),
                newOutstanding,
                newStatus,
                currency: ar.currency || 'IDR'
            });
            setPaymentSuccess(true);
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Success state UI
    if (paymentSuccess && successData) {
        return (
            <Modal isOpen={true} onClose={() => { onSuccess(); }} maxWidth="max-w-lg">
                <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-500 mb-2">Payment Received!</h2>
                    <p className="text-silver-dark mb-6">Payment has been recorded in the system</p>
                    <div className="glass-card p-4 rounded-lg mb-6 text-left bg-green-500/5 border border-green-500/20">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Payment Number:</span>
                                <span className="text-silver-light font-mono font-medium">{successData.paymentNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Amount Received:</span>
                                <span className="text-green-400 font-bold">{formatCurrency(successData.amountPaid, successData.currency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Outstanding Balance:</span>
                                <span className={`font-bold ${successData.newOutstanding <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {formatCurrency(Math.max(0, successData.newOutstanding), successData.currency)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">New Status:</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${successData.newStatus === 'paid' ? 'bg-green-500/20 text-green-400' :
                                    successData.newStatus === 'partially_paid' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {successData.newStatus === 'paid' ? 'PAID' :
                                        successData.newStatus === 'partially_paid' ? 'PARTIAL' : 'OUTSTANDING'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <Button onClick={() => { onSuccess(); }} className="w-full">Close</Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">Record AR Payment</h2>

                {/* Invoice Info Summary */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-gradient-to-br from-accent-orange/10 to-transparent border border-accent-orange/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-silver-dark">Invoice:</span>
                            <span className="text-silver-light font-medium ml-2">{ar.invoice_number}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Customer:</span>
                            <span className="text-silver-light font-medium ml-2">{ar.customer_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Total Amount:</span>
                            <span className="text-silver-light font-medium ml-2">{formatCurrency(ar.total_amount, ar.currency)}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Outstanding:</span>
                            <span className="text-yellow-400 font-bold ml-2">{formatCurrency(ar.outstanding_amount, ar.currency)}</span>
                        </div>
                    </div>
                </div>

                {/* ── Bank account printed on Invoice ── */}
                {ar.payment_bank_account && (
                    <div className="flex items-start gap-2 px-3 py-2 mb-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <CreditCard className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                        <div className="text-xs">
                            <p className="text-blue-300 font-semibold mb-0.5">Rekening yang tercetak di Invoice:</p>
                            <p className="text-blue-200 font-mono">{ar.payment_bank_account}</p>
                            <p className="text-blue-400 mt-0.5">Pastikan pembayaran diterima di rekening ini.</p>
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Payment Date *
                            </label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                                className="w-full"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Amount ({ar.currency}) *
                            </label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full"
                                min="0"
                                max={ar.outstanding_amount}
                                step="0.01"
                                required
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                Max: {formatCurrency(ar.outstanding_amount, ar.currency)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Payment Method *
                            </label>
                            <select
                                value={formData.payment_method}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                                className="w-full"
                                required
                            >
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cash">Cash</option>
                                <option value="check">Check / Giro</option>
                                <option value="credit_card">Credit Card</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Reference Number
                            </label>
                            <input
                                type="text"
                                value={formData.reference_number}
                                onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                                placeholder="e.g., Transfer ref, Check #"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Received in Account — with invoice bank account validation */}
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            <CreditCard className="w-4 h-4 inline mr-1" />
                            No. Rekening Penerimaan <span className="text-red-400">*</span>
                        </label>
                        {bankAccounts.length > 0 ? (
                            <>
                                <select
                                    value={formData.received_in_account}
                                    onChange={(e) => setFormData(prev => ({ ...prev, received_in_account: e.target.value }))}
                                    className="w-full"
                                    required
                                >
                                    <option value="">-- Select Bank Account --</option>
                                    {bankAccounts.map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.bank_name} — {account.account_number} ({account.account_holder || account.currency})
                                        </option>
                                    ))}
                                </select>
                                {/* Show selected bank detail */}
                                {formData.received_in_account && (() => {
                                    const sel = bankAccounts.find(b => b.id === formData.received_in_account);
                                    const invoiceBankId = ar.payment_bank_account_id;
                                    const mismatch = invoiceBankId && sel && sel.id !== invoiceBankId;
                                    return sel ? (
                                        <div className={`mt-1.5 px-3 py-2 rounded-lg text-xs border ${mismatch ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-300' : 'bg-green-500/10 border-green-500/30 text-green-300'}`}>
                                            {mismatch && <p className="font-semibold mb-0.5">⚠️ Berbeda dari rekening di Invoice!</p>}
                                            <p>🏦 {sel.bank_name} | <span className="font-mono">{sel.account_number}</span></p>
                                            {sel.account_holder && <p>a/n {sel.account_holder}</p>}
                                        </div>
                                    ) : null;
                                })()}
                            </>
                        ) : (
                            <p className="text-sm text-silver-dark italic">
                                No bank accounts configured. Go to Company Settings to add accounts.
                            </p>
                        )}
                    </div>

                    {/* Piutang Account Override */}
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Akun Piutang (AR Account)
                        </label>
                        <select
                            value={formData.ar_coa_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, ar_coa_id: e.target.value }))}
                            className="w-full"
                        >
                            <option value="">-- Pilih Akun Piutang --</option>
                            {arAccountsList.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.code} - {c.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-silver-dark mt-1">Dicatat di General Ledger sebagai pengurang piutang.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Optional payment notes..."
                            rows={2}
                            className="w-full"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} icon={DollarSign}>
                            {loading ? 'Processing...' : 'Record Payment'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
export default AccountsReceivable;
