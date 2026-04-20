import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { generatePONumber, generateAPNumber } from '../../utils/documentNumbers';
import { createPOApprovalJournal, getAllCOA } from '../../utils/journalHelper';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import COAPicker from '../../components/Common/COAPicker';
import {
    FileText, Plus, Search, Filter, Eye, Download, CheckCircle,
    XCircle, Clock, Package, DollarSign, TrendingUp, AlertCircle, X, Edit, Save, History, AlertTriangle, Trash2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const isMissingTableError = (error) => {
    const message = String(error?.message || error?.details || error || '').toLowerCase();
    return /relation .* does not exist|table .* does not exist|no such table|does not exist|could not find the table|column .* does not exist|missing column/.test(message);
};

const tryInsertTable = async (tableName, payload) => {
    const { error } = await supabase.from(tableName).insert([payload]);
    if (!error) return true;
    if (isMissingTableError(error)) return false;
    throw error;
};

const insertAPTransaction = async (blinkRow, fallbackRow) => {
    try {
        if (await tryInsertTable('blink_ap_transactions', blinkRow)) return;
        const { error } = await supabase.from('big_ap_transactions').insert([fallbackRow]);
        if (error) throw error;
    } catch (e) {
        console.warn('AP transaction creation skipped in PO (no valid DB table available):', e.message);
    }
};

const recordApprovalHistory = async (po, action, reason = null, approverName = 'System') => {
    try {
        const payload = {
            document_number: po.po_number || '-',
            document_type: 'po',
            approved_at: new Date().toISOString(),
            approver: approverName,
            status: action,
            reason: reason
        };
        await tryInsertTable('blink_approval_history', payload);
    } catch (e) {
        console.warn('Logging approval history failed:', e);
    }
};

const PurchaseOrder = () => {
    const { user, canCreate, canEdit, canDelete, canView, canApprove } = useAuth();
    const { companySettings, businessPartners } = useData();
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
        po_items: [{ description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, tax_rate: 0, tax_amount: 0, coa_id: null }],
        tax_rate: 11.00,
        discount_amount: 0,
        notes: '',
        currency: 'IDR',
        exchange_rate: 1,
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
        submitted: { label: 'Pending Approval', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
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

    // Fallback: sync vendors from DataContext if Supabase query returns empty
    useEffect(() => {
        if (vendors.length === 0 && businessPartners && businessPartners.length > 0) {
            const vendorList = businessPartners.filter(
                p => p.is_vendor === true || p.is_vendor === 'true' || p.is_vendor === 1
            );
            if (vendorList.length > 0) {
                console.log('[PO] Syncing vendors from DataContext businessPartners:', vendorList.length);
                setVendors(vendorList);
            }
        }
    }, [businessPartners, vendors.length]);

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
            // Fetch all partners then filter client-side
            // (avoids boolean type mismatch issues with Supabase)
            const { data, error } = await supabase
                .from('blink_business_partners')
                .select('id, partner_name, partner_code, email, phone, is_vendor')
                .order('partner_name');

            if (error) throw error;
            const allPartners = data || [];
            // Filter truthy values (handles boolean true, 1, "true", "1")
            const vendorPartners = allPartners.filter(p => p.is_vendor === true || p.is_vendor === 'true' || p.is_vendor === 1);
            console.log('[PO] All partners:', allPartners.length, '| Vendors:', vendorPartners.length);
            setVendors(vendorPartners);
        } catch (error) {
            console.error('Error fetching vendors:', error);
            // Fallback: use DataContext businessPartners
            if (businessPartners && businessPartners.length > 0) {
                const fallback = businessPartners.filter(p => p.is_vendor === true || p.is_vendor === 'true' || p.is_vendor === 1);
                console.log('[PO] Using DataContext fallback vendors:', fallback.length);
                setVendors(fallback);
            } else {
                setVendors([]);
            }
        }
    };

    const fetchShipments = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('id, customer, customer_id, origin, destination, job_number, so_number, cogs, cogs_currency, buying_items, service_type, status')
                .eq('status', 'approved')
                .order('created_at', { ascending: false });
            if (error) throw error;
            // Normalize field keys
            const mapped = (data || []).map(s => ({
                ...s,
                customer_name: s.customer || s.customer_name || '',
                job_number: s.job_number || s.so_number || '',
                cogsCurrency: s.cogs_currency || 'IDR',
                buyingItems: s.buying_items || []
            }));
            setShipments(mapped);
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
                vendor_id: vendor.id,
                vendor_name: vendor.partner_name
            }));
        } else {
            setFormData(prev => ({ ...prev, vendor_id: '' }));
        }
    };

    const addPOItem = () => {
        setFormData(prev => ({
            ...prev,
            po_items: [...prev.po_items, { description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, tax_rate: 0, tax_amount: 0, coa_id: null }]
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

            // Auto-calculate tax_amount from tax_rate percentage
            if (field === 'qty' || field === 'unit_price' || field === 'tax_rate') {
                const rate = field === 'tax_rate' ? value : (items[index].tax_rate || 0);
                items[index].tax_amount = items[index].amount * (rate / 100);
            }

            return { ...prev, po_items: items };
        });
    };

    const handleGlobalTaxChange = (newRate) => {
        setFormData(prev => {
            const items = prev.po_items.map(item => ({
                ...item,
                tax_rate: newRate,
                tax_amount: (item.amount || 0) * (newRate / 100)
            }));
            return { ...prev, tax_rate: newRate, po_items: items };
        });
    };

    const calculateTotals = () => {
        const subtotal = formData.po_items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxAmount = formData.po_items.reduce((sum, item) => sum + (Number(item.tax_amount) || 0), 0);
        const total = subtotal + taxAmount - (formData.discount_amount || 0);

        return { subtotal, taxAmount, total };
    };

    const handleCreatePO = async (e) => {
        e.preventDefault();
        if (!canCreate('blink_purchase_order')) {
            alert('Anda tidak memiliki hak akses untuk membuat PO.');
            return;
        }
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
                    vendor_name: vendor.partner_name,
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
                    exchange_rate: formData.exchange_rate || 1,
                    subtotal: subtotal,
                    tax_rate: formData.tax_rate,
                    tax_amount: taxAmount,
                    discount_amount: formData.discount_amount || 0,
                    total_amount: total,
                    notes: formData.notes || '',
                    shipment_id: formData.shipment_id || null, // Allocation
                    quotation_id: formData.quotation_id || null,
                    job_number: formData.job_number || null
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
        if (!canApprove('blink_purchase_order')) {
            alert('Anda tidak memiliki hak akses untuk mengubah status (Approve) PO.');
            return;
        }
        if (!confirm(`Approve PO ${po.po_number}? This will create an AP entry.`)) return;

        try {
            console.log('Starting PO approval for:', po.po_number);

            // 1. Update PO status to approved
            const { data: updatedPO, error: poError } = await supabase
                .from('blink_purchase_orders')
                .update({
                    status: 'approved'
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
            const apNumber = generateAPNumber();

            // 4. Create AP entry
            const blinkAPRow = {
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

            const bigAPRow = {
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

            console.log('Creating AP entry:', blinkAPRow);

            try {
                await insertAPTransaction(blinkAPRow, bigAPRow);
                console.log('AP entry created successfully');
            } catch (apError) {
                console.error('Error creating AP entry:', apError);
                throw apError;
            }

            // Record History
            await recordApprovalHistory(po, 'approved', null, user?.name || user?.email || 'System');


            // ── Create Journal Entries: Dr Expense/COGS per item | Cr Hutang Usaha ─
            try {
                const coaList = await getAllCOA();
                // include the full po object with all items
                const fullPO = { ...po, total_amount: po.total_amount };
                await createPOApprovalJournal({ po: fullPO, coaList });
                console.log('[PO] Journal entries created for', po.po_number);
            } catch (jeErr) {
                console.warn('[PO] Journal entry creation failed (non-critical):', jeErr.message);
            }
            // ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────


            await fetchPOs();
            alert(`✅ PO approved!\n\nAP Entry Created:\n• AP Number: ${apNumber}\n• Amount: ${formatCurrency(po.total_amount, po.currency)}\n• Due Date: ${dueDateStr}\n• Recorded in Ledger.`);
        } catch (error) {
            console.error('Error approving PO:', error);
            alert('Failed to approve PO: ' + error.message);
        }
    };

    const handleSubmitPO = async (po) => {
        if (!canEdit('blink_purchase_order')) {
            alert('Anda tidak memiliki hak akses untuk memanipulasi (Submit) PO.');
            return;
        }
        if (!confirm(`Submit PO ${po.po_number} for manager approval?`)) return;

        try {
            const { error } = await supabase
                .from('blink_purchase_orders')
                .update({
                    status: 'submitted'
                })
                .eq('id', po.id);

            if (error) throw error;

            await fetchPOs();
            alert('✅ PO successfully submitted!\nCheck Approval Center for the approval process.');
        } catch (error) {
            console.error('Error submitting PO:', error);
            alert('Failed to submit PO: ' + error.message);
        }
    };

    const handleDeletePO = async (po) => {
        if (!canDelete('blink_purchase_order')) {
            alert('Anda tidak memiliki hak akses untuk menghapus PO.');
            return;
        }
        // Don't allow delete if there's already payment
        if (po.paid_amount && po.paid_amount > 0) {
            alert('PO tidak dapat dihapus karena sudah ada pembayaran tercatat.');
            return;
        }

        if (!confirm(`Hapus PO ${po.po_number}?\n\nPerhatian: This action cannot be undone dan akan menghapus AP yang terkait.`)) return;

        try {
            console.log('Deleting PO:', po.po_number);

            // 1. Fetch linked AP entry to delete its related journal entries
            const { data: linkedAp } = await supabase
                .from('blink_ap_transactions')
                .select('id')
                .eq('po_id', po.id)
                .single();
                
            let apIdToDelete = linkedAp?.id;
            if (!apIdToDelete) {
                const { data: bigLinkedAp } = await supabase
                    .from('big_ap_transactions')
                    .select('id')
                    .eq('po_id', po.id)
                    .single();
                apIdToDelete = bigLinkedAp?.id;
            }

            if (apIdToDelete) {
                const { error: journalError } = await supabase
                    .from('blink_journal_entries')
                    .delete()
                    .eq('reference_id', apIdToDelete);

                if (journalError) {
                    console.warn('Could not delete linked journal entries:', journalError);
                }
            }

            // 2. Delete linked AP entry if exists
            const { error: apError } = await supabase
                .from('blink_ap_transactions')
                .delete()
                .eq('po_id', po.id);
                
            const { error: bigApError } = await supabase
                .from('big_ap_transactions')
                .delete()
                .eq('po_id', po.id);

            if (apError && bigApError) {
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
            alert('Failed to delete PO: ' + error.message);
        }
    };

    // Helper: build and open print window using Blob URL (fixes blank print bug)
    const buildPrintWindow = (po, autoPrint = false) => {
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
                            margin: 18px 22px;
                            color: #222;
                            line-height: 1.45;
                            font-size: 11px;
                        }

                        /* ===================== HEADER ===================== */
                        .doc-header {
                            display: table;
                            width: 100%;
                            border-bottom: 2.5px solid #0070BB;
                            padding-bottom: 12px;
                            margin-bottom: 16px;
                        }
                        .doc-header-left {
                            display: table-cell;
                            vertical-align: middle;
                            width: 60%;
                        }
                        .doc-header-right {
                            display: table-cell;
                            vertical-align: middle;
                            text-align: right;
                            width: 40%;
                        }
                        .company-logo {
                            max-height: 52px;
                            max-width: 140px;
                            object-fit: contain;
                            margin-bottom: 6px;
                            display: block;
                        }
                        .company-name {
                            font-size: 15px;
                            font-weight: bold;
                            color: #0070BB;
                            margin-bottom: 2px;
                        }
                        .company-detail {
                            font-size: 9px;
                            color: #555;
                            line-height: 1.5;
                        }
                        .po-label {
                            font-size: 26px;
                            font-weight: 900;
                            color: #0070BB;
                            letter-spacing: 1px;
                            line-height: 1.1;
                        }
                        .po-number {
                            font-size: 13px;
                            color: #444;
                            margin-top: 3px;
                            font-weight: bold;
                        }

                        /* ===================== INFO TABLE ===================== */
                        .info-table {
                            width: 100%;
                            margin-bottom: 16px;
                            border-collapse: collapse;
                        }
                        .info-table td {
                            padding: 2.5px 0;
                            font-size: 11px;
                        }
                        .info-table .label {
                            width: 115px;
                            font-weight: bold;
                            color: #555;
                        }
                        .info-table .colon { width: 10px; font-weight: bold; }
                        .info-table .value { color: #222; }

                        h3 {
                            margin: 12px 0 8px 0;
                            color: #0070BB;
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }

                        /* ===================== ITEMS TABLE ===================== */
                        table.items-table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 14px;
                        }
                        table.items-table th,
                        table.items-table td {
                            border: 1px solid #ddd;
                            padding: 5px 7px;
                            font-size: 13px;
                        }
                        table.items-table th {
                            background-color: #0070BB;
                            font-weight: bold;
                            color: white;
                            text-align: left;
                        }
                        table.items-table tbody tr:nth-child(even) td {
                            background-color: #f7f9fc;
                        }

                        /* ===================== FOOTER SECTION ===================== */
                        .footer-section {
                            display: table;
                            width: 100%;
                            margin-top: 12px;
                        }
                        .footer-left {
                            display: table-cell;
                            width: 48%;
                            vertical-align: top;
                            padding-right: 18px;
                        }
                        .footer-right {
                            display: table-cell;
                            width: 52%;
                            vertical-align: top;
                        }

                        /* Notes */
                        .notes-section {
                            padding: 8px 10px;
                            background: #f9f9f9;
                            border-left: 3px solid #0070BB;
                            font-size: 10px;
                            margin-bottom: 10px;
                        }
                        .notes-section strong {
                            font-size: 10px;
                            display: block;
                            margin-bottom: 4px;
                        }

                        /* Approval meta info */
                        .approval-meta td {
                            padding: 2.5px 0;
                            font-size: 10px;
                        }
                        .approval-meta .label {
                            width: 90px;
                            font-weight: bold;
                            color: #555;
                        }
                        .approval-meta .colon { width: 8px; }

                        /* Totals table */
                        .totals-table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .totals-table tr td {
                            padding: 3px 2px;
                            font-size: 11px;
                        }
                        .totals-table .label {
                            width: 110px;
                            text-align: right;
                            font-weight: bold;
                            padding-right: 6px;
                            color: #555;
                        }
                        .totals-table .colon { width: 10px; font-weight: bold; }
                        .totals-table .value {
                            text-align: right;
                            padding-left: 8px;
                        }
                        .totals-table .grand-total td {
                            font-size: 13px;
                            font-weight: bold;
                            border-top: 2px solid #0070BB;
                            padding-top: 6px !important;
                            color: #0070BB;
                        }

                        /* ===================== SIGNATURE BOXES (compact) ===================== */
                        .sig-section {
                            margin-top: 20px;
                            page-break-inside: avoid;
                        }
                        .sig-section h3 { margin-bottom: 8px; }
                        .sig-row {
                            display: table;
                            width: 55%;   /* Only 2 boxes, left-aligned */
                        }
                        .sig-cell {
                            display: table-cell;
                            width: 50%;
                            padding-right: 10px;
                            vertical-align: top;
                        }
                        .sig-cell:last-child { padding-right: 0; }
                        .sig-box {
                            border: 1px solid #ccc;
                            padding: 7px 10px 6px;
                            background: #f9f9f9;
                            text-align: center;
                        }
                        .sig-box.approved {
                            border: 2px solid #0070BB;
                            background: #f3f8fd;
                        }
                        .sig-box-title {
                            font-weight: bold;
                            font-size: 10px;
                            color: #555;
                            margin-bottom: 28px;
                        }
                        .sig-box.approved .sig-box-title { color: #0070BB; }
                        .sig-box-line {
                            border-top: 1px solid #999;
                            padding-top: 4px;
                            font-size: 9px;
                            color: #333;
                        }
                        .sig-box.approved .sig-box-line { border-color: #0070BB; }
                        .sig-box-date {
                            font-size: 8.5px;
                            color: #777;
                            margin-top: 2px;
                        }

                        /* ===================== BUTTONS ===================== */
                        .button-container {
                            margin-top: 24px;
                            text-align: center;
                        }
                        button {
                            padding: 8px 22px;
                            margin: 0 6px;
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: bold;
                        }
                        .btn-print { background: #0070BB; color: white; }
                        .btn-print:hover { background: #005a99; }
                        .btn-preview { background: #28a745; color: white; }
                        .btn-preview:hover { background: #218838; }
                        .btn-close { background: #666; color: white; }
                        .btn-close:hover { background: #555; }

                        @media print {
                            .button-container { display: none; }
                            body { margin: 8px 12px; }
                        }
                    </style>
                </head>
                <body>

                    <!-- ===== TOP HEADER: Company Left | PO Label Right ===== -->
                    <div class="doc-header">
                        <div class="doc-header-left">
                            ${companySettings?.logo_url
                ? `<img src="${companySettings.logo_url}" alt="Logo" class="company-logo" />`
                : ''}
                            <div class="company-name">Bakhtera Freight Worldwide</div>
                            <div class="company-detail">
                                Office Park Puri Mansion, Jl. Outer Ring Road Blok C No.36 Kembangan Selatan,<br/>
                                Jakarta Barat 11610
                                ${companySettings?.company_phone ? '<br/>Tel: ' + companySettings.company_phone : ''}
                                ${companySettings?.company_email ? ' &nbsp;|&nbsp; ' + companySettings.company_email : ''}
                            </div>
                        </div>
                        <div class="doc-header-right">
                            <div class="po-label">PURCHASE ORDER</div>
                            <div class="po-number">${po.po_number}</div>
                        </div>
                    </div>

                    <!-- ===== PO INFO ===== -->
                    <table class="info-table">
                        <tr>
                            <td class="label">Vendor</td>
                            <td class="colon">:</td>
                            <td class="value"><strong>${po.vendor_name || '-'}</strong></td>
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
                        ${po.job_number ? `<tr>
                            <td class="label">Job / SO No.</td>
                            <td class="colon">:</td>
                            <td class="value">${po.job_number}</td>
                        </tr>` : ''}
                    </table>

                    <!-- ===== ITEMS ===== -->
                    <h3>Order Items</h3>
                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style="width:55px; text-align:center;">Qty</th>
                                <th style="width:115px; text-align:right;">Unit Price</th>
                                <th style="width:115px; text-align:right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>

                    <!-- gap antara tabel item dan footer -->
                    <div style="margin-top: 20px;"></div>

                    <!-- ===== FOOTER: Approval Info Left | Totals Right ===== -->
                    <div class="footer-section">
                        <div class="footer-left">
                            <table class="approval-meta" style="border-collapse:collapse;">
                                <tr>
                                    <td class="label">Approved By</td>
                                    <td class="colon">:</td>
                                    <td>${approvedBy}</td>
                                </tr>
                                <tr>
                                    <td class="label">Approved Date</td>
                                    <td class="colon">:</td>
                                    <td>${approvalDate}</td>
                                </tr>
                            </table>
                        </div>
                        <div class="footer-right">
                            <table class="totals-table">
                                <tr>
                                    <td class="label">Subtotal</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(po.subtotal || 0, po.currency)}</td>
                                </tr>
                                <tr>
                                    <td class="label">Tax${po.tax_amount > 0 && po.tax_rate > 0 ? ` (${po.tax_rate}%)` : ''}</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(po.tax_amount || 0, po.currency)}</td>
                                </tr>
                                <tr class="grand-total">
                                    <td class="label">TOTAL</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(po.total_amount || 0, po.currency)}</td>
                                </tr>
                            </table>
                        </div>
                    </div>

                    <!-- ===== NOTES: Di bawah total, kolom kiri ===== -->
                    ${po.notes ? `
                    <div style="margin-top: 14px; width: 48%;">
                        <div class="notes-section">
                            <strong>Catatan:</strong>
                            ${String(po.notes).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}
                        </div>
                    </div>
                    ` : ''}



                    <!-- ===== ACTION BUTTONS ===== -->
                    <div class="button-container">
                        <button onclick="window.focus(); window.print();" class="btn-print">🖨️ Cetak Dokumen</button>
                        <button onclick="window.close()" class="btn-close">✖ Tutup</button>
                    </div>
                </body>
                </html>
            `;

        // ✅ Blob URL approach — fixes blank print (document.write doesn't render for printing)
        const blob = new Blob([printContent], { type: 'text/html; charset=UTF-8' });
        const blobUrl = URL.createObjectURL(blob);

        if (autoPrint) {
            // Print PO: open and auto-trigger print dialog when loaded
            const printWindow = window.open(blobUrl, '_blank');
            if (!printWindow) {
                alert('Pop-up diblokir! Izinkan pop-up untuk situs ini.');
                URL.revokeObjectURL(blobUrl);
                return;
            }
            printWindow.onload = () => {
                setTimeout(() => {
                    printWindow.focus();
                    printWindow.print();
                    // Clean up blob URL after a delay
                    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
                }, 200);
            };
        } else {
            // Print Preview: just open the document to view
            const previewWindow = window.open(blobUrl, '_blank');
            if (!previewWindow) {
                alert('Pop-up diblokir! Izinkan pop-up untuk situs ini.');
                URL.revokeObjectURL(blobUrl);
                return;
            }
            // Clean up blob URL after it's loaded
            previewWindow.onload = () => {
                setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
            };
        }
    };

    const handlePrintPO = (po) => {
        // Print PO = langsung cetak (auto-trigger dialog)
        try { buildPrintWindow(po, true); }
        catch (error) {
            console.error('Error printing PO:', error);
            alert('Gagal membuka print: ' + error.message);
        }
    };

    const handlePrintPreviewPO = (po) => {
        // Print Preview = tampilkan dokumen saja, user cetak sendiri
        try { buildPrintWindow(po, false); }
        catch (error) {
            console.error('Error print preview PO:', error);
            alert('Gagal membuka print preview: ' + error.message);
        }
    };

    const handleEditPO = (po, currentVendors) => {
        // Try to match vendor_id to blink_business_partners by ID first, then by name
        const vendorList = currentVendors || vendors;
        let matchedVendorId = '';
        if (po.vendor_id) {
            const byId = vendorList.find(v => v.id === po.vendor_id);
            if (byId) {
                matchedVendorId = byId.id;
            } else if (po.vendor_name) {
                // Fallback: match by name
                const byName = vendorList.find(v =>
                    v.partner_name?.toLowerCase().trim() === po.vendor_name?.toLowerCase().trim()
                );
                matchedVendorId = byName ? byName.id : '';
            }
        } else if (po.vendor_name) {
            const byName = vendorList.find(v =>
                v.partner_name?.toLowerCase().trim() === po.vendor_name?.toLowerCase().trim()
            );
            matchedVendorId = byName ? byName.id : '';
        }

            // Maintain backward compatibility for older POs
            const inheritedTaxRate = po.tax_rate || 0;
            const itemsWithTax = (po.po_items && po.po_items.length > 0 ? po.po_items : [{ item_name: '', description: '', qty: 1, unit: 'Job', unit_price: 0, amount: 0, coa_id: null }])
                .map(it => {
                    const itAmount = parseFloat(it.amount) || 0;
                    const itTaxAmount = typeof it.tax_amount !== 'undefined' ? Number(it.tax_amount) : (itAmount * inheritedTaxRate / 100);
                    // Derive tax_rate from stored tax_amount if tax_rate not yet persisted
                    const itTaxRate = typeof it.tax_rate !== 'undefined'
                        ? Number(it.tax_rate)
                        : (itAmount > 0 ? Math.round((itTaxAmount / itAmount) * 10000) / 100 : inheritedTaxRate);
                    return {
                        ...it,
                        tax_amount: itTaxAmount,
                        tax_rate: itTaxRate
                    };
                });
        setFormData({
            vendor_id: matchedVendorId,
            po_date: po.po_date,
            delivery_date: po.delivery_date || '',
            payment_terms: po.payment_terms || 'NET 30',
            po_items: itemsWithTax,
            tax_rate: po.tax_rate || 0,
            discount_amount: po.discount_amount || 0,
            notes: po.notes || '',
            currency: po.currency || 'IDR',
            shipment_id: po.shipment_id || null,
            quotation_id: po.quotation_id || null,
            job_number: po.job_number || '',
            coa_id: po.coa_id || '',
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
            const vendor = vendors.find(v => v.id === formData.vendor_id) || {
                id: formData.vendor_id, 
                partner_name: formData.vendor_name || 'Unknown Vendor',
                email: '', phone: '', address: '' 
            };

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
                vendor_name: vendor.partner_name,
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
                job_number: formData.job_number || null
            };

            // If PO was approved, require re-approval and add revision info
            if (wasApproved) {
                updates.status = 'submitted'; // Needs re-approval
                // Append revision note to existing notes instead of using separate column
                const revisionNote = `[REVISED ${new Date().toLocaleDateString('id-ID')}]`;
                updates.notes = revisionNote + (formData.notes || '');

                // Update linked AP entry if exists
                if (currentPO.id) {
                    const { error: apUpdateError } = await supabase
                        .from('blink_ap_transactions')
                        .update({
                            original_amount: total,
                            outstanding_amount: total,
                            notes: `PO Revised - Amount updated from ${formatCurrency(currentPO.total_amount, currentPO.currency)} to ${formatCurrency(total, formData.currency)} `,
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
            po_items: [{ description: '', qty: 1, unit: 'Unit', unit_price: 0, amount: 0, tax_rate: 0, tax_amount: 0 }],
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
            ? `$${value.toLocaleString('id-ID')} `
            : `Rp ${value.toLocaleString('id-ID')} `;
    };

    const filteredPOs = pos.filter(po => {
        const matchesFilter = filter === 'all' || po.status === filter;
        const matchesSearch = !searchTerm ||
            po.po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Calculate summary stats
    const totalPOs = pos.length;
    const totalValue = pos.filter(p => p.status !== 'cancelled').reduce((sum, po) => sum + (po.total_amount || 0), 0);
    const pendingApproval = pos.filter(p => p.status === 'submitted').length;
    const approvedPOs = pos.filter(p => p.status === 'approved').length;

    const handleExportXLS = () => {
        import('../../utils/exportXLS').then(({ exportToXLS }) => {
            const headerRows = [
                { value: 'PURCHASE ORDERS REPORT', style: 'title' },
                { value: `Report Date: ${new Date().toLocaleDateString('id-ID')}`, style: 'normal' },
                ''
            ];

            const xlsColumns = [
                { header: 'No', key: 'no', width: 5, align: 'center' },
                { header: 'PO Number', key: 'po_number', width: 20 },
                { header: 'Vendor', key: 'vendor_name', width: 25 },
                { header: 'PO Date', key: 'po_date', width: 15 },
                { header: 'Delivery Date', key: 'delivery_date', width: 15 },
                { header: 'Payment Terms', key: 'payment_terms', width: 15 },
                {
                    header: 'Amount',
                    key: 'total_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'IDR'} ${(item.total_amount || 0).toLocaleString('id-ID')}`
                },
                { header: 'Status', key: 'status', width: 15 }
            ];

            exportToXLS(filteredPOs, `PO_Report_${new Date().toISOString().split('T')[0]}`, headerRows, xlsColumns);
        }).catch(err => console.error("Failed to load export utility", err));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Purchase Orders</h1>
                    <p className="text-silver-dark mt-1">Kelola pembelian dari vendor</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleExportXLS} icon={Download} variant="secondary">
                        Export to Excel
                    </Button>
                    {canCreate('blink_purchase_order') && (
                        <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                            Buat PO Baru
                        </Button>
                    )}
                </div>
            </div>

            {/* Search - Full Width */}
            <div className="w-full">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Search PO number atau vendor..."
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
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Tax</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Amount</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredPOs.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="px-3 py-8 text-center">
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
                                                <span className="text-silver-dark">{formatCurrency(po.tax_amount || 0, po.currency)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="font-semibold text-silver-light">{formatCurrency(po.subtotal ?? po.total_amount, po.currency)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap">
                                                <div className={`inline - flex items - center gap - 1 px - 2 py - 0.5 rounded - full text - xs font - medium ${config?.color} `}>
                                                    <StatusIcon className="w-3 h-3" />
                                                    <span>{config?.label}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleEditPO(po, vendors)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 rounded text-xs font-medium transition-colors"
                                                    title="Edit PO"
                                                >
                                                    <Edit className="w-3 h-3" />
                                                    Edit
                                                </button>
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
                        handleGlobalTaxChange={handleGlobalTaxChange}
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
                        canEditPO={canEdit('blink_purchase_order')}
                        canApprovePO={canApprove('blink_purchase_order')}
                        canDeletePO={canDelete('blink_purchase_order')}
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
                        onPrintPreview={() => handlePrintPreviewPO(selectedPO)}
                        onDelete={() => handleDeletePO(selectedPO)}
                        statusConfig={statusConfig}
                    />
                )
            }
        </div >
    );
};

const POCreateModal = ({ isEditing, vendors, shipments, quotations, formData, setFormData, handleVendorSelect, addPOItem, removePOItem,
    updatePOItem, calculateTotals, handleSubmit, formatCurrency, onClose, handleGlobalTaxChange }) => {

    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorDropdown, setShowVendorDropdown] = useState(false);
    const [coaList, setCoaList] = useState([]);
    const [coaSearchMap, setCoaSearchMap] = useState({});   // { [itemIndex]: searchTerm }
    const [coaDropdownMap, setCoaDropdownMap] = useState({}); // { [itemIndex]: boolean open }

    // Fetch COA on mount
    useEffect(() => {
        const fetchCOA = async () => {
            const { data } = await supabase.from('finance_coa').select('id,code,name,type').in('type', ['EXPENSE', 'COGS']).order('code', { ascending: true });
            setCoaList(data || []);
        };
        fetchCOA();
    }, []);

    const filteredVendors = vendors.filter(v =>
        v.partner_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.partner_code?.toLowerCase().includes(vendorSearch.toLowerCase())
    );

    const selectedVendorName = vendors.find(v => v.id === formData.vendor_id)?.partner_name || '';

    const getFilteredCOA = (search) => coaList.filter(c =>
        c.name?.toLowerCase().includes((search || '').toLowerCase()) ||
        c.code?.toLowerCase().includes((search || '').toLowerCase())
    ).slice(0, 30);

    const { subtotal, taxAmount, total } = calculateTotals();


    // Combine shipments and quotations for selection logic
    const handleAllocationSelect = async (e) => {
        const val = e.target.value;

        if (!val) {
            setFormData(prev => ({
                ...prev,
                shipment_id: null,
                quotation_id: null,
                job_number: ''
            }));
            return;
        }

        // Use '||' as separator to avoid conflicts with IDs/names that contain '|'
        const sepIdx = val.indexOf('||');
        if (sepIdx === -1) return;
        const type = val.slice(0, sepIdx).trim();
        const id = val.slice(sepIdx + 2).trim();
        if (type === 'shipment') {
            const ship = shipments.find(s => String(s.id).trim() === id);

            // Auto-populate po_items from shipment's buying_items and cogs
            let autoItems = [];
            const buyingItems = ship?.buying_items || ship?.buyingItems || [];
            const cogs = ship?.cogs || {};

            // Legacy COGS fields
            const addIfPresent = (label, value) => {
                const val2 = parseFloat(String(value || '').replace(/,/g, ''));
                if (val2 && val2 > 0) {
                    autoItems.push({ item_name: label, description: `${label} - ${ship.job_number || ''} `, qty: 1, unit: 'Job', unit_price: val2, amount: val2, tax_amount: 0, coa_id: null });
                }
            };
            addIfPresent('Ocean Freight', cogs.oceanFreight);
            addIfPresent('Air Freight', cogs.airFreight);
            addIfPresent('Trucking', cogs.trucking);
            addIfPresent('THC', cogs.thc);
            addIfPresent('Documentation', cogs.documentation);
            addIfPresent('Customs Clearance', cogs.customs);
            addIfPresent('Insurance', cogs.insurance);
            addIfPresent('Demurrage', cogs.demurrage);
            addIfPresent(cogs.otherDescription || 'Other Charges', cogs.other);

            // Buying items with COA name lookup
            if (buyingItems.length > 0) {
                const coaIds = buyingItems.map(i => i.coa_id).filter(Boolean);
                let coaMap = {};
                if (coaIds.length > 0) {
                    const { data: coaData } = await supabase.from('finance_coa').select('id, name').in('id', coaIds);
                    (coaData || []).forEach(c => { coaMap[c.id] = c; });
                }
                buyingItems.forEach(item => {
                    const v = parseFloat(String(item.amount || 0).replace(/,/g, ''));
                    if (v && v > 0) {
                        const coaName = coaMap[item.coa_id]?.name || item.description || 'Item';
                        autoItems.push({ item_name: coaName, description: item.description || coaName, qty: parseFloat(item.qty) || 1, unit: item.unit || 'Job', unit_price: parseFloat(item.rate) || v, amount: v, tax_amount: typeof item.tax_amount !== 'undefined' ? Number(item.tax_amount) : 0, coa_id: item.coa_id || null });
                    }
                });
            }

            if (!ship) {
                console.warn('[PO] Shipment not found for id:', id, 'available:', shipments.map(s => s.id));
            }
            setFormData(prev => ({
                ...prev,
                shipment_id: id,
                quotation_id: null,
                job_number: ship?.job_number || ship?.so_number || '',
                currency: ship?.cogs_currency || ship?.cogsCurrency || prev.currency,
                // Only replace items if we found actual COGS data
                po_items: autoItems.length > 0 ? autoItems : prev.po_items
            }));
        } else if (type === 'quotation') {
            const quot = quotations.find(q => String(q.id).trim() === id);
            setFormData(prev => ({
                ...prev,
                shipment_id: null,
                quotation_id: id,
                job_number: quot?.quotation_number || ''
            }));
        }
    };

    // Use '||' as value separator (safe — UUID/IDs don't contain '||')
    const currentAllocationValue = formData.shipment_id
        ? `shipment||${formData.shipment_id}`
        : formData.quotation_id
            ? `quotation||${formData.quotation_id}`
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

                        {formData.shipment_id ? (
                            /* Locked: PO linked to specific SO — read-only */
                            <div className="flex items-center gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                <span className="text-green-400 text-lg">🔗</span>
                                <div className="flex-1">
                                    {(() => {
                                        const linked = shipments.find(s => s.id === formData.shipment_id);
                                        return (
                                            <div>
                                                <p className="text-sm font-semibold text-green-400">
                                                    Linked to Shipment
                                                    {formData.job_number && <span className="ml-2 font-mono">#{formData.job_number}</span>}
                                                </p>
                                                {linked && (
                                                    <p className="text-xs text-silver-dark mt-0.5">
                                                        {linked.origin} → {linked.destination}
                                                        {linked.customer_name && ` • ${linked.customer_name} `}
                                                    </p>
                                                )}
                                                {!linked && formData.job_number && (
                                                    <p className="text-xs text-silver-dark mt-0.5">Job: {formData.job_number}</p>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                                    Auto-linked from SO
                                </span>
                            </div>
                        ) : (
                            /* Free dropdown for manual PO */
                            <>
                                <p className="text-xs text-silver-dark mb-3">
                                    Hubungkan PO ini dengan Shipment atau Quotation untuk menghitung profit per job.
                                </p>
                                <select
                                    value={currentAllocationValue}
                                    onChange={handleAllocationSelect}
                                    className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                >
                                    <option value="">-- Tidak Ada Alokasi (Biaya Umum/Overhead) --</option>
                                    {shipments.length > 0 && (
                                        <optgroup label={`Shipments (${shipments.length})`}>
                                            {shipments.map(s => (
                                                <option key={s.id} value={`shipment||${s.id}`}>
                                                    {s.customer_name ? `[${s.customer_name}] ` : ''}
                                                    {s.origin || '-'} → {s.destination || '-'}
                                                    {s.job_number ? ` • #${s.job_number}` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {quotations.length > 0 && (
                                        <optgroup label={`Quotations (${quotations.length})`}>
                                            {quotations.map(q => (
                                                <option key={q.id} value={`quotation||${q.id}`}>
                                                    {q.quotation_number} - {q.customer_name || q.customer?.name || 'Customer'}
                                                    {q.origin && q.destination ? ` (${q.origin} → ${q.destination})` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {(formData.job_number) && (
                                    <p className="mt-2 text-xs text-green-400">
                                        ✓ Linked to Job: <strong>{formData.job_number}</strong>
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Vendor *</label>
                            {/* Custom vendor dropdown – white background for macOS compatibility */}
                            <div className="relative">
                                <div
                                    className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer flex justify-between items-center shadow-sm"
                                    onClick={() => setShowVendorDropdown(prev => !prev)}
                                >
                                    <span className={selectedVendorName ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                                        {selectedVendorName || 'Pilih Vendor...'}
                                    </span>
                                    <span className="text-gray-400 text-xs">▼</span>
                                </div>
                                {showVendorDropdown && (
                                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-60 flex flex-col">
                                        <div className="p-2 border-b border-gray-100">
                                            <input
                                                type="text"
                                                placeholder="Cari vendor..."
                                                value={vendorSearch}
                                                onChange={e => setVendorSearch(e.target.value)}
                                                className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-800 text-sm focus:outline-none focus:border-orange-400"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="overflow-y-auto flex-1">
                                            {filteredVendors.length === 0 ? (
                                                <div className="px-4 py-3 text-gray-500 text-sm">
                                                    {vendors.length === 0 ? '⚠️ Belum ada vendor. Tambahkan di Master Data → Business Partners.' : 'Tidak ditemukan'}
                                                </div>
                                            ) : (
                                                filteredVendors.map(v => (
                                                    <button
                                                        type="button"
                                                        key={v.id}
                                                        onClick={() => {
                                                            handleVendorSelect({ target: { value: v.id } });
                                                            setShowVendorDropdown(false);
                                                            setVendorSearch('');
                                                        }}
                                                        className={`w - full text - left px - 4 py - 2.5 hover: bg - orange - 50 transition - colors text - sm border - b border - gray - 50 last: border - 0 ${formData.vendor_id === v.id
                                                            ? 'bg-orange-50 text-orange-600 font-semibold'
                                                            : 'text-gray-700'
                                                            } `}
                                                    >
                                                        <span className="font-medium">{v.partner_name}</span>
                                                        {v.partner_code && <span className="ml-2 text-xs text-gray-400">({v.partner_code})</span>}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {vendors.length === 0 && (
                                <p className="mt-1 text-xs text-yellow-400">⚠️ No vendors loaded. Go to Blink Master Data → Business Partners and mark partners as "Vendor".</p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">Currency</label>
                            <select
                                value={formData.currency}
                                onChange={(e) => {
                                    const cur = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        currency: cur,
                                        exchange_rate: cur === 'IDR' ? 1 : (prev.exchange_rate > 1 ? prev.exchange_rate : 16000)
                                    }));
                                }}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="IDR">IDR (Rupiah)</option>
                                <option value="USD">USD (US Dollar)</option>
                                <option value="SGD">SGD (Singapore Dollar)</option>
                                <option value="EUR">EUR (Euro)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-silver-light mb-2">
                                Exchange Rate
                                {formData.currency !== 'IDR' && (
                                    <span className="ml-2 text-xs text-amber-400 font-normal">
                                        {formData.currency} → IDR
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                value={formData.exchange_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, exchange_rate: parseFloat(e.target.value) || 1 }))}
                                className="w-full px-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={formData.currency === 'IDR'}
                                min="1"
                                step="1"
                                placeholder="e.g. 16000"
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                {formData.currency === 'IDR'
                                    ? 'Not needed for IDR transactions'
                                    : `1 ${formData.currency} = Rp ${(formData.exchange_rate || 0).toLocaleString('id-ID')}`}
                            </p>
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
                                value={
                                    ['30 Days (NET 30)', '60 Days (NET 60)', '90 Days (NET 90)', 'Cash on Delivery'].includes(formData.payment_terms)
                                        ? formData.payment_terms
                                        : 'manual'
                                }
                                onChange={e => {
                                    const val = e.target.value;
                                    setFormData(prev => ({ ...prev, payment_terms: val === 'manual' ? '' : val }));
                                }}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm focus:outline-none focus:border-accent-orange"
                            >
                                <option value="30 Days (NET 30)">30 Hari (NET 30)</option>
                                <option value="60 Days (NET 60)">60 Hari (NET 60)</option>
                                <option value="90 Days (NET 90)">90 Hari (NET 90)</option>
                                <option value="Cash on Delivery">Cash on Delivery (COD)</option>
                                <option value="manual">Manual / Lainnya</option>
                            </select>
                            {(!['30 Days (NET 30)', '60 Days (NET 60)', '90 Days (NET 90)', 'Cash on Delivery'].includes(formData.payment_terms)) && (
                                <input
                                    type="text"
                                    placeholder="Contoh: NET 45, Cash Before Delivery..."
                                    value={formData.payment_terms}
                                    onChange={e => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                                    className="mt-2 w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm focus:outline-none focus:border-accent-orange"
                                />
                            )}
                        </div>
                    </div>

                    {/* ... Items ... */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-sm font-medium text-silver-light">PO Items *</label>
                            
                            <div className="flex items-center gap-4">
                                {/* Global Tax Input */}
                                <div className="flex items-center gap-2 bg-dark-surface px-3 py-1.5 rounded-lg border border-dark-border">
                                    <span className="text-xs text-silver-dark font-medium">Set All Tax %:</span>
                                    <input
                                        type="number"
                                        className="w-16 px-2 py-1 bg-transparent border-b border-gray-600 text-silver-light text-sm text-center focus:outline-none focus:border-accent-orange"
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                        step="0.01"
                                        value={formData.tax_rate ?? 0}
                                        onChange={(e) => handleGlobalTaxChange(parseFloat(e.target.value) || 0)}
                                    />
                                    <span className="text-xs text-silver-dark">%</span>
                                </div>
                                
                                <button type="button" onClick={addPOItem} className="text-accent-orange hover:text-accent-orange/80 text-sm flex items-center gap-1">
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            </div>
                        </div>

                        {/* Header Row Removed: Replaced with labels inside each item card */}

                        <div className="space-y-4 pt-2">
                            {formData.po_items.map((item, index) => (
                                <div key={index} className="flex flex-col gap-3 glass-card p-4 rounded-lg relative border border-gray-700/50">
                                    {/* Delete Item Button */}
                                    {formData.po_items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePOItem(index)}
                                            className="absolute top-2 right-2 p-1.5 hover:bg-red-500/20 text-red-400 rounded-md transition-colors"
                                            title="Hapus Item"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}

                                    {/* ROW 1: COA & Description */}
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start md:pr-8">
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block">Item (COA)</label>
                                            {/* COA dropdown for item_name */}
                                            <div className="relative">
                                                <div
                                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer flex justify-between items-center text-sm shadow-sm"
                                                    onClick={() => setCoaDropdownMap(prev => ({ ...prev, [index]: !prev[index] }))}
                                                >
                                                    <span className={item.item_name ? 'text-blue-600 font-medium truncate' : 'text-gray-400 text-xs'}>
                                                        {item.item_name || 'COA...'}
                                                    </span>
                                                    <span className="text-gray-400 text-xs ml-1">▼</span>
                                                </div>
                                                {coaDropdownMap[index] && (
                                                    <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-52 flex flex-col w-full min-w-[260px]">
                                                        <div className="p-2 border-b border-gray-100">
                                                            <input
                                                                type="text"
                                                                placeholder="Cari nama / kode COA..."
                                                                value={coaSearchMap[index] || ''}
                                                                onChange={e => setCoaSearchMap(prev => ({ ...prev, [index]: e.target.value }))}
                                                                className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-gray-800 text-xs focus:outline-none focus:border-orange-400"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1">
                                                            {getFilteredCOA(coaSearchMap[index]).length === 0 ? (
                                                                <div className="px-3 py-2 text-gray-400 text-xs">Tidak ditemukan</div>
                                                            ) : (
                                                                getFilteredCOA(coaSearchMap[index]).map(coa => (
                                                                    <button
                                                                        type="button"
                                                                        key={coa.id}
                                                                        onClick={() => {
                                                                            updatePOItem(index, 'item_name', coa.name);
                                                                            updatePOItem(index, 'coa_id', coa.id);
                                                                            setCoaDropdownMap(prev => ({ ...prev, [index]: false }));
                                                                            setCoaSearchMap(prev => ({ ...prev, [index]: '' }));
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 hover:bg-orange-50 transition-colors text-xs border-b border-gray-50 last:border-0 ${item.coa_id === coa.id ? 'bg-orange-50 text-orange-600 font-semibold' : 'text-gray-700'
                                                                            } `}
                                                                    >
                                                                        <span className="font-mono text-gray-400 mr-2">{coa.code}</span>
                                                                        <span className="font-medium">{coa.name}</span>
                                                                        <span className="ml-1 text-gray-300 text-[10px]">({coa.type})</span>
                                                                    </button>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="md:col-span-8">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block">Description</label>
                                            <input
                                                type="text"
                                                placeholder="Deskripsi spesifik item"
                                                value={item.description}
                                                onChange={(e) => updatePOItem(index, 'description', e.target.value)}
                                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm focus:border-accent-orange outline-none"
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* ROW 2: Qty, Harga, Pajak, Total */}
                                    <div className="grid grid-cols-2 md:grid-cols-12 gap-3 items-start md:pr-8">
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block">Qty</label>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                value={item.qty}
                                                onChange={(e) => updatePOItem(index, 'qty', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm text-center focus:border-accent-orange outline-none"
                                                min="0"
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block">Harga Satuan</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={item.unit_price}
                                                    onChange={(e) => updatePOItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-8 pr-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm focus:border-accent-orange outline-none"
                                                    min="0"
                                                    required
                                                />
                                                <span className="absolute left-3 top-2 text-silver-dark text-sm font-medium">{formData.currency === 'IDR' ? 'Rp' : formData.currency}</span>
                                            </div>
                                        </div>
                                        <div className="md:col-span-3">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block">Pajak %</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={item.tax_rate ?? ''}
                                                    onChange={(e) => updatePOItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm text-center focus:border-accent-orange outline-none"
                                                    min="0"
                                                    max="100"
                                                    step="0.01"
                                                />
                                                <span className="text-silver-dark text-xs font-bold">%</span>
                                            </div>
                                            {item.tax_amount > 0 && (
                                                <div className="text-[11px] text-accent-blue font-medium mt-1">
                                                    + {formatCurrency(item.tax_amount, formData.currency)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="md:col-span-4">
                                            <label className="text-[10px] font-semibold text-silver-dark uppercase mb-1 block text-right">Total (Subtotal + Pajak)</label>
                                            <div className="px-3 py-1.5 bg-dark-surface/50 border border-dark-border rounded-lg text-sm text-right">
                                                <div className="text-silver-dark text-[10px] leading-tight">Murni: {formatCurrency(item.amount, formData.currency)}</div>
                                                <div className="text-silver-light font-bold text-base leading-tight">
                                                    {formatCurrency((item.amount || 0) + (item.tax_amount || 0), formData.currency)}
                                                </div>
                                            </div>
                                        </div>
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
                        <div className="flex justify-between text-silver-dark">
                            <span>Tax (from items):</span>
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
const POViewModal = ({ po, formatCurrency, onClose, onEdit, onSubmit, onApprove, onPrint, onPrintPreview, onDelete, statusConfig, canEditPO, canApprovePO, canDeletePO }) => {
    const config = statusConfig[po.status];
    const StatusIcon = config?.icon || FileText;

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                {/* Status Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold gradient-text">Purchase Order Details</h2>
                    <div className={`inline - flex items - center gap - 2 px - 4 py - 2 rounded - lg ${config?.color} `}>
                        <StatusIcon className="w-5 h-5" />
                        <span className="font-semibold">{config?.label}</span>
                    </div>
                </div>

                {/* Pending Approval Banner */}
                {(po.status === 'submitted' || po.status === 'manager_approval') && (
                    <div className="mb-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/40 flex items-center gap-3">
                        <Clock className="w-6 h-6 text-yellow-400 flex-shrink-0" />
                        <div>
                            <p className="text-yellow-300 font-semibold text-sm">Menunggu Persetujuan Manager</p>
                            <p className="text-yellow-400/70 text-xs mt-0.5">This PO is currently under review. Approval is managed via the <span className="font-bold">Approval Center</span> menu. The PO cannot be modified at this time.</p>
                        </div>
                    </div>
                )}

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


                    <div>
                        <h3 className="text-lg font-semibold text-silver-light mb-3">Items</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-surface">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs text-blue-400 font-semibold">Item</th>
                                        <th className="px-4 py-2 text-left text-xs text-silver-dark">Description</th>
                                        <th className="px-4 py-2 text-right text-xs text-silver-dark">Qty</th>
                                        <th className="px-4 py-2 text-right text-xs text-silver-dark">Unit Price</th>
                                        <th className="px-4 py-2 text-right text-xs text-silver-dark">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {(po.po_items || []).map((item, idx) => (
                                        <tr key={idx}>
                                            <td className="px-4 py-2 text-blue-300 font-medium text-sm">{item.item_name || '-'}</td>
                                            <td className="px-4 py-2 text-silver-light">{item.description}</td>
                                            <td className="px-4 py-2 text-right text-silver-light">{item.qty}</td>
                                            <td className="px-4 py-2 text-right text-silver-light">{formatCurrency(item.unit_price, po.currency)}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-silver-light">{formatCurrency(item.amount, po.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ... Totals ... */}
                    <div className="space-y-2 border-t border-dark-border pt-4">
                        <div className="flex justify-between text-silver-dark">
                            <span>Subtotal:</span>
                            <span className="font-semibold">{formatCurrency(po.subtotal, po.currency)}</span>
                        </div>
                        <div className="flex justify-between text-silver-dark">
                            <span>Tax{po.tax_amount > 0 && po.tax_rate > 0 ? ` (${po.tax_rate}%)` : ''}:</span>
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
                                    <p className={`font - bold ${(po.outstanding_amount || po.total_amount) <= 0 ? 'text-green-400' : 'text-red-400'} `}>
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
                    <div className="flex flex-wrap gap-2 justify-end border-t border-dark-border pt-4">
                        {/* Print Button - Always visible */}
                        <Button
                            onClick={onPrint}
                            variant="secondary"
                            size="sm"
                        >
                            Print PO
                        </Button>

                        {/* Print Preview Button - opens and auto-triggers print dialog */}
                        <Button
                            onClick={onPrintPreview}
                            variant="secondary"
                            size="sm"
                            className="!border-green-500/50 !text-green-400 hover:!bg-green-500/10"
                        >
                            Print Preview
                        </Button>

                        {/* Edit Button - Locked only if there is payment */}
                        {(!po.paid_amount || po.paid_amount <= 0) && canEditPO && (
                            <Button
                                onClick={onEdit}
                                variant="secondary"
                                size="sm"
                            >
                                Edit PO
                            </Button>
                        )}

                        {/* Submit Button - Only for draft */}
                        {po.status === 'draft' && canEditPO && (
                            <Button
                                onClick={onSubmit}
                                variant="primary"
                                size="sm"
                            >
                                Submit for Approval
                            </Button>
                        )}

                        {/* Approval pending note only */}
                        {(po.status === 'submitted' || po.status === 'manager_approval') && (
                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs border border-yellow-500/30">
                                Waiting for Approval Center
                            </span>
                        )}

                        {/* Delete Button - Only if no payment */}
                        {(!po.paid_amount || po.paid_amount <= 0) && canDeletePO && (
                            <Button
                                onClick={onDelete}
                                variant="secondary"
                                size="sm"
                                className="!border-red-500/50 !text-red-400 hover:!bg-red-500/10"
                            >
                                Hapus PO
                            </Button>
                        )}

                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 border border-dark-border text-sm text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
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
            alert(`Payment amount cannot exceed outstanding amount(${formatCurrency(outstandingAmount, po.currency)})`);
            return;
        }

        try {
            setLoading(true);

            // Generate payment number
            const year = new Date().getFullYear();
            const paymentNumber = `PMT - OUT - ${year} -${String(Date.now()).slice(-6)} `;

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
                bank_account: selectedBank ? `${selectedBank.bank_name} - ${selectedBank.account_number} ` : null,
                transaction_ref: formData.transaction_ref || null,
                description: `Payment for PO ${po.po_number} to ${po.vendor_name} `,
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
                                <span className={`font - bold ${successData.newOutstanding <= 0 ? 'text-green-400' : 'text-yellow-400'} `}>
                                    {formatCurrency(Math.max(0, successData.newOutstanding), successData.currency)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-silver-dark">Status Baru:</span>
                                <span className={`px - 3 py - 1 rounded - full text - xs font - semibold ${successData.newStatus === 'received' ? 'bg-purple-500/20 text-purple-400' :
                                    successData.newStatus === 'approved' ? 'bg-green-500/20 text-green-400' :
                                        'bg-blue-500/20 text-blue-400'
                                    } `}>
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
