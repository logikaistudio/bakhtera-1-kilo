import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import {
    DollarSign, TrendingUp, AlertTriangle, Clock, Users,
    Search, Download, FileText, Calendar, X, CheckCircle, AlertCircle
} from 'lucide-react';

const AccountsReceivable = () => {
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

            // Fetch invoices (AR source data) - exclude draft and cancelled
            const { data: invoices, error: invoicesError } = await supabase
                .from('blink_invoices')
                .select('*')
                .neq('status', 'cancelled')
                .neq('status', 'draft')
                .order('due_date', { ascending: true });

            console.log('AR Query Result:', invoices?.length || 0, 'invoices found');
            if (invoices) console.log('Invoice statuses:', invoices.map(i => i.status));

            if (invoicesError) throw invoicesError;

            // Transform invoice data to AR format
            const arData = (invoices || []).map(inv => ({
                id: inv.id,
                ar_number: inv.invoice_number, // Use invoice number as AR identifier
                invoice_number: inv.invoice_number,
                customer_name: inv.customer_name,
                transaction_date: inv.invoice_date,
                due_date: inv.due_date,
                original_amount: inv.total_amount,
                paid_amount: inv.paid_amount || 0,
                outstanding_amount: inv.outstanding_amount || (inv.total_amount - (inv.paid_amount || 0)),
                aging_bucket: calculateAgingBucket(inv.due_date),
                status: deriveStatus(inv.paid_amount || 0, inv.total_amount, inv.due_date),
                currency: inv.currency || 'IDR',
                total_amount: inv.total_amount
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
            ar.ar_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ar.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Accounts Receivable (AR)</h1>
                    <p className="text-silver-dark mt-1">Kelola piutang dari pelanggan</p>
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
                        placeholder="Search AR number, invoice, atau customer..."
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
                                        <p className="text-silver-dark text-sm">Belum ada transaksi AR.</p>
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
                />
            )}

            {/* Payment Record Modal */}
            {showPaymentModal && selectedAR && (
                <PaymentRecordModal
                    invoice={selectedAR}
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

// AR Detail Modal Component
const ARDetailModal = ({ ar, onClose, onRecordPayment, formatCurrency }) => {
    const [accounts, setAccounts] = useState([]); // COA list
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [savingItems, setSavingItems] = useState(false);

    useEffect(() => {
        fetchAccounts();
        fetchInvoiceItems();
    }, [ar.id]);

    const fetchAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', 'REVENUE')  // Revenue accounts for AR
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

    const fetchInvoiceItems = async () => {
        try {
            setLoadingItems(true);
            const { data, error } = await supabase
                .from('blink_invoices')
                .select('invoice_items')
                .eq('id', ar.id)
                .single();

            if (error) throw error;

            if (data && data.invoice_items) {
                const items = Array.isArray(data.invoice_items) ? data.invoice_items : [];
                setInvoiceItems(items);
            }
        } catch (error) {
            console.error('Error fetching invoice items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleItemCoaChange = (index, newCoaId) => {
        const updatedItems = [...invoiceItems];
        updatedItems[index] = {
            ...updatedItems[index],
            coa_id: newCoaId
        };
        setInvoiceItems(updatedItems);
    };

    const handleSaveChanges = async () => {
        try {
            setSavingItems(true);

            // Update the invoice directly
            const { error } = await supabase
                .from('blink_invoices')
                .update({ invoice_items: invoiceItems })
                .eq('id', ar.id);

            if (error) throw error;
            alert('Alokasi akun pendapatan berhasil disimpan!');
        } catch (error) {
            console.error('Error updating invoice items:', error);
            alert('Failed to save perubahan: ' + error.message);
        } finally {
            setSavingItems(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">{ar.ar_number}</h2>
                        <p className="text-silver-dark text-sm mt-1">
                            Invoice: {ar.invoice_number} • {ar.transaction_date}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-silver-dark hover:text-white smooth-transition">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="glass-card p-4 rounded-lg space-y-3">
                        <h3 className="text-accent-orange font-semibold flex items-center gap-2">
                            <Users className="w-4 h-4" /> Customer Details
                        </h3>
                        <div>
                            <p className="text-xs text-silver-dark">Customer Name</p>
                            <p className="text-silver-light font-medium">{ar.customer_name}</p>
                        </div>
                        <div>
                            <p className="text-xs text-silver-dark">Due Date</p>
                            <p className={`font-medium ${ar.status === 'overdue' ? 'text-red-400' : 'text-silver-light'}`}>
                                {ar.due_date} ({ar.aging_bucket} Days)
                            </p>
                        </div>
                    </div>

                    <div className="glass-card p-4 rounded-lg space-y-3 bg-gradient-to-br from-accent-orange/5 to-transparent border border-accent-orange/20">
                        <h3 className="text-accent-orange font-semibold flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Payment Status
                        </h3>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-silver-dark">Total Amount</p>
                            <p className="text-silver-light font-medium">{formatCurrency(ar.original_amount, ar.currency)}</p>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-silver-dark">Paid Amount</p>
                            <p className="text-green-400 font-medium">{formatCurrency(ar.paid_amount, ar.currency)}</p>
                        </div>
                        <div className="pt-2 border-t border-dark-border flex justify-between items-center">
                            <p className="text-sm font-semibold text-silver-light">Outstanding</p>
                            <p className="text-xl font-bold text-yellow-400">{formatCurrency(ar.outstanding_amount, ar.currency)}</p>
                        </div>
                    </div>
                </div>

                {/* Item-Level Account / Revenue Assignment */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-green-400 flex items-center gap-2">
                            <DollarSign className="w-4 h-4" /> Alokasi Akun Per Item (Finance)
                        </h3>
                        <Button
                            size="sm"
                            icon={CheckCircle}
                            onClick={handleSaveChanges}
                            disabled={savingItems || loadingItems}
                            className={savingItems ? 'opacity-50' : ''}
                        >
                            {savingItems ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>

                    {loadingItems ? (
                        <div className="text-center py-4 text-silver-dark text-sm animate-pulse">Memuat detail items...</div>
                    ) : invoiceItems.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-dark-border text-left">
                                        <th className="py-2 text-silver-dark font-medium pl-2">Deskripsi Item</th>
                                        <th className="py-2 text-silver-dark font-medium text-right pr-4">Nilai</th>
                                        <th className="py-2 text-silver-dark font-medium w-1/2">Akun Pendapatan (COA)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/50">
                                    {invoiceItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-green-500/5 transition-colors">
                                            <td className="py-2 pl-2 text-silver-light">
                                                <div className="font-medium">{item.description || 'Item ' + (idx + 1)}</div>
                                                <div className="text-xs text-silver-dark">
                                                    {item.qty} {item.unit} x {formatCurrency(parseFloat(item.rate) || 0, ar.currency)}
                                                </div>
                                            </td>
                                            <td className="py-2 text-right pr-4 text-silver-light font-medium">
                                                {formatCurrency(parseFloat(item.amount) || (item.qty * parseFloat(item.rate)) || 0, ar.currency)}
                                            </td>
                                            <td className="py-2">
                                                <select
                                                    value={item.coa_id || ''}
                                                    onChange={(e) => handleItemCoaChange(idx, e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-dark-bg border border-dark-border rounded text-xs text-silver-light focus:border-green-400 transition-colors"
                                                >
                                                    <option value="">-- Pilih Akun --</option>
                                                    {accounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.code} - {acc.name} {acc.group_name ? `(${acc.group_name})` : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-4 text-silver-dark text-sm italic">
                            Tidak ada detail item yang ditemukan di Invoice ini.
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    {ar.outstanding_amount > 0 && (
                        <button
                            onClick={onRecordPayment}
                            className="flex items-center gap-2 px-6 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition font-semibold shadow-lg shadow-accent-orange/20"
                        >
                            <DollarSign className="w-4 h-4" />
                            Record Payment
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

// Payment Record Modal Component (Copied from InvoiceManagement)
const PaymentRecordModal = ({ invoice, formatCurrency, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: invoice.outstanding_amount || 0,
        payment_method: 'bank_transfer',
        reference_number: '',
        received_in_account: '',
        notes: ''
    });
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchBankAccounts();
    }, []);

    const fetchBankAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('bank_accounts')
                .select('*')
                .eq('is_active', true)
                .order('is_default', { ascending: false });

            if (error) throw error;
            setBankAccounts(data || []);

            // Set default bank account
            const defaultAccount = data?.find(acc => acc.is_default && acc.currency === invoice.currency);
            if (defaultAccount) {
                setFormData(prev => ({ ...prev, received_in_account: defaultAccount.id }));
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

        if (formData.amount > invoice.outstanding_amount) {
            alert(`Payment amount cannot exceed outstanding amount (${formatCurrency(invoice.outstanding_amount, invoice.currency)})`);
            return;
        }

        try {
            setLoading(true);

            // Generate payment number
            const year = new Date().getFullYear();
            const paymentNumber = `PMT-${year}-${String(Date.now()).slice(-6)}`;

            // Get selected banking info
            const selectedBank = bankAccounts.find(b => b.id === formData.received_in_account);

            console.log('📝 Recording AR payment for invoice:', invoice.invoice_number, 'ID:', invoice.id);

            // Create payment record
            const paymentData = {
                payment_number: paymentNumber,
                payment_type: 'incoming',
                payment_date: formData.payment_date,
                reference_type: 'invoice',
                reference_id: invoice.id,
                reference_number: invoice.invoice_number,
                amount: parseFloat(formData.amount),
                currency: invoice.currency,
                payment_method: formData.payment_method,
                bank_account: selectedBank ? `${selectedBank.bank_name} - ${selectedBank.account_number}` : null,
                transaction_ref: formData.reference_number || null,
                notes: formData.notes || null,
                status: 'completed'
            };

            const { data: paymentResult, error: paymentError } = await supabase
                .from('blink_payments')
                .insert([paymentData])
                .select();

            if (paymentError) throw paymentError;
            console.log('✅ Payment created:', paymentResult);

            // Update invoice - use total_amount from the AR object
            const newPaidAmount = (invoice.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = invoice.total_amount - newPaidAmount;

            let newStatus = 'unpaid';
            if (newOutstanding <= 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0) {
                newStatus = 'partially_paid';
            }

            console.log('📊 Updating invoice:', {
                id: invoice.id,
                currentPaid: invoice.paid_amount,
                newPaid: newPaidAmount,
                newOutstanding: newOutstanding,
                newStatus: newStatus
            });

            const { data: invoiceResult, error: invoiceError } = await supabase
                .from('blink_invoices')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                })
                .eq('id', invoice.id)
                .select();

            if (invoiceError) {
                console.error('❌ Invoice update error:', invoiceError);
                throw invoiceError;
            }

            if (!invoiceResult || invoiceResult.length === 0) {
                console.error('❌ Invoice update returned no data - may have failed silently');
                throw new Error('Invoice update failed - no data returned. Check RLS policies.');
            }

            console.log('✅ Invoice updated:', invoiceResult);

            alert(`✅ Payment recorded successfully! Payment Number: ${paymentNumber}`);
            onSuccess();
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">Record Payment</h2>

                {/* Invoice Info Summary */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-gradient-to-br from-accent-orange/10 to-transparent border border-accent-orange/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-silver-dark">Invoice:</span>
                            <span className="text-silver-light font-medium ml-2">{invoice.invoice_number}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Customer:</span>
                            <span className="text-silver-light font-medium ml-2">{invoice.customer_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Total Amount:</span>
                            <span className="text-silver-light font-medium ml-2">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Outstanding:</span>
                            <span className="text-yellow-400 font-bold ml-2">{formatCurrency(invoice.outstanding_amount, invoice.currency)}</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Payment Date & Amount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Payment Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Amount ({invoice.currency}) <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                min="0"
                                max={invoice.outstanding_amount}
                                step="0.01"
                                required
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                Max: {formatCurrency(invoice.outstanding_amount, invoice.currency)}
                            </p>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                        <label className="block text-[11px] font-semibold text-silver-light mb-1">
                            Payment Method <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={formData.payment_method}
                            onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
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
                        <label className="block text-[11px] font-semibold text-silver-light mb-1">
                            Reference Number
                        </label>
                        <input
                            type="text"
                            value={formData.reference_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, reference_number: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            placeholder="Transaction ID, Check number, etc."
                        />
                    </div>

                    {/* Received in Account */}
                    <div>
                        <label className="block text-[11px] font-semibold text-silver-light mb-1">
                            Received in Account
                        </label>
                        <select
                            value={formData.received_in_account}
                            onChange={(e) => setFormData(prev => ({ ...prev, received_in_account: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                        >
                            <option value="">-- Select Bank Account --</option>
                            {bankAccounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.bank_name} - {account.account_number} ({account.currency})
                                    {account.is_default && ' (Default)'}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-[11px] font-semibold text-silver-light mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            rows="3"
                            placeholder="Additional payment notes..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                            disabled={loading}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition font-semibold disabled:opacity-50"
                            disabled={loading}
                        >
                            {loading ? 'Processing...' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};
export default AccountsReceivable;
