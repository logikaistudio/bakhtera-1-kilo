import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DollarSign, FileText, TrendingUp, TrendingDown, Plus, Edit, Check, X, Trash2, BookOpen, BarChart2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Common/Button';
import { formatCurrency } from '../../utils/currencyFormatter';

const BridgeFinance = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { canCreate, canEdit, canDelete } = useAuth();
    const hasCreate = canCreate('bridge_finance');
    const hasEdit = canEdit('bridge_finance');
    const hasDelete = canDelete('bridge_finance');

    // State for Bridge finance data
    const [invoices, setInvoices] = useState([]);
    const [pos, setPOs] = useState([]);
    const [arTransactions, setArTransactions] = useState([]);
    const [apTransactions, setApTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    // Sync URL with Tab
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/bridge/finance/overview')) {
            setActiveTab('overview');
        } else if (path.includes('/bridge/finance/invoices')) {
            setActiveTab('invoices');
        } else if (path.includes('/bridge/finance/ar')) {
            setActiveTab('ar');
        } else if (path.includes('/bridge/finance/po')) {
            setActiveTab('pos');
        } else if (path.includes('/bridge/finance/ap')) {
            setActiveTab('ap');
        } else if (path.includes('/bridge/finance/reports')) {
            setActiveTab('reports');
        } else if (path.includes('/bridge/finance/ledger')) {
            setActiveTab('ledger');
        }
    }, [location.pathname]);

    // Fetch Bridge finance data
    useEffect(() => {
        fetchFinanceData();
    }, []);

    const fetchFinanceData = async () => {
        try {
            setLoading(true);

            // Fetch Bridge invoices
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('bridge_invoices')
                .select('*')
                .order('created_at', { ascending: false });

            if (invoiceError) throw invoiceError;

            // Fetch Bridge POs
            const { data: poData, error: poError } = await supabase
                .from('bridge_pos')
                .select('*')
                .order('created_at', { ascending: false });

            if (poError) throw poError;

            // Fetch Bridge AR transactions
            const { data: arData, error: arError } = await supabase
                .from('bridge_ar_transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (arError) throw arError;

            // Fetch Bridge AP transactions
            const { data: apData, error: apError } = await supabase
                .from('bridge_ap_transactions')
                .select('*')
                .order('created_at', { ascending: false });

            if (apError) throw apError;

            setInvoices(invoiceData || []);
            setPOs(poData || []);
            setArTransactions(arData || []);
            setApTransactions(apData || []);
        } catch (error) {
            console.error('Error fetching Bridge finance data:', error);
            alert('Failed to load finance data: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        let path = '/bridge/finance';
        if (tab === 'overview') path += '/overview';
        else if (tab === 'invoices') path += '/invoices';
        else if (tab === 'ar') path += '/ar';
        else if (tab === 'pos') path += '/po';
        else if (tab === 'ap') path += '/ap';
        else if (tab === 'reports') path += '/reports';
        else if (tab === 'ledger') path += '/ledger';
        navigate(path);
    };
        } else if (path.includes('/bridge/finance/ap')) { // Assuming AP maps to purchases
            setActiveTab('purchases');
        }
    }, [location.pathname]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        let path = '/bridge/finance';
        if (tab === 'invoices') path += '/invoices';
        else if (tab === 'pos') path += '/po';
        else if (tab === 'purchases') path += '/ap'; // Using AP route for purchases tab logic
        navigate(path);
    };
    const [showInvoiceForm, setShowInvoiceForm] = useState(false);
    const [showPurchaseForm, setShowPurchaseForm] = useState(false);
    const [showPOForm, setShowPOForm] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);
    const [editingPurchase, setEditingPurchase] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedPurchase, setSelectedPurchase] = useState(null);

    // Calculate summary
    const totalInvoices = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const paidInvoices = invoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
    const unpaidInvoices = totalInvoices - paidInvoices;

    const totalPurchases = purchases.reduce((sum, pur) => sum + (pur.grandTotal || 0), 0);
    const paidPurchases = purchases
        .filter(pur => pur.status === 'paid')
        .reduce((sum, pur) => sum + (pur.grandTotal || 0), 0);
    const unpaidPurchases = totalPurchases - paidPurchases;

    const handleMarkAsPaid = (type, id) => {
        if (!hasEdit) return;
        if (window.confirm('Tandai sebagai terbayar?')) {
            const updates = {
                status: 'paid',
                paidDate: new Date().toISOString().split('T')[0],
                paidAmount: type === 'invoice'
                    ? invoices.find(inv => inv.id === id)?.grandTotal
                    : purchases.find(pur => pur.id === id)?.grandTotal
            };

            if (type === 'invoice') {
                updateInvoice(id, updates);
            } else {
                updatePurchase(id, updates);
            }
        }
    };

    const handleAddInvoice = () => {
        setEditingInvoice(null);
        setShowInvoiceForm(true);
    };

    const handleAddPurchase = () => {
        setEditingPurchase(null);
        setShowPurchaseForm(true);
    };

    const handlePrint = (type, document) => {
        const printWindow = window.open('', '_blank');
        const isInvoice = type === 'invoice';

        const content = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${isInvoice ? 'Invoice' : 'Purchase Document'} - ${document.invoiceNumber || document.documentNumber}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.6; padding: 40px; color: #000; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
        .header h1 { font-size: 24pt; font-weight: bold; margin-bottom: 5px; }
        .header p { font-size: 10pt; color: #666; }
        .info-section { margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; margin: 8px 0; }
        .label { font-weight: bold; width: 150px; }
        .value { flex: 1; }
        .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .items-table th, .items-table td { border: 1px solid #000; padding: 8px; text-align: left; }
        .items-table th { background: #f0f0f0; font-weight: bold; }
        .items-table td.number { text-align: right; }
        .summary { margin-top: 20px; float: right; width: 300px; }
        .summary-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .summary-row.total { font-weight: bold; font-size: 14pt; border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; }
        .footer { margin-top: 60px; text-align: center; font-size: 10pt; color: #666; clear: both; }
        @media print { body { padding: 20px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>${isInvoice ? 'INVOICE' : 'PURCHASE DOCUMENT'}</h1>
        <p>Bakhtera-1 Freight Management</p>
    </div>
    
    <div class="info-section">
        <div class="info-row"><span class="label">No. Dokumen:</span><span class="value">${document.invoiceNumber || document.documentNumber}</span></div>
        <div class="info-row"><span class="label">Tanggal:</span><span class="value">${new Date(document.date).toLocaleDateString('id-ID')}</span></div>
        <div class="info-row"><span class="label">${isInvoice ? 'Customer' : 'Vendor'}:</span><span class="value">${document.customerName || document.customer || document.vendor || '-'}</span></div>
        <div class="info-row"><span class="label">Judul:</span><span class="value">${document.title}</span></div>
        ${document.pengajuanNumber ? `<div class="info-row"><span class="label">Ref. Pengajuan:</span><span class="value">${document.pengajuanNumber}</span></div>` : ''}
    </div>
    
    ${document.items && document.items.length > 0 ? `
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 40px;">No</th>
                <th>Deskripsi</th>
                <th style="width: 80px;">Qty</th>
                <th style="width: 100px;">Unit</th>
                <th style="width: 120px;">Harga</th>
                <th style="width: 120px;">Total</th>
            </tr>
        </thead>
        <tbody>
            ${document.items.map((item, idx) => `
                <tr>
                    <td class="number">${idx + 1}</td>
                    <td>${item.description || item.itemName || '-'}</td>
                    <td class="number">${item.quantity || 0}</td>
                    <td>${item.unit || 'pcs'}</td>
                    <td class="number">Rp ${formatCurrency(item.unitPrice || item.value / item.quantity || 0)}</td>
                    <td class="number">Rp ${formatCurrency(item.value || 0)}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
    ` : ''}
    
    <div class="summary">
        ${document.discount ? `<div class="summary-row"><span>Diskon:</span><span>Rp ${formatCurrency(document.discount)}</span></div>` : ''}
        ${document.vat ? `<div class="summary-row"><span>PPN:</span><span>Rp ${formatCurrency(document.vat)}</span></div>` : ''}
        <div class="summary-row total"><span>TOTAL:</span><span>Rp ${formatCurrency(document.grandTotal)}</span></div>
    </div>
    
    <div class="footer">
        <p>Dicetak pada: ${new Date().toLocaleDateString('id-ID')} ${new Date().toLocaleTimeString('id-ID')}</p>
        <p>Dokumen ini dibuat oleh sistem Bakhtera-1</p>
    </div>
</body>
</html>`;

        printWindow.document.write(content);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    // Debug logging
    console.log('🔍 BridgeFinance render - invoices:', invoices);
    console.log('🔍 Invoices count:', invoices.length);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold gradient-text">Bridge Finance</h1>
                <p className="text-silver-dark mt-1">
                    Invoice & Purchase Management untuk Bridge TPPB
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <SummaryCard
                    title="Total Invoice"
                    value={totalInvoices}
                    icon={FileText}
                    color="blue"
                />
                <SummaryCard
                    title="Invoice Terbayar"
                    value={paidInvoices}
                    icon={TrendingUp}
                    color="green"
                />
                <SummaryCard
                    title="Invoice Belum Bayar"
                    value={unpaidInvoices}
                    icon={TrendingDown}
                    color="orange"
                />
                <SummaryCard
                    title="Total Pengeluaran"
                    value={totalPurchases}
                    icon={DollarSign}
                    color="red"
                />
                <SummaryCard
                    title="Pengeluaran Terbayar"
                    value={paidPurchases}
                    icon={TrendingUp}
                    color="green"
                />
                <SummaryCard
                    title="Pengeluaran Belum Bayar"
                    value={unpaidPurchases}
                    icon={TrendingDown}
                    color="orange"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 items-center">
                <button
                    onClick={() => handleTabChange('invoices')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${activeTab === 'invoices'
                        ? 'bg-accent-blue text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Invoices ({invoices.length})
                </button>
                <button
                    onClick={() => handleTabChange('purchases')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${activeTab === 'purchases'
                        ? 'bg-accent-blue text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Purchases ({purchases.length})
                </button>
                <button
                    onClick={() => handleTabChange('pos')}
                    className={`px-4 py-2 rounded-lg font-medium smooth-transition ${activeTab === 'pos'
                        ? 'bg-accent-purple text-white'
                        : 'bg-dark-surface text-silver-dark hover:text-silver'
                        }`}
                >
                    Purchase Orders ({purchaseOrders.length})
                </button>

                {hasCreate && activeTab === 'invoices' && (
                    <Button onClick={handleAddInvoice} icon={Plus} size="sm" className="ml-auto">
                        Buat Invoice
                    </Button>
                )}
                {hasCreate && activeTab === 'purchases' && (
                    <Button onClick={handleAddPurchase} icon={Plus} size="sm" className="ml-auto">
                        Buat Purchase
                    </Button>
                )}
                {hasCreate && activeTab === 'pos' && (
                    <Button onClick={() => setShowPOForm(true)} icon={Plus} size="sm" className="ml-auto">
                        Buat PO
                    </Button>
                )}
            </div>

            {/* Content */}
            <div className="glass-card p-6 rounded-lg">
                {activeTab === 'invoices' ? (
                    <>
                        <h3 className="text-xl font-semibold text-silver-light mb-4">
                            Invoice
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-accent-blue">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">No. Invoice</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Ref. Pengajuan</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Customer</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tanggal</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Judul</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Nilai</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-white">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {invoices.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-4 py-8 text-center text-silver-dark">
                                                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>Belum ada invoice. Klik "Buat Invoice" untuk memulai.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        invoices.map(invoice => (
                                            <tr
                                                key={invoice.id}
                                                className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                                onClick={() => setSelectedInvoice(invoice)}
                                            >
                                                <td className="px-4 py-3 text-sm text-silver-light font-medium">
                                                    {invoice.invoiceNumber}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver">
                                                    {invoice.pengajuanNumber ? (
                                                        <span className="text-accent-blue">{invoice.pengajuanNumber}</span>
                                                    ) : (
                                                        <span className="text-silver-dark">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver">
                                                    {invoice.customerName || invoice.customer || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver-dark">
                                                    {new Date(invoice.date).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver">
                                                    {invoice.title}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-accent-green font-semibold">
                                                    Rp {formatCurrency(invoice.grandTotal)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                        invoice.status === 'overdue' ? 'bg-red-500/20 text-red-400' :
                                                            'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {invoice.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        {hasEdit && invoice.status !== 'paid' && (
                                                            <button
                                                                onClick={() => handleMarkAsPaid('invoice', invoice.id)}
                                                                className="p-1 hover:bg-green-500 hover:bg-opacity-20 rounded smooth-transition"
                                                                title="Tandai Terbayar"
                                                            >
                                                                <Check className="w-4 h-4 text-green-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : activeTab === 'purchases' ? (
                    <>
                        <h3 className="text-xl font-semibold text-silver-light mb-4">
                            Pembayaran
                        </h3>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-accent-orange">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">No. Dokumen</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tanggal</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Vendor</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Judul</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Jumlah</th>
                                        <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                                        <th className="px-4 py-3 text-center text-sm font-semibold text-white">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {purchases.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-8 text-center text-silver-dark">
                                                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p>Belum ada purchase. Klik "Buat Purchase" untuk memulai.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        purchases.map(purchase => (
                                            <tr
                                                key={purchase.id}
                                                className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                                onClick={() => setSelectedPurchase(purchase)}
                                            >
                                                <td className="px-4 py-3 text-sm text-silver-light font-medium">
                                                    {purchase.documentNumber}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver-dark">
                                                    {new Date(purchase.date).toLocaleDateString('id-ID')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver">
                                                    {purchase.vendor}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-silver">
                                                    {purchase.title}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-accent-red font-semibold">
                                                    Rp {formatCurrency(purchase.grandTotal)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${purchase.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                                                        purchase.status === 'pending_approval' ? 'bg-blue-500/20 text-blue-400' :
                                                            'bg-yellow-500/20 text-yellow-400'
                                                        }`}>
                                                        {purchase.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-center gap-2">
                                                        {hasEdit && purchase.status !== 'paid' && (
                                                            <button
                                                                onClick={() => handleMarkAsPaid('purchase', purchase.id)}
                                                                className="p-1 hover:bg-green-500 hover:bg-opacity-20 rounded smooth-transition"
                                                                title="Tandai Terbayar"
                                                            >
                                                                <Check className="w-4 h-4 text-green-400" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                ) : activeTab === 'pos' ? (
                    <>
                        <h3 className="text-xl font-semibold text-silver-light mb-4">
                            Daftar Purchase Orders
                        </h3>

                        {purchaseOrders.length === 0 ? (
                            <div className="text-center py-8 text-silver-dark">
                                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                <p>Belum ada Purchase Order. Klik "Buat PO" untuk memulai.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-accent-purple">
                                        <tr>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-white">No</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">No. PO</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Tanggal</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Vendor</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Judul</th>
                                            <th className="px-4 py-3 text-right text-sm font-semibold text-white">Nilai PO</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {purchaseOrders.map((po, index) => {
                                            const statusColors = {
                                                draft: 'bg-yellow-500/20 text-yellow-400',
                                                sent: 'bg-blue-500/20 text-blue-400',
                                                approved: 'bg-green-500/20 text-green-400',
                                                received: 'bg-emerald-500/20 text-emerald-400',
                                                cancelled: 'bg-red-500/20 text-red-400'
                                            };

                                            return (
                                                <tr key={po.id} className="hover:bg-dark-surface smooth-transition">
                                                    <td className="px-4 py-3 text-sm text-center text-silver-dark font-medium">
                                                        {index + 1}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-silver-light font-medium">
                                                        {po.poNumber}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-silver-dark">
                                                        {new Date(po.poDate).toLocaleDateString('id-ID')}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-silver">
                                                        {po.vendorName}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-silver">
                                                        {po.title}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-right text-accent-purple font-semibold">
                                                        Rp {formatCurrency(po.subtotalAfterDiscount || po.itemsSubtotal || 0)}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusColors[po.status] || statusColors.draft}`}>
                                                            {po.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : null}
            </div>

            {/* Invoice Form Modal */}
            {showInvoiceForm && (
                <InvoiceFormModal
                    onClose={() => setShowInvoiceForm(false)}
                    onSubmit={addInvoice}
                    customers={customers}
                    customsDocuments={customsDocuments}
                />
            )}

            {/* Purchase Form Modal */}
            {showPurchaseForm && (
                <PurchaseFormModal
                    onClose={() => setShowPurchaseForm(false)}
                    onSubmit={addPurchase}
                    vendors={vendors}
                />
            )}

            {/* Purchase Order Form Modal */}
            {showPOForm && (
                <POFormModal
                    onClose={() => setShowPOForm(false)}
                    onSubmit={addPurchaseOrder}
                    vendors={vendors}
                />
            )}

            {/* Invoice Detail Modal */}
            {selectedInvoice && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="glass-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 z-10 flex items-center justify-between">
                            <h2 className="text-2xl font-bold gradient-text">Detail Invoice</h2>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-dark-surface rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="font-semibold">No. Invoice:</span> {selectedInvoice.invoiceNumber}</div>
                                <div><span className="font-semibold">Tanggal:</span> {new Date(selectedInvoice.date).toLocaleDateString('id-ID')}</div>
                                <div><span className="font-semibold">Customer:</span> {selectedInvoice.customerName || selectedInvoice.customer}</div>
                                <div><span className="font-semibold">Status:</span>
                                    <span className={`ml-2 px-3 py-1 rounded-full text-xs ${selectedInvoice.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {selectedInvoice.status}
                                    </span>
                                </div>
                            </div>
                            <div><span className="font-semibold">Judul:</span> {selectedInvoice.title}</div>
                            {selectedInvoice.pengajuanNumber && (
                                <div><span className="font-semibold">Ref. Pengajuan:</span> <span className="text-accent-blue">{selectedInvoice.pengajuanNumber}</span></div>
                            )}
                            <div className="border-t border-dark-border pt-4">
                                <p className="font-semibold text-xl">Total: <span className="text-accent-green">Rp {formatCurrency(selectedInvoice.grandTotal)}</span></p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button onClick={() => handlePrint('invoice', selectedInvoice)} icon={FileText}>
                                    Cetak Dokumen
                                </Button>
                                <Button variant="secondary" onClick={() => setSelectedInvoice(null)}>
                                    Tutup
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Purchase Detail Modal */}
            {selectedPurchase && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="glass-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 z-10 flex items-center justify-between">
                            <h2 className="text-2xl font-bold gradient-text">Detail Pembayaran</h2>
                            <button onClick={() => setSelectedPurchase(null)} className="p-2 hover:bg-dark-surface rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><span className="font-semibold">No. Dokumen:</span> {selectedPurchase.documentNumber}</div>
                                <div><span className="font-semibold">Tanggal:</span> {new Date(selectedPurchase.date).toLocaleDateString('id-ID')}</div>
                                <div><span className="font-semibold">Vendor:</span> {selectedPurchase.vendor}</div>
                                <div><span className="font-semibold">Status:</span>
                                    <span className={`ml-2 px-3 py-1 rounded-full text-xs ${selectedPurchase.status === 'paid' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {selectedPurchase.status}
                                    </span>
                                </div>
                            </div>
                            <div><span className="font-semibold">Judul:</span> {selectedPurchase.title}</div>
                            <div className="border-t border-dark-border pt-4">
                                <p className="font-semibold text-xl">Total: <span className="text-accent-red">Rp {formatCurrency(selectedPurchase.grandTotal)}</span></p>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button onClick={() => handlePrint('purchase', selectedPurchase)} icon={FileText}>
                                    Cetak Dokumen
                                </Button>
                                <Button variant="secondary" onClick={() => setSelectedPurchase(null)}>
                                    Tutup
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color }) => {
    const colorClasses = {
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
        green: 'from-green-500/20 to-green-600/20 border-green-500/30',
        orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30'
    };

    const iconColors = {
        blue: 'text-blue-400',
        green: 'text-green-400',
        orange: 'text-orange-400',
        red: 'text-red-400'
    };

    return (
        <div className={`glass-card p-4 rounded-lg border bg-gradient-to-br ${colorClasses[color]}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-silver-dark uppercase">{title}</span>
                <Icon className={`w-5 h-5 ${iconColors[color]}`} />
            </div>
            <p className="text-xl font-bold text-silver-light">
                Rp {formatCurrency(value)}
            </p>
        </div>
    );
};

// Invoice Form Modal Component
const InvoiceFormModal = ({ onClose, onSubmit, customers, customsDocuments }) => {
    const { quotations = [], invoices = [] } = useData();

    // Filter only approved quotations
    const approvedQuotations = quotations.filter(q => q.status === 'approved');

    const [formData, setFormData] = useState({
        quotationId: '',
        customer: '',
        date: new Date().toISOString().split('T')[0],
        bcDocument: '',
        title: '',
        items: [],
        services: {}, // Kept for compatibility but hidden if not needed
        customCosts: [], // Kept for compatibility but hidden if not needed
        discountType: 'percentage',
        discountValue: 0,
        taxRate: 11,
        notes: '',
        status: 'unpaid',
        cogsItems: [] // COGS Items state
    });

    const [manualInvoiceNumber, setManualInvoiceNumber] = useState(false);
    const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');

    // Item Form State
    const [itemForm, setItemForm] = useState({
        item: '',
        description: '',
        unitPrice: '',
        quantity: '',
        unit: 'pcs'
    });

    const unitOptions = ['pcs', 'kg', 'ton', 'm', 'm2', 'm3', 'set', 'box', 'pallet', 'ctn', 'unit'];

    // Generate Auto Invoice Number
    const generateInvoiceNumber = () => {
        const today = new Date();
        const y = today.getFullYear().toString().slice(-2);
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const d = String(today.getDate()).padStart(2, '0');

        // Simple sequence generation based on existing invoices count
        // In a real app, this should come from backend
        const sequence = String(invoices.length + 1).padStart(8, '0');

        return `BRG-INV-${y}${m}${d}-${sequence}`;
    };

    const autoInvoiceNumber = generateInvoiceNumber();

    // Handle quotation selection - auto populate all fields
    const handleQuotationSelect = (quotationId) => {
        const selectedQuotation = approvedQuotations.find(q => q.id === quotationId);

        if (selectedQuotation) {
            console.log('📋 Selected quotation:', selectedQuotation);
            setFormData({
                ...formData,
                quotationId: quotationId,
                customer: selectedQuotation.customer || '',
                bcDocument: selectedQuotation.bcDocumentNumber || '',
                title: `Invoice untuk Quotation ${selectedQuotation.quotationNumber || ''}`,
                // Map items properly
                items: (selectedQuotation.items || []).map(item => ({
                    id: item.id || `item-${Date.now()}-${Math.random()}`,
                    item: item.itemName || item.item || '',
                    description: item.description || '',
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit || 'Unit',
                    unitPrice: Number(item.unitPrice) || Number(item.price) || 0,
                    total: (Number(item.quantity) || 0) * (Number(item.unitPrice) || Number(item.price) || 0)
                })),
                discountType: selectedQuotation.discountType || 'percentage',
                discountValue: selectedQuotation.discountValue || 0,
                taxRate: selectedQuotation.taxRate || 11,
                // Initialize COGS with same items but 0 price
                cogsItems: (selectedQuotation.items || []).map(item => ({
                    id: `cogs-${item.id || Date.now()}-${Math.random()}`,
                    item: item.itemName || item.item || '',
                    description: item.description || '',
                    quantity: Number(item.quantity) || 0,
                    unit: item.unit || 'Unit',
                    unitPrice: 0, // Default cost to 0
                    total: 0
                }))
            });
        } else {
            // Reset if no quotation selected
            setFormData({
                ...formData,
                quotationId: '',
                customer: '',
                bcDocument: '',
                title: '',
                items: [],
                cogsItems: []
            });
        }
    };

    const handleAddItem = () => {
        if (!itemForm.item || !itemForm.quantity || !itemForm.unitPrice) {
            alert('Item, Jumlah, dan Harga Satuan wajib diisi');
            return;
        }

        const newItem = {
            id: `item-${Date.now()}`,
            item: itemForm.item,
            description: itemForm.description,
            quantity: Number(itemForm.quantity),
            unit: itemForm.unit,
            unitPrice: Number(itemForm.unitPrice),
            total: Number(itemForm.quantity) * Number(itemForm.unitPrice)
        };

        setFormData({
            ...formData,
            items: [...formData.items, newItem]
        });

        // Reset form
        setItemForm({
            item: '',
            description: '',
            unitPrice: '',
            quantity: '',
            unit: 'pcs'
        });
    };

    const handleRemoveItem = (id) => {
        setFormData({
            ...formData,
            items: formData.items.filter(i => i.id !== id)
        });
    };

    // COGS Management
    const handleSyncCogs = () => {
        const newCogs = formData.items.map(item => ({
            id: `cogs-${Date.now()}-${Math.random()}`,
            item: item.item,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: 0,
            total: 0
        }));
        setFormData(prev => ({ ...prev, cogsItems: newCogs }));
    };

    const handleAddCogsItem = () => {
        const newItem = {
            id: `cogs-${Date.now()}`,
            item: '',
            description: '',
            quantity: 0,
            unit: 'pcs',
            unitPrice: 0,
            total: 0
        };
        setFormData(prev => ({ ...prev, cogsItems: [...prev.cogsItems, newItem] }));
    };

    const handleUpdateCogsItem = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            cogsItems: prev.cogsItems.map(item => {
                if (item.id === id) {
                    const updates = { [field]: value };
                    // Recalculate total if qty or price changes
                    if (field === 'quantity' || field === 'unitPrice') {
                        const qty = field === 'quantity' ? Number(value) : item.quantity;
                        const price = field === 'unitPrice' ? Number(value) : item.unitPrice;
                        updates.total = qty * price;
                    }
                    return { ...item, ...updates };
                }
                return item;
            })
        }));
    };

    const handleRemoveCogsItem = (id) => {
        setFormData(prev => ({
            ...prev,
            cogsItems: prev.cogsItems.filter(i => i.id !== id)
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (formData.items.length === 0) {
            alert('Harap tambahkan minimal satu item');
            return;
        }

        try {
            // Calculate
            const itemsSubtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
            const subtotalBeforeDiscount = itemsSubtotal; // Ignoring services/customCosts for this simplified view

            let discountAmount = 0;
            if (formData.discountType === 'percentage') {
                discountAmount = (subtotalBeforeDiscount * formData.discountValue) / 100;
            } else {
                discountAmount = formData.discountValue;
            }

            const subtotalAfterDiscount = subtotalBeforeDiscount - discountAmount;
            const taxAmount = (subtotalAfterDiscount * formData.taxRate) / 100;
            const grandTotal = subtotalAfterDiscount + taxAmount;

            const invoiceData = {
                ...formData,
                itemsSubtotal,
                subtotalBeforeDiscount,
                discountAmount,
                subtotalAfterDiscount,
                taxAmount,
                grandTotal,
                invoiceNumber: manualInvoiceNumber ? customInvoiceNumber : autoInvoiceNumber,
                cogsItems: formData.cogsItems,
                totalCogs: formData.cogsItems.reduce((sum, item) => sum + (item.total || 0), 0)
            };

            onSubmit(invoiceData);
            onClose();
        } catch (error) {
            console.error('❌ Error submitting invoice:', error);
            alert('Gagal menyimpan invoice: ' + error.message);
        }
    };

    // Calculations for Summary
    const itemsSubtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
    const discountAmt = formData.discountType === 'percentage'
        ? (itemsSubtotal * formData.discountValue) / 100
        : Number(formData.discountValue);
    const subtotalAfterDisc = itemsSubtotal - discountAmt;
    const taxAmt = (subtotalAfterDisc * formData.taxRate) / 100;
    const finalTotal = subtotalAfterDisc + taxAmt;

    // COGS Calculation
    const totalCogs = formData.cogsItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const grossProfit = itemsSubtotal - totalCogs;
    const profitMargin = itemsSubtotal > 0 ? (grossProfit / itemsSubtotal) * 100 : 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
            <div className="glass-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 z-10 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">Buat Invoice Baru</h2>
                        <p className="text-silver-dark text-sm mt-1">Lengkapi form invoice di bawah ini</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-dark-surface rounded-full">
                        <X className="w-6 h-6 text-silver" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* INVOICE HEADER */}
                    <div className="glass-card p-6 rounded-lg border border-accent-blue/30 bg-gradient-to-br from-accent-blue/5 to-transparent">
                        <h3 className="text-lg font-semibold text-silver-light mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-accent-blue" />
                            Header Invoice
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* No. Invoice */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-silver">
                                        No. Invoice *
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={manualInvoiceNumber}
                                            onChange={(e) => {
                                                setManualInvoiceNumber(e.target.checked);
                                                if (!e.target.checked) setCustomInvoiceNumber('');
                                            }}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-xs text-silver-dark">Manual Input</span>
                                    </label>
                                </div>

                                {manualInvoiceNumber ? (
                                    <input
                                        type="text"
                                        required
                                        value={customInvoiceNumber}
                                        onChange={(e) => setCustomInvoiceNumber(e.target.value)}
                                        placeholder="BRG-INV-YYMMDD-XXXXXXXX"
                                        className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    />
                                ) : (
                                    <div className="px-4 py-3 bg-dark-surface/50 border border-dark-border rounded-lg">
                                        <p className="text-silver-light font-mono font-bold tracking-wide">
                                            {autoInvoiceNumber}
                                        </p>
                                        <p className="text-xs text-silver-dark mt-1">Digenerate otomatis sistem</p>
                                    </div>
                                )}
                            </div>

                            {/* Data Customer */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Data Customer *
                                </label>
                                <div className="flex gap-2">
                                    <select
                                        value={formData.quotationId}
                                        onChange={(e) => handleQuotationSelect(e.target.value)}
                                        className="w-1/3 px-3 py-3 bg-dark-surface border border-dark-border rounded-l-lg text-silver-light text-sm focus:border-accent-blue focus:outline-none"
                                    >
                                        <option value="">Ref. Quotation</option>
                                        {approvedQuotations.map(q => (
                                            <option key={q.id} value={q.id}>{q.quotationNumber}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        required
                                        value={formData.customer}
                                        onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                                        className="flex-1 px-4 py-3 bg-dark-surface border border-dark-border rounded-r-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                        placeholder="Nama Customer"
                                    />
                                </div>
                            </div>

                            {/* Tanggal Inv */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Tanggal Invoice *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                />
                            </div>

                            {/* Judul */}
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">
                                    Judul / Keterangan
                                </label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:border-accent-blue focus:outline-none"
                                    placeholder="Keterangan Invoice..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* ITEMS TABLE SECTION */}
                    <div className="border-t border-dark-border pt-6">
                        <h3 className="text-lg font-semibold text-silver-light mb-4">Detail Item Invoice</h3>

                        {/* Item Input Form */}
                        <div className="glass-card p-4 rounded-lg border border-dark-border mb-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-silver mb-1">Item</label>
                                    <input
                                        type="text"
                                        value={itemForm.item}
                                        onChange={(e) => setItemForm({ ...itemForm, item: e.target.value })}
                                        placeholder="Nama Item"
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="md:col-span-3">
                                    <label className="block text-xs font-medium text-silver mb-1">Deskripsi</label>
                                    <input
                                        type="text"
                                        value={itemForm.description}
                                        onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                                        placeholder="Deskripsi..."
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-silver mb-1">Harga Satuan</label>
                                    <input
                                        type="number"
                                        value={itemForm.unitPrice}
                                        onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })}
                                        placeholder="Rp 0"
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="block text-xs font-medium text-silver mb-1">Jml</label>
                                    <input
                                        type="number"
                                        value={itemForm.quantity}
                                        onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })}
                                        placeholder="0"
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-medium text-silver mb-1">Satuan</label>
                                    <select
                                        value={itemForm.unit}
                                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-sm"
                                    >
                                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <button
                                        type="button"
                                        onClick={handleAddItem}
                                        className="w-full py-2 bg-accent-blue hover:bg-blue-600 text-white rounded-lg flex items-center justify-center transition-colors"
                                    >
                                        <Plus className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="glass-card rounded-lg overflow-hidden overflow-x-auto mb-4">
                            <table className="w-full text-sm">
                                <thead className="bg-accent-blue/10">
                                    <tr>
                                        <th className="px-4 py-3 text-center text-silver-light w-16">No</th>
                                        <th className="px-4 py-3 text-left text-silver-light">Item</th>
                                        <th className="px-4 py-3 text-left text-silver-light">Deskripsi</th>
                                        <th className="px-4 py-3 text-right text-silver-light">Harga Satuan</th>
                                        <th className="px-4 py-3 text-center text-silver-light">Jumlah</th>
                                        <th className="px-4 py-3 text-center text-silver-light">Satuan</th>
                                        <th className="px-4 py-3 text-right text-silver-light">Subtotal</th>
                                        <th className="px-4 py-3 text-center text-silver-light w-16">Acc</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {formData.items.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="px-4 py-8 text-center text-silver-dark opacity-50">
                                                Belum ada item ditambahkan
                                            </td>
                                        </tr>
                                    ) : (
                                        formData.items.map((item, idx) => (
                                            <tr key={item.id} className="hover:bg-dark-surface/50">
                                                <td className="px-4 py-2 text-center text-silver">{idx + 1}</td>
                                                <td className="px-4 py-2 text-silver font-medium">{item.item}</td>
                                                <td className="px-4 py-2 text-silver">{item.description || '-'}</td>
                                                <td className="px-4 py-2 text-right text-silver font-mono">
                                                    {formatCurrency(item.unitPrice)}
                                                </td>
                                                <td className="px-4 py-2 text-center text-silver">{item.quantity}</td>
                                                <td className="px-4 py-2 text-center text-silver">{item.unit}</td>
                                                <td className="px-4 py-2 text-right text-accent-green font-mono font-medium">
                                                    {formatCurrency(item.total)}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="text-red-400 hover:text-red-300 transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* COGS SECTION */}
                        <div className="border-t border-dark-border pt-6 mt-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-silver-light">COGS / Biaya Modal</h3>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={handleSyncCogs}
                                        icon={FileText}
                                    >
                                        Salin dari Invoice
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={handleAddCogsItem}
                                        icon={Plus}
                                    >
                                        Tambah Item
                                    </Button>
                                </div>
                            </div>

                            <div className="glass-card rounded-lg overflow-hidden overflow-x-auto mb-4 border border-dark-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-accent-orange/10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-silver-light">Item</th>
                                            <th className="px-4 py-3 text-left text-silver-light">Deskripsi</th>
                                            <th className="px-4 py-3 text-right text-silver-light">Harga Beli</th>
                                            <th className="px-4 py-3 text-center text-silver-light">Jml</th>
                                            <th className="px-4 py-3 text-right text-silver-light">Total</th>
                                            <th className="px-4 py-3 text-center text-silver-light w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {formData.cogsItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="px-4 py-6 text-center text-silver-dark opacity-50">
                                                    Belum ada item COGS. Klik "Salin dari Invoice" atau "Tambah Item".
                                                </td>
                                            </tr>
                                        ) : (
                                            formData.cogsItems.map((item, idx) => (
                                                <tr key={item.id} className="hover:bg-dark-surface/50">
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={item.item}
                                                            onChange={(e) => handleUpdateCogsItem(item.id, 'item', e.target.value)}
                                                            className="w-full bg-transparent border border-dark-border rounded px-2 py-1 text-silver-light"
                                                            placeholder="Nama Item"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="text"
                                                            value={item.description}
                                                            onChange={(e) => handleUpdateCogsItem(item.id, 'description', e.target.value)}
                                                            className="w-full bg-transparent border border-dark-border rounded px-2 py-1 text-silver"
                                                            placeholder="Deskripsi"
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <input
                                                            type="number"
                                                            value={item.unitPrice}
                                                            onChange={(e) => handleUpdateCogsItem(item.id, 'unitPrice', e.target.value)}
                                                            className="w-full bg-transparent border border-dark-border rounded px-2 py-1 text-right text-silver font-mono"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-2 w-20">
                                                        <input
                                                            type="number"
                                                            value={item.quantity}
                                                            onChange={(e) => handleUpdateCogsItem(item.id, 'quantity', e.target.value)}
                                                            className="w-full bg-transparent border border-dark-border rounded px-2 py-1 text-center text-silver"
                                                            placeholder="0"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-right font-mono text-accent-orange">
                                                        {formatCurrency(item.total)}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveCogsItem(item.id)}
                                                            className="text-red-400 hover:text-red-300 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {formData.cogsItems.length > 0 && (
                                        <tfoot className="bg-dark-surface/30 font-semibold border-t border-dark-border">
                                            <tr>
                                                <td colSpan="4" className="px-4 py-2 text-right text-silver">Total COGS:</td>
                                                <td className="px-4 py-2 text-right text-accent-orange">Rp {formatCurrency(totalCogs)}</td>
                                                <td></td>
                                            </tr>
                                            <tr>
                                                <td colSpan="4" className="px-4 py-2 text-right text-silver">Estimasi Laba Kotor:</td>
                                                <td className={`px-4 py-2 text-right ${grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    Rp {formatCurrency(grossProfit)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>

                        {/* SUMMARY & TOTALS */}
                        <div className="flex flex-col items-end space-y-3 pt-2 text-sm max-w-xs ml-auto">
                            <div className="flex justify-between w-full text-silver">
                                <span>Subtotal</span>
                                <span>Rp {formatCurrency(itemsSubtotal)}</span>
                            </div>

                            {/* Discount */}
                            <div className="flex justify-between items-center w-full text-silver">
                                <span>Diskon</span>
                                <div className="flex gap-1">
                                    <input
                                        type="number"
                                        value={formData.discountValue}
                                        onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                                        className="w-16 bg-dark-bg border border-dark-border rounded px-1 text-right text-xs"
                                    />
                                    <select
                                        value={formData.discountType}
                                        onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                                        className="bg-dark-bg border border-dark-border rounded px-1 text-xs"
                                    >
                                        <option value="percentage">%</option>
                                        <option value="fixed">Rp</option>
                                    </select>
                                </div>
                            </div>

                            {/* Tax */}
                            <div className="flex justify-between items-center w-full text-silver">
                                <span>Tax (PPN)</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={formData.taxRate}
                                        onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                        className="w-12 bg-dark-bg border border-dark-border rounded px-1 text-right text-xs"
                                    />
                                    <span>%</span>
                                    <span className="w-24 text-right">Rp {formatCurrency(taxAmt)}</span>
                                </div>
                            </div>

                            <div className="w-full border-t border-dark-border pt-2 flex justify-between items-center text-lg font-bold">
                                <span className="text-silver-light">Grand Total</span>
                                <span className="text-accent-green">Rp {formatCurrency(finalTotal)}</span>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex gap-3 justify-end mt-8 border-t border-dark-border pt-6">
                            <Button type="button" variant="secondary" onClick={onClose}>
                                Batal
                            </Button>
                            <Button type="submit">
                                Simpan Invoice
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Purchase Form Modal Component
const PurchaseFormModal = ({ onClose, onSubmit, vendors }) => {
    const [formData, setFormData] = useState({
        vendor: '',
        date: new Date().toISOString().split('T')[0],
        title: '',
        costItems: [],
        taxRate: 11,
        notes: '',
        status: 'unpaid'
    });

    const [costForm, setCostForm] = useState({
        description: '',
        quantity: '1',
        unitPrice: '0'
    });

    const handleAddCost = () => {
        if (!costForm.description || !costForm.quantity || !costForm.unitPrice) {
            alert('Lengkapi semua field biaya');
            return;
        }

        const newCost = {
            id: `cost-${Date.now()}`,
            description: costForm.description,
            quantity: Number(costForm.quantity),
            unitPrice: Number(costForm.unitPrice),
            total: Number(costForm.quantity) * Number(costForm.unitPrice)
        };

        setFormData({ ...formData, costItems: [...formData.costItems, newCost] });
        setCostForm({ description: '', quantity: '1', unitPrice: '0' });
    };

    const handleRemoveCost = (costId) => {
        setFormData({ ...formData, costItems: formData.costItems.filter(c => c.id !== costId) });
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const subtotal = formData.costItems.reduce((sum, cost) => sum + cost.total, 0);
        const taxAmount = (subtotal * formData.taxRate) / 100;
        const grandTotal = subtotal + taxAmount;

        onSubmit({
            ...formData,
            subtotal,
            taxAmount,
            grandTotal
        });

        onClose();
    };

    const subtotal = formData.costItems.reduce((sum, cost) => sum + cost.total, 0);
    const taxAmount = (subtotal * formData.taxRate) / 100;
    const grandTotal = subtotal + taxAmount;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="glass-card p-6 rounded-lg max-w-3xl w-full my-8">
                <h2 className="text-2xl font-bold text-silver-light mb-6">Buat Pembayaran/Purchase Baru</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Vendor *</label>
                            <input
                                type="text"
                                required
                                value={formData.vendor}
                                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                placeholder="Nama Vendor"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver mb-2">Tanggal *</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-silver mb-2">Judul Pembayaran *</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Pembayaran Jasa Transportasi"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Cost Items */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-silver-light">Breakdown Biaya</h3>

                        <div className="glass-card p-4 rounded-lg border border-dark-border">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Deskripsi</label>
                                    <input
                                        type="text"
                                        value={costForm.description}
                                        onChange={(e) => setCostForm({ ...costForm, description: e.target.value })}
                                        placeholder="Biaya Transportasi"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Qty</label>
                                    <input
                                        type="number"
                                        value={costForm.quantity}
                                        onChange={(e) => setCostForm({ ...costForm, quantity: e.target.value })}
                                        min="1"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-silver mb-2">Harga Satuan</label>
                                    <input
                                        type="number"
                                        value={costForm.unitPrice}
                                        onChange={(e) => setCostForm({ ...costForm, unitPrice: e.target.value })}
                                        min="0"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                            <Button type="button" size="sm" onClick={handleAddCost} icon={Plus}>
                                Tambah Biaya
                            </Button>
                        </div>

                        {formData.costItems.length > 0 && (
                            <div className="glass-card rounded-lg overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-accent-orange">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Deskripsi</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Qty</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Harga</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-white">Total</th>
                                            <th className="px-4 py-3 text-center text-sm font-semibold text-white">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {formData.costItems.map(cost => (
                                            <tr key={cost.id}>
                                                <td className="px-4 py-3 text-sm text-silver-light">{cost.description}</td>
                                                <td className="px-4 py-3 text-sm text-silver">{cost.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-silver">Rp {formatCurrency(cost.unitPrice)}</td>
                                                <td className="px-4 py-3 text-sm text-accent-green font-semibold">Rp {formatCurrency(cost.total)}</td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCost(cost.id)}
                                                        className="p-1 hover:bg-red-500 hover:bg-opacity-20 rounded"
                                                    >
                                                        <X className="w-4 h-4 text-red-400" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="glass-card p-4 rounded-lg border border-dark-border space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-silver-dark">Subtotal:</span>
                            <span className="text-silver-light font-semibold">Rp {formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-silver-dark">Pajak (PPN):</span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={formData.taxRate}
                                    onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    className="w-20 text-sm py-1 px-2"
                                />
                                <span className="text-silver-dark">% = Rp {formatCurrency(taxAmount)}</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-lg pt-2 border-t border-dark-border">
                            <span className="text-silver-light font-bold">TOTAL:</span>
                            <span className="text-accent-green font-bold">Rp {formatCurrency(grandTotal)}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Catatan</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full"
                            placeholder="Catatan tambahan..."
                        />
                    </div>

                    <div className="flex gap-3 justify-end">
                        <Button type="button" variant="secondary" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="submit">
                            Simpan Purchase
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BridgeFinance;
