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
        notes: '',
        // Print-specific fields
        consignor: '',
        consignee: '',
        order_reference: '',
        goods_description: '',
        import_broker: '',
        chargeable_weight: '',
        packages: '',
        vessel_name: '',
        voyage_number: '',
        ocean_bl: '',
        house_bl: '',
        etd: '',
        eta: '',
        containers: ''
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
                    }],
                // Pre-fill fields from quotation where possible
                consignor: quotation.shipper_name || '', // Assuming shipper map to consignor often
                consignee: quotation.customerName || '',
                goods_description: quotation.commodity || '',
                chargeable_weight: parseFloat(quotation.chargeableWeight || quotation.weight || 0),
                packages: quotation.packageType ? `${quotation.quantity || ''} ${quotation.packageType}` : ''
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
                }],
                // Pre-fill fields from shipment
                consignor: shipment.shipper_name || '',
                consignee: shipment.consignee_name || shipment.customer || '',
                vessel_name: shipment.vessel_name || '',
                voyage_number: shipment.voyage_number || '',
                ocean_bl: shipment.mbl_number || '',
                house_bl: shipment.hbl_number || '',
                etd: shipment.etd || '',
                eta: shipment.eta || '',
                containers: shipment.container_number || '',
                goods_description: shipment.commodity || '',
                chargeable_weight: shipment.chargeable_weight || shipment.weight || '',
                packages: shipment.packages || ''
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
                notes: formData.notes || null,
                // Print fields
                consignor: formData.consignor,
                consignee: formData.consignee,
                order_reference: formData.order_reference,
                goods_description: formData.goods_description,
                import_broker: formData.import_broker,
                chargeable_weight: parseFloat(formData.chargeable_weight) || 0,
                packages: formData.packages,
                vessel_name: formData.vessel_name,
                voyage_number: formData.voyage_number,
                ocean_bl: formData.ocean_bl,
                house_bl: formData.house_bl,
                etd: formData.etd || null,
                eta: formData.eta || null,
                containers: formData.containers
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
            notes: '',
            consignor: '',
            consignee: '',
            order_reference: '',
            goods_description: '',
            import_broker: '',
            chargeable_weight: '',
            packages: '',
            vessel_name: '',
            voyage_number: '',
            ocean_bl: '',
            house_bl: '',
            etd: '',
            eta: '',
            containers: ''
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

            // Helper for empty fields default
            const safeStr = (str) => str || '-';
            const safeDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

            // Generate items rows
            const itemsRows = invoice.invoice_items?.map((item, index) => `
                <tr>
                    <td style="vertical-align: top; text-transform: capitalize;">${String(item.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td style="text-align: center; vertical-align: top;">${invoice.currency}</td>
                    <td style="text-align: right; vertical-align: top;">${formatCurrency(item.amount || 0, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                    <td style="text-align: right; vertical-align: top;">${formatCurrency((item.amount || 0) * (invoice.tax_rate || 0) / 100, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                </tr>
            `).join('') || '<tr><td colspan="4" style="text-align: center; padding: 10px;">No items</td></tr>';

            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Arimo:wght@400;700&display=swap');
                        * { box-sizing: border-box; }
                        body { 
                            font-family: 'Arimo', Arial, sans-serif; 
                            font-size: 11px; 
                            margin: 0; 
                            padding: 20px; 
                            color: #000; 
                            background-color: #f0f0f0; 
                            -webkit-print-color-adjust: exact; 
                        }
                        .container { 
                            width: 210mm; 
                            min-height: 297mm; 
                            margin: 0 auto; 
                            background-color: #fff;
                            padding: 15mm; 
                            box-shadow: 0 0 10px rgba(0,0,0,0.1);
                            position: relative;
                        }
                        
                        /* Header */
                        .header-row { display: flex; justify-content: space-between; margin-bottom: 20px; align-items: flex-start; }
                        .company-logo h1 { margin: 0; font-size: 24px; font-weight: bold; font-style: italic; color: #000; }
                        .company-logo p { margin: 0; font-size: 9px; letter-spacing: 3px; color: #555; text-transform: uppercase; }
                        .company-address { text-align: right; font-size: 10px; line-height: 1.4; color: #333; }

                        /* Invoice Title Bar */
                        .invoice-title-bar { 
                            border-top: 2px solid #000; border-bottom: 2px solid #000; 
                            background-color: #ededed;
                            padding: 6px 10px; margin-bottom: 20px; font-weight: bold; font-size: 16px; 
                            display: flex; justify-content: space-between; align-items: center;
                        }

                        /* Client & Invoice Info */
                        .info-section { display: flex; margin-bottom: 20px; }
                        .info-left { width: 55%; padding-right: 20px; }
                        .info-right { width: 45%; }
                        
                        .info-table { width: 100%; border-collapse: collapse; }
                        .info-table td { padding: 2px 0; vertical-align: top; font-size: 11px; }
                        .info-table .label { width: 110px; font-weight: bold; color: #444; }
                        .info-table .val { font-weight: bold; }

                        /* Shipment Details Box */
                        .shipment-box { border: 1px solid #000; margin-bottom: 20px; }
                        .shipment-header { background: #333; color: #fff; font-weight: bold; padding: 4px 8px; text-transform: uppercase; font-size: 11px; border-bottom: 1px solid #000; }
                        
                        .shipment-grid { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid #ccc; }
                        .shipment-cell { padding: 3px 6px; border-right: 1px solid #ccc; font-size: 11px; }
                        .shipment-cell:last-child { border-right: none; }
                        .shipment-cell label { display: block; font-size: 9px; color: #666; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
                        .shipment-cell span { display: block; font-weight: bold; color: #000; min-height: 12px;}
                        
                        .grid-4 { display: grid; grid-template-columns: 2fr 1fr 1fr 1.5fr; border-bottom: 1px solid #ccc; }
                        .shipment-row-border { border-bottom: 1px solid #ccc; }
                        
                        /* Charges Table */
                        .charges-table { width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 1px solid #000; }
                        .charges-table th { background: #e0e0e0; border-bottom: 1px solid #000; padding: 6px 8px; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase; }
                        .charges-table td { border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px; font-size: 11px; vertical-align: top; }
                        .charges-table td:last-child { border-right: none; }
                        .charges-table tr:last-child td { border-bottom: none; }
                        
                        /* Totals */
                        .totals-wrapper { display: flex; justify-content: flex-end; margin-bottom: 20px; }
                        .totals-box { width: 320px; border: 1px solid #000; border-top: none; }
                        .totals-row { display: flex; justify-content: space-between; padding: 6px 10px; font-weight: bold; font-size: 11px; }
                        .border-bottom { border-bottom: 1px solid #ccc; }
                        .grand-total { background: #333; color: white; padding: 10px; font-size: 13px; text-transform: uppercase; }

                        /* Footer */
                        .footer-section { display: flex; margin-top: auto; border-top: 2px solid #000; padding-top: 20px; page-break-inside: avoid; }
                        .footer-left { flex: 1; padding-right: 40px; font-size: 10px; }
                        .footer-right { width: 220px; text-align: center; }
                        .signature-line { margin-top: 70px; border-top: 1px solid #000; padding-top: 5px; font-weight: bold; font-size: 11px;}
                        
                        .bank-box { border: 1px solid #999; background: #fcfcfc; padding: 10px; margin-top: 8px; border-radius: 4px; font-size: 11px; line-height: 1.4; }
                        
                        /* Print Actions Button in New Window */
                        .print-actions { 
                            position: fixed; top: 20px; right: 20px; 
                            background: white; padding: 15px; border-radius: 8px; 
                            box-shadow: 0 4px 12px rgba(0,0,0,0.15); 
                            z-index: 1000; text-align: center;
                        }
                        .btn { 
                            padding: 10px 24px; cursor: pointer; 
                            background: #E65100; color: white; 
                            border: none; border-radius: 6px; 
                            font-weight: bold; font-size: 14px; 
                            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                        }
                        .btn:hover { background: #EF6C00; }
                        
                        @media print { 
                            .print-actions { display: none !important; } 
                            body { margin: 0; padding: 0; background-color: #fff; }
                            .container { 
                                width: 100%; max-width: none; 
                                margin: 0; padding: 0; 
                                box-shadow: none; border: none; 
                            }
                            @page { 
                                size: A4; 
                                margin: 15mm 15mm 15mm 15mm; /* Standard A4 Margins */
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-actions">
                        <button onclick="window.print()" class="btn">PRINT INVOICE</button>
                    </div>

                    <div class="container">
                        <!-- Header -->
                        <div class="header-row">
                            <div class="company-logo">
                                <h1>${companySettings?.company_name?.split(' ')[0] || 'FREIGHT'}ONE</h1>
                                <p>LOGISTICS SOLUTIONS</p>
                            </div>
                            <div class="company-address">
                                <strong>${companySettings?.company_name || 'PT. Freight One Indonesia'}</strong><br>
                                ${(companySettings?.company_address || '').replace(/\n/g, '<br>')}<br>
                                Phone: ${companySettings?.company_phone || '-'}<br>
                                Email: ${companySettings?.company_email || '-'}
                            </div>
                        </div>

                        <!-- Title -->
                        <div class="invoice-title-bar">
                            <span>TAX INVOICE ${invoice.invoice_number}</span>
                             <span style="font-size: 10px; font-weight: normal; color: #555;">Page 1 of 1</span>
                        </div>

                        <!-- Top Info -->
                        <div class="info-section">
                            <div class="info-left">
                                <div style="margin-bottom: 4px; font-weight: bold; font-size: 9px; color: #555;">BILL TO / CUSTOMER:</div>
                                <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px;">${invoice.customer_name}</div>
                                <div style="margin-bottom: 3px; font-size: 10px;">${(invoice.customer_address || '').replace(/\n/g, '<br>')}</div>
                                <div style="font-size: 10px;">Attn: ${invoice.customer_contact_name || invoice.customer_pic || '-'}</div>
                            </div>
                            <div class="info-right">
                                <table class="info-table">
                                    <tr><td class="label">INVOICE DATE</td><td class="val">: ${safeDate(invoice.invoice_date)}</td></tr>
                                    <tr><td class="label">JOB NUMBER</td><td class="val">: ${invoice.job_number}</td></tr>
                                    <tr><td class="label">DUE DATE</td><td class="val">: ${safeDate(invoice.due_date)}</td></tr>
                                    <tr><td class="label">TERMS</td><td class="val">: ${invoice.payment_terms}</td></tr>
                                    ${invoice.customer_npwp ? `<tr><td class="label">NPWP</td><td class="val">: ${invoice.customer_npwp}</td></tr>` : ''}
                                </table>
                            </div>
                        </div>

                        <!-- Shipment Details -->
                        <div class="shipment-box">
                            <div class="shipment-header">SHIPMENT DETAILS</div>
                            
                            <div class="shipment-grid">
                                <div class="shipment-cell">
                                    <label>CONSIGNOR / SHIPPER</label>
                                    <span>${safeStr(invoice.consignor || invoice.shipper_name)}</span>
                                </div>
                                <div class="shipment-cell">
                                    <label>CONSIGNEE</label>
                                    <span>${safeStr(invoice.consignee || invoice.consignee_name || invoice.customer_name)}</span>
                                </div>
                            </div>
                            
                            <div class="grid-4">
                                <div class="shipment-cell"><label>VESSEL / VOYAGE</label><span>${safeStr(invoice.vessel_name || invoice.vessel)} / ${safeStr(invoice.voyage_number || invoice.voyage)}</span></div>
                                <div class="shipment-cell"><label>ETD</label><span>${safeDate(invoice.etd)}</span></div>
                                <div class="shipment-cell"><label>ETA</label><span>${safeDate(invoice.eta)}</span></div>
                                <div class="shipment-cell"><label>REF NO</label><span>${safeStr(invoice.order_reference)}</span></div>
                            </div>

                            <div class="grid-4">
                                <div class="shipment-cell"><label>ORIGIN (POL)</label><span>${safeStr(invoice.origin)}</span></div>
                                <div class="shipment-cell"><label>DESTINATION (POD)</label><span>${safeStr(invoice.destination)}</span></div>
                                <div class="shipment-cell"><label>MASTER BL</label><span>${safeStr(invoice.ocean_bl || invoice.bl_awb_number)}</span></div>
                                <div class="shipment-cell"><label>HOUSE BL</label><span>${safeStr(invoice.house_bl)}</span></div>
                            </div>

                            <div class="grid-4">
                                <div class="shipment-cell"><label>PACKAGES</label><span>${safeStr(invoice.packages)}</span></div>
                                <div class="shipment-cell"><label>GROSS WEIGHT</label><span>${invoice.weight || 0} KGS</span></div>
                                <div class="shipment-cell"><label>MEASUREMENT</label><span>${invoice.cbm || 0} CBM</span></div>
                                <div class="shipment-cell"><label>CHG WEIGHT</label><span>${invoice.chargeable_weight || 0} KGS</span></div>
                            </div>
                            
                            <div class="shipment-row-border" style="display: grid; grid-template-columns: 2fr 1fr;">
                                <div class="shipment-cell">
                                    <label>DESCRIPTION OF GOODS</label>
                                    <span>${safeStr(invoice.goods_description)}</span>
                                </div>
                                <div class="shipment-cell" style="border-right: none;">
                                    <label>CONTAINER NOS</label>
                                    <span>${safeStr(invoice.containers)}</span>
                                </div>
                            </div>
                             <div class="shipment-cell" style="border: none;">
                                <label>IMPORT BROKER</label>
                                <span>${safeStr(invoice.import_broker)}</span>
                            </div>
                        </div>

                        <!-- Charges -->
                        <div style="margin-bottom: 2px; font-weight: bold; font-size: 11px;">CHARGES BREAKDOWN</div>
                        <table class="charges-table">
                            <thead>
                                <tr>
                                    <th style="width: 50%; text-align: left; padding-left: 10px;">DESCRIPTION</th>
                                    <th style="width: 10%; text-align: center;">CURR</th>
                                    <th style="width: 20%; text-align: right; padding-right: 10px;">AMOUNT</th>
                                    <th style="width: 20%; text-align: right; padding-right: 10px;">TAX</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${itemsRows}
                            </tbody>
                        </table>
                        
                        <div class="totals-wrapper">
                            <div class="totals-box">
                                <div class="totals-row border-bottom" style="background: #f9f9f9;">
                                    <span>SUBTOTAL</span>
                                    <span>${formatCurrency(invoice.subtotal || 0, invoice.currency)}</span>
                                </div>
                                <div class="totals-row border-bottom">
                                    <span>TAX Total (${invoice.tax_rate}%)</span>
                                    <span>${formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
                                </div>
                                 <div class="totals-row grand-total">
                                    <span>TOTAL AMOUNT DUE</span>
                                    <span>${formatCurrency(invoice.total_amount || 0, invoice.currency)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="footer-section">
                            <div class="footer-left">
                                <div class="bank-box">
                                    <b style="font-size: 11px;">PAYMENT DETAILS:</b><br><br>
                                    Please transfer to:<br>
                                    ${bankAccounts && bankAccounts.length > 0 ? bankAccounts.map(bank => `
                                        <div style="margin-bottom: 8px;">
                                            <b>${bank.bank_name} (${bank.currency || invoice.currency})</b><br>
                                            A/C No: ${bank.account_number}<br>
                                            A/N: ${bank.account_holder}<br>
                                            Branch: ${bank.branch || '-'}
                                        </div>
                                    `).join('') : `
                                        <b>BANK CENTRAL ASIA (BCA)</b><br>
                                        A/C No: 000-000-000<br>
                                        A/N: PT. BAKHTERA FREIGHT WORLDWIDE<br>
                                        Branch: KCU JAKARTA
                                    `}
                                </div>
                                
                                <div style="margin-top: 10px; font-style: italic;">
                                    <strong>Notes:</strong><br>
                                    ${safeStr(invoice.customer_notes)}
                                </div>
                            </div>
                            <div class="footer-right">
                                <b>AUTHORIZED SIGNATURE</b>
                                <br><br><br><br><br><br>
                                <div class="signature-line">
                                    ${companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE'}
                                </div>
                            </div>
                        </div>
                    </div>
                </body>
                </html>
            `;

            printWindow.document.write(printContent);
            printWindow.document.close();
        } catch (error) {
            console.error('Print error:', error);
            alert('Error generating print preview');
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
                        companySettings={companySettings}
                        bankAccounts={bankAccounts}
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


                    {/* Extended Shipment Details for Print */}
                    <div className="glass-card p-3 rounded-lg border border-dark-border/50">
                        <h3 className="text-xs font-semibold text-accent-orange mb-3 flex items-center gap-2">
                            Shipment Details (For Print Output)
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Consignor / Shipper</label>
                                <input
                                    type="text"
                                    value={formData.consignor}
                                    onChange={(e) => setFormData(prev => ({ ...prev, consignor: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                    placeholder="Shipper Name"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Consignee</label>
                                <input
                                    type="text"
                                    value={formData.consignee}
                                    onChange={(e) => setFormData(prev => ({ ...prev, consignee: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                    placeholder="Consignee Name"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">Vessel Name</label>
                                <input
                                    type="text"
                                    value={formData.vessel_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, vessel_name: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">Voyage No.</label>
                                <input
                                    type="text"
                                    value={formData.voyage_number}
                                    onChange={(e) => setFormData(prev => ({ ...prev, voyage_number: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">Ocean BL (MBL)</label>
                                <input
                                    type="text"
                                    value={formData.ocean_bl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, ocean_bl: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">House BL (HBL)</label>
                                <input
                                    type="text"
                                    value={formData.house_bl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, house_bl: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">ETD</label>
                                <input
                                    type="date"
                                    value={formData.etd}
                                    onChange={(e) => setFormData(prev => ({ ...prev, etd: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">ETA</label>
                                <input
                                    type="date"
                                    value={formData.eta}
                                    onChange={(e) => setFormData(prev => ({ ...prev, eta: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">Chargeable W (Kg)</label>
                                <input
                                    type="number"
                                    value={formData.chargeable_weight}
                                    onChange={(e) => setFormData(prev => ({ ...prev, chargeable_weight: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] text-silver-dark mb-1">Packages</label>
                                <input
                                    type="text"
                                    value={formData.packages}
                                    onChange={(e) => setFormData(prev => ({ ...prev, packages: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                    placeholder="e.g. 10 CTNS"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Goods Description</label>
                                <input
                                    type="text"
                                    value={formData.goods_description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, goods_description: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Containers</label>
                                <input
                                    type="text"
                                    value={formData.containers}
                                    onChange={(e) => setFormData(prev => ({ ...prev, containers: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                    placeholder="e.g. 1x20GP, 1x40HQ"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Order Ref / PO #</label>
                                <input
                                    type="text"
                                    value={formData.order_reference}
                                    onChange={(e) => setFormData(prev => ({ ...prev, order_reference: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                            <div className="col-span-1 md:col-span-2">
                                <label className="block text-[10px] text-silver-dark mb-1">Import Customs Broker</label>
                                <input
                                    type="text"
                                    value={formData.import_broker}
                                    onChange={(e) => setFormData(prev => ({ ...prev, import_broker: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                />
                            </div>
                        </div>
                    </div>

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

// Print Preview Modal Component - Updated to match handlePrintInvoice layout
const PrintPreviewModal = ({ invoice, formatCurrency, onClose, onPrint, companySettings, bankAccounts }) => {

    // Helper for empty fields default
    const safeStr = (str) => str || '-';
    const safeDate = (date) => date ? new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold gradient-text">Print Preview</h2>
                    <div className="flex gap-2">
                        <button
                            onClick={onPrint}
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

                {/* Print-friendly invoice content - WYSIWYG with handlePrintInvoice */}
                <div className="bg-white text-black p-8 rounded-lg shadow-inner overflow-x-auto">
                    <div style={{ fontFamily: "'Arimo', Arial, sans-serif", fontSize: '11px', color: '#000', width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '15mm', backgroundColor: '#fff', boxSizing: 'border-box', position: 'relative' }}>

                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'flex-start' }}>
                            <div className="company-logo">
                                <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', fontStyle: 'italic', color: '#000' }}>
                                    {companySettings?.company_name?.split(' ')[0] || 'FREIGHT'}ONE
                                </h1>
                                <p style={{ margin: 0, fontSize: '8px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase' }}>LOGISTICS SOLUTIONS</p>
                            </div>
                            <div style={{ textAlign: 'right', fontSize: '9px', lineHeight: '1.4', color: '#333' }}>
                                <strong>{companySettings?.company_name || 'PT. Freight One Indonesia'}</strong><br />
                                {(companySettings?.company_address || '').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
                                Phone: {companySettings?.company_phone || '-'}<br />
                                Email: {companySettings?.company_email || '-'}
                            </div>
                        </div>

                        {/* Invoice Title Bar */}
                        <div style={{
                            borderTop: '2px solid #000', borderBottom: '2px solid #000',
                            backgroundColor: '#f0f0f0', padding: '8px 10px', marginBottom: '15px',
                            fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span>TAX INVOICE {invoice.invoice_number}</span>
                            <span style={{ fontSize: '10px', fontWeight: 'normal', color: '#555' }}>Page 1 of 1</span>
                        </div>

                        {/* Top Info */}
                        <div style={{ display: 'flex', marginBottom: '25px' }}>
                            <div style={{ width: '55%', paddingRight: '20px' }}>
                                <div style={{ marginBottom: '4px', fontWeight: 'bold', fontSize: '9px', color: '#555' }}>BILL TO / CUSTOMER:</div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>{invoice.customer_name}</div>
                                <div style={{ marginBottom: '3px', fontSize: '11px' }}>{(invoice.customer_address || '').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}</div>
                                <div style={{ fontSize: '11px' }}>Attn: {invoice.customer_contact_name || invoice.customer_pic || '-'}</div>
                            </div>
                            <div style={{ width: '45%' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        <tr><td style={{ width: '120px', fontWeight: 'bold', color: '#444', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>INVOICE DATE</td><td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>: {safeDate(invoice.invoice_date)}</td></tr>
                                        <tr><td style={{ fontWeight: 'bold', color: '#444', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>JOB NUMBER</td><td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>: {invoice.job_number}</td></tr>
                                        <tr><td style={{ fontWeight: 'bold', color: '#444', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>DUE DATE</td><td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>: {safeDate(invoice.due_date)}</td></tr>
                                        <tr><td style={{ fontWeight: 'bold', color: '#444', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>TERMS</td><td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>: {invoice.payment_terms}</td></tr>
                                        {invoice.customer_npwp && (
                                            <tr><td style={{ fontWeight: 'bold', color: '#444', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>NPWP</td><td style={{ fontWeight: 'bold', padding: '4px 0', verticalAlign: 'top', fontSize: '11px' }}>: {invoice.customer_npwp}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Shipment Details Box */}
                        <div style={{ border: '1px solid #000', marginBottom: '20px' }}>
                            <div style={{ background: '#333', color: '#fff', fontWeight: 'bold', padding: '4px 8px', textTransform: 'uppercase', fontSize: '11px', borderBottom: '1px solid #000' }}>
                                SHIPMENT DETAILS
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #ccc' }}>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}>
                                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>CONSIGNOR / SHIPPER</label>
                                    <span style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#000', minHeight: '12px' }}>{safeStr(invoice.consignor || invoice.shipper_name)}</span>
                                </div>
                                <div style={{ padding: '3px 6px' }}>
                                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>CONSIGNEE</label>
                                    <span style={{ display: 'block', fontWeight: 'bold', fontSize: '11px', color: '#000', minHeight: '12px' }}>{safeStr(invoice.consignee || invoice.consignee_name || invoice.customer_name)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', borderBottom: '1px solid #ccc' }}>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>VESSEL / VOYAGE</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.vessel_name || invoice.vessel)} / {safeStr(invoice.voyage_number || invoice.voyage)}</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>ETD</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeDate(invoice.etd)}</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>ETA</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeDate(invoice.eta)}</span></div>
                                <div style={{ padding: '3px 6px' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>REF NO</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.order_reference)}</span></div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', borderBottom: '1px solid #ccc' }}>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>ORIGIN (POL)</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.origin)}</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>DESTINATION (POD)</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.destination)}</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>MASTER BL</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.ocean_bl || invoice.bl_awb_number)}</span></div>
                                <div style={{ padding: '3px 6px' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>HOUSE BL</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.house_bl)}</span></div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', borderBottom: '1px solid #ccc' }}>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>PACKAGES</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.packages)}</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>GROSS WEIGHT</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{invoice.weight || 0} KGS</span></div>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>MEASUREMENT</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{invoice.cbm || 0} CBM</span></div>
                                <div style={{ padding: '3px 6px' }}><label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>CHG WEIGHT</label><span style={{ fontWeight: 'bold', fontSize: '11px' }}>{invoice.chargeable_weight || 0} KGS</span></div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: '1px solid #ccc' }}>
                                <div style={{ padding: '3px 6px', borderRight: '1px solid #ccc' }}>
                                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>DESCRIPTION OF GOODS</label>
                                    <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.goods_description)}</span>
                                </div>
                                <div style={{ padding: '3px 6px' }}>
                                    <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>CONTAINER NOS</label>
                                    <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.containers)}</span>
                                </div>
                            </div>

                            <div style={{ padding: '3px 6px' }}>
                                <label style={{ display: 'block', fontSize: '9px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '2px' }}>IMPORT BROKER</label>
                                <span style={{ fontWeight: 'bold', fontSize: '11px' }}>{safeStr(invoice.import_broker)}</span>
                            </div>
                        </div>

                        {/* Charges Table */}
                        <div style={{ marginBottom: '2px', fontWeight: 'bold', fontSize: '11px' }}>CHARGES BREAKDOWN</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px', border: '1px solid #000' }}>
                            <thead>
                                <tr>
                                    <th style={{ background: '#e0e0e0', borderBottom: '1px solid #000', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '11px', width: '50%', paddingLeft: '10px' }}>DESCRIPTION</th>
                                    <th style={{ background: '#e0e0e0', borderBottom: '1px solid #000', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', width: '10%' }}>CURR</th>
                                    <th style={{ background: '#e0e0e0', borderBottom: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', width: '20%', paddingRight: '10px' }}>AMOUNT</th>
                                    <th style={{ background: '#e0e0e0', borderBottom: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', width: '20%', paddingRight: '10px' }}>TAX</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.invoice_items && invoice.invoice_items.length > 0 ? (
                                    invoice.invoice_items.map((item, index) => (
                                        <tr key={index}>
                                            <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textTransform: 'capitalize' }}>{item.description}</td>
                                            <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'center' }}>{invoice.currency}</td>
                                            <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>{formatCurrency(item.amount || 0, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                                            <td style={{ borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>{formatCurrency((item.amount || 0) * (invoice.tax_rate || 0) / 100, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px', fontSize: '11px' }}>No items</td></tr>
                                )}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <div style={{ width: '320px', border: '1px solid #000', borderTop: 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #ccc', background: '#f9f9f9' }}>
                                    <span>SUBTOTAL</span>
                                    <span>{formatCurrency(invoice.subtotal || 0, invoice.currency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #ccc' }}>
                                    <span>TAX Total ({invoice.tax_rate}%)</span>
                                    <span>{formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', fontWeight: 'bold', fontSize: '13px', background: '#333', color: 'white' }}>
                                    <span>TOTAL AMOUNT DUE</span>
                                    <span>{formatCurrency(invoice.total_amount || 0, invoice.currency)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', marginTop: 'auto', borderTop: '2px solid #000', paddingTop: '20px' }}>
                            <div style={{ flex: '1', paddingRight: '40px', fontSize: '10px' }}>
                                <div style={{ border: '1px solid #999', background: '#fcfcfc', padding: '10px', marginTop: '8px', borderRadius: '4px' }}>
                                    <b style={{ fontSize: '11px' }}>PAYMENT DETAILS:</b><br /><br />
                                    Please transfer to:<br />
                                    {bankAccounts && bankAccounts.length > 0 ? bankAccounts.map((bank, index) => (
                                        <div key={index} style={{ marginBottom: '8px' }}>
                                            <b>{bank.bank_name} ({bank.currency || invoice.currency})</b><br />
                                            A/C No: {bank.account_number}<br />
                                            A/N: {bank.account_holder}<br />
                                            Branch: {bank.branch || '-'}<br />
                                        </div>
                                    )) : (
                                        <>
                                            <b>BANK CENTRAL ASIA (BCA)</b><br />
                                            A/C No: 000-000-000<br />
                                            A/N: PT. BAKHTERA FREIGHT WORLDWIDE<br />
                                            Branch: KCU JAKARTA
                                        </>
                                    )}
                                </div>

                                <div style={{ marginTop: '10px', fontStyle: 'italic' }}>
                                    <strong>Notes:</strong><br />
                                    {safeStr(invoice.customer_notes)}
                                </div>
                            </div>
                            <div style={{ width: '200px', textAlign: 'center' }}>
                                <b>AUTHORIZED SIGNATURE</b>
                                <br /><br /><br /><br /><br /><br />
                                <div style={{ marginTop: '70px', borderTop: '1px solid #000', paddingTop: '5px', fontWeight: 'bold', fontSize: '11px' }}>
                                    {companySettings?.company_name || 'PT. BAKHTERA FREIGHT WORLDWIDE'}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default InvoiceManagement;
