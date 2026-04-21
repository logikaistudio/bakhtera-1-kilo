import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    DollarSign, TrendingUp, TrendingDown, AlertTriangle,
    Download, Calendar, FileText, Users, Package, X, ExternalLink, Activity, Plus, Search
} from 'lucide-react';

const BridgeAccountsReceivable = () => {
    const [invoices, setInvoices] = useState([]);
    const [arTransactions, setArTransactions] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

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

            // Fetch Bridge AR transactions
            const { data: arData, error: arError } = await supabase
                .from('bridge_ar_transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (arError) throw arError;

            // Fetch customers for reference
            const { data: customerData, error: customerError } = await supabase
                .from('bridge_customers')
                .select('*')
                .order('name', { ascending: true });

            if (customerError) throw customerError;

            setInvoices(invoiceData || []);
            setArTransactions(arData || []);
            setCustomers(customerData || []);
        } catch (error) {
            console.error('Error fetching AR data:', error);
            alert('Failed to load AR data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value, currency = 'IDR') => {
        if (currency === 'USD') {
            return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2 });
        }
        return 'Rp ' + value.toLocaleString('id-ID');
    };

    // Calculate AR metrics
    const totalReceivables = invoices
        .filter(inv => inv.status !== 'cancelled')
        .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

    const collectedAmount = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.grand_total || 0), 0);

    const outstandingAmount = totalReceivables - collectedAmount;

    const overdueAmount = invoices
        .filter(inv => {
            if (inv.status === 'paid' || inv.status === 'cancelled' || !inv.due_date) return false;
            return new Date(inv.due_date) < new Date();
        })
        .reduce((sum, inv) => sum + ((inv.grand_total || 0) - (inv.paid_amount || 0)), 0);

    // Filter invoices based on search and status
    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch = searchTerm === '' ||
            invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const handleRecordPayment = (invoice) => {
        setSelectedInvoice(invoice);
        setPaymentAmount((invoice.grand_total - (invoice.paid_amount || 0)).toString());
        setShowPaymentModal(true);
    };

    const submitPayment = async () => {
        if (!selectedInvoice || !paymentAmount) return;

        try {
            const paymentValue = parseFloat(paymentAmount);
            if (paymentValue <= 0) {
                alert('Payment amount must be greater than 0');
                return;
            }

            // Generate transaction number
            const transactionNumber = `AR-${Date.now()}`;

            // Create AR transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('bridge_ar_transactions')
                .insert({
                    transaction_number: transactionNumber,
                    invoice_number: selectedInvoice.invoice_number,
                    customer_name: selectedInvoice.customer_name,
                    amount: paymentValue,
                    transaction_type: 'payment',
                    payment_method: paymentMethod,
                    payment_date: paymentDate,
                    description: `Payment for invoice ${selectedInvoice.invoice_number}`,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) throw transactionError;

            // Update invoice paid amount and status
            const newPaidAmount = (selectedInvoice.paid_amount || 0) + paymentValue;
            const newStatus = newPaidAmount >= selectedInvoice.grand_total ? 'paid' : 'sent';

            const { error: updateError } = await supabase
                .from('bridge_invoices')
                .update({
                    paid_amount: newPaidAmount,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedInvoice.id);

            if (updateError) throw updateError;

            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            setSelectedInvoice(null);
            setPaymentAmount('');
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment: ' + error.message);
        }
    };

    const exportARReport = () => {
        const csvContent = [
            ['Bridge Accounts Receivable Report', '', '', ''],
            ['Generated on', new Date().toLocaleDateString(), '', ''],
            ['', '', '', ''],
            ['Summary', '', '', ''],
            ['Total Receivables', formatCurrency(totalReceivables), '', ''],
            ['Collected Amount', formatCurrency(collectedAmount), '', ''],
            ['Outstanding Amount', formatCurrency(outstandingAmount), '', ''],
            ['Overdue Amount', formatCurrency(overdueAmount), '', ''],
            ['', '', '', ''],
            ['Invoice Details', '', '', ''],
            ['Invoice #', 'Customer', 'Date', 'Amount', 'Paid', 'Outstanding', 'Due Date', 'Status']
        ];

        filteredInvoices.forEach(invoice => {
            const paid = invoice.paid_amount || 0;
            const outstanding = invoice.grand_total - paid;
            csvContent.push([
                invoice.invoice_number,
                invoice.customer_name || '-',
                new Date(invoice.date).toLocaleDateString(),
                formatCurrency(invoice.grand_total),
                formatCurrency(paid),
                formatCurrency(outstanding),
                invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-',
                invoice.status
            ]);
        });

        const csvString = csvContent.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bridge_ar_report_${new Date().toISOString().split('T')[0]}.csv`;
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
                        <DollarSign className="h-6 w-6 text-blue-500" />
                        Bridge Accounts Receivable
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage customer invoices and payments for Bridge module
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportARReport} variant="outline" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Export CSV
                    </Button>
                    <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Receivables</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalReceivables)}</p>
                        </div>
                        <FileText className="h-8 w-8 text-blue-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Collected</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(collectedAmount)}</p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Outstanding</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(outstandingAmount)}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(overdueAmount)}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Search
                        </label>
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by invoice # or customer..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Status Filter
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                            <option value="all">All Status</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="flex items-end">
                        <Button onClick={() => setSearchTerm('')} variant="outline" className="w-full">
                            Clear Filters
                        </Button>
                    </div>
                </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Customer Invoices ({filteredInvoices.length})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Paid</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Outstanding</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Due Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>No invoices found matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => {
                                    const paid = invoice.paid_amount || 0;
                                    const outstanding = invoice.grand_total - paid;
                                    const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

                                    return (
                                        <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {invoice.invoice_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {invoice.customer_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(invoice.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatCurrency(invoice.grand_total)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                                                {formatCurrency(paid)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatCurrency(outstanding)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    invoice.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                    invoice.status === 'sent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                                    isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                                    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                                                }`}>
                                                    {isOverdue ? 'Overdue' : invoice.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {outstanding > 0 && (
                                                    <Button
                                                        onClick={() => handleRecordPayment(invoice)}
                                                        size="sm"
                                                        className="text-xs"
                                                    >
                                                        Record Payment
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && selectedInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Record Payment
                            </h2>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Invoice: <span className="font-medium">{selectedInvoice.invoice_number}</span>
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Customer: <span className="font-medium">{selectedInvoice.customer_name}</span>
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Outstanding: <span className="font-medium">{formatCurrency(selectedInvoice.grand_total - (selectedInvoice.paid_amount || 0))}</span>
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Payment Amount
                                </label>
                                <input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                    placeholder="Enter payment amount"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Payment Date
                                </label>
                                <input
                                    type="date"
                                    value={paymentDate}
                                    onChange={(e) => setPaymentDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Payment Method
                                </label>
                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cash">Cash</option>
                                    <option value="check">Check</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                            <Button onClick={() => setShowPaymentModal(false)} variant="outline">
                                Cancel
                            </Button>
                            <Button onClick={submitPayment}>
                                Record Payment
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BridgeAccountsReceivable;