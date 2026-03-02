import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    DollarSign, TrendingDown, AlertCircle, Clock, Package,
    Search, Download, FileText, Calendar, CheckCircle, Eye, X,
    Building, CreditCard, Banknote, History
} from 'lucide-react';

// AP Payment Record Modal Component
const APPaymentRecordModal = ({ ap, formatCurrency, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: ap.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        paid_from_account: '',
        notes: ''
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    // Success state
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [successData, setSuccessData] = useState(null);

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    const fetchBankAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('company_bank_accounts')
                .select('*')
                .order('display_order', { ascending: true });

            if (error) throw error;
            setBankAccounts(data || []);

            // Set first bank account as default
            if (data && data.length > 0) {
                setFormData(prev => ({ ...prev, paid_from_account: data[0].id }));
            }
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

        if (formData.amount > ap.outstanding_amount) {
            alert(`Payment amount cannot exceed outstanding amount (${formatCurrency(ap.outstanding_amount, ap.currency)})`);
            return;
        }

        try {
            setLoading(true);

            // Generate payment number
            const year = new Date().getFullYear();
            const paymentNumber = `PAY-OUT-${year}-${String(Date.now()).slice(-6)}`;

            // Get selected banking info
            const selectedBank = bankAccounts.find(b => b.id === formData.paid_from_account);

            // Create payment record
            const paymentData = {
                payment_number: paymentNumber,
                payment_type: 'outgoing',
                payment_date: formData.payment_date,
                reference_type: 'po',
                reference_id: ap.id,
                reference_number: ap.ap_number,
                amount: parseFloat(formData.amount),
                currency: ap.currency || 'IDR',
                payment_method: formData.payment_method,
                bank_account: selectedBank ? `${selectedBank.bank_name} - ${selectedBank.account_number}` : null,
                transaction_ref: formData.reference_number || null,
                notes: formData.notes || null,
                status: 'completed'
            };

            const { error: paymentError } = await supabase
                .from('blink_payments')
                .insert([paymentData]);

            if (paymentError) throw paymentError;

            // Update AP transaction
            const newPaidAmount = (ap.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = ap.original_amount - newPaidAmount;

            let newStatus = ap.status;
            if (newOutstanding <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0 && newOutstanding > 0) {
                newStatus = 'partial';
            } else {
                newStatus = 'outstanding';
            }

            const { error: apError } = await supabase
                .from('blink_ap_transactions')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus,
                    last_payment_date: formData.payment_date,
                    last_payment_amount: parseFloat(formData.amount)
                })
                .eq('id', ap.id);

            if (apError) throw apError;

            // IMPORTANT: Also update the linked PO to keep data synchronized
            console.log('AP Payment - Syncing PO:', {
                ap_id: ap.id,
                po_id: ap.po_id,
                po_number: ap.po_number,
                newPaidAmount,
                newOutstanding
            });

            // Try to sync PO by po_id first, then by po_number
            let poIdentifier = ap.po_id;
            let lookupField = 'id';

            // If po_id is not available, try to find PO by po_number
            if (!poIdentifier && ap.po_number) {
                console.log('No po_id, looking up PO by po_number:', ap.po_number);
                const { data: poLookup, error: lookupError } = await supabase
                    .from('blink_purchase_orders')
                    .select('id')
                    .eq('po_number', ap.po_number)
                    .single();

                if (lookupError) {
                    console.warn('Could not find PO by po_number:', lookupError);
                } else if (poLookup) {
                    poIdentifier = poLookup.id;
                    console.log('Found PO by po_number, id:', poIdentifier);
                }
            }

            if (poIdentifier) {
                // Determine PO status based on payment
                let poStatus = 'approved'; // default
                if (newOutstanding <= 0) {
                    poStatus = 'received'; // Fully paid
                }

                const updateData = {
                    paid_amount: newPaidAmount,
                    outstanding_amount: Math.max(0, newOutstanding),
                    status: poStatus
                };

                console.log('Updating PO:', poIdentifier, 'with:', updateData);

                // Use update without .select() to avoid PGRST204 error when no rows returned
                const { error: poError } = await supabase
                    .from('blink_purchase_orders')
                    .update(updateData)
                    .eq('id', poIdentifier);

                if (poError) {
                    console.error('PO Sync Error:', poError);
                    // Don't throw - AP update was successful, PO sync is secondary
                } else {
                    console.log('PO Sync Success for ID:', poIdentifier);
                }
            } else {
                console.warn('No po_id or po_number found in AP record, cannot sync PO');
            }

            // Set success state instead of alert
            setSuccessData({
                paymentNumber,
                amountPaid: parseFloat(formData.amount),
                newOutstanding,
                newStatus,
                currency: ap.currency || 'IDR'
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
                    {/* Success Animation */}
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center animate-pulse">
                        <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>

                    <h2 className="text-2xl font-bold text-green-500 mb-2">Payment Successful!</h2>
                    <p className="text-silver-dark mb-6">Payment has been recorded in the system</p>

                    {/* Payment Details */}
                    <div className="glass-card p-4 rounded-lg mb-6 text-left bg-green-500/5 border border-green-500/20">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Payment Number:</span>
                                <span className="text-silver-light font-mono font-medium">{successData.paymentNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Amount Paid:</span>
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
                                    successData.newStatus === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {successData.newStatus === 'paid' ? 'PAID' :
                                        successData.newStatus === 'partial' ? 'PARTIAL' : 'OUTSTANDING'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button onClick={() => { onSuccess(); }} className="w-full">
                        Close
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">Record AP Payment</h2>

                {/* AP Info Summary */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-silver-dark">AP Number:</span>
                            <span className="text-silver-light font-medium ml-2">{ap.ap_number}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Vendor:</span>
                            <span className="text-silver-light font-medium ml-2">{ap.vendor_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">PO Number:</span>
                            <span className="text-silver-light font-medium ml-2">{ap.po_number || '-'}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Due Date:</span>
                            <span className="text-silver-light font-medium ml-2">{ap.due_date}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Total Amount:</span>
                            <span className="text-silver-light font-medium ml-2">{formatCurrency(ap.original_amount, ap.currency)}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Outstanding:</span>
                            <span className="text-red-400 font-bold ml-2">{formatCurrency(ap.outstanding_amount, ap.currency)}</span>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Payment Date *
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Payment Amount *
                            </label>
                            <input
                                type="number"
                                required
                                min="0"
                                max={ap.outstanding_amount}
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                                className="w-full"
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                Max: {formatCurrency(ap.outstanding_amount, ap.currency)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-dark mb-2">
                                Payment Method *
                            </label>
                            <select
                                required
                                value={formData.payment_method}
                                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                className="w-full"
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
                                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                placeholder="e.g., Transfer ref, Check #"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Bank Account Selection */}
                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            <CreditCard className="w-4 h-4 inline mr-1" />
                            Paid From Account
                        </label>
                        {bankAccounts.length > 0 ? (
                            <select
                                value={formData.paid_from_account}
                                onChange={(e) => setFormData({ ...formData, paid_from_account: e.target.value })}
                                className="w-full"
                            >
                                <option value="">-- Select Bank Account --</option>
                                {bankAccounts.map(bank => (
                                    <option key={bank.id} value={bank.id}>
                                        {bank.bank_name} - {bank.account_number} ({bank.account_holder})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-sm text-silver-dark italic">
                                No bank accounts configured. Go to Company Settings to add accounts.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-dark mb-2">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Optional payment notes..."
                            rows={2}
                            className="w-full"
                        />
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        <Button type="button" variant="secondary" onClick={onClose}>
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

// AP Detail Modal Component
const APDetailModal = ({ ap, formatCurrency, onClose, onRecordPayment }) => {
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [accounts, setAccounts] = useState([]); // COA list

    // Item-level COA state
    const [poItems, setPoItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [savingItems, setSavingItems] = useState(false);

    useEffect(() => {
        fetchPaymentHistory();
        fetchAccounts();
        if (ap.po_id) {
            fetchLinkedPODetails();
        }
    }, [ap.id]);

    const fetchPaymentHistory = async () => {
        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('blink_payments')
                .select('*')
                .eq('reference_id', ap.id)
                .order('payment_date', { ascending: false });

            if (error) throw error;
            setPaymentHistory(data || []);
        } catch (error) {
            console.error('Error fetching payment history:', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', 'EXPENSE')  // Expense accounts for AP
                .eq('is_active', true)
                .gte('level', 3)        // Only detail accounts (level >= 3)
                .order('group_name', { ascending: true })
                .order('code', { ascending: true });

            if (error) throw error;
            setAccounts(data || []);
        } catch (error) {
            console.error('Error fetching accounts:', error);
        }
    };

    const fetchLinkedPODetails = async () => {
        if (!ap.po_id) return;

        try {
            setLoadingItems(true);
            const { data, error } = await supabase
                .from('blink_purchase_orders')
                .select('po_items')
                .eq('id', ap.po_id)
                .single();

            if (error) throw error;

            if (data && data.po_items) {
                // Ensure items is an array
                const items = Array.isArray(data.po_items) ? data.po_items : [];
                setPoItems(items);
            }
        } catch (error) {
            console.error('Error fetching linked PO items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleItemCoaChange = (index, newCoaId) => {
        const updatedItems = [...poItems];
        updatedItems[index] = {
            ...updatedItems[index],
            coa_id: newCoaId
        };
        setPoItems(updatedItems);
    };

    const handleSaveChanges = async () => {
        if (!ap.po_id) return;

        try {
            setSavingItems(true);

            // Update the linked PO
            const { error } = await supabase
                .from('blink_purchase_orders')
                .update({ po_items: poItems })
                .eq('id', ap.po_id);

            if (error) throw error;

            alert('Alokasi akun berhasil disimpan!');
        } catch (error) {
            console.error('Error updating items:', error);
            alert('Failed to save perubahan: ' + error.message);
        } finally {
            setSavingItems(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold gradient-text">AP Detail</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${ap.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        ap.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                            ap.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                ap.status === 'outstanding' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-gray-500/20 text-gray-400'
                        }`}>
                        {ap.status === 'paid' ? 'PAID' :
                            ap.status === 'partial' ? 'PARTIAL' :
                                ap.status === 'overdue' ? 'OVERDUE' :
                                    ap.status === 'outstanding' ? 'OUTSTANDING' : ap.status?.toUpperCase()}
                    </span>
                </div>

                {/* AP Info */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">AP Number</p>
                        <p className="font-bold text-accent-orange">{ap.ap_number}</p>
                    </div>
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">PO Number</p>
                        <p className="font-bold text-silver-light">{ap.po_number || '-'}</p>
                    </div>
                    <div className="glass-card p-4 rounded-lg">
                        <p className="text-xs text-silver-dark mb-1">Vendor</p>
                        <p className="font-bold text-silver-light">{ap.vendor_name}</p>
                    </div>
                </div>

                {/* Item-Level Account / Cost Center Assignment */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-blue-500/5 border border-blue-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Building className="w-4 h-4" /> Item Allocation (Finance)
                        </h3>
                    </div>

                    {loadingItems ? (
                        <div className="text-center py-4 text-silver-dark text-sm animate-pulse">Loading item details...</div>
                    ) : poItems.length > 0 ? (
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
                                    {poItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-blue-500/5 transition-colors">
                                            <td className="py-3 px-4 text-silver-light font-medium align-top">
                                                {item.item_name || 'Item ' + (idx + 1)}
                                            </td>
                                            <td className="py-3 px-4 text-silver-light align-top">
                                                {item.description || '-'}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light align-top">
                                                {item.qty} {item.unit}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light align-top">
                                                {formatCurrency(item.unit_price || item.rate || 0, ap.currency)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-silver-light font-medium align-top">
                                                {formatCurrency(item.amount || (item.qty * (item.unit_price || item.rate)) || 0, ap.currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-silver-dark text-sm italic">
                            No item details found for this PO.
                        </div>
                    )}
                </div>

                {/* Financial Summary */}
                <div className="glass-card p-4 rounded-lg mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Banknote className="w-5 h-5 text-accent-green" />
                        <h3 className="font-semibold text-silver-light">Financial Summary</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Bill Date</p>
                            <p className="font-medium text-silver-light">{ap.bill_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Due Date</p>
                            <p className="font-medium text-silver-light">{ap.due_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Original Amount</p>
                            <p className="font-bold text-silver-light">{formatCurrency(ap.original_amount, ap.currency)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark mb-1">Paid Amount</p>
                            <p className="font-bold text-green-400">{formatCurrency(ap.paid_amount || 0, ap.currency)}</p>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-dark-border">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold text-silver-light">Outstanding Balance</span>
                            <span className={`text-2xl font-bold ${ap.outstanding_amount <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatCurrency(ap.outstanding_amount, ap.currency)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment History */}
                {paymentHistory.length > 0 && (
                    <div className="glass-card p-4 rounded-lg mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <History className="w-5 h-5 text-accent-blue" />
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
                {ap.notes && (
                    <div className="glass-card p-4 rounded-lg mb-6">
                        <p className="text-xs text-silver-dark mb-1">Notes</p>
                        <p className="text-silver-light text-sm">{ap.notes}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    {ap.outstanding_amount > 0 && (
                        <Button icon={DollarSign} onClick={onRecordPayment}>
                            Record Payment
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

const AccountsPayable = () => {
    const [apTransactions, setAPTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAP, setSelectedAP] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    useEffect(() => {
        fetchAPTransactions();
    }, []);

    const fetchAPTransactions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_ap_transactions')
                .select('*')
                .order('bill_date', { ascending: false });

            if (error) throw error;

            // Update aging bucket dynamically
            const updatedData = (data || []).map(ap => {
                const dueDate = new Date(ap.due_date);
                const today = new Date();
                const daysDiff = Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24));

                let aging_bucket = '0-30';
                let status = ap.status;

                if (ap.outstanding_amount <= 0) {
                    status = 'paid';
                } else if (daysDiff > 0) {
                    status = 'overdue';
                    if (daysDiff <= 30) aging_bucket = '0-30';
                    else if (daysDiff <= 60) aging_bucket = '31-60';
                    else if (daysDiff <= 90) aging_bucket = '61-90';
                    else aging_bucket = '90+';
                }

                return { ...ap, aging_bucket, status };
            });

            setAPTransactions(updatedData);
        } catch (error) {
            console.error('Error fetching AP:', error);
            setAPTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'IDR') => {
        const numValue = value || 0;
        return currency === 'USD'
            ? `$${numValue.toLocaleString('id-ID')}`
            : `Rp ${numValue.toLocaleString('id-ID')}`;
    };

    // Calculate metrics - more comprehensive
    const totalAPAmount = apTransactions.reduce((sum, ap) => sum + (ap.original_amount || 0), 0);
    const totalPaidAmount = apTransactions.reduce((sum, ap) => sum + (ap.paid_amount || 0), 0);
    const totalOutstanding = apTransactions.reduce((sum, ap) => sum + (ap.outstanding_amount || 0), 0);
    const overdueCount = apTransactions.filter(ap => ap.status === 'overdue' && ap.outstanding_amount > 0).length;
    const dueSoon = apTransactions.filter(ap => {
        const daysUntilDue = Math.ceil((new Date(ap.due_date) - new Date()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 7 && daysUntilDue >= 0 && ap.outstanding_amount > 0;
    }).reduce((sum, ap) => sum + ap.outstanding_amount, 0);
    const current30 = apTransactions.filter(ap => ap.aging_bucket === '0-30' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0);
    const aged90Plus = apTransactions.filter(ap => ap.aging_bucket === '90+' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0);

    // Aging summary
    const agingSummary = {
        '0-30': apTransactions.filter(ap => ap.aging_bucket === '0-30' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0),
        '31-60': apTransactions.filter(ap => ap.aging_bucket === '31-60' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0),
        '61-90': apTransactions.filter(ap => ap.aging_bucket === '61-90' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0),
        '90+': apTransactions.filter(ap => ap.aging_bucket === '90+' && ap.outstanding_amount > 0).reduce((sum, ap) => sum + ap.outstanding_amount, 0),
    };

    const filteredAP = apTransactions.filter(ap => {
        const matchesFilter = filter === 'all' || ap.aging_bucket === filter || ap.status === filter;
        const matchesSearch = !searchTerm ||
            ap.ap_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ap.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ap.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const handleRowClick = (ap) => {
        setSelectedAP(ap);
        setShowDetailModal(true);
    };

    const handleRecordPayment = (ap) => {
        setSelectedAP(ap);
        setShowDetailModal(false);
        setShowPaymentModal(true);
    };

    const handlePaymentSuccess = () => {
        setShowPaymentModal(false);
        setShowDetailModal(false);
        setSelectedAP(null);
        fetchAPTransactions();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Accounts Payable (AP)</h1>
                    <p className="text-silver-dark mt-1">Manage vendor payables</p>
                </div>
                <Button icon={Download}>Export to Excel</Button>
            </div>

            {/* Summary Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total AP Amount</p>
                        <DollarSign className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-blue-400">{formatCurrency(totalAPAmount)}</p>
                    <p className="text-xs text-silver-dark">{apTransactions.length} transactions</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Paid</p>
                        <CheckCircle className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totalPaidAmount)}</p>
                    <p className="text-xs text-silver-dark">{apTransactions.filter(ap => ap.status === 'paid').length} paid</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Outstanding Balance</p>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-xl font-bold text-red-400">{formatCurrency(totalOutstanding)}</p>
                    <p className="text-xs text-silver-dark">{apTransactions.filter(ap => ap.outstanding_amount > 0).length} unpaid</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Overdue</p>
                        <Clock className="w-4 h-4 text-orange-400" />
                    </div>
                    <p className="text-xl font-bold text-orange-400">{overdueCount}</p>
                    <p className="text-xs text-silver-dark">{formatCurrency(apTransactions.filter(ap => ap.status === 'overdue').reduce((sum, ap) => sum + ap.outstanding_amount, 0))}</p>
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
                                    className={`h-full ${bucket === '0-30' ? 'bg-blue-400' :
                                        bucket === '31-60' ? 'bg-yellow-400' :
                                            bucket === '61-90' ? 'bg-orange-400' : 'bg-red-400'
                                        }`}
                                    style={{ width: `${totalAPAmount > 0 ? (amount / totalAPAmount) * 100 : 0}%` }}
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
                        placeholder="Search AP number, PO, atau vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-base"
                    />
                </div>
            </div>

            {/* AP Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">AP Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">PO #</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Vendor</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Bill Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Due Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Original</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Paid</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Outstanding</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {loading ? (
                                <tr>
                                    <td colSpan="9" className="px-3 py-8 text-center">
                                        <div className="animate-spin w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full mx-auto"></div>
                                        <p className="text-silver-dark mt-2 text-sm">Loading...</p>
                                    </td>
                                </tr>
                            ) : filteredAP.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-3 py-8 text-center">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2" />
                                        <p className="text-silver-dark text-sm">No AP transactions yet.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredAP.map((ap) => (
                                    <tr
                                        key={ap.id}
                                        className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                        onClick={() => handleRowClick(ap)}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="font-medium text-accent-orange">{ap.ap_number}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ap.po_number || '-'}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-light">{ap.vendor_name}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className="text-silver-dark">{ap.bill_date}</span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span className={`${ap.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                                {ap.due_date}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-silver-light">{formatCurrency(ap.original_amount, ap.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="text-green-400">{formatCurrency(ap.paid_amount || 0, ap.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-semibold text-red-400">{formatCurrency(ap.outstanding_amount, ap.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ap.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                ap.status === 'partial' ? 'bg-yellow-500/20 text-yellow-400' :
                                                    ap.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                                        ap.status === 'outstanding' ? 'bg-blue-500/20 text-blue-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                }`}>
                                                {ap.status === 'paid' ? 'Paid' :
                                                    ap.status === 'partial' ? 'Partial' :
                                                        ap.status === 'overdue' ? 'Overdue' :
                                                            ap.status === 'outstanding' ? 'Outstanding' : ap.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* AP Detail Modal */}
            {showDetailModal && selectedAP && (
                <APDetailModal
                    ap={selectedAP}
                    formatCurrency={formatCurrency}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedAP(null);
                    }}
                    onRecordPayment={() => handleRecordPayment(selectedAP)}
                />
            )}

            {/* Payment Modal */}
            {showPaymentModal && selectedAP && (
                <APPaymentRecordModal
                    ap={selectedAP}
                    formatCurrency={formatCurrency}
                    onClose={() => {
                        setShowPaymentModal(false);
                        setSelectedAP(null);
                    }}
                    onSuccess={handlePaymentSuccess}
                />
            )}
        </div>
    );
};

export default AccountsPayable;
