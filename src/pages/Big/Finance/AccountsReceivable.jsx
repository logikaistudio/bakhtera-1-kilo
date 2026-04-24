import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import Button from '../../../../components/Common/Button';
import Modal from '../../../../components/Common/Modal';
import {
    DollarSign, TrendingUp, AlertTriangle, Clock, Users,
    Search, Download, FileText, Calendar, X, CheckCircle, AlertCircle, CreditCard
} from 'lucide-react';

const BigAR = () => {
    const [arTransactions, setARTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAR, setSelectedAR] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
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

            // Fetch BIG invoices - exclude draft and cancelled
            const { data: invoices, error: invoicesError } = await supabase
                .from('big_invoices')
                .select(`
                    *,
                    event:big_events(event_name),
                    client:freight_customers(name)
                `)
                .neq('status', 'cancelled')
                .neq('status', 'draft')
                .order('due_date', { ascending: true });

            if (invoicesError) throw invoicesError;

            // Transform invoice data to AR format
            const arData = (invoices || []).map(inv => ({
                id: inv.id,
                ar_number: `AR-${inv.invoice_number || inv.id.slice(-6).toUpperCase()}`,
                invoice_number: inv.invoice_number,
                client_name: inv.client?.name || 'N/A',
                client_id: inv.client_id,
                event_name: inv.event?.event_name || 'N/A',
                event_id: inv.event_id,
                transaction_date: inv.invoice_date,
                due_date: inv.due_date,
                original_amount: inv.total_amount || 0,
                paid_amount: inv.paid_amount || 0,
                outstanding_amount: (inv.total_amount || 0) - (inv.paid_amount || 0),
                aging_bucket: calculateAgingBucket(inv.due_date),
                status: deriveStatus(inv.paid_amount || 0, inv.total_amount || 0, inv.due_date),
                currency: 'IDR'
            }));

            setARTransactions(arData);
        } catch (error) {
            console.error('Error fetching AR:', error);
            alert('Failed to load AR data: ' + error.message);
            setARTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return 'Rp ' + (value || 0).toLocaleString('id-ID');
    };

    // Calculate metrics
    const totalARAmount = arTransactions.reduce((sum, ar) => sum + (ar.original_amount || 0), 0);
    const totalPaidAmount = arTransactions.reduce((sum, ar) => sum + (ar.paid_amount || 0), 0);
    const totalReceivables = arTransactions.reduce((sum, ar) => sum + (ar.outstanding_amount || 0), 0);

    // Counts
    const paidCount = arTransactions.filter(ar => ar.status === 'paid').length;
    const outstandingCount = arTransactions.filter(ar => ar.outstanding_amount > 0).length;
    const overdueCount = arTransactions.filter(ar => ar.status === 'overdue').length;
    const overdueTotal = arTransactions.filter(ar => ar.status === 'overdue').reduce((sum, ar) => sum + ar.outstanding_amount, 0);

    // Aging summary
    const agingSummary = {
        '0-30': arTransactions.filter(ar => ar.aging_bucket === '0-30').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '31-60': arTransactions.filter(ar => ar.aging_bucket === '31-60').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '61-90': arTransactions.filter(ar => ar.aging_bucket === '61-90').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
        '90+': arTransactions.filter(ar => ar.aging_bucket === '90+').reduce((sum, ar) => sum + ar.outstanding_amount, 0),
    };

    const filteredAR = arTransactions.filter(ar => {
        const matchesSearch = !searchTerm ||
            ar.ar_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.event_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleRecordPayment = (ar) => {
        setSelectedAR(ar);
        setShowPaymentModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-green-400" />
                        Event AR (Piutang)
                    </h1>
                    <p className="text-silver-dark mt-1">Kelola piutang dari pelanggan event</p>
                </div>
                <Button icon={Download}>Export to Excel</Button>
            </div>

            {/* Summary Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Piutang AR</p>
                        <DollarSign className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(totalARAmount)}</p>
                    <p className="text-xs text-silver-dark">{arTransactions.length} transaksi</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Diterima</p>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaidAmount)}</p>
                    <p className="text-xs text-silver-dark">{paidCount} lunas</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Sisa Piutang</p>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totalReceivables)}</p>
                    <p className="text-xs text-silver-dark">{outstandingCount} belum lunas</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Jatuh Tempo</p>
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
                        placeholder="Cari AR number, invoice, customer, atau event..."
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
                        <thead className="bg-green-600">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">AR Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Invoice</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Event</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Client</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Due Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Total</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Paid</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Outstanding</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Aging</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="px-3 py-8 text-center">
                                        <div className="animate-pulse text-silver-dark">Loading...</div>
                                    </td>
                                </tr>
                            ) : filteredAR.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-3 py-8 text-center">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2" />
                                        <p className="text-silver-dark text-sm">Belum ada transaksi AR.</p>
                                        <p className="text-silver-dark text-xs mt-1">Approve invoice terlebih dahulu untuk membuat AR.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAR.map((ar) => (
                                    <tr
                                        key={ar.id}
                                        className="hover:bg-dark-surface smooth-transition"
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="font-medium text-green-400">{ar.ar_number}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light font-mono text-xs">{ar.invoice_number || '-'}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ar.event_name}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ar.client_name}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`${ar.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                                {ar.due_date}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-silver-light">{formatCurrency(ar.original_amount)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-green-400">{formatCurrency(ar.paid_amount)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-semibold text-yellow-400">{formatCurrency(ar.outstanding_amount)}</span>
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
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            {ar.outstanding_amount > 0 && (
                                                <button
                                                    onClick={() => handleRecordPayment(ar)}
                                                    className="p-1.5 hover:bg-green-500/20 rounded-lg smooth-transition"
                                                    title="Record Payment"
                                                >
                                                    <CreditCard className="w-4 h-4 text-green-400" />
                                                </button>
                                            )}
                                            {ar.status === 'paid' && (
                                                <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Recording Modal */}
            {showPaymentModal && selectedAR && (
                <BigARPaymentModal
                    ar={selectedAR}
                    formatCurrency={formatCurrency}
                    onClose={() => setShowPaymentModal(false)}
                    onSuccess={() => {
                        setShowPaymentModal(false);
                        fetchARTransactions();
                    }}
                />
            )}
        </div>
    );
};

// Payment Recording Modal for BIG AR
const BigARPaymentModal = ({ ar, formatCurrency, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: ar.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.amount <= 0) {
            alert('Payment amount must be greater than 0');
            return;
        }

        if (formData.amount > ar.outstanding_amount) {
            alert(`Payment amount cannot exceed outstanding amount (${formatCurrency(ar.outstanding_amount)})`);
            return;
        }

        try {
            setLoading(true);

            const newPaidAmount = (ar.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = ar.original_amount - newPaidAmount;

            let newStatus = 'unpaid';
            if (newOutstanding <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partial';
            }

            // Update big_invoices
            const { error: invoiceError } = await supabase
                .from('big_invoices')
                .update({
                    paid_amount: newPaidAmount,
                    status: newStatus
                })
                .eq('id', ar.id);

            if (invoiceError) throw invoiceError;

            // Update big_ar_transactions if exists
            await supabase
                .from('big_ar_transactions')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                })
                .eq('invoice_id', ar.id);

            // Create journal entries for payment
            const { data: cashCoa } = await supabase
                .from('finance_coa')
                .select('id')
                .eq('type', 'ASSET')
                .ilike('name', '%kas%')
                .limit(1)
                .single();

            const { data: arCoa } = await supabase
                .from('finance_coa')
                .select('id')
                .eq('type', 'ASSET')
                .ilike('name', '%piutang%')
                .limit(1)
                .single();

            if (cashCoa && arCoa) {
                await supabase.from('blink_journal_entries').insert([
                    {
                        entry_date: formData.payment_date,
                        coa_id: cashCoa.id,
                        debit: parseFloat(formData.amount),
                        credit: 0,
                        description: `Payment received - ${ar.invoice_number || ar.ar_number}`,
                        reference_type: 'big_payment',
                        reference_id: ar.id
                    },
                    {
                        entry_date: formData.payment_date,
                        coa_id: arCoa.id,
                        debit: 0,
                        credit: parseFloat(formData.amount),
                        description: `AR Payment - ${ar.invoice_number || ar.ar_number}`,
                        reference_type: 'big_payment',
                        reference_id: ar.id
                    }
                ]);
            }

            alert(`✅ Payment recorded successfully!`);
            onSuccess();
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title="Record Payment">
            <div className="p-6 space-y-6">
                {/* AR Info Summary */}
                <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-silver-dark">AR Number:</span>
                            <span className="text-green-400 font-medium ml-2">{ar.ar_number}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Client:</span>
                            <span className="text-silver-light font-medium ml-2">{ar.client_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Event:</span>
                            <span className="text-silver-light font-medium ml-2">{ar.event_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Due Date:</span>
                            <span className={`font-medium ml-2 ${ar.status === 'overdue' ? 'text-red-400' : 'text-silver-light'}`}>
                                {ar.due_date}
                            </span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Total Amount:</span>
                            <span className="text-silver-light font-medium ml-2">{formatCurrency(ar.original_amount)}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Outstanding:</span>
                            <span className="text-yellow-400 font-bold ml-2">{formatCurrency(ar.outstanding_amount)}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Payment Date & Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-silver-light mb-1">
                                Payment Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-silver-light mb-1">
                                Amount (IDR) <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                min="0"
                                max={ar.outstanding_amount}
                                step="1"
                                required
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                Max: {formatCurrency(ar.outstanding_amount)}
                            </p>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-xs font-semibold text-silver-light mb-1">
                            Payment Method <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            required
                        >
                            <option value="bank_transfer">Bank Transfer</option>
                            <option value="cash">Cash</option>
                            <option value="check">Check</option>
                            <option value="credit_card">Credit Card</option>
                        </select>
                    </div>

                    {/* Reference Number */}
                    <div>
                        <label className="block text-xs font-semibold text-silver-light mb-1">
                            Reference Number
                        </label>
                        <input
                            type="text"
                            value={formData.reference_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            placeholder="Transaction ID, Check number, etc."
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-semibold text-silver-light mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            rows="2"
                            placeholder="Optional notes..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                        <Button variant="secondary" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading} icon={CreditCard}>
                            {loading ? 'Processing...' : 'Record Payment'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default BigAR;
