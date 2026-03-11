import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { generateInvoiceNumber } from '../../utils/documentNumbers';
import { getCurrencySymbol } from '../../utils/currencyFormatter';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import COAPicker from '../../components/Common/COAPicker';
import {
    FileText, DollarSign, Calendar, User, Clock, CheckCircle, XCircle,
    Plus, Send, AlertCircle, Download, Eye, Edit, Trash, Receipt,
    TrendingUp, AlertTriangle, Search, Filter, X, Package, Circle, PlaySquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import InvoiceProfitSummary from '../../components/Blink/InvoiceProfitSummary';


const InvoiceManagement = () => {
    const navigate = useNavigate();
    const { canCreate, canEdit, canDelete, canApprove } = useAuth();
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
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [addItemInvoice, setAddItemInvoice] = useState(null);
    const [previewInvoiceData, setPreviewInvoiceData] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [referenceType, setReferenceType] = useState('quotation'); // 'quotation' or 'so'
    const [revenueAccounts, setRevenueAccounts] = useState([]);
    const [confirmSubmitAction, setConfirmSubmitAction] = useState(null);
    const [successSubmitMsg, setSuccessSubmitMsg] = useState('');

    // Form state for creating invoice
    const [formData, setFormData] = useState({
        quotation_id: '',
        job_number: '',
        payment_terms: 'NET 30',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        billing_currency: 'IDR',
        exchange_rate: 1,
        payment_bank_id: '',  // Selected bank account for payment
        invoice_items: [
            { item_name: 'Freight', description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null }
        ],
        cogs_items: [],  // COGS items from shipment buying_items
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
        fetchRevenueAccounts();
    }, []);

    const fetchRevenueAccounts = async () => {
        try {
            const { data, error } = await supabase
                .from('finance_coa')
                .select('*')
                .eq('type', 'REVENUE')
                .order('code');
            if (!error && data) {
                setRevenueAccounts(data);
            }
        } catch (error) {
            console.error('Error fetching revenue accounts:', error);
        }
    };

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
                        item_name: revenueAccounts.find(acc => acc.code === item.itemCode)?.name || item.itemCode || item.name || item.service_name || 'Item',
                        description: item.description || item.name || '',
                        qty: parseFloat(item.quantity) || parseFloat(item.qty) || 1,
                        unit: item.unit || 'Job',
                        rate: parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.rate) || 0,
                        amount: parseFloat(item.amount) || parseFloat(item.total) ||
                            ((parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.rate) || 0)),
                        currency: item.currency || quotation.currency || 'IDR'
                    }))
                    : [{
                        item_name: (quotation.serviceType || quotation.service_type || 'Freight').toUpperCase(),
                        description: `${(quotation.serviceType || quotation.service_type || 'Freight').toUpperCase()} - ${quotation.origin} to ${quotation.destination}`,
                        qty: 1,
                        unit: 'Job',
                        rate: quotation.totalAmount || quotation.total_amount || 0,
                        amount: quotation.totalAmount || quotation.total_amount || 0,
                        currency: quotation.currency || 'IDR'
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
                    item_name: (shipment.service_type || 'Freight').toUpperCase(),
                    description: `${(shipment.service_type || 'Freight').toUpperCase()} - ${shipment.origin} to ${shipment.destination}`,
                    qty: 1,
                    unit: 'Shipment',
                    rate: shipment.quoted_amount || 0,
                    amount: shipment.quoted_amount || 0
                }],
                // Extract COGS from shipment buying_items and old cogs JSON
                cogs_items: (() => {
                    const extractedItems = [];
                    // 1. From Buying Items
                    if (shipment.buying_items && Array.isArray(shipment.buying_items)) {
                        shipment.buying_items.forEach(item => {
                            extractedItems.push({
                                description: item.description || item.name || 'Cost Item',
                                qty: item.quantity || item.qty || 1,
                                unit: item.unit || 'Job',
                                rate: item.unitPrice || item.rate || item.price || 0,
                                amount: item.total || item.amount || 0,
                                vendor: item.vendor || item.supplier || '',
                                currency: item.currency || shipment.currency || 'IDR'
                            });
                        });
                    }

                    // 2. From Old COGS Box Format (cogs Object)
                    if (shipment.cogs && typeof shipment.cogs === 'object') {
                        const cogsCurrency = shipment.cogsCurrency || shipment.cogs_currency || shipment.currency || 'IDR';

                        const parseVal = (val) => {
                            const parsed = parseFloat(String(val || 0).replace(/,/g, ''));
                            return isNaN(parsed) ? 0 : parsed;
                        };

                        const predefinedFields = [
                            { key: 'oceanFreight', label: 'Ocean Freight' },
                            { key: 'airFreight', label: 'Air Freight' },
                            { key: 'trucking', label: 'Trucking' },
                            { key: 'thc', label: 'THC' },
                            { key: 'documentation', label: 'Documentation' },
                            { key: 'customs', label: 'Customs Clearance' },
                            { key: 'insurance', label: 'Insurance' },
                            { key: 'demurrage', label: 'Demurrage' },
                            { key: 'other', label: shipment.cogs.otherDescription || 'Other Charges' }
                        ];

                        predefinedFields.forEach(field => {
                            const amount = parseVal(shipment.cogs[field.key]);
                            if (amount > 0) {
                                extractedItems.push({
                                    description: field.label,
                                    qty: 1,
                                    unit: 'Job',
                                    rate: amount,
                                    amount: amount,
                                    vendor: '',
                                    currency: cogsCurrency
                                });
                            }
                        });

                        // 3. Additional costs inside old COGS JSON
                        if (shipment.cogs.additionalCosts && Array.isArray(shipment.cogs.additionalCosts)) {
                            shipment.cogs.additionalCosts.forEach(add => {
                                const amount = parseVal(add.amount);
                                if (amount > 0 && add.description) {
                                    extractedItems.push({
                                        description: add.description,
                                        qty: 1,
                                        unit: 'Job',
                                        rate: amount,
                                        amount: amount,
                                        vendor: '',
                                        currency: cogsCurrency
                                    });
                                }
                            });
                        }
                    }

                    return extractedItems;
                })(),
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
                { item_name: '', description: '', qty: 1, unit: 'Job', rate: 0, amount: 0, currency: prev.billing_currency || 'IDR' }
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
        const subtotal = formData.invoice_items.reduce((sum, item) => {
            let itemVal = item.amount || 0;
            const itemCurr = item.currency || formData.billing_currency;
            if (itemCurr !== formData.billing_currency) {
                if (formData.billing_currency === 'IDR' && itemCurr !== 'IDR') itemVal *= (formData.exchange_rate || 16000);
                else if (formData.billing_currency !== 'IDR' && itemCurr === 'IDR') itemVal /= (formData.exchange_rate || 16000);
                // simplified mapping for USD/SGD vs IDR assuming IDR is base for non-matching ones except same
            }
            return sum + itemVal;
        }, 0);
        const taxAmount = (subtotal * formData.tax_rate) / 100;
        const total = subtotal + taxAmount - (formData.discount_amount || 0);

        // Calculate COGS
        const cogsSubtotal = (formData.cogs_items || []).reduce((sum, item) => sum + (item.amount || 0), 0);
        const grossProfit = total - cogsSubtotal;
        const profitMargin = total > 0 ? (grossProfit / total) * 100 : 0;

        return { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin };
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
            // 1. Check if active invoice already exists for this job + currency combination
            // Check by job_number ensures no duplicates per job, instead of just checking quotation/shipment IDs
            if (formData.job_number) {
                const { data: allInvoices, error: allCheckError } = await supabase
                    .from('blink_invoices')
                    .select('id, invoice_number, status, currency')
                    .eq('job_number', formData.job_number)
                    .neq('status', 'cancelled');

                if (allCheckError) throw allCheckError;

                const selectedCurrency = formData.billing_currency || 'IDR';
                const existingCurrencyInvoices = (allInvoices || []).filter(inv => inv.currency === selectedCurrency);

                if (existingCurrencyInvoices.length > 0) {
                    const activeInv = existingCurrencyInvoices[0];
                    alert(`Cannot create invoice: An active ${selectedCurrency} invoice (${activeInv.invoice_number}) already exists for Job ${formData.job_number}.\n\nNote: You can create a maximum of 2 invoices per job (1 IDR + 1 USD). Please cancel the existing invoice first if you need to create a replacement.`);
                    return;
                }

                const existingCurrencies = [...new Set((allInvoices || []).map(inv => inv.currency))];

                // If there are already 2 currencies and this is a new one, block it
                if (existingCurrencies.length >= 2 && !existingCurrencies.includes(selectedCurrency)) {
                    alert(`Cannot create invoice: This job already has invoices in ${existingCurrencies.join(' and ')}.\n\nMaximum 2 currencies (IDR and USD) are allowed per job.`);
                    return;
                }
            }

            const { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin } = calculateTotals();

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
                status: 'unpaid',
                // Selected payment bank account
                payment_bank_id: formData.payment_bank_id || null,
                // COGS and Profit fields
                cogs_items: formData.cogs_items || [],
                cogs_subtotal: cogsSubtotal,
                gross_profit: grossProfit,
                profit_margin: profitMargin,
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

            const insertedInvoice = data[0];

            // Auto Journal Entry for AR & Revenue
            try {
                const batchId = crypto.randomUUID();
                const entryNum = `JE-INV-${new Date().toISOString().slice(2, 7).replace('-', '')}-${Date.now().toString().slice(-6)}`;
                const billDate = insertedInvoice.invoice_date || new Date().toISOString().split('T')[0];

                const [{ data: arCoas }, { data: revCoas }] = await Promise.all([
                    supabase.from('finance_coa').select('id, code, name').eq('type', 'ASSET').ilike('name', '%receivable%').limit(1),
                    supabase.from('finance_coa').select('id, code, name').eq('type', 'REVENUE').ilike('name', '%freight%').limit(1)
                ]);
                const arCoa = arCoas?.[0] || { code: '1-01-400-0-1-00', name: 'ACCOUNT RECEIVABLE', id: null };
                const revCoa = revCoas?.[0] || { code: '4-01-301-0-1-00', name: 'OCEAN FREIGHT', id: null };

                const idrNote = insertedInvoice.currency !== 'IDR' ? ` (Rate: ${insertedInvoice.exchange_rate || 16000})` : '';
                const exRate = insertedInvoice.exchange_rate || 16000;

                const debitEntry = {
                    entry_number: entryNum + '-D',
                    entry_date: billDate,
                    entry_type: 'invoice',
                    reference_type: 'ar',
                    reference_id: insertedInvoice.id,
                    reference_number: insertedInvoice.invoice_number,
                    account_code: arCoa.code,
                    account_name: `${arCoa.name} - ${insertedInvoice.customer_name}`,
                    debit: insertedInvoice.total_amount,
                    credit: 0,
                    currency: insertedInvoice.currency || 'IDR',
                    exchange_rate: exRate,
                    description: 'Invoice ' + insertedInvoice.invoice_number + ' - ' + insertedInvoice.customer_name + idrNote,
                    batch_id: batchId,
                    source: 'auto',
                    coa_id: arCoa.id,
                    party_name: insertedInvoice.customer_name
                };

                const creditEntry = {
                    entry_number: entryNum + '-C',
                    entry_date: billDate,
                    entry_type: 'invoice',
                    reference_type: 'ar',
                    reference_id: insertedInvoice.id,
                    reference_number: insertedInvoice.invoice_number,
                    account_code: revCoa.code,
                    account_name: `${revCoa.name} - ${insertedInvoice.customer_name}`,
                    debit: 0,
                    credit: insertedInvoice.total_amount,
                    currency: insertedInvoice.currency || 'IDR',
                    exchange_rate: exRate,
                    description: 'Invoice ' + insertedInvoice.invoice_number + ' - ' + insertedInvoice.customer_name + idrNote,
                    batch_id: batchId,
                    source: 'auto',
                    coa_id: revCoa.id,
                    party_name: insertedInvoice.customer_name
                };

                const { error: journalError } = await supabase.from('blink_journal_entries').insert([debitEntry, creditEntry]);
                if (journalError) console.error('Error creating journal entries for invoice:', journalError);
            } catch (jeError) {
                console.warn('Journal entry creation failed:', jeError.message);
            }

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
            payment_bank_id: '',
            invoice_items: [
                { item_name: 'Freight', description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null }
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
        return `${getCurrencySymbol(currency)} ${Number(value || 0).toLocaleString('id-ID')}`;
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
                                    ${(() => {
                                        // Show only selected bank if set, otherwise show all banks
                                        const selectedBank = invoice.payment_bank_id
                                            ? (bankAccounts || []).find(b => b.id === invoice.payment_bank_id)
                                            : null;
                                        const banksToShow = selectedBank 
                                            ? [selectedBank] 
                                            : (bankAccounts || []).filter(b => b.currency === invoice.currency || (!b.currency && invoice.currency === 'IDR'));
                                        return banksToShow.length > 0 ? banksToShow.map(bank => `
                                            <div style="margin-bottom: 8px;">
                                                <b>${bank.bank_name} (${bank.currency || invoice.currency})</b><br>
                                                A/C No: ${bank.account_number}<br>
                                                A/N: ${bank.account_holder}<br>
                                                ${bank.branch ? `Branch: ${bank.branch}<br>` : ''}
                                                ${bank.swift_code ? `SWIFT: ${bank.swift_code}` : ''}
                                            </div>
                                        `).join('') : `
                                            <b>BANK CENTRAL ASIA (BCA)</b><br>
                                            A/C No: 000-000-000<br>
                                            A/N: PT. BAKHTERA FREIGHT WORLDWIDE<br>
                                            Branch: KCU JAKARTA
                                        `;
                                    })()}
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
        if (!canCreate('blink_invoices') && !canEdit('blink_invoices')) {
            alert('You do not have permission to submit invoices.');
            return;
        }
        setConfirmSubmitAction(invoice);
    };

    const confirmAndProcessSubmit = async () => {
        if (!confirmSubmitAction) return;
        const invoice = confirmSubmitAction;
        setConfirmSubmitAction(null);

        try {
            console.log('Submitting invoice for approval:', invoice.invoice_number, 'ID:', invoice.id, 'Current status:', invoice.status);

            const { data, error } = await supabase
                .from('blink_invoices')
                .update({ status: 'manager_approval', updated_at: new Date().toISOString() })
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

            // Refetch or update local state
            await fetchInvoices();
            if (showViewModal && selectedInvoice?.id === invoice.id) {
                setSelectedInvoice({ ...selectedInvoice, status: 'manager_approval' });
            }

            setSuccessSubmitMsg('✅ Invoice successfully submitted! Managers can review and approve it in the Approval Center.');
            setTimeout(() => setSuccessSubmitMsg(''), 3000);
        } catch (error) {
            console.error('Error submitting invoice:', error);
            alert('Failed to submit invoice: ' + error.message);
        }
    };

    // ── Add Item to Existing Invoice ────────────────────────────────────────────
    // Works for any status, including paid. After adding, status resets to draft.
    // Also syncs changes to linked Quotation (service_items) and Shipment (selling_items).
    const handleAddItemToInvoice = async (invoice, newItems, amendmentNote) => {
        if (!canEdit('blink_invoices')) {
            alert('Anda tidak memiliki hak akses untuk memanipulasi (Edit) invoice.');
            return;
        }
        try {
            const taxRate = invoice.tax_rate || 0;
            const discountAmount = invoice.discount_amount || 0;

            // Merge existing + new items
            const existingItems = invoice.invoice_items || [];
            const mergedItems = [...existingItems, ...newItems];

            // Recalculate totals
            const newSubtotal = mergedItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            const newTaxAmount = (newSubtotal * taxRate) / 100;
            const newTotal = newSubtotal + newTaxAmount - discountAmount;

            // Outstanding = new total minus what's already been paid
            const alreadyPaid = invoice.paid_amount || 0;
            const newOutstanding = Math.max(0, newTotal - alreadyPaid);

            // Build amendment notes
            const timestamp = new Date().toISOString();
            const prevNote = invoice.notes || '';
            const amendNote = `[AMENDMENT ${timestamp.slice(0, 10)}] ${amendmentNote || 'Item(s) added by user'}. Previous total: ${invoice.total_amount}, New total: ${newTotal}.`;
            const updatedNotes = prevNote ? `${prevNote}\n${amendNote}` : amendNote;

            // ── 1. Update Invoice ──────────────────────────────────────────────
            const { data, error } = await supabase
                .from('blink_invoices')
                .update({
                    invoice_items: mergedItems,
                    subtotal: newSubtotal,
                    tax_amount: newTaxAmount,
                    total_amount: newTotal,
                    outstanding_amount: newOutstanding,
                    status: 'draft',          // Reset to draft — requires re-approval
                    notes: updatedNotes,
                    updated_at: timestamp,
                })
                .eq('id', invoice.id)
                .select();

            if (error) throw error;

            // ── 2. Update AR outstanding if it exists ──────────────────────────
            await supabase
                .from('blink_ar_transactions')
                .update({
                    original_amount: newTotal,
                    outstanding_amount: newOutstanding,
                    status: newOutstanding <= 0 ? 'paid' : alreadyPaid > 0 ? 'partial' : 'outstanding',
                })
                .eq('invoice_id', invoice.id);

            // ── 3. Sync to linked Quotation (service_items + total_amount) ─────
            // Map invoice items → quotation service_items format
            const serviceItemsForQuotation = mergedItems.map(item => ({
                description: item.item_name || item.description || '',
                item_name: item.item_name || '',
                qty: parseFloat(item.qty) || 1,
                unit: item.unit || 'Job',
                rate: parseFloat(item.rate) || 0,
                amount: parseFloat(item.amount) || 0,
                coa_id: item.coa_id || null,
            }));

            const updatedInvoice = data?.[0] || invoice;

            if (updatedInvoice.quotation_id) {
                try {
                    const { error: qError } = await supabase
                        .from('blink_quotations')
                        .update({
                            service_items: serviceItemsForQuotation,
                            total_amount: newSubtotal, // Quotation uses subtotal (pre-tax)
                            updated_at: timestamp,
                        })
                        .eq('id', updatedInvoice.quotation_id);

                    if (qError) {
                        console.warn('Quotation sync failed (non-critical):', qError.message);
                    } else {
                        console.log('✅ Quotation synced:', updatedInvoice.quotation_id);
                    }
                } catch (qErr) {
                    console.warn('Error syncing to quotation:', qErr.message);
                }
            }

            // ── 4. Sync to linked Shipment (selling_items) ─────────────────────
            if (updatedInvoice.shipment_id) {
                try {
                    const { error: sError } = await supabase
                        .from('blink_shipments')
                        .update({
                            selling_items: serviceItemsForQuotation,
                            updated_at: timestamp,
                        })
                        .eq('id', updatedInvoice.shipment_id);

                    if (sError) {
                        console.warn('Shipment sync failed (non-critical):', sError.message);
                    } else {
                        console.log('✅ Shipment selling_items synced:', updatedInvoice.shipment_id);
                    }
                } catch (sErr) {
                    console.warn('Error syncing to shipment:', sErr.message);
                }
            }

            // ── 5. Also sync to SO if so_number is available ───────────────────
            // SO is identified by so_number in blink_sales_orders or similar table
            if (updatedInvoice.so_number) {
                try {
                    const { error: soError } = await supabase
                        .from('blink_sales_orders')
                        .update({
                            order_items: serviceItemsForQuotation,
                            total_amount: newSubtotal,
                            updated_at: timestamp,
                        })
                        .eq('so_number', updatedInvoice.so_number);

                    if (soError) {
                        // Table might not exist — that's OK, log and continue
                        console.warn('SO sync skipped:', soError.message);
                    } else {
                        console.log('✅ SO synced:', updatedInvoice.so_number);
                    }
                } catch (soErr) {
                    console.warn('Error syncing to SO:', soErr.message);
                }
            }

            const syncedModules = [];
            if (updatedInvoice.quotation_id) syncedModules.push('Quotation');
            if (updatedInvoice.shipment_id) syncedModules.push('Shipment');
            if (updatedInvoice.so_number) syncedModules.push('SO');
            const syncInfo = syncedModules.length > 0 ? `\n\n📋 Also synced to: ${syncedModules.join(', ')}` : '';

            alert(`✅ Item(s) added successfully!\n\nNew Total: ${formatCurrency(newTotal, invoice.currency)}\nAlready Paid: ${formatCurrency(alreadyPaid, invoice.currency)}\nNew Outstanding: ${formatCurrency(newOutstanding, invoice.currency)}\n\n⚠️ Invoice status reset to Draft — please re-approve.${syncInfo}`);

            await fetchInvoices();
            setShowAddItemModal(false);
            setAddItemInvoice(null);
            setShowViewModal(false);
            setSelectedInvoice(null);
        } catch (error) {
            console.error('Error adding item to invoice:', error);
            alert('Failed to add item: ' + error.message);
        }
    };



    const filteredInvoices = invoices.filter(inv => {
        const matchesFilter = filter === 'all' || inv.status === filter;
        const matchesSearch = !searchTerm ||
            inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    // Calculate summary stats
    const totalRevenue = invoices.reduce((sum, inv) =>
        inv.status !== 'cancelled' ? sum + (inv.total_amount || 0) : sum, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;

    const handleExportXLS = () => {
        import('../../utils/exportXLS').then(({ exportToXLS }) => {
            const headerRows = [
                { value: companySettings?.company_name || 'PT Bakhtera Satu Indonesia', style: 'company' },
                { value: 'INVOICE REPORT', style: 'title' },
                { value: `Report Date: ${new Date().toLocaleDateString('id-ID')}`, style: 'normal' },
                ''
            ];

            const xlsColumns = [
                { header: 'No', key: 'no', width: 5, align: 'center' },
                { header: 'Invoice #', key: 'invoice_number', width: 20 },
                { header: 'Job Number', key: 'job_number', width: 20 },
                { header: 'Customer', key: 'customer_name', width: 25 },
                { header: 'Date', key: 'invoice_date', width: 15 },
                { header: 'Due Date', key: 'due_date', width: 15 },
                {
                    header: 'Amount',
                    key: 'total_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${(item.total_amount || 0).toLocaleString('id-ID')}`
                },
                {
                    header: 'Outstanding',
                    key: 'outstanding_amount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${(item.outstanding_amount || 0).toLocaleString('id-ID')}`
                },
                { header: 'Status', key: 'status', width: 15 }
            ];

            exportToXLS(filteredInvoices, `Invoice_Report_${new Date().toISOString().split('T')[0]}`, headerRows, xlsColumns);
        }).catch(err => console.error("Failed to load export utility", err));
    };

    // --- Dev Temp Migration ---
    const [isMigrating, setIsMigrating] = useState(false);
    const runMigration = async () => {
        if (!confirm('Run auto-journal migration for historical invoices?')) return;
        setIsMigrating(true);
        try {
            const { data: allInvoices, error: invError } = await supabase
                .from('blink_invoices')
                .select('*')
                .neq('status', 'draft')
                .neq('status', 'cancelled');
            if (invError) throw invError;

            const { data: currentJournals, error: jeError } = await supabase
                .from('blink_journal_entries')
                .select('reference_id')
                .eq('reference_type', 'ar');
            if (jeError) throw jeError;

            const existingIds = new Set(currentJournals.map(je => je.reference_id));
            const toMigrate = allInvoices
                .filter(inv => !existingIds.has(inv.id))
                .sort((a, b) => new Date(b.created_at || b.invoice_date) - new Date(a.created_at || a.invoice_date))
                .slice(0, 2);

            if (toMigrate.length === 0) {
                alert('All invoices already migrated!');
                setIsMigrating(false);
                return;
            }

            const [{ data: arCoas }, { data: revCoas }] = await Promise.all([
                supabase.from('finance_coa').select('id, code, name').eq('type', 'ASSET').ilike('name', '%receivable%').limit(1),
                supabase.from('finance_coa').select('id, code, name').eq('type', 'REVENUE').ilike('name', '%freight%').limit(1)
            ]);
            const arCoa = arCoas?.[0] || { code: '1-01-400-0-1-00', name: 'ACCOUNT RECEIVABLE', id: null };
            const revCoa = revCoas?.[0] || { code: '4-01-301-0-1-00', name: 'OCEAN FREIGHT', id: null };

            let entriesToInsert = [];
            for (const inv of toMigrate) {
                // Generate a simple UUID fallback since crypto might not be available in browser
                const batchId = '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c =>
                    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
                );
                const dStr = new Date().toISOString().slice(2, 7).replace('-', '');
                const entryNum = `JE-MIG-${dStr}-${Math.floor(Math.random() * 100000).toString().padStart(6, '0')}`;
                const billDate = inv.invoice_date || new Date().toISOString().split('T')[0];
                const exRate = inv.exchange_rate || 16000;

                entriesToInsert.push({
                    entry_number: entryNum + '-D', entry_date: billDate, entry_type: 'invoice', reference_type: 'ar',
                    reference_id: inv.id, reference_number: inv.invoice_number, account_code: arCoa.code,
                    account_name: `${arCoa.name} - ${inv.customer_name}`, debit: inv.total_amount, credit: 0,
                    currency: inv.currency || 'IDR', exchange_rate: exRate, description: `Invoice ${inv.invoice_number}`,
                    batch_id: batchId, source: 'auto', coa_id: arCoa.id, party_name: inv.customer_name
                });
                entriesToInsert.push({
                    entry_number: entryNum + '-C', entry_date: billDate, entry_type: 'invoice', reference_type: 'ar',
                    reference_id: inv.id, reference_number: inv.invoice_number, account_code: revCoa.code,
                    account_name: `${revCoa.name} - ${inv.customer_name}`, debit: 0, credit: inv.total_amount,
                    currency: inv.currency || 'IDR', exchange_rate: exRate, description: `Invoice ${inv.invoice_number}`,
                    batch_id: batchId, source: 'auto', coa_id: revCoa.id, party_name: inv.customer_name
                });
            }

            if (entriesToInsert.length > 0) {
                // Insert in batches of 500
                const CHUNK_SIZE = 500;
                for (let i = 0; i < entriesToInsert.length; i += CHUNK_SIZE) {
                    const chunk = entriesToInsert.slice(i, i + CHUNK_SIZE);
                    const { error: iErr } = await supabase.from('blink_journal_entries').insert(chunk);
                    if (iErr) throw iErr;
                }
                alert(`Successfully migrated ${toMigrate.length} invoices!`);
                await fetchInvoices();
            }
        } catch (error) {
            console.error(error);
            alert('Migration failed: ' + error.message);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Invoice Management</h1>
                    <p className="text-silver-dark mt-1">Kelola invoice dan tracking pembayaran</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={runMigration}
                        icon={PlaySquare}
                        variant="secondary"
                        disabled={isMigrating}
                    >
                        {isMigrating ? 'Migrating...' : 'Migrate Past Invoices'}
                    </Button>
                    <Button onClick={handleExportXLS} variant="secondary" icon={Download}>
                        Export XLS
                    </Button>
                    {canCreate('blink_invoices') && (
                        <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                            Buat Invoice Baru
                        </Button>
                    )}
                </div>
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
                        placeholder="Search invoice, job number, atau customer..."
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
                        bankAccounts={bankAccounts}
                        onClose={() => {
                            setShowCreateModal(false);
                            resetForm();
                        }}
                    />
                )
            }

            {/* View Invoice Modal */}
            {
                showViewModal && selectedInvoice && (
                    <InvoiceViewModal
                        invoice={selectedInvoice}
                        formatCurrency={formatCurrency}
                        bankAccounts={bankAccounts}
                        onInvoiceUpdate={(updatedInvoice) => {
                            setSelectedInvoice(updatedInvoice);
                            setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
                        }}
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
                        onAddItem={() => {
                            setAddItemInvoice(selectedInvoice);
                            setShowAddItemModal(true);
                        }}
                        statusConfig={statusConfig}
                        canEditInvoice={canEdit('blink_invoices')}
                        canSubmitInvoice={canCreate('blink_invoices') || canEdit('blink_invoices')}
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
            {/* Add Item to Invoice Modal */}
            {
                showAddItemModal && addItemInvoice && (
                    <AddItemModal
                        invoice={addItemInvoice}
                        formatCurrency={formatCurrency}
                        revenueAccounts={revenueAccounts}
                        onClose={() => {
                            setShowAddItemModal(false);
                            setAddItemInvoice(null);
                        }}
                        onSave={handleAddItemToInvoice}
                    />
                )
            }

            {/* Status Confirmation Modal */}
            <Modal isOpen={!!confirmSubmitAction} onClose={() => setConfirmSubmitAction(null)} title="Confirmation" size="small">
                <div className="space-y-4 text-silver-light">
                    <p className="text-lg">Submit invoice {confirmSubmitAction?.invoice_number} to the Approval Center for Manager approval?</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="secondary" onClick={() => setConfirmSubmitAction(null)}>Cancel</Button>
                        <Button variant="primary" onClick={confirmAndProcessSubmit}>Yes, Continue</Button>
                    </div>
                </div>
            </Modal>

            {/* Success Message Modal */}
            <Modal isOpen={!!successSubmitMsg} onClose={() => setSuccessSubmitMsg('')} title="Success" size="small">
                <div className="space-y-4 text-center">
                    <p className="text-lg text-emerald-400 font-semibold mt-4">{successSubmitMsg}</p>
                    <div className="flex justify-center mt-6">
                        <Button variant="primary" onClick={() => setSuccessSubmitMsg('')}>Close</Button>
                    </div>
                </div>
            </Modal>
        </div >
    );
};

// Invoice Create Modal Component  
const InvoiceCreateModal = ({ quotations, shipments, formData, setFormData, selectedQuotation, selectedShipment,
    referenceType, setReferenceType, handleQuotationSelect, handleShipmentSelect, handlePaymentTermsChange,
    addInvoiceItem, removeInvoiceItem, updateInvoiceItem, calculateTotals,
    handleCreateInvoice, formatCurrency, onClose, bankAccounts }) => {

    const { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin } = calculateTotals();

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

                    {/* Existing Invoices Indicator */}
                    {selectedQuotation && (
                        <ExistingInvoicesIndicator jobNumber={formData.job_number} />
                    )}


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
                                <option value="SGD">SGD (Singapore Dollar)</option>
                                <option value="EUR">EUR (Euro)</option>
                                <option value="RMB">RMB (Chinese Yuan)</option>
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

                    {/* Payment Bank Account Selection */}
                    {bankAccounts && bankAccounts.length > 0 && (
                        <div className="glass-card p-3 rounded-lg border border-blue-500/20">
                            <h3 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-2">
                                🏦 Rekening Bank Penerima Pembayaran
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                <div>
                                    <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                        Pilih Rekening Bank <span className="text-silver-dark font-normal">(opsional)</span>
                                    </label>
                                    <select
                                        value={formData.payment_bank_id || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, payment_bank_id: e.target.value }))}
                                        className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                                    >
                                        <option value="">-- Tampilkan semua rekening --</option>
                                        {bankAccounts.map(bank => (
                                            <option key={bank.id} value={bank.id}>
                                                {bank.bank_name} ({bank.currency || 'IDR'}) – {bank.account_number}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-silver-dark mt-1">
                                        Jika dipilih, hanya rekening ini yang tampil di cetak invoice
                                    </p>
                                </div>

                                {/* Preview rekening yang dipilih */}
                                {formData.payment_bank_id && (() => {
                                    const selected = bankAccounts.find(b => b.id === formData.payment_bank_id);
                                    return selected ? (
                                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] space-y-0.5">
                                            <div className="font-bold text-blue-300">{selected.bank_name} ({selected.currency || 'IDR'})</div>
                                            <div className="text-silver-light">No. Rekening: <span className="font-mono">{selected.account_number}</span></div>
                                            <div className="text-silver-light">A/N: {selected.account_holder}</div>
                                            {selected.branch && <div className="text-silver-dark">Cabang: {selected.branch}</div>}
                                            {selected.swift_code && <div className="text-silver-dark">SWIFT: {selected.swift_code}</div>}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        </div>
                    )}

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
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[150px] font-normal">Item</th>
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[200px] font-normal">Description</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-24 font-normal">Qty</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-24 font-normal">Unit</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-16 font-normal">Curr</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[140px] font-normal">Price</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[100px] font-normal">Total</th>
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
                                                    value={item.item_name}
                                                    onChange={(e) => updateInvoiceItem(index, 'item_name', e.target.value)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                    placeholder="Nama Item (e.g. THL, Freight)"
                                                    required
                                                />
                                            </td>
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
                                            <td className="px-1 py-2">
                                                <select
                                                    value={item.currency || formData.billing_currency}
                                                    onChange={(e) => updateInvoiceItem(index, 'currency', e.target.value)}
                                                    className="w-full px-1 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs text-center"
                                                >
                                                    <option value="IDR">IDR</option>
                                                    <option value="USD">USD</option>
                                                    <option value="SGD">SGD</option>
                                                    <option value="EUR">EUR</option>
                                                </select>
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
                                                <span className="text-silver-light text-sm">{formatCurrency(item.amount, item.currency || formData.billing_currency)}</span>
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

                    {/* Profit Preview (if COGS available) */}
                    {formData.cogs_items && formData.cogs_items.length > 0 && (
                        <div className="glass-card p-3 rounded-lg border border-accent-orange/30 bg-accent-orange/5">
                            <h4 className="text-xs font-semibold text-accent-orange mb-2 flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Profit Preview
                            </h4>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                                <div className="text-center p-2 rounded bg-blue-500/10 border border-blue-500/30">
                                    <div className="text-[9px] text-silver-dark mb-0.5">Revenue</div>
                                    <div className="text-xs font-bold text-blue-400">
                                        {formatCurrency(total, formData.billing_currency)}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded bg-orange-500/10 border border-orange-500/30">
                                    <div className="text-[9px] text-silver-dark mb-0.5">COGS</div>
                                    <div className="text-xs font-bold text-orange-400">
                                        {formatCurrency(cogsSubtotal, formData.billing_currency)}
                                    </div>
                                </div>
                                <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/30">
                                    <div className="text-[9px] text-silver-dark mb-0.5">Profit</div>
                                    <div className="text-xs font-bold text-green-400">
                                        {formatCurrency(grossProfit, formData.billing_currency)}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-2 rounded bg-dark-surface">
                                <span className="text-[10px] text-silver-dark">Profit Margin:</span>
                                <span className={`text-sm font-bold ${profitMargin >= 30 ? 'text-green-400' :
                                    profitMargin >= 20 ? 'text-blue-400' :
                                        profitMargin >= 10 ? 'text-yellow-400' :
                                            profitMargin >= 0 ? 'text-orange-400' : 'text-red-400'
                                    }`}>
                                    {profitMargin.toFixed(2)}%
                                </span>
                            </div>
                            <p className="text-[9px] text-silver-dark mt-2">
                                💡 {formData.cogs_items.length} COGS item(s) from shipment will be tracked for profit analysis
                            </p>
                        </div>
                    )}

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
const InvoiceViewModal = ({ invoice, formatCurrency, onClose, onPayment, onPrint, onPreview, onSubmit, onAddItem, statusConfig, canEditInvoice, canSubmitInvoice, bankAccounts, onInvoiceUpdate }) => {
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [selectedBankId, setSelectedBankId] = useState(invoice.payment_bank_id || '');
    const [savingBank, setSavingBank] = useState(false);

    const handleBankChange = async (bankId) => {
        setSelectedBankId(bankId);
        setSavingBank(true);
        try {
            const { error } = await supabase
                .from('blink_invoices')
                .update({ payment_bank_id: bankId || null })
                .eq('id', invoice.id);
            if (error) throw error;
            if (onInvoiceUpdate) onInvoiceUpdate({ ...invoice, payment_bank_id: bankId || null });
        } catch (err) {
            console.error('Error updating payment bank:', err);
            alert('Gagal menyimpan rekening: ' + err.message);
        } finally {
            setSavingBank(false);
        }
    };

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
                            <table className="w-full text-sm">
                                <thead className="bg-[#0070bc]">
                                    <tr className="text-left">
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase rounded-tl-lg">Item</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase">Description</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-center w-20">Qty</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-center w-24">Unit</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right w-32">Rate</th>
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right w-32 rounded-tr-lg">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border/50 bg-dark-bg">
                                    {invoice.invoice_items?.map((item, index) => (
                                        <tr key={index} className="hover:bg-blue-500/5 transition-colors">
                                            <td className="px-4 py-3 text-silver-light font-medium align-top">{item.item_name || 'Item ' + (index + 1)}</td>
                                            <td className="px-4 py-3 text-silver-light align-top">{item.description}</td>
                                            <td className="px-4 py-3 text-center text-silver-light align-top">{item.qty}</td>
                                            <td className="px-4 py-3 text-center text-silver-dark align-top">{item.unit}</td>
                                            <td className="px-4 py-3 text-right text-silver-light align-top">{(parseFloat(item.rate) || 0).toLocaleString('id-ID')}</td>
                                            <td className="px-4 py-3 text-right text-silver-light font-medium align-top">{formatCurrency(item.amount, invoice.currency)}</td>
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

                    {/* Profit Analysis Section */}
                    <InvoiceProfitSummary invoice={invoice} formatCurrency={formatCurrency} />

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

                    {/* Payment Bank Account */}
                    {bankAccounts && bankAccounts.length > 0 && (
                        <div className="glass-card p-4 rounded-lg border border-blue-500/20">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                                    🏦 Rekening Bank Pembayaran
                                </h3>
                                {savingBank && <span className="text-xs text-silver-dark animate-pulse">Menyimpan...</span>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                                <div>
                                    <select
                                        value={selectedBankId}
                                        onChange={(e) => handleBankChange(e.target.value)}
                                        className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light text-sm"
                                        disabled={savingBank}
                                    >
                                        <option value="">-- Tampilkan semua rekening --</option>
                                        {bankAccounts.map(bank => (
                                            <option key={bank.id} value={bank.id}>
                                                {bank.bank_name} ({bank.currency || 'IDR'}) – {bank.account_number}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-silver-dark mt-1">
                                        Pilihan rekening yang tampil di cetak invoice
                                    </p>
                                </div>
                                {selectedBankId && (() => {
                                    const sel = bankAccounts.find(b => b.id === selectedBankId);
                                    return sel ? (
                                        <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs space-y-0.5">
                                            <div className="font-bold text-blue-300">{sel.bank_name} ({sel.currency || 'IDR'})</div>
                                            <div className="text-silver-light">No. Rek: <span className="font-mono">{sel.account_number}</span></div>
                                            <div className="text-silver-light">A/N: {sel.account_holder}</div>
                                            {sel.branch && <div className="text-silver-dark">Cabang: {sel.branch}</div>}
                                            {sel.swift_code && <div className="text-silver-dark">SWIFT: {sel.swift_code}</div>}
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 justify-end pt-4 border-t border-dark-border flex-wrap">
                        {invoice.outstanding_amount > 0 && (
                            <p className="text-xs text-silver-dark self-center mr-auto">
                                💡 Payment via AR (Accounts Receivable) module
                            </p>
                        )}
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition"
                        >
                            Close
                        </button>

                        {/* Add Item — always visible, all statuses including paid */}
                        {onAddItem && canEditInvoice && (
                            <button
                                onClick={onAddItem}
                                className="flex items-center gap-2 px-4 py-2 border border-yellow-500 text-yellow-400 rounded-lg hover:bg-yellow-500/10 smooth-transition font-semibold"
                                title="Add new charge item to this invoice (will require re-approval)"
                            >
                                <Plus className="w-4 h-4" />
                                Add Item
                            </button>
                        )}

                        {onPrint && (
                            <button
                                onClick={onPrint}
                                className="flex items-center gap-2 px-5 py-2 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/10 smooth-transition"
                            >
                                <div className="w-4 h-4">🖨️</div>
                                Print
                            </button>
                        )}
                        {onPreview && (
                            <button
                                onClick={onPreview}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg smooth-transition font-semibold"
                            >
                                <Eye className="w-4 h-4" />
                                Preview
                            </button>
                        )}
                        {invoice.status === 'draft' && onSubmit && canSubmitInvoice && (
                            <button
                                onClick={onSubmit}
                                className="flex items-center gap-2 px-5 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg smooth-transition font-semibold"
                            >
                                <Send className="w-4 h-4" />
                                Submit for Approval
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

    const [splitItems, setSplitItems] = useState(() =>
        invoice.invoice_items ? invoice.invoice_items.map(item => ({ ...item, isSelected: true, splitQty: item.qty || 1, splitRate: item.rate || 0 })) : []
    );
    const [splitLabel, setSplitLabel] = useState('FULL PAYMENT');
    const [printCurrency, setPrintCurrency] = useState(invoice.currency || 'IDR');

    // Extract unique currencies from items
    const availableCurrencies = Array.from(new Set(invoice.invoice_items?.map(item => item.currency || invoice.currency) || [invoice.currency || 'IDR']));

    const handleSplitItemChange = (index, field, value) => {
        setSplitItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], [field]: value };
            return newItems;
        });
    };

    const isSplit = splitItems.some(item => !item.isSelected || item.splitQty !== (item.qty || 1) || item.splitRate !== (item.rate || 0));

    // Calculate split totals
    const splitSubtotal = splitItems.reduce((sum, item) => sum + (item.isSelected ? (item.splitQty * item.splitRate) : 0), 0);
    const splitTax = splitSubtotal * (invoice.tax_rate || 0) / 100;
    const splitTotal = splitSubtotal + splitTax - (invoice.discount_amount || 0);

    const handleCurrencyFilter = (curr) => {
        setPrintCurrency(curr);
        setSplitItems(prev => prev.map(item => ({
            ...item,
            isSelected: (item.currency || invoice.currency) === curr
        })));
    };

    const handlePrintClick = () => {
        // We inject the split calculation dynamically to the onPrint method if needed
        // Since onPrint uses handlePrintInvoice, we could pass split details, but it's cleaner to handle printing internally here or modify handlePrintInvoice
        // Because handlePrintInvoice is defined above and doesn't take split options, let's just trigger the native browser print for the preview window.
        // The user can print the preview directly!
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Pop-up blocked! Please allow pop-ups for this site.');
            return;
        }
        printWindow.document.write('<html><head><title>Print Invoice</title>');
        // inject styles
        printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Arimo:wght@400;700&display=swap"); * { box-sizing: border-box; } body { font-family: "Arimo", Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; color: #000; background-color: #fff; -webkit-print-color-adjust: exact; } .container { width: 100%; max-width: 210mm; margin: 0 auto; padding: 0; box-shadow: none; position: relative; } table { width: 100%; border-collapse: collapse; } </style>');
        printWindow.document.write('</head><body><div class="container">');
        printWindow.document.write(document.getElementById('invoice-print-area').innerHTML);
        printWindow.document.write('</div><script>window.onload = function() { window.print(); };</script></body></html>');
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">Print Preview</h2>
                        <p className="text-sm text-silver-dark mt-1">Gunakan opsi Split Invoice untuk membagi tagihan per termin perjalanan.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-dark-bg p-2 rounded-lg border border-dark-border">
                            <label className="text-xs text-silver-light font-medium whitespace-nowrap">Print Label:</label>
                            <input
                                type="text"
                                placeholder="Misal: Termin 1 (DP)"
                                value={splitLabel}
                                onChange={(e) => setSplitLabel(e.target.value)}
                                className="bg-dark-surface border border-dark-border text-silver-light px-2 py-1 rounded text-sm w-32 ml-1"
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-dark-bg p-2 rounded-lg border border-dark-border">
                            <label className="text-xs text-silver-light font-medium whitespace-nowrap">Filter Kurs / Cetak:</label>
                            <select
                                value={printCurrency}
                                onChange={(e) => handleCurrencyFilter(e.target.value)}
                                className="bg-dark-surface border border-dark-border text-silver-light px-2 py-1 rounded text-sm w-24 ml-1 shadow-none"
                            >
                                {availableCurrencies.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handlePrintClick}
                            className="flex items-center gap-2 px-4 py-2 bg-accent-orange hover:bg-accent-orange/80 text-white rounded-lg smooth-transition font-semibold h-[38px]"
                        >
                            <Download className="w-4 h-4" />
                            Print / PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition h-[38px]"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Custom Split Invoice Configurator */}
                <div className="bg-dark-surface mb-6 p-4 rounded-lg border border-dark-border">
                    <h3 className="text-sm font-semibold text-silver-light mb-3">Pilih Item untuk Dicetak</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-silver-light">
                            <thead className="text-xs text-silver-dark uppercase bg-dark-bg">
                                <tr>
                                    <th className="px-3 py-2 text-center w-10">Pilih</th>
                                    <th className="px-3 py-2">Item deskripsi</th>
                                    <th className="px-3 py-2 w-24 text-center">Qty Total</th>
                                    <th className="px-3 py-2 w-24 text-center">Qty Cetak</th>
                                    <th className="px-3 py-2 w-32 text-right">Harga Asli</th>
                                    <th className="px-3 py-2 w-32 text-right">Harga Cetak</th>
                                    <th className="px-3 py-2 w-32 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitItems.map((item, index) => (
                                    <tr key={index} className="border-b border-dark-border hover:bg-white/5">
                                        <td className="px-3 py-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={item.isSelected}
                                                onChange={(e) => handleSplitItemChange(index, 'isSelected', e.target.checked)}
                                                className="w-4 h-4 rounded bg-dark-bg border-dark-border text-accent-orange focus:ring-accent-orange"
                                            />
                                        </td>
                                        <td className="px-3 py-2">
                                            {item.item_name ? <span className="font-semibold">{item.item_name} - </span> : ''}
                                            {item.description}
                                        </td>
                                        <td className="px-3 py-2 text-center text-silver-dark">{item.qty || 1} {item.unit}</td>
                                        <td className="px-3 py-2 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                max={item.qty || 1000}
                                                step="0.01"
                                                value={item.splitQty}
                                                onChange={(e) => handleSplitItemChange(index, 'splitQty', parseFloat(e.target.value) || 0)}
                                                disabled={!item.isSelected}
                                                className="w-16 bg-dark-bg border border-dark-border text-silver-light px-1 py-0.5 rounded text-center disabled:opacity-50"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right text-silver-dark">{formatCurrency(item.rate || 0, item.currency || invoice.currency)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={item.splitRate}
                                                onChange={(e) => handleSplitItemChange(index, 'splitRate', parseFloat(e.target.value) || 0)}
                                                disabled={!item.isSelected}
                                                className="w-24 bg-dark-bg border border-dark-border text-silver-light px-1 py-0.5 rounded text-right disabled:opacity-50"
                                            />
                                        </td>
                                        <td className="px-3 py-2 text-right text-accent-orange font-medium">
                                            {item.isSelected ? formatCurrency(item.splitQty * item.splitRate, printCurrency) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Print-friendly invoice content - WYSIWYG with handlePrintInvoice */}
                <div className="bg-white text-black p-8 rounded-lg shadow-inner overflow-x-auto">
                    <div id="invoice-print-area" style={{ fontFamily: "'Arimo', Arial, sans-serif", fontSize: '11px', color: '#000', width: '210mm', minHeight: '297mm', margin: '0 auto', padding: '15mm', backgroundColor: '#fff', boxSizing: 'border-box', position: 'relative' }}>

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
                                {splitItems.filter(item => item.isSelected).length > 0 ? (
                                    splitItems.filter(item => item.isSelected).map((item, index) => {
                                        const calcAmount = item.splitQty * item.splitRate;
                                        const calcTax = calcAmount * (invoice.tax_rate || 0) / 100;
                                        return (
                                            <tr key={index}>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textTransform: 'capitalize' }}>
                                                    {item.item_name ? <b>{item.item_name}</b> : null} {item.item_name ? '- ' : ''}{item.description}
                                                    <div style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
                                                        {item.splitQty} {item.unit} x {formatCurrency(item.splitRate, printCurrency).replace('Rp ', '').replace('$', '')}
                                                    </div>
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'center' }}>{printCurrency}</td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>{formatCurrency(calcAmount, printCurrency).replace('Rp ', '').replace('$', '')}</td>
                                                <td style={{ borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>{formatCurrency(calcTax, printCurrency).replace('Rp ', '').replace('$', '')}</td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px', fontSize: '11px' }}>No items</td></tr>
                                )}
                            </tbody>
                        </table>

                        {isSplit && (
                            <div style={{ fontStyle: 'italic', marginBottom: '10px', fontSize: '11px', color: '#444' }}>
                                * This is a partial billing: <strong>{splitLabel}</strong>
                            </div>
                        )}

                        {/* Totals */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <div style={{ width: '320px', border: '1px solid #000', borderTop: 'none' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #ccc', background: '#f9f9f9' }}>
                                    <span>SUBTOTAL</span>
                                    <span>{formatCurrency(splitSubtotal, printCurrency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #ccc' }}>
                                    <span>TAX Total ({invoice.tax_rate}%)</span>
                                    <span>{formatCurrency(splitTax, printCurrency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', fontWeight: 'bold', fontSize: '13px', background: '#333', color: 'white' }}>
                                    <span>TOTAL AMOUNT DUE</span>
                                    <span>{formatCurrency(splitTotal, printCurrency)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ display: 'flex', marginTop: 'auto', borderTop: '2px solid #000', paddingTop: '20px' }}>
                            <div style={{ flex: '1', paddingRight: '40px', fontSize: '10px' }}>
                                <div style={{ border: '1px solid #999', background: '#fcfcfc', padding: '10px', marginTop: '8px', borderRadius: '4px' }}>
                                    <b style={{ fontSize: '11px' }}>PAYMENT DETAILS:</b><br /><br />
                                    Please transfer to:<br />
                                    {(() => {
                                        const selectedBank = invoice.payment_bank_id
                                            ? (bankAccounts || []).find(b => b.id === invoice.payment_bank_id)
                                            : null;
                                        const banksToShow = selectedBank 
                                            ? [selectedBank] 
                                            : (bankAccounts || []).filter(b => b.currency === printCurrency || (!b.currency && printCurrency === 'IDR'));
                                        return banksToShow.length > 0 ? banksToShow.map((bank, index) => (
                                            <div key={index} style={{ marginBottom: '8px' }}>
                                                <b>{bank.bank_name} ({bank.currency || invoice.currency})</b><br />
                                                A/C No: {bank.account_number}<br />
                                                A/N: {bank.account_holder}<br />
                                                {bank.branch && <>Branch: {bank.branch}<br /></>}
                                                {bank.swift_code && <>SWIFT: {bank.swift_code}</>}
                                            </div>
                                        )) : (
                                            <>
                                                <b>BANK CENTRAL ASIA (BCA)</b><br />
                                                A/C No: 000-000-000<br />
                                                A/N: PT. BAKHTERA FREIGHT WORLDWIDE<br />
                                                Branch: KCU JAKARTA
                                            </>
                                        );
                                    })()}
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

// Existing Invoices Indicator Component
const ExistingInvoicesIndicator = ({ jobNumber }) => {
    const [existingInvoices, setExistingInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExistingInvoices = async () => {
            if (!jobNumber) return;

            try {
                const { data, error } = await supabase
                    .from('blink_invoices')
                    .select('invoice_number, currency, status, total_amount, created_at')
                    .eq('job_number', jobNumber)
                    .neq('status', 'cancelled')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                setExistingInvoices(data || []);
            } catch (error) {
                console.error('Error fetching existing invoices:', error);
                setExistingInvoices([]);
            } finally {
                setLoading(false);
            }
        };

        fetchExistingInvoices();
    }, [jobNumber]);

    if (loading) return null;
    if (existingInvoices.length === 0) return null;

    const idrInvoice = existingInvoices.find(inv => inv.currency === 'IDR');
    const usdInvoice = existingInvoices.find(inv => inv.currency === 'USD');
    const canCreateIDR = !idrInvoice;
    const canCreateUSD = !usdInvoice;

    return (
        <div className="glass-card p-3 rounded-lg border border-accent-orange/30 bg-accent-orange/5">
            <div className="flex items-start gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-accent-orange mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                    <h4 className="text-xs font-semibold text-accent-orange mb-1">
                        Existing Invoices for Job {jobNumber}
                    </h4>
                    <p className="text-[10px] text-silver-dark mb-2">
                        Maximum 2 invoices allowed: 1 IDR + 1 USD
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
                {/* IDR Status */}
                <div className={`p-2 rounded border ${idrInvoice ? 'bg-green-500/10 border-green-500/30' : 'bg-dark-surface border-dark-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        {idrInvoice ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Circle className="w-3.5 h-3.5 text-silver-dark" />
                        )}
                        <span className="text-[10px] font-semibold text-silver-light">IDR Invoice</span>
                    </div>
                    {idrInvoice ? (
                        <div className="text-[9px] text-silver-dark space-y-0.5">
                            <div className="font-mono text-green-400">{idrInvoice.invoice_number}</div>
                            <div>Rp {idrInvoice.total_amount?.toLocaleString('id-ID')}</div>
                            <div className="text-[8px] opacity-70">{idrInvoice.status}</div>
                        </div>
                    ) : (
                        <div className="text-[9px] text-silver-dark">Available to create</div>
                    )}
                </div>

                {/* USD Status */}
                <div className={`p-2 rounded border ${usdInvoice ? 'bg-green-500/10 border-green-500/30' : 'bg-dark-surface border-dark-border'}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                        {usdInvoice ? (
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Circle className="w-3.5 h-3.5 text-silver-dark" />
                        )}
                        <span className="text-[10px] font-semibold text-silver-light">USD Invoice</span>
                    </div>
                    {usdInvoice ? (
                        <div className="text-[9px] text-silver-dark space-y-0.5">
                            <div className="font-mono text-green-400">{usdInvoice.invoice_number}</div>
                            <div>${usdInvoice.total_amount?.toLocaleString('id-ID')}</div>
                            <div className="text-[8px] opacity-70">{usdInvoice.status}</div>
                        </div>
                    ) : (
                        <div className="text-[9px] text-silver-dark">Available to create</div>
                    )}
                </div>
            </div>

            {!canCreateIDR && !canCreateUSD && (
                <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded">
                    <p className="text-[9px] text-red-400">
                        ⚠️ Both IDR and USD invoices already exist. Cancel one to create a replacement.
                    </p>
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// AddItemModal — Add new charge items to an existing invoice (any status)
// After saving: invoice resets to 'draft' and requires re-approval
// ─────────────────────────────────────────────────────────────────────────────
const AddItemModal = ({ invoice, formatCurrency, revenueAccounts, onClose, onSave }) => {
    const emptyItem = () => ({ item_name: '', description: '', qty: 1, unit: 'Job', rate: 0, amount: 0, coa_id: null });
    const [newItems, setNewItems] = useState([emptyItem()]);
    const [amendmentNote, setAmendmentNote] = useState('');
    const [saving, setSaving] = useState(false);

    const updateItem = (idx, field, val) => {
        setNewItems(prev => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: val };
            // Auto-calc amount on rate/qty change
            if (field === 'rate' || field === 'qty') {
                const qty = field === 'qty' ? parseFloat(val) || 0 : parseFloat(updated[idx].qty) || 0;
                const rate = field === 'rate' ? parseFloat(val) || 0 : parseFloat(updated[idx].rate) || 0;
                updated[idx].amount = qty * rate;
            }
            return updated;
        });
    };

    const addRow = () => setNewItems(prev => [...prev, emptyItem()]);
    const removeRow = (idx) => setNewItems(prev => prev.filter((_, i) => i !== idx));

    // Preview: recalculate totals with new items appended
    const newItemsSubtotal = newItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
    const existingSubtotal = invoice.subtotal || 0;
    const preview = {
        subtotal: existingSubtotal + newItemsSubtotal,
        tax: ((existingSubtotal + newItemsSubtotal) * (invoice.tax_rate || 0)) / 100,
        get total() { return this.subtotal + this.tax - (invoice.discount_amount || 0); },
        get outstanding() { return Math.max(0, this.total - (invoice.paid_amount || 0)); }
    };

    const handleSave = async () => {
        const validItems = newItems.filter(it => it.item_name && parseFloat(it.amount) > 0);
        if (validItems.length === 0) {
            alert('Please fill at least one item with a name and amount > 0.');
            return;
        }
        setSaving(true);
        await onSave(invoice, validItems, amendmentNote);
        setSaving(false);
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-4xl">
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="text-xl font-bold gradient-text flex items-center gap-2">
                            <Plus className="w-5 h-5 text-yellow-400" />
                            Add Items to Invoice
                        </h2>
                        <p className="text-silver-dark text-sm mt-1">
                            {invoice.invoice_number} — {invoice.customer_name}
                        </p>
                    </div>
                    {/* Status badge warning */}
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-yellow-500/15 border border-yellow-500/40 text-yellow-400 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wider">
                            ⚠️ Will reset to Draft
                        </span>
                        <span className="text-[10px] text-silver-dark">Current: <span className="capitalize text-silver-light">{invoice.status}</span></span>
                    </div>
                </div>

                {/* Current invoice summary */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                        { label: 'Current Total', value: formatCurrency(invoice.total_amount, invoice.currency), color: 'text-silver-light' },
                        { label: 'Already Paid', value: formatCurrency(invoice.paid_amount || 0, invoice.currency), color: 'text-green-400' },
                        { label: 'Outstanding', value: formatCurrency(invoice.outstanding_amount || 0, invoice.currency), color: invoice.outstanding_amount > 0 ? 'text-yellow-400' : 'text-green-400' },
                    ].map(c => (
                        <div key={c.label} className="glass-card p-3 rounded-lg border border-dark-border text-center">
                            <p className="text-[10px] text-silver-dark uppercase tracking-wider">{c.label}</p>
                            <p className={`text-sm font-bold mt-1 font-mono ${c.color}`}>{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* New Items Table */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-yellow-400">New Items to Add</h3>
                        <button onClick={addRow}
                            className="flex items-center gap-1 text-xs text-accent-orange border border-accent-orange/40 px-2.5 py-1 rounded hover:bg-accent-orange/10 smooth-transition">
                            <Plus className="w-3 h-3" /> Add Row
                        </button>
                    </div>
                    <div className="glass-card rounded-lg overflow-hidden border border-dark-border">
                        <table className="w-full text-xs">
                            <thead className="bg-dark-surface">
                                <tr>
                                    {['Item Name', 'Description', 'Qty', 'Unit', 'Rate', 'Amount', 'COA', ''].map((h, i) => (
                                        <th key={i} className="px-3 py-2 text-left text-silver-dark font-semibold uppercase text-[10px]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border/30">
                                {newItems.map((item, idx) => (
                                    <tr key={idx} className="bg-dark-bg">
                                        <td className="px-2 py-1.5">
                                            <input value={item.item_name}
                                                onChange={e => updateItem(idx, 'item_name', e.target.value)}
                                                placeholder="e.g. Handling Fee"
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs focus:border-yellow-500/60 outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5">
                                            <input value={item.description}
                                                onChange={e => updateItem(idx, 'description', e.target.value)}
                                                placeholder="Details..."
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs focus:border-yellow-500/60 outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5 w-16">
                                            <input type="number" value={item.qty} min="0"
                                                onChange={e => updateItem(idx, 'qty', e.target.value)}
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs text-center focus:border-yellow-500/60 outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5 w-20">
                                            <input value={item.unit}
                                                onChange={e => updateItem(idx, 'unit', e.target.value)}
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs focus:border-yellow-500/60 outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5 w-28">
                                            <input type="number" value={item.rate} min="0"
                                                onChange={e => updateItem(idx, 'rate', e.target.value)}
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs text-right focus:border-yellow-500/60 outline-none" />
                                        </td>
                                        <td className="px-2 py-1.5 w-28 text-right font-mono text-yellow-400 font-semibold">
                                            {(parseFloat(item.amount) || 0).toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2 py-1.5 w-36">
                                            <select value={item.coa_id || ''}
                                                onChange={e => updateItem(idx, 'coa_id', e.target.value || null)}
                                                className="w-full bg-dark-surface border border-dark-border rounded px-1.5 py-1 text-silver-light text-[10px] focus:border-yellow-500/60 outline-none">
                                                <option value="">-- COA --</option>
                                                {revenueAccounts.map(a => (
                                                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-2 py-1.5">
                                            {newItems.length > 1 && (
                                                <button onClick={() => removeRow(idx)}
                                                    className="text-red-400/60 hover:text-red-400 smooth-transition">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Amendment Note */}
                <div className="mb-5">
                    <label className="block text-xs text-silver-dark mb-1">Amendment Note (optional)</label>
                    <input value={amendmentNote}
                        onChange={e => setAmendmentNote(e.target.value)}
                        placeholder="e.g. Additional handling charges per customer request..."
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light text-sm focus:border-yellow-500/60 outline-none" />
                </div>

                {/* New Total Preview */}
                {newItemsSubtotal > 0 && (
                    <div className="mb-5 glass-card p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                        <h3 className="text-xs font-semibold text-yellow-400 mb-3 uppercase tracking-wider">New Totals Preview</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] text-silver-dark">New Items</p>
                                <p className="font-mono font-bold text-yellow-400">{formatCurrency(newItemsSubtotal, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">New Subtotal</p>
                                <p className="font-mono font-bold text-silver-light">{formatCurrency(preview.subtotal, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">New Total (incl. tax)</p>
                                <p className="font-mono font-bold text-accent-orange">{formatCurrency(preview.total, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">New Outstanding</p>
                                <p className={`font-mono font-bold ${preview.outstanding > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                    {formatCurrency(preview.outstanding, invoice.currency)}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 justify-end border-t border-dark-border pt-4">
                    <button onClick={onClose} disabled={saving}
                        className="px-5 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface smooth-transition">
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg smooth-transition font-semibold disabled:opacity-50">
                        {saving ? (
                            <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                        ) : (
                            <><Plus className="w-4 h-4" /> Save & Reset to Draft</>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default InvoiceManagement;
