import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { generatePONumber } from '../../utils/documentNumbers';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import COAPicker from '../../components/Common/COAPicker';
import {
    FileText, Plus, Search, Filter, Eye, Download, CheckCircle,
    XCircle, Clock, Package, DollarSign, TrendingUp, AlertCircle, X, Edit, Save, History, AlertTriangle, Trash2
} from 'lucide-react';

const PurchaseOrder = () => {
    const { companySettings } = useData();
    const [pos, setPOs] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        vendor_id: '',
        po_date: new Date().toISOString().split('T')[0],
        delivery_date: '',
        payment_terms: 'NET 30',
        po_items: [{ description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, coa_id: null }],
        tax_rate: 11.00,
        discount_amount: 0,
        notes: '',
        currency: 'IDR',
        shipment_id: null,
        quotation_id: null,
        job_number: '',
        // NEW: Shipper & Consignee details
        shipper_id: '',
        shipper_name: '',
        shipper_address: '',
        consignee_id: '',
        consignee_name: '',
        consignee_address: ''
    });

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: FileText },
        submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-400', icon: Clock },
        approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
        received: { label: 'Received', color: 'bg-purple-500/20 text-purple-400', icon: Package },
        cancelled: { label: 'Cancelled', color: 'bg-red-500/20 text-red-400', icon: XCircle }
    };

    useEffect(() => {
        fetchPOs();
        fetchVendors();
        fetchShipments();
        fetchQuotations();
    }, []);

    const fetchPOs = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_purchase_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPOs(data || []);
        } catch (error) {
            console.error('Error fetching POs:', error);
            setPOs([]);
        } finally {
            setLoading(false);
        }
    };


    const fetchVendors = async () => {
        try {
            const { data, error } = await supabase
                .from('freight_vendors')
                .select('*')
                .order('name');

            if (error) throw error;
            setVendors(data || []);
        } catch (error) {
            console.error('Error fetching vendors:', error);
            setVendors([]);
        }
    };

    const fetchShipments = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setShipments(data || []);
        } catch (error) {
            console.error('Error fetching shipments:', error);
        }
    };

    const fetchQuotations = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_quotations')
                .select('*')
                .in('status', ['approved', 'sent', 'approved_internal', 'converted'])
                .order('created_at', { ascending: false });
            if (error) throw error;
            setQuotations(data || []);
        } catch (error) {
            console.error('Error fetching quotations:', error);
        }
    };

    const handleVendorSelect = (e) => {
        const vendorId = e.target.value;
        const vendor = vendors.find(v => v.id === vendorId);

        if (vendor) {
            setFormData(prev => ({
                ...prev,
                vendor_id: vendor.id
            }));
        }
    };

    const addPOItem = () => {
        setFormData(prev => ({
            ...prev,
            po_items: [...prev.po_items, { description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, coa_id: null }]
        }));
    };

    const removePOItem = (index) => {
        if (formData.po_items.length > 1) {
            setFormData(prev => ({
                ...prev,
                po_items: prev.po_items.filter((_, i) => i !== index)
            }));
        }
    };

    const updatePOItem = (index, field, value) => {
        setFormData(prev => {
            const items = [...prev.po_items];
            items[index][field] = value;

            // Auto-calculate amount
            if (field === 'qty' || field === 'unit_price') {
                items[index].amount = items[index].qty * items[index].unit_price;
            }

            return { ...prev, po_items: items };
        });
    };

    const calculateTotals = () => {
        const subtotal = formData.po_items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxAmount = (subtotal * formData.tax_rate) / 100;
        const total = subtotal + taxAmount - (formData.discount_amount || 0);

        return { subtotal, taxAmount, total };
    };

    const handleCreatePO = async (e) => {
        e.preventDefault();
        console.log('Starting PO Creation... (Form Data):', formData);
        console.log('Vendor ID present?:', formData.vendor_id);

        if (!formData.vendor_id) {
            alert('Please select a vendor');
            return;
        }

        if (formData.po_items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        try {
            const { subtotal, taxAmount, total } = calculateTotals();
            const vendor = vendors.find(v => v.id === formData.vendor_id);

            const { data, error } = await supabase
                .from('blink_purchase_orders')
                .insert([{
                    vendor_id: vendor.id,
                    vendor_name: vendor.name,
                    vendor_email: vendor.email || '',
                    vendor_phone: vendor.phone || '',
                    vendor_address: vendor.address || '',
                    po_number: await generatePONumber(), // Using centralized PO Number Generation
                    po_date: formData.po_date || new Date(),
                    delivery_date: formData.delivery_date || null,
                    payment_terms: formData.payment_terms,
                    status: 'draft',
                    po_items: formData.po_items,
                    currency: formData.currency,
                    exchange_rate: formData.currency === 'USD' ? 16000 : 1, // Hardcoded for demo
                    subtotal: subtotal,
                    tax_rate: formData.tax_rate,
                    tax_amount: taxAmount,
                    discount_amount: formData.discount_amount || 0,
                    total_amount: total,
                    notes: formData.notes || '',
                    shipment_id: formData.shipment_id || null, // Allocation
                    quotation_id: formData.quotation_id || null,
                    job_number: formData.job_number || null,
                    coa_id: formData.coa_id || null, // Link to COA
                    // NEW: Shipper & Consignee details
                    shipper_id: formData.shipper_id || null,
                    shipper_name: formData.shipper_name || '',
                    shipper_address: formData.shipper_address || '',
                    consignee_id: formData.consignee_id || null,
                    consignee_name: formData.consignee_name || '',
                    consignee_address: formData.consignee_address || ''
                }])
                .select();

            if (error) throw error;

            fetchPOs();
            setShowCreateModal(false);
            resetForm();
            alert('Purchase Order created successfully!');
        } catch (error) {
            console.error('Error creating PO:', error);
            alert('Failed to create PO: ' + error.message);
        }
    };

    const handleApprovePO = async (po) => {
        if (!confirm(`Approve PO ${po.po_number}? This will create an AP entry.`)) return;

        try {
            console.log('Starting PO approval for:', po.po_number);

            // 1. Update PO status to approved
            const { data: updatedPO, error: poError } = await supabase
                .from('blink_purchase_orders')
                .update({
                    status: 'approved',
                    approved_by: 'Current User', // TODO: Get from auth
                    approved_at: new Date().toISOString()
                })
                .eq('id', po.id)
                .select();

            if (poError) {
                console.error('Error updating PO status:', poError);
                throw poError;
            }
            console.log('PO status updated successfully:', updatedPO);

            // 2. Calculate due date based on payment terms
            const today = new Date();
            const billDate = today.toISOString().split('T')[0];

            // Parse payment terms (e.g., "NET 30" -> 30 days)
            let daysToAdd = 30; // default
            if (po.payment_terms) {
                const match = po.payment_terms.match(/\d+/);
                if (match) {
                    daysToAdd = parseInt(match[0]);
                }
            }

            const dueDate = new Date(today);
            dueDate.setDate(dueDate.getDate() + daysToAdd);
            const dueDateStr = dueDate.toISOString().split('T')[0];

            // 3. Generate AP number
            const year = new Date().getFullYear();
            const timestamp = Date.now().toString().slice(-6);
            const apNumber = `AP-${year}-${timestamp}`;

            // 4. Create AP entry
            const apEntry = {
                ap_number: apNumber,
                po_id: po.id,
                po_number: po.po_number,
                vendor_id: po.vendor_id,
                vendor_name: po.vendor_name,
                bill_date: billDate,
                due_date: dueDateStr,
                original_amount: po.total_amount,
                paid_amount: 0,
                outstanding_amount: po.total_amount,
                currency: po.currency || 'IDR',
                status: 'outstanding',
                notes: `Auto-created from PO ${po.po_number} (${po.payment_terms || 'NET 30'})`
            };

            console.log('Creating AP entry:', apEntry);

            const { data: apData, error: apError } = await supabase
                .from('blink_ap_transactions')
                .insert([apEntry])
                .select();

            if (apError) {
                console.error('Error creating AP entry:', apError);
                throw apError;
            }

            console.log('AP entry created successfully:', apData);

            await fetchPOs();
            alert(`✅ PO approved!\n\nAP Entry Created:\n• AP Number: ${apNumber}\n• Amount: ${formatCurrency(po.total_amount, po.currency)}\n• Due Date: ${dueDateStr}`);
        } catch (error) {
            console.error('Error approving PO:', error);
            alert('Failed to approve PO: ' + error.message);
        }
    };

    const handleSubmitPO = async (po) => {
        if (!confirm(`Submit PO ${po.po_number} for approval?`)) return;

        try {
            const { error } = await supabase
                .from('blink_purchase_orders')
                .update({ status: 'submitted' })
                .eq('id', po.id);

            if (error) throw error;

            await fetchPOs();
            alert('PO submitted for approval!');
        } catch (error) {
            console.error('Error submitting PO:', error);
            alert('Failed to submit PO: ' + error.message);
        }
    };

    const handleDeletePO = async (po) => {
        // Don't allow delete if there's already payment
        if (po.paid_amount && po.paid_amount > 0) {
            alert('PO tidak dapat dihapus karena sudah ada pembayaran tercatat.');
            return;
        }

        if (!confirm(`Hapus PO ${po.po_number}?\n\nPerhatian: Tindakan ini tidak dapat dibatalkan dan akan menghapus AP yang terkait.`)) return;

        try {
            console.log('Deleting PO:', po.po_number);

            // 1. Delete linked AP entry if exists
            const { error: apError } = await supabase
                .from('blink_ap_transactions')
                .delete()
                .eq('po_id', po.id);

            if (apError) {
                console.warn('Could not delete linked AP (may not exist):', apError);
            }

            // 2. Delete linked payments if any
            const { error: paymentError } = await supabase
                .from('blink_payments')
                .delete()
                .eq('reference_id', po.id)
                .eq('reference_type', 'po');

            if (paymentError) {
                console.warn('Could not delete linked payments:', paymentError);
            }

            // 3. Delete the PO
            const { error } = await supabase
                .from('blink_purchase_orders')
                .delete()
                .eq('id', po.id);

            if (error) throw error;

            await fetchPOs();
            setShowViewModal(false);
            setSelectedPO(null);
            alert(`✅ PO ${po.po_number} berhasil dihapus.`);
        } catch (error) {
            console.error('Error deleting PO:', error);
            alert('Gagal menghapus PO: ' + error.message);
        }
    };

    const handlePrintPO = (po) => {
        try {
            // Create printable content
            const printWindow = window.open('', '_blank');

            if (!printWindow) {
                alert('Pop-up blocked! Please allow pop-ups for this site.');
                return;
            }

            // Generate items rows
            const itemsRows = po.po_items.map(item => {
                const desc = String(item.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `
                    <tr>
                        <td>${desc}</td>
                        <td style="text-align: center;">${item.qty || 0}</td>
                        <td style="text-align: right;">${formatCurrency(item.unit_price || 0, po.currency)}</td>
                        <td style="text-align: right;">${formatCurrency(item.amount || 0, po.currency)}</td>
                    </tr>
                `;
            }).join('');

            // Format approval date if exists
            const approvalDate = po.approved_at ? new Date(po.approved_at).toLocaleDateString('id-ID') : '-';
            const approvedBy = po.approved_by || '-';

            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Purchase Order - ${po.po_number}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            margin: 15px;
                            color: #333;
                            line-height: 1.4;
                            font-size: 11px;
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 20px;
                            padding-bottom: 15px;
                            border-bottom: 2px solid #0070BB;
                        }
                        .header h1 {
                            margin: 0 0 8px 0;
                            color: #0070BB;
                            font-size: 20px;
                            font-weight: bold;
                        }
                        .header p {
                            font-size: 13px;
                            color: #666;
                            margin: 0;
                        }

                        /* Info table for aligned colons */
                        .info-table {
                            width: 100%;
                            margin-bottom: 20px;
                            border-collapse: collapse;
                        }
                        .info-table td {
                            padding: 3px 0;
                            font-size: 11px;
                        }
                        .info-table .label {
                            width: 130px;
                            font-weight: bold;
                            color: #555;
                        }
                        .info-table .colon {
                            width: 10px;
                            font-weight: bold;
                        }
                        .info-table .value {
                            color: #333;
                        }

                        h3 {
                            margin: 15px 0 10px 0;
                            color: #0070BB;
                            font-size: 12px;
                        }

                        /* Items table */
                        table.items-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 15px;
                        }
                        table.items-table th,
                        table.items-table td {
                            border: 1px solid #ddd;
                            padding: 6px 8px;
                            font-size: 10px;
                        }
                        table.items-table th {
                            background-color: #0070BB;
                            font-weight: bold;
                            color: white;
                            text-align: left;
                        }
                        table.items-table tbody tr:nth-child(even) td {
                            background-color: #f9f9f9;
                        }

                        /* Footer section with 2 columns */
                        .footer-section {
                            display: table;
                            width: 100%;
                            margin-top: 15px;
                        }
                        .footer-left {
                            display: table-cell;
                            width: 50%;
                            vertical-align: top;
                            padding-right: 20px;
                        }
                        .footer-right {
                            display: table-cell;
                            width: 50%;
                            vertical-align: top;
                        }

                        /* Approval info on left */
                        .approval-info {
                            margin-bottom: 15px;
                        }
                        .approval-info table {
                            border-collapse: collapse;
                        }
                        .approval-info td {
                            padding: 3px 0;
                            font-size: 11px;
                        }
                        .approval-info .label {
                            width: 100px;
                            font-weight: bold;
                            color: #555;
                        }
                        .approval-info .colon {
                            width: 10px;
                            font-weight: bold;
                        }
                        .approval-info .value {
                            color: #333;
                        }

                        /* Notes section on left */
                        .notes-section {
                            padding: 10px;
                            background: #f9f9f9;
                            border-left: 3px solid #0070BB;
                            font-size: 10px;
                        }
                        .notes-section strong {
                            font-size: 11px;
                            display: block;
                            margin-bottom: 5px;
                        }

                        /* Totals table on right */
                        .totals-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .totals-table tr td {
                            padding: 3px 0;
                            font-size: 11px;
                        }
                        .totals-table .label {
                            width: 100px;
                            text-align: right;
                            font-weight: bold;
                            padding-right: 5px;
                        }
                        .totals-table .colon {
                            width: 10px;
                            font-weight: bold;
                        }
                        .totals-table .value {
                            width: 150px;
                            text-align: right;
                            padding-left: 10px;
                        }
                        .totals-table .grand-total {
                            font-size: 13px;
                            font-weight: bold;
                            border-top: 2px solid #0070BB;
                            padding-top: 8px !important;
                        }
                        .totals-table .grand-total .value {
                            color: #0070BB;
                        }

                        .button-container {
                            margin-top: 30px;
                            text-align: center;
                        }
                        button {
                            padding: 10px 25px;
                            margin: 0 8px;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .btn-print {
                            background: #0070BB;
                            color: white;
                        }
                        .btn-print:hover {
                            background: #005a99;
                        }
                        .btn-close {
                            background: #666;
                            color: white;
                        }
                        .btn-close:hover {
                            background: #555;
                        }
                        @media print {
                            button { display: none; }
                            .button-container { display: none; }
                            body { margin: 10px; }
                        }
                    </style>
                </head>
                <body>
                    <!-- Company Letterhead -->
                    <div style="margin-bottom: 20px;">
                        <div style="text-align: center;">
                            <h1 style="margin: 0 0 5px 0; color: #0070BB; font-size: 18px;">${companySettings?.company_name || 'PT Bakhtera Satu Indonesia'}</h1>
                            <p style="margin: 0 0 3px 0; font-size: 10px; color: #444;">${(companySettings?.company_address || 'Jakarta, Indonesia').replace(/\n/g, ', ')}</p>
                            ${companySettings?.company_phone || companySettings?.company_email ? `<p style="margin: 0; font-size: 9px; color: #666;">${companySettings?.company_phone ? 'Tel: ' + companySettings.company_phone : ''}${companySettings?.company_phone && companySettings?.company_email ? ' | ' : ''}${companySettings?.company_email ? 'Email: ' + companySettings.company_email : ''}</p>` : ''}
                        </div>
                        <div style="margin-top: 10px; border-top: 2px solid #0070BB;"></div>
                    </div>
                    
                    <div class="header">
                        <h1>PURCHASE ORDER</h1>
                        <p><strong>${po.po_number}</strong></p>
                    </div>

                    <!--Info section with aligned colons -->
                    <table class="info-table">
                        <tr>
                            <td class="label">Vendor</td>
                            <td class="colon">:</td>
                            <td class="value">${po.vendor_name || '-'}</td>
                        </tr>
                        <tr>
                            <td class="label">PO Date</td>
                            <td class="colon">:</td>
                            <td class="value">${po.po_date ? new Date(po.po_date).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>
                        <tr>
                            <td class="label">Delivery Date</td>
                            <td class="colon">:</td>
                            <td class="value">${po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('id-ID') : '-'}</td>
                        </tr>
                        <tr>
                            <td class="label">Payment Terms</td>
                            <td class="colon">:</td>
                            <td class="value">${po.payment_terms || '-'}</td>
                        </tr>
                        <tr>
                            <td class="label">Currency</td>
                            <td class="colon">:</td>
                            <td class="value">${po.currency || 'IDR'}</td>
                        </tr>
                    </table>

                    <!-- Shipper & Consignee Section -->
                    ${po.shipper_name || po.consignee_name ? `
                        <h3>Shipping Details</h3>
                        <div style="display: table; width: 100%; margin-bottom: 15px;">
                            ${po.shipper_name ? `
                                <div style="display: table-cell; width: 50%; padding-right: 20px; vertical-align: top;">
                                    <div style="padding: 10px; background: #f9f9f9; border-left: 3px solid #0070BB;">
                                        <strong style="display: block; margin-bottom: 5px; color: #0070BB;">Shipper</strong>
                                        <div style="font-size: 11px;">${po.shipper_name}</div>
                                        ${po.shipper_address ? `<div style="font-size: 10px; color: #666; margin-top: 3px;">${po.shipper_address.replace(/\n/g, '<br>')}</div>` : ''}
                                    </div>
                                </div>
                            ` : ''}
                            ${po.consignee_name ? `
                                <div style="display: table-cell; width: 50%; padding-left: ${po.shipper_name ? '0' : '0'}; vertical-align: top;">
                                    <div style="padding: 10px; background: #f9f9f9; border-left: 3px solid #0070BB;">
                                        <strong style="display: block; margin-bottom: 5px; color: #0070BB;">Consignee</strong>
                                        <div style="font-size: 11px;">${po.consignee_name}</div>
                                        ${po.consignee_address ? `<div style="font-size: 10px; color: #666; margin-top: 3px;">${po.consignee_address.replace(/\n/g, '<br>')}</div>` : ''}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}

                    <h3>Order Items</h3>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style="width: 60px; text-align: center;">Qty</th>
                                <th style="width: 120px; text-align: right;">Unit Price</th>
                                <th style="width: 120px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>

                    <!-- Footer section: Left (Approval + Notes) | Right (Totals) -->
                    <div class="footer-section">
                        <!-- Left column: Approval and Notes -->
                        <div class="footer-left">
                            <!-- Approval Info -->
                            <div class="approval-info">
                                <table>
                                    <tr>
                                        <td class="label">Approved Date</td>
                                        <td class="colon">:</td>
                                        <td class="value">${approvalDate}</td>
                                    </tr>
                                    <tr>
                                        <td class="label">Approved By</td>
                                        <td class="colon">:</td>
                                        <td class="value">${approvedBy}</td>
                                    </tr>
                                </table>
                            </div>

                            <!-- Notes (aligned with Tax row on right) -->
                            ${po.notes ? `
                                <div class="notes-section">
                                    <strong>Notes:</strong>
                                    ${String(po.notes).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}
                                </div>
                            ` : ''}
                        </div>

                        <!-- Right column: Totals -->
                        <div class="footer-right">
                            <table class="totals-table">
                                <tr>
                                    <td class="label">Subtotal</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(po.subtotal || 0, po.currency)}</td>
                                </tr>
                                <tr>
                                    <td class="label">Tax (${po.tax_rate || 0}%)</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(po.tax_amount || 0, po.currency)}</td>
                                </tr>
                                <tr class="grand-total">
                                    <td class="label grand-total">TOTAL</td>
                                    <td class="colon grand-total">:</td>
                                    <td class="value grand-total">${formatCurrency(po.total_amount || 0, po.currency)}</td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <!-- Approval Signature Section -->
                    <div style="margin-top: 40px; page-break-inside: avoid;">
                        <h3>Approval Signature</h3>
                        <div style="display: table; width: 100%;">
                            <!-- Prepared By -->
                            <div style="display: table-cell; width: 33%; text-align: center; padding: 10px; vertical-align: top;">
                                <div style="border: 1px solid #ddd; padding: 15px; min-height: 100px; background: #f9f9f9;">
                                    <div style="font-weight: bold; margin-bottom: 60px; color: #555;">Prepared By</div>
                                    <div style="border-top: 1px solid #999; padding-top: 5px; font-size: 10px;">
                                        (__________________)
                                    </div>
                                    <div style="font-size: 9px; color: #666; margin-top: 3px;">Date: __________</div>
                                </div>
                            </div>
                            <!-- Approved By -->
                            <div style="display: table-cell; width: 33%; text-align: center; padding: 10px; vertical-align: top;">
                                <div style="border: 2px solid #0070BB; padding: 15px; min-height: 100px; background: #f7fcff;">
                                    <div style="font-weight: bold; margin-bottom: 10px; color: #0070BB;">Approved By</div>
                                    ${po.approval_signature ? `
                                        <img src="${po.approval_signature}" alt="Signature" style="max-width: 100px; max-height: 40px; margin: 5px auto; display: block;" />
                                    ` : `
                                        <div style="margin: 20px 0;"></div>
                                    `}
                                    <div style="border-top: 1px solid #0070BB; padding-top: 5px; font-size: 10px; margin-top: 10px;">
                                        <strong>${approvedBy}</strong>
                                    </div>
                                    <div style="font-size: 9px; color: #666; margin-top: 3px;">Date: ${approvalDate}</div>
                                </div>
                            </div>
                            <!-- Received By -->
                            <div style="display: table-cell; width: 33%; text-align: center; padding: 10px; vertical-align: top;">
                                <div style="border: 1px solid #ddd; padding: 15px; min-height: 100px; background: #f9f9f9;">
                                    <div style="font-weight: bold; margin-bottom: 60px; color: #555;">Received By</div>
                                    <div style="border-top: 1px solid #999; padding-top: 5px; font-size: 10px;">
                                        (__________________)
                                    </div>
                                    <div style="font-size: 9px; color: #666; margin-top: 3px;">Date: __________</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="button-container">
                        <button onclick="window.print()" class="btn-print">🖨️ Print</button>
                        <button onclick="window.close()" class="btn-close">✖ Close</button>
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(printContent);
            printWindow.document.close();
        } catch (error) {
            console.error('Error printing PO:', error);
            alert('Gagal membuka print preview: ' + error.message);
        }
    };

    const handleEditPO = (po) => {
        setFormData({
            vendor_id: po.vendor_id || '',
            po_date: po.po_date,
            delivery_date: po.delivery_date || '',
            payment_terms: po.payment_terms || 'NET 30',
            po_items: po.po_items && po.po_items.length > 0 ? po.po_items : [{ description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, coa_id: null }],
            tax_rate: po.tax_rate || 11.00,
            discount_amount: po.discount_amount || 0,
            notes: po.notes || '',
            currency: po.currency || 'IDR',
            shipment_id: po.shipment_id || null,
            quotation_id: po.quotation_id || null,
            job_number: po.job_number || '',
            coa_id: po.coa_id || '', // Load existing COA
            // NEW: Shipper & Consignee details
            shipper_id: po.shipper_id || '',
            shipper_name: po.shipper_name || '',
            shipper_address: po.shipper_address || '',
            consignee_id: po.consignee_id || '',
            consignee_name: po.consignee_name || '',
            consignee_address: po.consignee_address || ''
        });
        setIsEditing(true);
        setEditId(po.id);
        setShowCreateModal(true);
        // If coming from View Modal, close it? Or keep it open? Better close View Modal first usually.
        setShowViewModal(false);
    };

    const handleUpdatePO = async (e) => {
        e.preventDefault();
        console.log('Starting PO Update... (Form Data):', formData);
        console.log('Delivery Date Value:', formData.delivery_date);

        if (!formData.vendor_id) {
            alert('Please select a vendor');
            return;
        }

        if (formData.po_items.length === 0) {
            alert('Please add at least one item');
            return;
        }

        try {
            const { subtotal, taxAmount, total } = calculateTotals();
            const vendor = vendors.find(v => v.id === formData.vendor_id);

            // Check if this PO was previously approved (needs re-approval after edit)
            const currentPO = pos.find(p => p.id === editId);
            const wasApproved = currentPO?.status === 'approved';
            const hasPayment = currentPO?.paid_amount && currentPO.paid_amount > 0;

            // Don't allow edit if there's already payment
            if (hasPayment) {
                alert('PO tidak dapat diubah karena sudah ada pembayaran tercatat.');
                return;
            }

            // Build update object
            const updates = {
                vendor_id: vendor.id,
                vendor_name: vendor.name,
                vendor_email: vendor.email || '',
                vendor_phone: vendor.phone || '',
                vendor_address: vendor.address || '',
                po_date: formData.po_date || null,
                delivery_date: formData.delivery_date || null,
                payment_terms: formData.payment_terms,
                po_items: formData.po_items,
                currency: formData.currency,
                exchange_rate: formData.currency === 'USD' ? 16000 : 1,
                subtotal: subtotal,
                tax_rate: formData.tax_rate,
                tax_amount: taxAmount,
                discount_amount: formData.discount_amount || 0,
                total_amount: total,
                notes: formData.notes || '',
                updated_at: new Date().toISOString(),
                shipment_id: formData.shipment_id || null, // Allow updating allocation
                quotation_id: formData.quotation_id || null,
                job_number: formData.job_number || null,
                coa_id: formData.coa_id || null,
                // NEW: Shipper & Consignee details
                shipper_id: formData.shipper_id || null,
                shipper_name: formData.shipper_name || '',
                shipper_address: formData.shipper_address || '',
                consignee_id: formData.consignee_id || null,
                consignee_name: formData.consignee_name || '',
                consignee_address: formData.consignee_address || ''
            };

            // If PO was approved, require re-approval and add revision info
            if (wasApproved) {
                updates.status = 'submitted'; // Needs re-approval
                // Append revision note to existing notes instead of using separate column
                const revisionNote = `[REVISED ${new Date().toLocaleDateString('id-ID')}] `;
                updates.notes = revisionNote + (formData.notes || '');

                // Update linked AP entry if exists
                if (currentPO.id) {
                    const { error: apUpdateError } = await supabase
                        .from('blink_ap_transactions')
                        .update({
                            original_amount: total,
                            outstanding_amount: total,
                            notes: `PO Revised - Amount updated from ${formatCurrency(currentPO.total_amount, currentPO.currency)} to ${formatCurrency(total, formData.currency)}`,
                            status: 'pending_revision'
                        })
                        .eq('po_id', currentPO.id);

                    if (apUpdateError) {
                        console.warn('Could not update linked AP:', apUpdateError);
                    }
                }
            }

            const { error } = await supabase
                .from('blink_purchase_orders')
                .update(updates)
                .eq('id', editId);

            if (error) throw error;

            await fetchPOs();
            setShowCreateModal(false);
            resetForm();

            if (wasApproved) {
                alert('✅ PO diperbarui!\n\nKarena PO sebelumnya sudah disetujui, PO ini perlu disetujui ulang.\nStatus berubah ke "Submitted".');
            } else {
                alert('Purchase Order updated successfully!');
            }
        } catch (error) {
            console.error('Error updating PO:', error);
            alert('Failed to update PO: ' + error.message);
        }
    };

    // ... existing resetForm ...

    const resetForm = () => {
        setFormData({
            vendor_id: '',
            po_date: new Date().toISOString().split('T')[0],
            delivery_date: '',
            payment_terms: 'NET 30',
            po_items: [{ description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0 }],
            tax_rate: 11.00,
            discount_amount: 0,
            notes: '',
            currency: 'IDR',
            coa_id: '',
            // NEW: Reset shipper & consignee
            shipper_id: '',
            shipper_name: '',
            shipper_address: '',
            consignee_id: '',
            consignee_name: '',
            consignee_address: ''
        });
        setIsEditing(false);
        setEditId(null);
    };

    const formatCurrency = (value, currency = 'IDR') => {
        return currency === 'USD'
            ? `$${value.toLocaleString('id-ID')}`
            : `Rp ${value.toLocaleString('id-ID')}`;
    };

    const filteredPOs = pos.filter(po => {
        const matchesFilter = filter === 'all' || po.status === filter;
        const matchesSearch = !searchTerm ||
            po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Calculate summary stats
    const totalPOs = pos.length;
    const totalValue = pos.filter(p => p.status !== 'cancelled').reduce((sum, po) => sum + (po.total_amount || 0), 0);
    const pendingApproval = pos.filter(p => p.status === 'submitted').length;
    const approvedPOs = pos.filter(p => p.status === 'approved').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Purchase Orders</h1>
                    <p className="text-silver-dark mt-1">Kelola pembelian dari vendor</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                    Buat PO Baru
                </Button>
            </div>



            {/* Search - Full Width */}
            <div className="w-full">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari PO number atau vendor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-base"
                    />
                </div>
            </div>

            {/* PO Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">PO Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Vendor</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">PO Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Delivery Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Amount</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredPOs.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-3 py-8 text-center">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2" />
                                        <p className="text-silver-dark text-sm">
                                            {filter === 'all'
                                                ? 'Belum ada PO. Klik "Buat PO Baru" untuk memulai.'
                                                : `Tidak ada PO dengan status "${statusConfig[filter]?.label}"`
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredPOs.map((po) => {
                                    const config = statusConfig[po.status];
                                    const StatusIcon = config?.icon || FileText;

                                    return (
                                        <tr
                                            key={po.id}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                            onClick={() => {
                                                setSelectedPO(po);
                                                setShowViewModal(true);
                                            }}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="font-medium text-accent-orange">{po.po_number}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-light">{po.vendor_name}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-dark">
                                                    {po.po_date ? new Date(po.po_date).toLocaleDateString('id-ID') : '-'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-dark">
                                                    {po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('id-ID') : '-'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="font-semibold text-silver-light">{formatCurrency(po.total_amount, po.currency)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap">
                                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    <span>{config?.label}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit PO Modal */}
            {
                showCreateModal && (
                    <POCreateModal
                        isEditing={isEditing}
                        vendors={vendors}
                        shipments={shipments}
                        quotations={quotations}
                        formData={formData}

                        setFormData={setFormData}
                        handleVendorSelect={handleVendorSelect}
                        addPOItem={addPOItem}
                        removePOItem={removePOItem}
                        updatePOItem={updatePOItem}
                        calculateTotals={calculateTotals}
                        handleSubmit={isEditing ? handleUpdatePO : handleCreatePO}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowCreateModal(false);
                            resetForm();
                        }}
                    />
                )
            }

            {/* View PO Modal */}
            {
                showViewModal && selectedPO && (
                    <POViewModal
                        po={selectedPO}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowViewModal(false);
                            setSelectedPO(null);
                        }}
                        onEdit={() => handleEditPO(selectedPO)}
                        onSubmit={() => {
                            handleSubmitPO(selectedPO);
                            setShowViewModal(false);
                        }}
                        onApprove={() => {
                            handleApprovePO(selectedPO);
                            setShowViewModal(false);
                        }}
                        onPrint={() => handlePrintPO(selectedPO)}
                        onDelete={() => handleDeletePO(selectedPO)}
                        statusConfig={statusConfig}
                    />
                )
            }
        </div >
    );
};

// PO Create/Edit Modal Component
const POCreateModal = ({ isEditing, vendors, shipments, quotations, accounts, formData, setFormData, handleVendorSelect, addPOItem, removePOItem,
    updatePOItem, calculateTotals, handleSubmit, formatCurrency, onClose }) => {

    const { subtotal, taxAmount, total } = calculateTotals();

    // Combine shipments and quotations for selection logic
    const handleAllocationSelect = (e) => {
        const val = e.target.value; // format: "shipment|ID" or "quotation|ID"

        if (!val) {
            setFormData(prev => ({
                ...prev,
                shipment_id: null,
                quotation_id: null,
                job_number: ''
            }));
            return;
        }

        const [type, id] = val.split('|');
        if (type === 'shipment') {
            const ship = shipments.find(s => s.id === id);
            setFormData(prev => ({
                ...prev,
                shipment_id: id,
                quotation_id: null,
                job_number: ship?.job_number || '' // Assuming job_number will be added to shipment soon or exists
            }));
        } else if (type === 'quotation') {
            const quot = quotations.find(q => q.id === id);
            setFormData(prev => ({
                ...prev,
                shipment_id: null,
                quotation_id: id,
                job_number: quot?.quotation_number || '' // Use Quote No as fallback if no job number
            }));
        }
    };

    // Prepare options
    const allocationOptions = [
        ...shipments.map(s => ({
            value: `shipment|${s.id}`,
            label: `Shipment: ${s.origin} -> ${s.destination} (${s.customer_name})`,
            type: 'Shipment'
        })),
        ...quotations.map(q => ({
            value: `quotation|${q.id}`,
            label: `Quote: ${q.quotation_number} - ${q.customer?.name || 'Customer'}`,
            type: 'Quotation'
        }))
    ];

    const currentAllocationValue = formData.shipment_id
        ? `shipment|${formData.shipment_id}`
        : formData.quotation_id
            ? `quotation|${formData.quotation_id}`
            : '';

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-[90vw]">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">{isEditing ? 'Edit Purchase Order' : 'Buat Purchase Order Baru'}</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ... (rest of the form remains mostly same, just check formData mapping) ... */}
                    {/* Notes: Form fields are controlled by formData, so reusing them works. Button text change below. */}

                    {/* ... existing fields ... */}


                    <div className="glass-card p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <label className="block text-sm font-semibold text-accent-blue mb-2">
                            Alokasi Job / Shipment
                        </label>
                        <p className="text-xs text-silver-dark mb-3">
                            Hubungkan PO ini dengan Shipment atau Quotation untuk menghitung profit per job.
                        </p>
                        <select
                            value={currentAllocationValue}
                            onChange={handleAllocationSelect}
                            className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                        >
                            <option value="">-- Tidak Ada Alokasi (Biaya Umum/Overhead) --</option>
                            <optgroup label="Shipments">
                                {shipments.map(s => (
                                    <option key={s.id} value={`shipment|${s.id}`}>
                                        {s.customer_name ? `[${s.customer_name}] ` : ''}
                                        {s.origin} → {s.destination}
                                        {s.job_number ? ` (#${s.job_number})` : ''}
                                    </option>
                                ))}
                            </optgroup>
                            <optgroup label="Quotations">
                                {quotations.map(q => (
                                    <option key={q.id} value={`quotation|${q.id}`}>
                                        {q.quotation_number} - {q.customer?.name || 'Unknown'}
                                        ({q.origin} → {q.destination})
                                    </option>
                                ))}
                            </optgroup>
                        </select>
                        {(formData.job_number) && (
                            <p className="mt-2 text-xs text-green-400">
                                ✓ Linked to Job: <strong>{formData.job_number}</strong>
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Vendor *</label>
                            <select
                                value={formData.vendor_id}
                                onChange={handleVendorSelect}
                                required
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="">Pilih Vendor</option>
                                {vendors.map(vendor => (
                                    <option key={vendor.id} value={vendor.id}>{vendor.name}</option>
                                ))}
                            </select>
                        </div>
                        {/* ... currency ... */}
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="IDR">IDR</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>

                    {/* ... Dates ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">PO Date</label>
                            <input
                                type="date"
                                value={formData.po_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, po_date: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Delivery Date</label>
                            <input
                                type="date"
                                value={formData.delivery_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Payment Terms</label>
                            <select
                                value={formData.payment_terms}
                                onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="NET 15">NET 15</option>
                                <option value="NET 30">NET 30</option>
                                <option value="NET 45">NET 45</option>
                                <option value="NET 60">NET 60</option>
                            </select>
                        </div>
                    </div>

                    {/* ... Items ... */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-silver-light">PO Items *</label>
                            <button type="button" onClick={addPOItem} className="text-accent-orange hover:text-accent-orange/80 text-sm flex items-center gap-1">
                                <Plus className="w-4 h-4" /> Add Item
                            </button>
                        </div>

                        {/* Header Row */}
                        <div className="grid grid-cols-12 gap-2 mb-2 px-3">
                            <div className="col-span-4">
                                <label className="text-xs font-semibold text-silver-dark uppercase">Deskripsi</label>
                            </div>
                            <div className="col-span-1">
                                <label className="text-xs font-semibold text-silver-dark uppercase">Qty</label>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-silver-dark uppercase">Harga</label>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-silver-dark uppercase">Total</label>
                            </div>
                            <div className="col-span-2">
                                <label className="text-xs font-semibold text-silver-dark uppercase">Akun Biaya</label>
                            </div>
                            <div className="col-span-1"></div>
                        </div>

                        <div className="space-y-3">
                            {formData.po_items.map((item, index) => (
                                <div key={index} className="grid grid-cols-12 gap-2 items-start glass-card p-3 rounded-lg">
                                    <div className="col-span-4">
                                        <input
                                            type="text"
                                            placeholder="Deskripsi item"
                                            value={item.description}
                                            onChange={(e) => updatePOItem(index, 'description', e.target.value)}
                                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-1">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={item.qty}
                                            onChange={(e) => updatePOItem(index, 'qty', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm text-center"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input
                                            type="number"
                                            placeholder="0"
                                            value={item.unit_price}
                                            onChange={(e) => updatePOItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                            className="w-full px-2 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <div className="px-3 py-2 bg-dark-card border border-dark-border rounded-lg text-silver-light text-sm font-semibold">
                                            {formatCurrency(item.amount, formData.currency)}
                                        </div>
                                    </div>
                                    <div className="col-span-2">
                                        <COAPicker
                                            value={item.coa_id}
                                            onChange={(coaId) => updatePOItem(index, 'coa_id', coaId)}
                                            context="AP"
                                            minLevel={3}
                                            placeholder="Pilih Akun"
                                            size="sm"
                                        />
                                    </div>
                                    <div className="col-span-1 flex items-center justify-center">
                                        {formData.po_items.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removePOItem(index)}
                                                className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ... Totals and Notes ... */}
                    <div className="space-y-2 border-t border-dark-border pt-4">
                        <div className="flex justify-between text-silver-dark">
                            <span>Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(subtotal, formData.currency)}</span>
                        </div>
                        <div className="flex justify-between items-center text-silver-dark">
                            <div className="flex items-center gap-2">
                                <span>VAT/Tax:</span>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={formData.tax_rate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                                    className="w-16 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                />
                                <span className="text-xs">%</span>
                            </div>
                            <span className="font-semibold">{formatCurrency(taxAmount, formData.currency)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-silver-light">
                            <span>Total:</span>
                            <span className="text-accent-orange">{formatCurrency(total, formData.currency)}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-silver-light mb-2">Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            rows="3"
                            className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            placeholder="Additional notes..."
                        />
                    </div>


                    {/* Actions */}
                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Cancel
                        </button>
                        <Button type="submit" icon={isEditing ? Save : Plus}>
                            {isEditing ? 'Save Changes' : 'Create PO'}
                        </Button>
                    </div>
                </form>
            </div >
        </Modal >
    );
};

// PO View Modal Component
const POViewModal = ({ po, formatCurrency, onClose, onEdit, onSubmit, onApprove, onPrint, onDelete, statusConfig }) => {
    const config = statusConfig[po.status];
    const StatusIcon = config?.icon || FileText;

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold gradient-text">Purchase Order Details</h2>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${config?.color}`}>
                        <StatusIcon className="w-5 h-5" />
                        <span className="font-semibold">{config?.label}</span>
                    </div>
                </div>

                {/* ... PO Info ... */}
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-silver-dark">PO Number</p>
                            <p className="text-lg font-semibold text-accent-orange">{po.po_number}</p>
                        </div>
                        <div>
                            <p className="text-sm text-silver-dark">Vendor</p>
                            <p className="text-lg font-semibold text-silver-light">{po.vendor_name}</p>
                        </div>
                        <div>
                            <p className="text-sm text-silver-dark">PO Date</p>
                            <p className="text-silver-light">{po.po_date ? new Date(po.po_date).toLocaleDateString('id-ID') : '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-silver-dark">Delivery Date</p>
                            <p className="text-silver-light">{po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('id-ID') : '-'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-silver-dark">Payment Terms</p>
                            <p className="text-silver-light">{po.payment_terms}</p>
                        </div>
                    </div>

                    {/* Job Allocation Info */}
                    {(po.job_number || po.quotation_id || po.shipment_id) && (
                        <div className="glass-card p-3 rounded-lg border border-blue-500/30 bg-blue-500/5">
                            <h4 className="text-sm font-bold text-accent-blue mb-1">Job Allocation</h4>
                            <div className="flex items-center gap-4 text-sm">
                                {po.job_number && (
                                    <div>
                                        <span className="text-silver-dark mr-2">Job Number:</span>
                                        <span className="text-silver-light font-medium">{po.job_number}</span>
                                    </div>
                                )}
                                {po.shipment_id && (
                                    <div className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                                        Linked to Shipment
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {/* ... Items Table ... */}
                    <div>
                        <h3 className="text-lg font-semibold text-silver-light mb-3">Items</h3>
                        <table className="w-full">
                            <thead className="bg-dark-surface">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs text-silver-dark">Description</th>
                                    <th className="px-4 py-2 text-right text-xs text-silver-dark">Qty</th>
                                    <th className="px-4 py-2 text-right text-xs text-silver-dark">Unit Price</th>
                                    <th className="px-4 py-2 text-right text-xs text-silver-dark">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {po.po_items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 text-silver-light">{item.description}</td>
                                        <td className="px-4 py-2 text-right text-silver-light">{item.qty}</td>
                                        <td className="px-4 py-2 text-right text-silver-light">{formatCurrency(item.unit_price, po.currency)}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-silver-light">{formatCurrency(item.amount, po.currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ... Totals ... */}
                    <div className="space-y-2 border-t border-dark-border pt-4">
                        <div className="flex justify-between text-silver-dark">
                            <span>Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(po.subtotal, po.currency)}</span>
                        </div>
                        <div className="flex justify-between text-silver-dark">
                            <span>Tax ({po.tax_rate}%):</span>
                            <span className="font-semibold">{formatCurrency(po.tax_amount, po.currency)}</span>
                        </div>
                        <div className="flex justify-between text-xl font-bold text-silver-light">
                            <span>Total:</span>
                            <span className="text-accent-orange">{formatCurrency(po.total_amount, po.currency)}</span>
                        </div>
                    </div>

                    {/* Payment Status Summary - Always visible for approved/received POs */}
                    {(po.status === 'approved' || po.status === 'received') && (
                        <div className="glass-card p-4 rounded-lg border border-dark-border">
                            <div className="flex items-center gap-2 mb-3">
                                <DollarSign className="w-5 h-5 text-accent-blue" />
                                <h3 className="font-semibold text-silver-light">Status Pembayaran</h3>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 rounded-lg bg-dark-surface">
                                    <p className="text-xs text-silver-dark mb-1">Total PO</p>
                                    <p className="font-bold text-silver-light">{formatCurrency(po.total_amount, po.currency)}</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-dark-surface">
                                    <p className="text-xs text-silver-dark mb-1">Sudah Dibayar</p>
                                    <p className="font-bold text-green-400">{formatCurrency(po.paid_amount || 0, po.currency)}</p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-dark-surface">
                                    <p className="text-xs text-silver-dark mb-1">Sisa</p>
                                    <p className={`font-bold ${(po.outstanding_amount || po.total_amount) <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(po.outstanding_amount ?? po.total_amount, po.currency)}
                                    </p>
                                </div>
                            </div>
                            {/* Payment Status Badge */}
                            <div className="mt-3 pt-3 border-t border-dark-border flex items-center justify-between">
                                <span className="text-sm text-silver-dark">Status:</span>
                                {(po.outstanding_amount ?? po.total_amount) <= 0 ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        LUNAS
                                    </span>
                                ) : (po.paid_amount > 0) ? (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-500/20 text-yellow-400 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        SEBAGIAN DIBAYAR
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        BELUM DIBAYAR
                                    </span>
                                )}
                            </div>
                            {/* Info to check AP module */}
                            <p className="text-xs text-silver-dark mt-2 italic">
                                * Untuk mencatat pembayaran, silakan buka modul Accounts Payable (AP)
                            </p>
                        </div>
                    )}

                    {/* ... Notes ... */}
                    {po.notes && (
                        <div>
                            <p className="text-sm text-silver-dark mb-2">Notes</p>
                            <p className="text-silver-light">{po.notes}</p>
                        </div>
                    )}

                    {/* Warning if payment exists - PO cannot be modified */}
                    {(po.paid_amount && po.paid_amount > 0) && (
                        <div className="glass-card p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                <p className="text-sm text-yellow-400 font-medium">
                                    PO tidak dapat diubah karena sudah ada pembayaran tercatat
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 justify-end border-t border-dark-border pt-4">
                        {/* Print Button - Always visible */}
                        <Button
                            onClick={onPrint}
                            icon={Download}
                            variant="secondary"
                        >
                            Print PO
                        </Button>

                        {/* Edit Button - Show for draft/submitted/approved, hide only if paid_amount > 0 */}
                        {(po.status === 'draft' || po.status === 'submitted' || po.status === 'approved') && (!po.paid_amount || po.paid_amount <= 0) && (
                            <Button
                                onClick={onEdit}
                                icon={Edit}
                                variant="secondary"
                            >
                                Edit PO
                            </Button>
                        )}

                        {/* Submit Button - Only for draft */}
                        {po.status === 'draft' && (
                            <Button
                                onClick={onSubmit}
                                icon={CheckCircle}
                                variant="primary"
                            >
                                Submit for Approval
                            </Button>
                        )}

                        {/* Approve Button - Only for submitted */}
                        {po.status === 'submitted' && (
                            <Button onClick={onApprove} icon={CheckCircle}>
                                Approve PO
                            </Button>
                        )}

                        {/* Delete Button - Only if no payment */}
                        {(!po.paid_amount || po.paid_amount <= 0) && (
                            <Button
                                onClick={onDelete}
                                icon={Trash2}
                                variant="secondary"
                                className="!border-red-500/50 !text-red-400 hover:!bg-red-500/10"
                            >
                                Hapus PO
                            </Button>
                        )}

                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

// Payment Record Modal Component for PO
const POPaymentRecordModal = ({ po, formatCurrency, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        payment_date: new Date().toISOString().split('T')[0],
        amount: po.outstanding_amount || po.total_amount || 0,
        payment_method: 'bank_transfer',
        transaction_ref: '',
        bank_account: '',
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
                setFormData(prev => ({ ...prev, bank_account: data[0].id }));
            }
        } catch (error) {
            console.error('Error fetching bank accounts:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const outstandingAmount = po.outstanding_amount || po.total_amount || 0;

        if (formData.amount <= 0) {
            alert('Payment amount must be greater than 0');
            return;
        }

        if (formData.amount > outstandingAmount) {
            alert(`Payment amount cannot exceed outstanding amount (${formatCurrency(outstandingAmount, po.currency)})`);
            return;
        }

        try {
            setLoading(true);

            // Generate payment number
            const year = new Date().getFullYear();
            const paymentNumber = `PMT-OUT-${year}-${String(Date.now()).slice(-6)}`;

            // Get selected bank info
            const selectedBank = bankAccounts.find(b => b.id === formData.bank_account);

            // Create payment record in blink_payments table
            const paymentData = {
                payment_number: paymentNumber,
                payment_type: 'outgoing',
                payment_date: formData.payment_date,
                reference_type: 'po',
                reference_id: po.id,
                reference_number: po.po_number,
                amount: parseFloat(formData.amount),
                currency: po.currency,
                payment_method: formData.payment_method,
                bank_account: selectedBank ? `${selectedBank.bank_name} - ${selectedBank.account_number}` : null,
                transaction_ref: formData.transaction_ref || null,
                description: `Payment for PO ${po.po_number} to ${po.vendor_name}`,
                notes: formData.notes || null,
                status: 'completed'
            };

            const { error: paymentError } = await supabase
                .from('blink_payments')
                .insert([paymentData]);

            if (paymentError) throw paymentError;

            // Update PO status and amounts
            const newPaidAmount = (po.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = (po.total_amount || 0) - newPaidAmount;

            let newStatus = po.status;
            if (newOutstanding <= 0) {
                newStatus = 'received'; // Fully paid
            }

            const { error: poError } = await supabase
                .from('blink_purchase_orders')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                })
                .eq('id', po.id);

            if (poError) throw poError;

            // Set success state instead of alert
            setSuccessData({
                paymentNumber,
                amountPaid: parseFloat(formData.amount),
                newOutstanding,
                newStatus,
                currency: po.currency || 'IDR'
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

                    <h2 className="text-2xl font-bold text-green-500 mb-2">Pembayaran Berhasil!</h2>
                    <p className="text-silver-dark mb-6">Pembayaran PO telah dicatat dalam sistem</p>

                    {/* Payment Details */}
                    <div className="glass-card p-4 rounded-lg mb-6 text-left bg-green-500/5 border border-green-500/20">
                        <div className="space-y-3">
                            <div className="flex justify-between">
                                <span className="text-silver-dark">No. Pembayaran:</span>
                                <span className="text-silver-light font-mono font-medium">{successData.paymentNumber}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Jumlah Dibayar:</span>
                                <span className="text-green-400 font-bold">{formatCurrency(successData.amountPaid, successData.currency)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Sisa Outstanding:</span>
                                <span className={`font-bold ${successData.newOutstanding <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {formatCurrency(Math.max(0, successData.newOutstanding), successData.currency)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Status Baru:</span>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${successData.newStatus === 'received' ? 'bg-purple-500/20 text-purple-400' :
                                    successData.newStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    }`}>
                                    {successData.newStatus === 'received' ? 'LUNAS' :
                                        successData.newStatus === 'approved' ? 'APPROVED' : successData.newStatus?.toUpperCase()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button onClick={() => { onSuccess(); }} className="w-full">
                        Tutup
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-2xl">
            <div className="p-6">
                <h2 className="text-2xl font-bold gradient-text mb-6">Catat Pembayaran</h2>

                {/* PO Info Summary */}
                <div className="glass-card p-4 rounded-lg mb-6 bg-gradient-to-br from-accent-orange/10 to-transparent border border-accent-orange/30">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <span className="text-silver-dark">No. PO:</span>
                            <span className="text-silver-light font-medium ml-2">{po.po_number}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Vendor:</span>
                            <span className="text-silver-light font-medium ml-2">{po.vendor_name}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Total:</span>
                            <span className="text-silver-light font-medium ml-2">{formatCurrency(po.total_amount, po.currency)}</span>
                        </div>
                        <div>
                            <span className="text-silver-dark">Sisa:</span>
                            <span className="text-yellow-400 font-semibold ml-2">
                                {formatCurrency(po.outstanding_amount || po.total_amount, po.currency)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Payment Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        {/* Payment Date */}
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">
                                Tanggal Pembayaran *
                            </label>
                            <input
                                type="date"
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>

                        {/* Amount */}
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">
                                Jumlah ({po.currency}) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Payment Method */}
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">
                                Metode Pembayaran *
                            </label>
                            <select
                                value={formData.payment_method}
                                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            >
                                <option value="bank_transfer">Transfer Bank</option>
                                <option value="cash">Tunai</option>
                                <option value="check">Cek / Giro</option>
                                <option value="credit_card">Kartu Kredit</option>
                            </select>
                        </div>

                        {/* Bank Account */}
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">
                                Dari Rekening
                            </label>
                            <select
                                value={formData.bank_account}
                                onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="">Pilih Rekening Bank</option>
                                {bankAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.bank_name} - {acc.account_number}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Transaction Reference */}
                    <div>
                        <label className="block text-sm font-medium text-silver-light mb-2">
                            No. Referensi Transaksi
                        </label>
                        <input
                            type="text"
                            value={formData.transaction_ref}
                            onChange={(e) => setFormData({ ...formData, transaction_ref: e.target.value })}
                            placeholder="contoh: TRX123456 atau Cek #789"
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-silver-light mb-2">
                            Catatan
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            placeholder="Catatan tambahan pembayaran..."
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                            disabled={loading}
                        >
                            Batal
                        </button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={loading}
                        >
                            {loading ? 'Memproses...' : 'Catat Pembayaran'}
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default PurchaseOrder;
