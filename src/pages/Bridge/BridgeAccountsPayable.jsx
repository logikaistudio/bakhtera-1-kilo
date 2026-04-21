import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import {
    DollarSign, TrendingUp, TrendingDown, AlertTriangle,
    Download, Calendar, FileText, Users, Package, X, ExternalLink, Activity, Plus, Search
} from 'lucide-react';

const BridgeAccountsPayable = () => {
    const [pos, setPOs] = useState([]);
    const [apTransactions, setApTransactions] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch Bridge POs
            const { data: poData, error: poError } = await supabase
                .from('bridge_pos')
                .select('*')
                .order('created_at', { ascending: false });

            if (poError) throw poError;

            // Fetch Bridge AP transactions
            const { data: apData, error: apError } = await supabase
                .from('bridge_ap_transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (apError) throw apError;

            // Fetch vendors for reference
            const { data: vendorData, error: vendorError } = await supabase
                .from('bridge_vendors')
                .select('*')
                .order('name', { ascending: true });

            if (vendorError) throw vendorError;

            setPOs(poData || []);
            setApTransactions(apData || []);
            setVendors(vendorData || []);
        } catch (error) {
            console.error('Error fetching AP data:', error);
            alert('Failed to load AP data: ' + error.message);
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

    // Calculate AP metrics
    const totalPayables = pos
        .filter(po => po.status !== 'cancelled')
        .reduce((sum, po) => sum + (po.grand_total || 0), 0);

    const paidAmount = pos
        .filter(po => po.status === 'paid')
        .reduce((sum, po) => sum + (po.grand_total || 0), 0);

    const outstandingAmount = totalPayables - paidAmount;

    const overdueAmount = pos
        .filter(po => {
            if (po.status === 'paid' || po.status === 'cancelled' || !po.due_date) return false;
            return new Date(po.due_date) < new Date();
        })
        .reduce((sum, po) => sum + ((po.grand_total || 0) - (po.paid_amount || 0)), 0);

    // Filter POs based on search and status
    const filteredPOs = pos.filter(po => {
        const matchesSearch = searchTerm === '' ||
            po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || po.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const handleRecordPayment = (po) => {
        setSelectedPO(po);
        setPaymentAmount((po.grand_total - (po.paid_amount || 0)).toString());
        setShowPaymentModal(true);
    };

    const submitPayment = async () => {
        if (!selectedPO || !paymentAmount) return;

        try {
            const paymentValue = parseFloat(paymentAmount);
            if (paymentValue <= 0) {
                alert('Payment amount must be greater than 0');
                return;
            }

            // Generate transaction number
            const transactionNumber = `AP-${Date.now()}`;

            // Create AP transaction record
            const { data: transactionData, error: transactionError } = await supabase
                .from('bridge_ap_transactions')
                .insert({
                    transaction_number: transactionNumber,
                    po_number: selectedPO.po_number,
                    vendor_name: selectedPO.vendor_name,
                    amount: paymentValue,
                    transaction_type: 'payment',
                    payment_method: paymentMethod,
                    payment_date: paymentDate,
                    description: `Payment for PO ${selectedPO.po_number}`,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (transactionError) throw transactionError;

            // Update PO paid amount and status
            const newPaidAmount = (selectedPO.paid_amount || 0) + paymentValue;
            const newStatus = newPaidAmount >= selectedPO.grand_total ? 'paid' : 'approved';

            const { error: updateError } = await supabase
                .from('bridge_pos')
                .update({
                    paid_amount: newPaidAmount,
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', selectedPO.id);

            if (updateError) throw updateError;

            alert('Payment recorded successfully!');
            setShowPaymentModal(false);
            setSelectedPO(null);
            setPaymentAmount('');
            fetchData(); // Refresh data
        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Failed to record payment: ' + error.message);
        }
    };

    const exportAPReport = () => {
        const csvContent = [
            ['Bridge Accounts Payable Report', '', '', ''],
            ['Generated on', new Date().toLocaleDateString(), '', ''],
            ['', '', '', ''],
            ['Summary', '', '', ''],
            ['Total Payables', formatCurrency(totalPayables), '', ''],
            ['Paid Amount', formatCurrency(paidAmount), '', ''],
            ['Outstanding Amount', formatCurrency(outstandingAmount), '', ''],
            ['Overdue Amount', formatCurrency(overdueAmount), '', ''],
            ['', '', '', ''],
            ['Purchase Order Details', '', '', ''],
            ['PO #', 'Vendor', 'Date', 'Amount', 'Paid', 'Outstanding', 'Due Date', 'Status']
        ];

        filteredPOs.forEach(po => {
            const paid = po.paid_amount || 0;
            const outstanding = po.grand_total - paid;
            csvContent.push([
                po.po_number,
                po.vendor_name || '-',
                new Date(po.po_date).toLocaleDateString(),
                formatCurrency(po.grand_total),
                formatCurrency(paid),
                formatCurrency(outstanding),
                po.due_date ? new Date(po.due_date).toLocaleDateString() : '-',
                po.status
            ]);
        });

        const csvString = csvContent.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bridge_ap_report_${new Date().toISOString().split('T')[0]}.csv`;
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
                        <DollarSign className="h-6 w-6 text-red-500" />
                        Bridge Accounts Payable
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                        Manage vendor payments and purchase orders for Bridge module
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={exportAPReport} variant="outline" className="flex items-center gap-2">
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
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Payables</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(totalPayables)}</p>
                        </div>
                        <FileText className="h-8 w-8 text-red-500" />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Paid</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(paidAmount)}</p>
                        </div>
                        <TrendingDown className="h-8 w-8 text-green-500" />
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
                                placeholder="Search by PO # or vendor..."
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
                            <option value="approved">Approved</option>
                            <option value="paid">Paid</option>
                            <option value="pending">Pending</option>
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

            {/* Purchase Orders Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Vendor Purchase Orders ({filteredPOs.length})
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">PO #</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
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
                            {filteredPOs.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                        <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                        <p>No purchase orders found matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPOs.map((po) => {
                                    const paid = po.paid_amount || 0;
                                    const outstanding = po.grand_total - paid;
                                    const isOverdue = po.due_date && new Date(po.due_date) < new Date() && po.status !== 'paid';

                                    return (
                                        <tr key={po.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                {po.po_number}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {po.vendor_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {new Date(po.po_date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatCurrency(po.grand_total)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
                                                {formatCurrency(paid)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {formatCurrency(outstanding)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {po.due_date ? new Date(po.due_date).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                    po.status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                                                    po.status === 'approved' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
                                                    isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' :
                                                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
                                                }`}>
                                                    {isOverdue ? 'Overdue' : po.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {outstanding > 0 && po.status === 'approved' && (
                                                    <Button
                                                        onClick={() => handleRecordPayment(po)}
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
            {showPaymentModal && selectedPO && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                                Record Vendor Payment
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
                                    PO: <span className="font-medium">{selectedPO.po_number}</span>
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Vendor: <span className="font-medium">{selectedPO.vendor_name}</span>
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Outstanding: <span className="font-medium">{formatCurrency(selectedPO.grand_total - (selectedPO.paid_amount || 0))}</span>
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

export default BridgeAccountsPayable;