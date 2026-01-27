import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { generateInvoiceNumber } from '../../utils/documentNumbers';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import COAPicker from '../../components/Common/COAPicker';
import {
    FileText, DollarSign, Calendar, User, Clock, CheckCircle, XCircle,
    Plus, Send, AlertCircle, Download, Eye, Edit, Trash, Receipt,
    TrendingUp, AlertTriangle, Search, Filter, X, Package
} from 'lucide-react';

const InvoiceManagement = () => {
    const navigate = useNavigate();
    const { companySettings, bankAccounts } = useData();
    const [invoices, setInvoices] = useState([]);
    const [quotations, setQuotations] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [previewInvoiceData, setPreviewInvoiceData] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [referenceType, setReferenceType] = useState('quotation'); // 'quotation' or 'so'

    // Form state for creating invoice
    const [formData, setFormData] = useState({
        quotation_id: '',
        job_number: '',
        payment_terms: 'NET 30',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        billing_currency: 'IDR',
        exchange_rate: 1,
        invoice_items: [
            { description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null }
        ],
        tax_rate: 11.00,
        discount_amount: 0,
        customer_notes: '',
        notes: ''
    });

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: FileText },
        sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400', icon: Send },
        partially_paid: { label: 'Partial Payment', color: 'bg-yellow-500/20 text-yellow-400', icon: DollarSign },
        paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
        overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-400', icon: AlertCircle },
        cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400', icon: XCircle },
        unpaid: { label: 'Unpaid', color: 'bg-orange-500/20 text-orange-400', icon: Clock }
    };

    useEffect(() => {
        fetchInvoices();
        fetchApprovedQuotations();
        fetchShipments();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);

            // Fetch invoices from the database
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('blink_invoices')
                .select(`*`)
                .order('created_at', { ascending: false });

            if (invoicesError) throw invoicesError;

            console.log('Fetched invoices:', invoicesData?.length || 0);

            setInvoices(invoicesData || []);
        } catch (error) {
            console.error('Error fetching invoices:', error);
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchApprovedQuotations = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_quotations')
                .select('*')
                // Include more statuses - user wants to invoice from approved AND converted quotations
                .in('status', ['approved', 'sent', 'approved_internal', 'converted'])
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Could not fetch quotations:', error.message);
                // Set empty array instead of failing
                setQuotations([]);
                return;
            }
            // Map to consistent format
            const mapped = (data || []).map(q => ({
                ...q,
                quotationNumber: q.quotation_number || q.quotationNumber,
                customerName: q.customer_name || q.customerName,
                jobNumber: q.job_number || q.jobNumber,
                totalAmount: q.total_amount || q.totalAmount,
                serviceType: q.service_type || q.serviceType
            }));
            console.log(`✅ Loaded ${mapped.length} quotations for invoice creation`);
            setQuotations(mapped);
        } catch (error) {
            console.error('Error fetching quotations:', error);
            // Ensure quotations is always an array
            setQuotations([]);
        }
    };

    const fetchShipments = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.warn('Could not fetch shipments:', error.message);
                setShipments([]);
                return;
            }
            console.log(`✅ Loaded ${(data || []).length} shipments for invoice creation`);
            setShipments(data || []);
        } catch (error) {
            console.error('Error fetching shipments:', error);
            setShipments([]);
        }
    };

    const handleQuotationSelect = (e) => {
        const quotationId = e.target.value;
        const quotation = quotations.find(q => q.id === quotationId);

        if (quotation) {
            setSelectedQuotation(quotation);

            // Auto-populate form
            const dueDate = new Date();
            const terms = formData.payment_terms;
            const days = parseInt(terms.replace('NET ', ''));
            dueDate.setDate(dueDate.getDate() + days);

            setFormData(prev => ({
                ...prev,
                quotation_id: quotation.id,
                job_number: quotation.jobNumber || quotation.job_number,
                quotation_number: quotation.quotationNumber || quotation.quotation_number,
                customer_name: quotation.customerName || quotation.customer_name,
                customer_id: quotation.customer_id || quotation.customerId,
                customer_company: quotation.customerCompany || quotation.customer_company,
                origin: quotation.origin,
                destination: quotation.destination,
                service_type: quotation.serviceType || quotation.service_type,
                billing_currency: quotation.currency || 'IDR',
                exchange_rate: quotation.currency === 'USD' ? 16000 : 1,
                due_date: dueDate.toISOString().split('T')[0],
                cargo_details: {
                    weight: quotation.weight,
                    volume: quotation.volume,
                    commodity: quotation.commodity
                },
                // Initialize with service items from quotation
                invoice_items: quotation.service_items && quotation.service_items.length > 0
                    ? quotation.service_items.map(item => ({
                        description: item.description || item.name,
                        qty: item.quantity || 1,
                        unit: item.unit || 'Job',
                        rate: item.unitPrice || item.price || 0,
                        amount: item.total || (item.quantity * item.unitPrice) || 0
                    }))
                    : [{
                        description: `${(quotation.serviceType || quotation.service_type || 'Freight').toUpperCase()} - ${quotation.origin} to ${quotation.destination}`,
                        qty: 1,
                        unit: 'Job',
                        rate: quotation.totalAmount || quotation.total_amount || 0,
                        amount: quotation.totalAmount || quotation.total_amount || 0
                    }]
            }));
        }
    };

    const handleShipmentSelect = (e) => {
        const shipmentId = e.target.value;
        const shipment = shipments.find(s => s.id === shipmentId);

        if (shipment) {
            setSelectedShipment(shipment);
            setSelectedQuotation(null); // Clear quotation selection

            // Auto-populate form from shipment
            const dueDate = new Date();
            const terms = formData.payment_terms;
            const days = parseInt(terms.replace('NET ', ''));
            dueDate.setDate(dueDate.getDate() + days);

            setFormData(prev => ({
                ...prev,
                quotation_id: shipment.quotation_id || null,
                shipment_id: shipment.id,
                job_number: shipment.job_number,
                so_number: shipment.so_number,
                customer_name: shipment.customer,
                customer_id: shipment.customer_id,
                origin: shipment.origin,
                destination: shipment.destination,
                service_type: shipment.service_type,
                billing_currency: shipment.currency || 'IDR',
                exchange_rate: shipment.currency === 'USD' ? 16000 : 1,
                due_date: dueDate.toISOString().split('T')[0],
                cargo_details: {
                    weight: shipment.weight,
                    volume: shipment.volume,
                    commodity: shipment.commodity
                },
                // Initialize with quoted amount as single line item
                invoice_items: [{
                    description: `${(shipment.service_type || 'Freight').toUpperCase()} - ${shipment.origin} to ${shipment.destination}`,
                    qty: 1,
                    unit: 'Shipment',
                    rate: shipment.quoted_amount || 0,
                    amount: shipment.quoted_amount || 0
                }]
            }));
        }
    };

    const handlePaymentTermsChange = (e) => {
        const terms = e.target.value;
        setFormData(prev => {
            const days = parseInt(terms.replace('NET ', ''));
            const dueDate = new Date(prev.invoice_date);
            dueDate.setDate(dueDate.getDate() + days);

            return {
                ...prev,
                payment_terms: terms,
                due_date: dueDate.toISOString().split('T')[0]
            };
        });
    };

    const addInvoiceItem = () => {
        setFormData(prev => ({
            ...prev,
            invoice_items: [
                ...prev.invoice_items,
                { description: '', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null }
            ]
        }));
    };

    const removeInvoiceItem = (index) => {
        if (formData.invoice_items.length > 1) {
            setFormData(prev => ({
                ...prev,
                invoice_items: prev.invoice_items.filter((_, i) => i !== index)
            }));
        }
    };

    const updateInvoiceItem = (index, field, value) => {
        setFormData(prev => {
            const items = [...prev.invoice_items];
            items[index][field] = value;

            // Auto-calculate amount
            if (field === 'qty' || field === 'rate') {
                items[index].amount = items[index].qty * items[index].rate;
            }

            return { ...prev, invoice_items: items };
        });
    };

    const calculateTotals = () => {
        const subtotal = formData.invoice_items.reduce((sum, item) => sum + (item.amount || 0), 0);
        const taxAmount = (subtotal * formData.tax_rate) / 100;
        const total = subtotal + taxAmount - (formData.discount_amount || 0);

        return { subtotal, taxAmount, total };
    };

    const handleCreateInvoice = async (e) => {
        e.preventDefault();

        if (!formData.quotation_id && !formData.shipment_id) {
            alert('Please select a reference (Quotation or Shipment)');
            return;
        }

        if (formData.invoice_items.length === 0) {
            alert('Please add at least one invoice item');
            return;
        }

        try {
            // 1. Check if active invoice already exists for this reference
            const referenceId = formData.quotation_id || formData.shipment_id;
            const referenceField = formData.quotation_id ? 'quotation_id' : 'shipment_id';

            const { data: existingInvoices, error: checkError } = await supabase
                .from('blink_invoices')
                .select('id, invoice_number, status')
                .eq(referenceField, referenceId)
                .neq('status', 'cancelled'); // Check for NON-cancelled invoices

            if (checkError) throw checkError;

            if (existingInvoices && existingInvoices.length > 0) {
                const activeInv = existingInvoices[0];
                alert(`Cannot create invoice: An active invoice (${activeInv.invoice_number}) already exists for this reference. Please cancel it first if you need to create a replacement.`);
                return;
            }

            const { subtotal, taxAmount, total } = calculateTotals();

            // 2. Generate unique invoice number (async)
            // If previous invocies were cancelled, this will auto-generate suffix (e.g. -1)
            const quotationNum = selectedQuotation?.quotation_number || selectedQuotation?.quotationNumber || formData.job_number;
            const invoiceNumber = await generateInvoiceNumber(quotationNum);

            const newInvoice = {
                invoice_number: invoiceNumber,
                quotation_id: selectedQuotation?.id || null,
                shipment_id: selectedShipment?.id || null,
                job_number: formData.job_number,
                so_number: formData.so_number || formData.job_number,
                customer_id: formData.customer_id,
                customer_name: formData.customer_name,
                customer_company: formData.customer_company || null,
                customer_address: formData.customer_address || null,
                customer_email: formData.customer_email || null,
                customer_phone: formData.customer_phone || null,
                invoice_date: formData.invoice_date,
                due_date: formData.due_date,
                payment_terms: formData.payment_terms,
                origin: formData.origin,
                destination: formData.destination,
                service_type: formData.service_type,
                cargo_details: formData.cargo_details || null,
                invoice_items: formData.invoice_items,
                currency: formData.billing_currency || 'IDR',
                subtotal: subtotal,
                tax_rate: formData.tax_rate,
                tax_amount: taxAmount,
                discount_amount: formData.discount_amount || 0,
                total_amount: total,
                paid_amount: 0,
                outstanding_amount: total,
                status: 'draft',
                customer_notes: formData.customer_notes || null,
                notes: formData.notes || null
            };

            const { data, error } = await supabase
                .from('blink_invoices')
                .insert([newInvoice])
                .select();

            if (error) throw error;

            await fetchInvoices();
            setShowCreateModal(false);

            resetForm();
            alert('Invoice created successfully!');
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            quotation_id: '',
            job_number: '',
            payment_terms: 'NET 30',
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: '',
            billing_currency: 'IDR',
            exchange_rate: 1,
            invoice_items: [
                { description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null }
            ],
            tax_rate: 11.00,
            discount_amount: 0,
            customer_notes: '',
            notes: ''
        });
        setSelectedQuotation(null);
        setSelectedShipment(null);
        setReferenceType('quotation');
    };

    const formatCurrency = (value, currency = 'IDR') => {
        return currency === 'USD'
            ? `$${value.toLocaleString('id-ID')}`
            : `Rp ${value.toLocaleString('id-ID')}`;
    };

    const handlePrintInvoice = (invoice) => {
        try {
            const printWindow = window.open('', '_blank');

            if (!printWindow) {
                alert('Pop-up blocked! Please allow pop-ups for this site.');
                return;
            }

            // Generate items rows
            const itemsRows = invoice.invoice_items?.map((item, index) => `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${String(item.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td style="text-align: center;">${item.qty || 0}</td>
                    <td style="text-align: center;">${item.unit || '-'}</td>
                    <td style="text-align: right;">${formatCurrency(item.rate || 0, invoice.currency)}</td>
                    <td style="text-align: right;">${formatCurrency(item.amount || 0, invoice.currency)}</td>
                </tr>
            `).join('') || '<tr><td colspan="6" style="text-align: center;">No items</td></tr>';

            // Generate shipment details HTML
            const shipmentDetailsHtml = (invoice.service_type || invoice.bl_awb_number || invoice.voyage) ? `
                <div style="flex: 1;">
                    <strong style="display: block; margin-bottom: 8px; font-size: 10px;">Shipment Details</strong>
                    ${invoice.service_type ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Service:</span> ${invoice.service_type.toUpperCase()}</div>` : ''}
                    ${invoice.bl_awb_number ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">BL/AWB:</span> ${invoice.bl_awb_number}</div>` : ''}
                    ${invoice.voyage ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Voyage:</span> ${invoice.voyage}</div>` : ''}
                    ${invoice.shipper_name ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Shipper:</span> ${invoice.shipper_name}</div>` : ''}
                    ${invoice.delivery_date ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Delivery:</span> ${invoice.delivery_date}</div>` : ''}
                </div>
            ` : '';

            const cargoDetailsHtml = (invoice.container_type || invoice.weight || invoice.cbm) ? `
                <div style="flex: 1;">
                    <strong style="display: block; margin-bottom: 8px; font-size: 10px;">Cargo Details</strong>
                    ${invoice.container_type ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Container:</span> ${invoice.container_type}</div>` : ''}
                    ${invoice.weight && invoice.weight > 0 ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Weight:</span> ${invoice.weight} kg</div>` : ''}
                    ${invoice.dimensions ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">Dimensions:</span> ${invoice.dimensions}</div>` : ''}
                    ${invoice.cbm && invoice.cbm > 0 ? `<div style="margin-bottom: 4px; font-size: 9px;"><span style="color: #666;">CBM:</span> ${invoice.cbm} m³</div>` : ''}
                </div>
            ` : '';

            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Invoice - ${invoice.invoice_number}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: Arial, Helvetica, sans-serif;
                            margin: 10mm;
                            color: #333;
                            font-size: 10px;
                            line-height: 1.3;
                        }
                        .header {
                            border-bottom: 2px solid #0070BB;
                            padding-bottom: 10px;
                            margin-bottom: 15px;
                        }
                        .header h1 {
                            font-size: 18px;
                            color: #0070BB;
                            margin-bottom: 4px;
                        }
                        .header p {
                            font-size: 12px;
                            color: #666;
                        }
                        
                        /* Company & Customer */
                        .company-info {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 15px;
                        }
                        .company-info > div {
                            flex: 1;
                        }
                        .company-info h3 {
                            font-size: 9px;
                            font-weight: bold;
                            color: #666;
                            margin-bottom: 6px;
                        }
                        .company-info .company-name {
                            font-size: 11px;
                            font-weight: bold;
                            margin-bottom: 4px;
                        }
                        .company-info p {
                            font-size: 9px;
                            margin-bottom: 2px;
                        }
                        
                        /* Invoice details grid */
                        .invoice-details {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 10px;
                            background: #f9f9f9;
                            padding: 10px;
                            margin-bottom: 12px;
                            border-radius: 4px;
                        }
                        .invoice-details .detail-item {
                            font-size: 9px;
                        }
                        .invoice-details .detail-label {
                            color: #666;
                            margin-bottom: 2px;
                        }
                        .invoice-details .detail-value {
                            font-weight: bold;
                        }
                        
                        /* Shipment & Cargo */
                        .shipment-cargo {
                            display: flex;
                            gap: 15px;
                            padding: 10px;
                            border: 1px solid #ddd;
                            margin-bottom: 12px;
                            border-radius: 4px;
                        }
                        
                        /* Table */
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 15px;
                        }
                        th, td {
                            border: 1px solid #ddd;
                            padding: 6px;
                            font-size: 9px;
                        }
                        th {
                            background-color: #0070BB;
                            color: white;
                            font-weight: bold;
                            text-align: left;
                        }
                        
                        /* Totals */
                        .totals-section {
                            display: flex;
                            justify-content: flex-end;
                            margin-top: 15px;
                        }
                        .totals-table {
                            width: 250px;
                            border-collapse: collapse;
                        }
                        .totals-table td {
                            padding: 4px 0;
                            font-size: 9px;
                            border: none;
                        }
                        .totals-table .label {
                            width: 100px;
                            text-align: right;
                            font-weight: bold;
                            padding-right: 10px;
                        }
                        .totals-table .colon {
                            width: 10px;
                        }
                        .totals-table .value {
                            text-align: right;
                        }
                        .totals-table .grand-total {
                            font-size: 11px;
                            font-weight: bold;
                            border-top: 2px solid #0070BB;
                            padding-top: 6px !important;
                        }
                        .totals-table .grand-total .value {
                            color: #0070BB;
                        }
                        
                        /* Notes */
                        .notes {
                            padding: 10px;
                            background: #f9f9f9;
                            border-left: 3px solid #0070BB;
                            font-size: 9px;
                            height: fit-content;
                        }
                        
                        /* Footer */
                        .footer {
                            margin-top: 20px;
                            padding-top: 10px;
                            border-top: 1px solid #ddd;
                            text-align: center;
                            font-size: 8px;
                            color: #666;
                        }
                        
                        /* Print buttons */
                        .print-actions {
                            text-align: center;
                            margin: 20px 0;
                        }
                        .print-actions button {
                            padding: 10px 20px;
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
                            body { margin: 5mm; }
                            .print-actions { display: none; }
                        }
                        
                        @page {
                            size: auto;
                            margin: 10mm;
                        }
                    </style>
                </head>
                <body>
                    <div class="print-actions">
                        <button onclick="window.print()" class="btn-print">🖨️ Print</button>
                        <button onclick="window.close()" class="btn-close">✖ Close</button>
                    </div>
                    
                    <div class="header">
                        <h1>INVOICE</h1>
                        <p><strong>${invoice.invoice_number}</strong></p>
                    </div>
                    
                    <div class="company-info">
                        <div>
                            <h3>FROM:</h3>
                            <div class="company-name">${companySettings?.company_name || 'PT Bakhtera Satu Indonesia'}</div>
                            <p>${(companySettings?.company_address || 'Jakarta, Indonesia').replace(/\n/g, '<br/>')}</p>
                            ${companySettings?.company_phone ? `<p>Phone: ${companySettings.company_phone}</p>` : ''}
                            ${companySettings?.company_email ? `<p>Email: ${companySettings.company_email}</p>` : ''}
                            ${companySettings?.company_npwp ? `<p style="margin-top: 4px;"><strong>NPWP: ${companySettings.company_npwp}</strong></p>` : ''}
                        </div>
                        <div>
                            <h3>BILL TO:</h3>
                            <div class="company-name">${invoice.customer_name || '-'}</div>
                            ${invoice.customer_company ? `<p>${invoice.customer_company}</p>` : ''}
                            ${invoice.customer_address ? `<p>${invoice.customer_address}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="invoice-details">
                        <div class="detail-item">
                            <div class="detail-label">Invoice Date:</div>
                            <div class="detail-value">${invoice.invoice_date || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Due Date:</div>
                            <div class="detail-value">${invoice.due_date || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Job Number:</div>
                            <div class="detail-value">${invoice.job_number || '-'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Payment Terms:</div>
                            <div class="detail-value">${invoice.payment_terms || '-'}</div>
                        </div>
                        ${invoice.origin && invoice.destination ? `
                        <div class="detail-item" style="grid-column: span 2;">
                            <div class="detail-label">Route:</div>
                            <div class="detail-value">${invoice.origin} → ${invoice.destination}</div>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${(shipmentDetailsHtml || cargoDetailsHtml) ? `
                    <div class="shipment-cargo">
                        ${shipmentDetailsHtml}
                        ${cargoDetailsHtml}
                    </div>
                    ` : ''}
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 40px; text-align: center;">No</th>
                                <th>Description</th>
                                <th style="width: 60px; text-align: center;">Qty</th>
                                <th style="width: 60px; text-align: center;">Unit</th>
                                <th style="width: 100px; text-align: right;">Unit Price</th>
                                <th style="width: 100px; text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>
                    
                    <!-- Notes & Totals Section: Side by Side -->
                    <div style="display: flex; gap: 20px; margin-top: 15px;">
                        <!-- Left: Notes & Bank Account -->
                        <div style="flex: 1;">
                            ${invoice.customer_notes ? `
                            <div class="notes" style="margin-bottom: 12px;">
                                <strong>Notes:</strong><br/>
                                ${String(invoice.customer_notes).replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')}
                            </div>
                            ` : ''}
                            
                            <!-- Bank Account Information -->
                            <div style="padding: 10px; background: #f9f9f9; border-left: 3px solid #0070BB; font-size: 9px;">
                                <strong style="display: block; margin-bottom: 8px;">Bank Account:</strong>
                                
                                ${bankAccounts && bankAccounts.length > 0 ? bankAccounts.map(bank => `
                                <div style="margin-bottom: 8px;">
                                    <div style="font-weight: bold; font-size: 10px;">${bank.bank_name || 'Bank'}</div>
                                    <div style="color: #666;">Account: ${bank.account_number}</div>
                                    <div style="color: #666;">Name: ${bank.account_holder}</div>
                                </div>
                                `).join('') : `
                                <div style="color: #666; font-style: italic;">No bank account details available</div>
                                `}
                            </div>
                        </div>
                        
                        <!-- Right: Totals -->
                        <div style="flex: 1;">
                            <table class="totals-table" style="margin-left: auto;">
                                <tr>
                                    <td class="label">Subtotal</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(invoice.subtotal || 0, invoice.currency)}</td>
                                </tr>
                                <tr>
                                    <td class="label">Tax (${invoice.tax_rate || 0}%)</td>
                                    <td class="colon">:</td>
                                    <td class="value">${formatCurrency(invoice.tax_amount || 0, invoice.currency)}</td>
                                </tr>
                                ${invoice.discount_amount > 0 ? `
                                <tr>
                                    <td class="label">Discount</td>
                                    <td class="colon">:</td>
                                    <td class="value" style="color: #dc2626;">-${formatCurrency(invoice.discount_amount, invoice.currency)}</td>
                                </tr>
                                ` : ''}
                                <tr class="grand-total">
                                    <td class="label grand-total">TOTAL</td>
                                    <td class="colon grand-total">:</td>
                                    <td class="value grand-total">${formatCurrency(invoice.total_amount || 0, invoice.currency)}</td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p>Thank you for your business!</p>
                        <p>For any questions, please contact us</p>
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(printContent);
            printWindow.document.close();
        } catch (error) {
            console.error('Error printing invoice:', error);
            alert('Gagal membuka print preview: ' + error.message);
        }
    };

    const handleSubmitInvoice = async (invoice) => {
        if (!confirm(`Approve invoice ${invoice.invoice_number}? Invoice akan masuk hitungan AR.`)) return;

        try {
            console.log('Approving invoice:', invoice.invoice_number, 'ID:', invoice.id, 'Current status:', invoice.status);

            const { data, error } = await supabase
                .from('blink_invoices')
                .update({ status: 'unpaid' })
                .eq('id', invoice.id)
                .select();

            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }

            if (!data || data.length === 0) {
                console.error('Update returned no data - update may have failed silently');
                throw new Error('Failed to update invoice status. Please check permissions.');
            }

            console.log('Invoice status updated successfully:', data);

            alert('Invoice approved! Invoice sekarang masuk hitungan AR.');
            window.location.reload(); // Force refresh to update UI
        } catch (error) {
            console.error('Error approving invoice:', error);
            alert('Failed to approve invoice: ' + error.message);
        }
    };



    const filteredInvoices = invoices.filter(inv => {
        const matchesFilter = filter === 'all' || inv.status === filter;
        const matchesSearch = !searchTerm ||
            inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.job_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Calculate summary stats
    const totalRevenue = invoices.reduce((sum, inv) =>
        inv.status !== 'cancelled' ? sum + (inv.total_amount || 0) : sum, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Invoice Management</h1>
                    <p className="text-silver-dark mt-1">Kelola invoice dan tracking pembayaran</p>
                </div>
                <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                    Buat Invoice Baru
                </Button>
            </div>

            {/* Summary Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Invoices</p>
                        <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-silver-light">{invoices.length}</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Revenue</p>
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    </div>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(totalRevenue)}</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Outstanding</p>
                        <DollarSign className="w-4 h-4 text-yellow-400" />
                    </div>
                    <p className="text-xl font-bold text-yellow-400">{formatCurrency(totalOutstanding)}</p>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Overdue</p>
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    <p className="text-xl font-bold text-red-400">{overdueCount}</p>
                </div>
            </div>

            {/* Search - Full Width */}
            <div className="w-full">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        placeholder="Cari invoice, job number, atau customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-base"
                    />
                </div>
            </div>

            {/* Invoices Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Invoice #</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Job Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Customer</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Due Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Amount</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Outstanding</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-3 py-8 text-center">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2" />
                                        <p className="text-silver-dark text-sm">
                                            {filter === 'all'
                                                ? 'Belum ada invoice. Klik "Buat Invoice Baru" untuk memulai.'
                                                : `Tidak ada invoice dengan status "${statusConfig[filter]?.label}"`
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => {
                                    const config = statusConfig[invoice.status];
                                    const StatusIcon = config?.icon || FileText;
                                    const daysOverdue = invoice.status === 'overdue'
                                        ? Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24))
                                        : 0;

                                    return (
                                        <tr
                                            key={invoice.id}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                            onClick={() => {
                                                setSelectedInvoice(invoice);
                                                setShowViewModal(true);
                                            }}
                                        >
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="font-medium text-accent-orange">{invoice.invoice_number}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-light">{invoice.job_number}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-light">{invoice.customer_name}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className="text-silver-dark">{invoice.invoice_date}</span>
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <span className={`${invoice.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-silver-dark'}`}>
                                                    {invoice.due_date}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className="font-semibold text-silver-light">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right whitespace-nowrap">
                                                <span className={`font-semibold ${invoice.outstanding_amount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                    {formatCurrency(invoice.outstanding_amount, invoice.currency)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Invoice Modal */}
            {
                showCreateModal && (
                    <InvoiceCreateModal
                        quotations={quotations}
                        shipments={shipments}
                        formData={formData}
                        setFormData={setFormData}
                        selectedQuotation={selectedQuotation}
                        selectedShipment={selectedShipment}
                        referenceType={referenceType}
                        setReferenceType={setReferenceType}
                        handleQuotationSelect={handleQuotationSelect}
                        handleShipmentSelect={handleShipmentSelect}
                        handlePaymentTermsChange={handlePaymentTermsChange}
                        addInvoiceItem={addInvoiceItem}
                        removeInvoiceItem={removeInvoiceItem}
                        updateInvoiceItem={updateInvoiceItem}
                        calculateTotals={calculateTotals}
                        handleCreateInvoice={handleCreateInvoice}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowCreateModal(false);
                            resetForm();
                        }}
                    />
                )
            }

            {/* View Invoice Modal - Will be implemented */}
            {
                showViewModal && selectedInvoice && (
                    <InvoiceViewModal
                        invoice={selectedInvoice}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowViewModal(false);
                            setSelectedInvoice(null);
                        }}
                        onPayment={() => {
                            setShowPaymentModal(true);
                            setShowViewModal(false);
                        }}
                        onPrint={() => handlePrintInvoice(selectedInvoice)}
                        onPreview={() => {
                            setPreviewInvoiceData(selectedInvoice);
                            setShowPrintPreview(true);
                        }}
                        onSubmit={() => handleSubmitInvoice(selectedInvoice)}
                        statusConfig={statusConfig}
                    />
                )
            }

            {/* Payment Record Modal */}
            {
                showPaymentModal && selectedInvoice && (
                    <PaymentRecordModal
                        invoice={selectedInvoice}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowPaymentModal(false);
                        }}
                        onSuccess={async () => {
                            await fetchInvoices();
                            setShowPaymentModal(false);
                            setSelectedInvoice(null);
                        }}
                    />
                )
            }

            {/* Print Preview Modal */}
            {
                showPrintPreview && previewInvoiceData && (
                    <PrintPreviewModal
                        invoice={previewInvoiceData}
                        formatCurrency={formatCurrency}
                        onClose={() => {
                            setShowPrintPreview(false);
                            setPreviewInvoiceData(null);
                        }}
                        onPrint={() => handlePrintInvoice(previewInvoiceData)}
                    />
                )
            }
        </div >
    );
};

// Invoice Create Modal Component  
const InvoiceCreateModal = ({ quotations, shipments, formData, setFormData, selectedQuotation, selectedShipment,
    referenceType, setReferenceType, handleQuotationSelect, handleShipmentSelect, handlePaymentTermsChange,
    addInvoiceItem, removeInvoiceItem, updateInvoiceItem, calculateTotals,
    handleCreateInvoice, formatCurrency, onClose }) => {

    const { subtotal, taxAmount, total } = calculateTotals();

    // Blend quotations and shipments into single list
    const blendedReferences = [
        ...quotations.map(q => ({
            id: q.id,
            type: 'quotation',
            label: `[QUOTATION] ${q.quotationNumber || q.quotation_number} - ${q.customerName || q.customer_name} (${q.origin} → ${q.destination})`,
            data: q
        })),
        ...shipments.map(s => ({
            id: s.id,
            type: 'shipment',
            label: `[SO] ${s.so_number || s.job_number} - ${s.customer} (${s.origin} → ${s.destination})`,
            data: s
        }))
    ];

    const handleReferenceSelect = (e) => {
        const selectedId = e.target.value;
        const reference = blendedReferences.find(r => r.id === selectedId);

        if (!reference) return;

        if (reference.type === 'quotation') {
            const event = { target: { value: reference.id } };
            handleQuotationSelect(event);
        } else {
            const event = { target: { value: reference.id } };
            handleShipmentSelect(event);
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-[90vw]">
            <div className="p-3">
                <h2 className="text-lg font-bold gradient-text mb-3">Buat Invoice Baru</h2>

                <form onSubmit={handleCreateInvoice} className="space-y-3">
                    {/* Blended Reference Selection */}
                    <div className="glass-card p-2.5 rounded-lg">
                        <label className="block text-[11px] font-semibold text-silver-light mb-1.5">
                            Referensi (Quotation / SO) <span className="text-red-400">*</span>
                        </label>
                        <select
                            value={formData.quotation_id || formData.shipment_id || ''}
                            onChange={handleReferenceSelect}
                            className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded text-silver-light text-[11px]"
                            required
                        >
                            <option value="">-- Pilih Quotation atau Sales Order --</option>
                            {blendedReferences.map(ref => (
                                <option key={`${ref.type}-${ref.id}`} value={ref.id}>
                                    {ref.label}
                                </option>
                            ))}
                        </select>

                    </div>



                    {/* Customer & Quotation Info - Auto populated */}
                    {(selectedQuotation || selectedShipment) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="glass-card p-2 rounded-lg">
                                <h3 className="text-[11px] font-semibold text-accent-orange mb-1.5">Informasi Customer</h3>
                                <div className="space-y-1 text-[11px]">
                                    <div><span className="text-silver-dark">Nama:</span> <span className="text-silver-light font-medium">{formData.customer_name}</span></div>
                                    <div><span className="text-silver-dark">Job Number:</span> <span className="text-silver-light">{formData.job_number}</span></div>
                                    {formData.quotation_number && (
                                        <div><span className="text-silver-dark">Quotation Number:</span> <span className="text-silver-light">{formData.quotation_number}</span></div>
                                    )}
                                </div>
                            </div>

                            <div className="glass-card p-2 rounded-lg">
                                <h3 className="text-[11px] font-semibold text-accent-orange mb-1.5">Informasi {selectedQuotation ? 'Quotation' : 'SO'}</h3>
                                <div className="space-y-1 text-[11px]">
                                    <div><span className="text-silver-dark">Route:</span> <span className="text-silver-light">{formData.origin} → {formData.destination}</span></div>
                                    <div><span className="text-silver-dark">Service:</span> <span className="text-silver-light">{formData.service_type?.toUpperCase()}</span></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Terms, Dates, Currency & Exchange Rate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Tanggal Invoice
                            </label>
                            <input
                                type="date"
                                value={formData.invoice_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, invoice_date: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Payment Terms
                            </label>
                            <select
                                value={formData.payment_terms}
                                onChange={handlePaymentTermsChange}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                            >
                                <option value="NET 7">NET 7</option>
                                <option value="NET 14">NET 14</option>
                                <option value="NET 30">NET 30</option>
                                <option value="NET 60">NET 60</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            />
                        </div>
                    </div>

                    {/* Currency & Exchange Rate */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Mata Uang Penagihan <span className="text-red-400">*</span>
                            </label>
                            <select
                                value={formData.billing_currency}
                                onChange={(e) => {
                                    const newCurrency = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        billing_currency: newCurrency,
                                        exchange_rate: newCurrency === 'IDR' ? 1 : (prev.exchange_rate || 16000)
                                    }));
                                }}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            >
                                <option value="IDR">IDR (Rupiah)</option>
                                <option value="USD">USD (US Dollar)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Kurs Rate (USD to IDR)
                            </label>
                            <input
                                type="number"
                                value={formData.exchange_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, exchange_rate: parseFloat(e.target.value) || 1 }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                disabled={formData.billing_currency === 'IDR'}
                                min="1"
                                step="0.01"
                                placeholder="e.g., 16000"
                            />
                            <p className="text-xs text-silver-dark mt-1">
                                {formData.billing_currency === 'IDR' ? 'Tidak diperlukan untuk IDR' : 'Masukkan nilai tukar USD ke IDR'}
                            </p>
                        </div>
                    </div>

                    {/* Invoice Items */}
                    <div className="glass-card p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-accent-orange">Invoice Items</h3>
                            <button
                                type="button"
                                onClick={addInvoiceItem}
                                className="flex items-center gap-2 px-3 py-1.5 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Tambah Item
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-accent-orange">
                                    <tr>
                                        <th className="px-2 py-2 text-center text-xs text-white w-10 font-normal">No</th>
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[200px] font-normal">Description</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-24 font-normal">Qty</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-24 font-normal">Unit</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[140px] font-normal">Price</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[100px] font-normal">Total</th>
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[180px] font-normal">Revenue Account</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-10 font-normal">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {formData.invoice_items.map((item, index) => (
                                        <tr key={index} className="hover:bg-dark-surface/50 smooth-transition">
                                            <td className="px-2 py-2 text-center text-silver-light text-xs">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                    placeholder="Deskripsi layanan"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => updateInvoiceItem(index, 'qty', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => updateInvoiceItem(index, 'unit', e.target.value)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                                    placeholder="Unit"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="number"
                                                    value={item.rate}
                                                    onChange={(e) => updateInvoiceItem(index, 'rate', parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-right"
                                                    min="0"
                                                    step="0.01"
                                                    required
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-right">
                                                <span className="text-silver-light text-sm">{formatCurrency(item.amount, formData.billing_currency)}</span>
                                            </td>
                                            <td className="px-2 py-2">
                                                <COAPicker
                                                    value={item.coa_id}
                                                    onChange={(coaId) => updateInvoiceItem(index, 'coa_id', coaId)}
                                                    context="AR"
                                                    minLevel={3}
                                                    placeholder="Pilih Akun"
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => removeInvoiceItem(index)}
                                                    className="p-1 hover:bg-red-500/20 text-red-400 rounded smooth-transition"
                                                    disabled={formData.invoice_items.length === 1}
                                                >
                                                    <Trash className="w-3.5 h-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Tax & Discount */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Tax Rate (%)
                            </label>
                            <input
                                type="number"
                                value={formData.tax_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                min="0"
                                max="100"
                                step="0.01"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Discount Amount ({formData.currency})
                            </label>
                            <input
                                type="number"
                                value={formData.discount_amount}
                                onChange={(e) => setFormData(prev => ({ ...prev, discount_amount: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {/* Summary Calculation */}
                    <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-accent-orange/10 to-transparent border border-accent-orange/30">
                        <h3 className="text-sm font-semibold text-accent-orange mb-3">Summary</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-silver-dark">Subtotal:</span>
                                <span className="text-silver-light font-medium">{formatCurrency(subtotal, formData.currency)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-silver-dark">Tax ({formData.tax_rate}%):</span>
                                <span className="text-silver-light font-medium">{formatCurrency(taxAmount, formData.currency)}</span>
                            </div>
                            {formData.discount_amount > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-silver-dark">Discount:</span>
                                    <span className="text-red-400 font-medium">-{formatCurrency(formData.discount_amount, formData.currency)}</span>
                                </div>
                            )}
                            <div className="border-t border-dark-border pt-2 mt-2">
                                <div className="flex justify-between">
                                    <span className="text-silver-light font-bold">Total:</span>
                                    <span className="text-accent-orange font-bold text-lg">{formatCurrency(total, formData.currency)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Customer Notes (tampil di invoice)
                            </label>
                            <textarea
                                value={formData.customer_notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, customer_notes: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                rows="3"
                                placeholder="Catatan untuk customer..."
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Internal Notes (tidak tampil di invoice)
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                rows="3"
                                placeholder="Catatan internal..."
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition font-semibold"
                        >
                            Buat Invoice
                        </button>
                    </div>
                </form>
            </div >
        </Modal >
    );
};

// Invoice View Modal Component
const InvoiceViewModal = ({ invoice, formatCurrency, onClose, onPayment, onPrint, onPreview, onSubmit, statusConfig }) => {
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);

    useEffect(() => {
        fetchPayments();
    }, [invoice.id]);

    const fetchPayments = async () => {
        try {
            setLoadingPayments(true);
            const { data, error } = await supabase
                .from('blink_payments')
                .select('*')
                .eq('reference_type', 'invoice')
                .eq('reference_id', invoice.id)
                .order('payment_date', { ascending: false });

            if (error) {
                console.error('Error fetching payments:', error);
                setPayments([]);
                return;
            }
            setPayments(data || []);
        } catch (error) {
            console.error('Error fetching payments:', error);
            setPayments([]); // Don't break modal, just show no payments
        } finally {
            setLoadingPayments(false);
        }
    };

    const config = statusConfig[invoice.status];
    const StatusIcon = config?.icon || FileText;

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-5xl">
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">{invoice.invoice_number}</h2>
                        <p className="text-silver-dark text-sm mt-1">
                            Job: {invoice.job_number} {invoice.so_number && `• SO: ${invoice.so_number}`}
                        </p>
                    </div>

                </div>

                <div className="space-y-6">
                    {/* Invoice Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-card p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <User className="w-4 h-4 text-accent-orange" />
                                <h3 className="text-sm font-semibold text-accent-orange">Customer</h3>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="text-silver-light font-medium">{invoice.customer_name}</div>
                                {invoice.customer_company && (
                                    <div className="text-silver-dark">{invoice.customer_company}</div>
                                )}
                                {invoice.customer_address && (
                                    <div className="text-silver-dark text-xs mt-2">{invoice.customer_address}</div>
                                )}
                            </div>
                        </div>

                        <div className="glass-card p-4 rounded-lg">
                            <div className="flex items-center gap-2 mb-3">
                                <Calendar className="w-4 h-4 text-accent-orange" />
                                <h3 className="text-sm font-semibold text-accent-orange">Tanggal</h3>
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-silver-dark">Invoice:</span>
                                    <span className="text-silver-light ml-2">{invoice.invoice_date}</span>
                                </div>
                                <div>
                                    <span className="text-silver-dark">Due:</span>
                                    <span className={`ml-2 font-medium ${invoice.status === 'overdue' ? 'text-red-400' : 'text-silver-light'}`}>
                                        {invoice.due_date}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-silver-dark">Terms:</span>
                                    <span className="text-silver-light ml-2">{invoice.payment_terms}</span>
                                </div>
                            </div>
                        </div>

                        {/* Shipment & Cargo Details - Side by Side Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Shipment Details Card */}
                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Receipt className="w-4 h-4 text-accent-orange" />
                                    <h3 className="text-sm font-semibold text-accent-orange">Shipment</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-silver-dark">Route:</span>
                                        <span className="text-silver-light ml-2">{invoice.origin} → {invoice.destination}</span>
                                    </div>
                                    <div>
                                        <span className="text-silver-dark">Service:</span>
                                        <span className="text-silver-light ml-2">{invoice.service_type?.toUpperCase()}</span>
                                    </div>
                                    {invoice.bl_awb_number && (
                                        <div>
                                            <span className="text-silver-dark">BL/AWB:</span>
                                            <span className="text-silver-light ml-2">{invoice.bl_awb_number}</span>
                                        </div>
                                    )}
                                    {invoice.voyage && (
                                        <div>
                                            <span className="text-silver-dark">Voyage:</span>
                                            <span className="text-silver-light ml-2">{invoice.voyage}</span>
                                        </div>
                                    )}
                                    {invoice.shipper_name && (
                                        <div>
                                            <span className="text-silver-dark">Shipper:</span>
                                            <span className="text-silver-light ml-2">{invoice.shipper_name}</span>
                                        </div>
                                    )}
                                    {invoice.delivery_date && (
                                        <div>
                                            <span className="text-silver-dark">Delivery Date:</span>
                                            <span className="text-silver-light ml-2">{invoice.delivery_date}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Cargo Details Card */}
                            {Boolean(invoice.container_type || (invoice.weight && invoice.weight > 0) || invoice.dimensions || (invoice.cbm && invoice.cbm > 0)) && (
                                <div className="glass-card p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Package className="w-4 h-4 text-accent-orange" />
                                        <h3 className="text-sm font-semibold text-accent-orange">Cargo Details</h3>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {invoice.container_type && (
                                            <div>
                                                <span className="text-silver-dark">Container:</span>
                                                <span className="text-silver-light ml-2">{invoice.container_type}</span>
                                            </div>
                                        )}
                                        {Boolean(invoice.weight && invoice.weight > 0) && (
                                            <div>
                                                <span className="text-silver-dark">Weight:</span>
                                                <span className="text-silver-light ml-2">{invoice.weight} kg</span>
                                            </div>
                                        )}
                                        {invoice.dimensions && (
                                            <div>
                                                <span className="text-silver-dark">Dimensions:</span>
                                                <span className="text-silver-light ml-2">{invoice.dimensions}</span>
                                            </div>
                                        )}
                                        {Boolean(invoice.cbm && invoice.cbm > 0) && (
                                            <div>
                                                <span className="text-silver-dark">CBM:</span>
                                                <span className="text-silver-light ml-2">{invoice.cbm} m³</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Invoice Items Table */}
                    <div className="glass-card rounded-lg overflow-hidden">
                        <div className="px-4 py-3 bg-accent-orange">
                            <h3 className="font-semibold text-white">Invoice Items</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-dark-surface border-b border-dark-border">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-semibold text-silver-dark uppercase">Deskripsi</th>
                                        <th className="px-4 py-2 text-center text-xs font-semibold text-silver-dark uppercase w-20">Qty</th>
                                        <th className="px-4 py-2 text-center text-xs font-semibold text-silver-dark uppercase w-24">Unit</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-silver-dark uppercase w-32">Rate</th>
                                        <th className="px-4 py-2 text-right text-xs font-semibold text-silver-dark uppercase w-32">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {invoice.invoice_items?.map((item, index) => (
                                        <tr key={index}>
                                            <td className="px-4 py-3 text-silver-light">{item.description}</td>
                                            <td className="px-4 py-3 text-center text-silver-light">{item.qty}</td>
                                            <td className="px-4 py-3 text-center text-silver-dark">{item.unit}</td>
                                            <td className="px-4 py-3 text-right text-silver-light">{(parseFloat(item.rate) || 0).toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-right text-silver-light font-medium">{formatCurrency(item.amount, invoice.currency)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            {invoice.customer_notes && (
                                <div className="glass-card p-4 rounded-lg">
                                    <h3 className="text-sm font-semibold text-accent-orange mb-2">Customer Notes</h3>
                                    <p className="text-sm text-silver-light">{invoice.customer_notes}</p>
                                </div>
                            )}
                        </div>

                        <div className="glass-card p-4 rounded-lg bg-gradient-to-br from-accent-orange/10 to-transparent border border-accent-orange/30">
                            <h3 className="text-sm font-semibold text-accent-orange mb-3">Summary</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-silver-dark">Subtotal:</span>
                                    <span className="text-silver-light">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-silver-dark">Tax ({invoice.tax_rate}%):</span>
                                    <span className="text-silver-light">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                                </div>
                                {invoice.discount_amount > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-silver-dark">Discount:</span>
                                        <span className="text-red-400">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                                    </div>
                                )}
                                <div className="border-t border-dark-border pt-2 mt-2">
                                    <div className="flex justify-between font-bold">
                                        <span className="text-silver-light">Total:</span>
                                        <span className="text-accent-orange text-lg">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between text-sm pt-2 border-t border-dark-border/50">
                                    <span className="text-silver-dark">Paid:</span>
                                    <span className="text-green-400 font-medium">{formatCurrency(invoice.paid_amount || 0, invoice.currency)}</span>
                                </div>
                                <div className="flex justify-between font-semibold">
                                    <span className="text-silver-light">Outstanding:</span>
                                    <span className={invoice.outstanding_amount > 0 ? 'text-yellow-400' : 'text-green-400'}>
                                        {formatCurrency(invoice.outstanding_amount || 0, invoice.currency)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment History */}
                    <div className="glass-card p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-accent-orange">Payment History</h3>
                            {payments.length > 0 && (
                                <span className="text-xs text-silver-dark">{payments.length} payment(s)</span>
                            )}
                        </div>

                        {loadingPayments ? (
                            <div className="text-center py-4 text-silver-dark">Loading payments...</div>
                        ) : payments.length === 0 ? (
                            <div className="text-center py-4 text-silver-dark">Belum ada pembayaran</div>
                        ) : (
                            <div className="space-y-2">
                                {payments.map((payment) => (
                                    <div key={payment.id} className="flex items-center justify-between p-3 bg-dark-surface rounded-lg border border-dark-border">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <CheckCircle className="w-4 h-4 text-green-400" />
                                                <span className="text-silver-light font-medium">{formatCurrency(payment.amount, payment.currency)}</span>
                                            </div>
                                            <div className="text-xs text-silver-dark mt-1">
                                                {payment.payment_date} • {payment.payment_method || 'N/A'}
                                                {payment.reference_number && ` • Ref: ${payment.reference_number}`}
                                            </div>
                                        </div>
                                        {payment.notes && (
                                            <div className="text-xs text-silver-dark max-w-xs truncate">{payment.notes}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border">
                        {invoice.outstanding_amount > 0 && (
                            <p className="text-xs text-silver-dark self-center mr-auto">
                                💡 Pembayaran dilakukan melalui modul AR (Accounts Receivable)
                            </p>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Tutup
                        </button>
                        {onPrint && (
                            <button
                                onClick={onPrint}
                                className="flex items-center gap-2 px-6 py-2 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/10 smooth-transition"
                            >
                                <div className="w-4 h-4">🖨️</div>
                                Print
                            </button>
                        )}
                        {onPreview && (
                            <button
                                onClick={onPreview}
                                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg smooth-transition font-semibold"
                            >
                                <Eye className="w-4 h-4" />
                                Preview
                            </button>
                        )}
                        {invoice.status === 'draft' && onSubmit && (
                            <button
                                onClick={onSubmit}
                                className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg smooth-transition font-semibold"
                            >
                                <CheckCircle className="w-4 h-4" />
                                Approval
                            </button>
                        )}
                    </div>
                </div >
            </div >
        </Modal >
    );
};

// Payment Record Modal Component
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

            const { error: paymentError } = await supabase
                .from('blink_payments')
                .insert([paymentData]);

            if (paymentError) throw paymentError;

            // Update invoice
            const newPaidAmount = (invoice.paid_amount || 0) + parseFloat(formData.amount);
            const newOutstanding = invoice.total_amount - newPaidAmount;

            let newStatus = invoice.status;
            if (newOutstanding === 0) {
                newStatus = 'paid';
            } else if (newPaidAmount > 0 && newOutstanding > 0) {
                newStatus = 'partially_paid';
            }

            const { error: invoiceError } = await supabase
                .from('blink_invoices')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                })
                .eq('id', invoice.id);

            if (invoiceError) throw invoiceError;

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

// Print Preview Modal Component
const PrintPreviewModal = ({ invoice, formatCurrency, onClose, onPrint, companySettings }) => {
    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold gradient-text">Print Preview</h2>
                    <div className="flex gap-2 print:hidden">
                        <button
                            onClick={onPrint || handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition font-semibold"
                        >
                            <Download className="w-4 h-4" />
                            Print / Save as PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Print-friendly invoice content */}
                <div className="print-content bg-white text-black p-8 rounded-lg">
                    {/* Header */}
                    <div className="border-b-2 border-gray-800 pb-4 mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">INVOICE</h1>
                        <p className="text-xl font-semibold text-gray-600 mt-1">{invoice.invoice_number}</p>
                    </div>

                    {/* Company & Customer Info */}
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-2">FROM:</h3>
                            <div className="text-sm text-gray-800">
                                <p className="font-bold text-base text-[#0070BB]">{companySettings?.company_name || 'PT Bakhtera Satu Indonesia'}</p>
                                <p className="mt-2 whitespace-pre-wrap">{companySettings?.company_address || 'Jakarta, Indonesia'}</p>
                                {companySettings?.company_phone && <p className="mt-2">Phone: {companySettings.company_phone}</p>}
                                {companySettings?.company_email && <p>Email: {companySettings.company_email}</p>}
                                {companySettings?.company_npwp && <p className="mt-1 font-semibold">NPWP: {companySettings.company_npwp}</p>}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-gray-700 mb-2">BILL TO:</h3>
                            <div className="text-sm text-gray-800">
                                <p className="font-bold text-base">{invoice.customer_name}</p>
                                {invoice.customer_company && <p className="text-gray-600">{invoice.customer_company}</p>}
                                {invoice.customer_address && <p className="mt-2">{invoice.customer_address}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Invoice Details */}
                    <div className="grid grid-cols-2 gap-4 mb-8 bg-gray-50 p-4 rounded">
                        <div>
                            <p className="text-xs text-gray-600">Invoice Date:</p>
                            <p className="font-semibold text-gray-800">{invoice.invoice_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Due Date:</p>
                            <p className="font-semibold text-gray-800">{invoice.due_date}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Job Number:</p>
                            <p className="font-semibold text-gray-800">{invoice.job_number}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-600">Payment Terms:</p>
                            <p className="font-semibold text-gray-800">{invoice.payment_terms}</p>
                        </div>
                        {invoice.origin && invoice.destination && (
                            <div className="col-span-2">
                                <p className="text-xs text-gray-600">Route:</p>
                                <p className="font-semibold text-gray-800">{invoice.origin} → {invoice.destination}</p>
                            </div>
                        )}
                    </div>

                    {/* Shipment & Container Details */}
                    {(invoice.service_type || invoice.bl_awb_number || invoice.container_type || invoice.weight) && (
                        <div className="grid grid-cols-2 gap-4 mb-8 p-4 border border-gray-300 rounded">
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Shipment Details</h3>
                                {invoice.service_type && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Service Type:</p>
                                        <p className="text-sm text-gray-800">{invoice.service_type?.toUpperCase()}</p>
                                    </div>
                                )}
                                {invoice.bl_awb_number && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">BL/AWB Number:</p>
                                        <p className="text-sm text-gray-800">{invoice.bl_awb_number}</p>
                                    </div>
                                )}
                                {invoice.voyage && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Voyage:</p>
                                        <p className="text-sm text-gray-800">{invoice.voyage}</p>
                                    </div>
                                )}
                                {invoice.shipper_name && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Shipper:</p>
                                        <p className="text-sm text-gray-800">{invoice.shipper_name}</p>
                                    </div>
                                )}
                                {invoice.delivery_date && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Delivery Date:</p>
                                        <p className="text-sm text-gray-800">{invoice.delivery_date}</p>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 mb-3">Cargo Details</h3>
                                {invoice.container_type && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Container Type:</p>
                                        <p className="text-sm text-gray-800">{invoice.container_type}</p>
                                    </div>
                                )}
                                {invoice.weight && invoice.weight > 0 && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Weight:</p>
                                        <p className="text-sm text-gray-800">{invoice.weight} kg</p>
                                    </div>
                                )}
                                {invoice.dimensions && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">Dimensions:</p>
                                        <p className="text-sm text-gray-800">{invoice.dimensions}</p>
                                    </div>
                                )}
                                {invoice.cbm && invoice.cbm > 0 && (
                                    <div className="mb-2">
                                        <p className="text-xs text-gray-600">CBM:</p>
                                        <p className="text-sm text-gray-800">{invoice.cbm} m³</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Invoice Items Table */}
                    <table className="w-full mb-8">
                        <thead>
                            <tr className="bg-gray-800 text-white">
                                <th className="p-3 text-left text-xs">NO</th>
                                <th className="p-3 text-left text-xs">DESCRIPTION</th>
                                <th className="p-3 text-center text-xs w-16">QTY</th>
                                <th className="p-3 text-center text-xs w-14">UNIT</th>
                                <th className="p-3 text-right text-xs w-28">PRICE</th>
                                <th className="p-3 text-right text-xs w-24">TOTAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            {invoice.invoice_items?.map((item, index) => (
                                <tr key={index} className="border-b border-gray-200">
                                    <td className="p-3 text-sm text-gray-700 text-center">{index + 1}</td>
                                    <td className="p-3 text-sm text-gray-800">{item.description}</td>
                                    <td className="p-3 text-sm text-gray-700 text-center">{item.qty}</td>
                                    <td className="p-3 text-sm text-gray-700 text-center">{item.unit}</td>
                                    <td className="p-3 text-sm text-gray-700 text-right">{formatCurrency(item.rate, invoice.currency)}</td>
                                    <td className="p-3 text-sm text-gray-800 text-right font-semibold">{formatCurrency(item.amount, invoice.currency)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Add spacing before totals */}
                    <div className="h-8"></div>

                    {/* Totals */}
                    <div className="flex justify-end mb-8">
                        <div className="w-80">
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-sm text-gray-600">Subtotal:</span>
                                <span className="text-sm font-semibold text-gray-800">{formatCurrency(invoice.subtotal, invoice.currency)}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-200">
                                <span className="text-sm text-gray-600">Tax ({invoice.tax_rate}%):</span>
                                <span className="text-sm font-semibold text-gray-800">{formatCurrency(invoice.tax_amount, invoice.currency)}</span>
                            </div>
                            {invoice.discount_amount > 0 && (
                                <div className="flex justify-between py-2 border-b border-gray-200">
                                    <span className="text-sm text-gray-600">Discount:</span>
                                    <span className="text-sm font-semibold text-red-600">-{formatCurrency(invoice.discount_amount, invoice.currency)}</span>
                                </div>
                            )}
                            <div className="flex justify-between py-3 bg-gray-800 text-white px-4 rounded mt-2">
                                <span className="font-bold">TOTAL:</span>
                                <span className="font-bold text-lg">{formatCurrency(invoice.total_amount, invoice.currency)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {invoice.customer_notes && (
                        <div className="mt-8 p-4 bg-gray-50 rounded">
                            <h4 className="text-xs font-bold text-gray-700 mb-2">NOTES:</h4>
                            <p className="text-sm text-gray-700">{invoice.customer_notes}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="mt-12 pt-6 border-t border-gray-300 text-center">
                        <p className="text-xs text-gray-500">Thank you for your business!</p>
                        <p className="text-xs text-gray-500 mt-1">For any questions, please contact us</p>
                    </div>
                </div>
            </div>

            {/* Print-specific styles */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .print-content, .print-content * {
                        visibility: visible;
                    }
                    .print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        background: white !important;
                        box-shadow: none !important;
                    }
                    .print:hidden {
                        display: none !important;
                    }
                }
            `}</style>
        </Modal>
    );
};

export default InvoiceManagement;
