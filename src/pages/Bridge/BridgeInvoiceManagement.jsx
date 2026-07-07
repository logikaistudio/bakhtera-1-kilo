import React, { useState, useEffect } from 'react';
import { createInvoiceJournal, createCOGSJournal, createARPaymentJournal, getAllCOA, resolveARAccount, resolveRevenueAccount, generateUUID, migrateBridgeFinancialRecords } from '../../utils/bridgeJournalHelper';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useData } from '../../context/DataContext';
import { generateInvoiceNumber, generateBridgeInvoiceNumber } from '../../utils/documentNumbers';
import { getCurrencySymbol } from '../../utils/currencyFormatter';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import COAPicker from '../../components/Common/COAPicker';
import { logTransaction, TRANSACTION_TYPES, MODULES, ACTIONS } from '../../services/transactionLogService';
import {
    FileText, DollarSign, Calendar, User, Clock, CheckCircle, XCircle,
    Plus, Send, AlertCircle, Download, Eye, Edit, Trash, Receipt,
    TrendingUp, AlertTriangle, Search, Filter, X, Package, Circle, PlaySquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import InvoiceProfitSummary from '../../components/Bridge/InvoiceProfitSummary';


const BridgeInvoiceManagement = () => {
    const navigate = useNavigate();
    const { canCreate, canEdit, canDelete, canApprove, isSuperAdmin, user } = useAuth();
    const { companySettings, bankAccounts, quotations: ctxQuotations = [], shipments: ctxShipments = [], bridgeBusinessPartners = [], deleteBridgeInvoiceCascade } = useData();
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
    const [financeMigrationRan, setFinanceMigrationRan] = useState(false);
    const [showReimbursementModal, setShowReimbursementModal] = useState(false);
    const [reimbursementInvoice, setReimbursementInvoice] = useState(null);
    const [previewInvoiceData, setPreviewInvoiceData] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);
    const [selectedQuotation, setSelectedQuotation] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [referenceType, setReferenceType] = useState('quotation'); // 'quotation' or 'so'
    const [revenueAccounts, setRevenueAccounts] = useState([]);
    const [coaSearchMapInv, setCoaSearchMapInv] = useState({});    // { [itemIndex]: searchTerm }
    const [coaDropdownMapInv, setCoaDropdownMapInv] = useState({}); // { [itemIndex]: boolean open }
    const [confirmSubmitAction, setConfirmSubmitAction] = useState(null);
    const [successSubmitMsg, setSuccessSubmitMsg] = useState('');
    const [isEditingInvoice, setIsEditingInvoice] = useState(false);
    const [editInvoiceId, setEditInvoiceId] = useState(null);
    const canRunSuperAdminBatch = isSuperAdmin();
    const canCleanseBridgeInvoice = canRunSuperAdminBatch;
    const [isCleansing, setIsCleansing] = useState(false);
    const [cleanseProgress, setCleanseProgress] = useState('');

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
            { item_name: 'Freight', description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, tax_rate: 0, tax_amount: 0, coa_id: null }
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
        rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400', icon: XCircle },
        cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-400', icon: XCircle },
        unpaid: { label: 'Unpaid', color: 'bg-orange-500/20 text-orange-400', icon: Clock },
        manager_approval: { label: 'Manager Approval', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock }
    };

    useEffect(() => {
        fetchInvoices();
        // Prefer data from DataContext (bridge pengajuan) if available
        if (ctxQuotations && ctxQuotations.length > 0) {
            console.log('Using quotations from DataContext (bridge pengajuan)');
            setQuotations(ctxQuotations);
        } else {
            fetchApprovedQuotations();
        }

        if (ctxShipments && ctxShipments.length > 0) {
            console.log('Using shipments from DataContext');
            setShipments(ctxShipments);
        } else {
            fetchShipments();
        }
        fetchRevenueAccounts();
    }, []);

    // Keep local lists in sync with DataContext updates
    useEffect(() => {
        if (ctxQuotations && ctxQuotations.length > 0) setQuotations(ctxQuotations);
    }, [ctxQuotations]);

    useEffect(() => {
        if (ctxShipments && ctxShipments.length > 0) setShipments(ctxShipments);
    }, [ctxShipments]);

    useEffect(() => {
        if (!canRunSuperAdminBatch || financeMigrationRan || loading || invoices.length === 0) return;
        const runMigration = async () => {
            setFinanceMigrationRan(true);
            try {
                const { migratedInvoices, migratedPOs } = await migrateBridgeFinancialRecords();
                if (migratedInvoices || migratedPOs) {
                    await fetchInvoices();
                }
            } catch (err) {
                console.warn('Finance migration failed:', err?.message || err);
            }
        };
        runMigration();
    }, [canRunSuperAdminBatch, financeMigrationRan, loading, invoices]);

    const fetchRevenueAccounts = async () => {
        try {
            // Use code PREFIX (4xx = Revenue) not type='REVENUE' to ensure all
            // revenue accounts appear, consistent with P&L classification logic.
            const { data, error } = await supabase
                .from('bridge_coa')
                .select('*')
                .like('code', '4%')
                .neq('is_active', false)
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
                .from('bridge_invoices')
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
                .from('freight_pengajuan')
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
            // Map to consistent format and derive totals
            const mapped = (data || []).map(q => {
                const rate = q.exchange_rate || q.exchangeRate || 16000;
                const totalIdr = q.total_idr ?? (q.total_amount ?? q.totalAmount ? ((q.currency === 'IDR') ? (q.total_amount ?? q.totalAmount) : ((q.total_amount ?? q.totalAmount) * rate)) : 0);
                const totalUsd = q.total_usd ?? (q.total_amount ?? q.totalAmount ? ((q.currency === 'USD') ? (q.total_amount ?? q.totalAmount) : ((rate ? (q.total_amount ?? q.totalAmount) / rate : 0))) : 0);
                return {
                    ...q,
                    quotationNumber: q.quotation_number || q.quotationNumber,
                    customerName: q.customer_name || q.customerName,
                    jobNumber: q.job_number || q.jobNumber,
                    totalAmount: q.total_amount || q.totalAmount,
                    total_idr: totalIdr,
                    total_usd: totalUsd,
                    serviceType: q.service_type || q.serviceType
                };
            });
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
                .from('freight_pengajuan')
                .select('*')
                .eq('status', 'approved')
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
                customer_address: quotation.customerAddress || quotation.customer_address || '',
                customer_id: quotation.customer_id || quotation.customerId,
                customer_company: quotation.customerCompany || quotation.customer_company,
                origin: quotation.origin,
                destination: quotation.destination,
                service_type: quotation.serviceType || quotation.service_type,
                billing_currency: quotation.currency || 'IDR',
                exchange_rate: quotation.exchange_rate || quotation.exchangeRate || 1,
                due_date: dueDate.toISOString().split('T')[0],
                cargo_details: {
                    weight: quotation.weight,
                    volume: quotation.volume,
                    commodity: quotation.commodity
                },
                invoice_items: quotation.service_items && quotation.service_items.length > 0
                    ? quotation.service_items.map(item => {
                        const acc = (typeof revenueAccounts !== 'undefined' && revenueAccounts) ? revenueAccounts.find(a => a.code === item.itemCode) : null;
                        return {
                            item_name: acc?.name || item.itemCode || item.name || item.service_name || 'Item',
                            description: item.description || item.name || '',
                            qty: parseFloat(item.quantity) || parseFloat(item.qty) || 1,
                            unit: item.unit || 'Job',
                            rate: parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.rate) || 0,
                            amount: parseFloat(item.amount) || parseFloat(item.total) ||
                                ((parseFloat(item.quantity) || 1) * (parseFloat(item.unitPrice) || parseFloat(item.price) || parseFloat(item.rate) || 0)),
                            tax_amount: typeof item.tax_amount !== 'undefined' ? Number(item.tax_amount) : 0,
                            tax_rate: typeof item.tax_rate !== 'undefined' ? Number(item.tax_rate) : 0,
                            currency: item.currency || quotation.currency || 'IDR',
                            coa_id: acc?.id || item.coa_id || null,
                            coa_code: acc?.code || item.itemCode || item.coa_code || null
                        };
                    })
                    : [{
                        item_name: (quotation.serviceType || quotation.service_type || 'Freight').toUpperCase(),
                        description: `${(quotation.serviceType || quotation.service_type || 'Freight').toUpperCase()} - ${quotation.origin} to ${quotation.destination}`,
                        qty: 1,
                        unit: 'Job',
                        rate: (quotation.billing_currency === 'IDR' || quotation.currency === 'IDR') ? (quotation.total_idr ?? (quotation.totalAmount || quotation.total_amount || 0)) : (quotation.total_usd ?? ((quotation.totalAmount || quotation.total_amount || 0) / (quotation.exchange_rate || quotation.exchangeRate || 16000))),
                        amount: (quotation.billing_currency === 'IDR' || quotation.currency === 'IDR') ? (quotation.total_idr ?? (quotation.totalAmount || quotation.total_amount || 0)) : (quotation.total_usd ?? ((quotation.totalAmount || quotation.total_amount || 0) / (quotation.exchange_rate || quotation.exchangeRate || 16000))),
                        tax_amount: 0,
                        tax_rate: 0,
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
                customer_address: shipment.customer_address || shipment.customerAddress || '',
                customer_id: shipment.customer_id,
                origin: shipment.origin,
                destination: shipment.destination,
                service_type: shipment.service_type,
                billing_currency: shipment.currency || 'IDR',
                exchange_rate: shipment.exchange_rate || shipment.exchangeRate || 1,
                due_date: dueDate.toISOString().split('T')[0],
                cargo_details: {
                    weight: shipment.weight,
                    volume: shipment.volume,
                    commodity: shipment.commodity
                },
                // Bug Fix #1 & #5: Use selling_items OR service_items (whichever is populated).
                // coa_id is taken directly from item.coa_id — do NOT rely on itemCode lookup
                // which never existed on flattened items from SalesQuotation flattenItems().
                invoice_items: (() => {
                    const srcItems = (shipment.selling_items && shipment.selling_items.length > 0)
                        ? shipment.selling_items
                        : (shipment.service_items && shipment.service_items.length > 0)
                            ? shipment.service_items
                            : null;

                    if (srcItems) {
                        return srcItems.map(item => {
                            // coa_id is authoritative from the item itself.
                            // Only look up revenueAccounts if coa_id is missing.
                            const accById = (typeof revenueAccounts !== 'undefined' && revenueAccounts && item.coa_id) ? revenueAccounts.find(a => a.id === item.coa_id) : null;
                            const accByCode = !accById && (typeof revenueAccounts !== 'undefined' && revenueAccounts && item.itemCode) ? revenueAccounts.find(a => a.code === item.itemCode) : null;
                            const acc = accById || accByCode;
                            return {
                                item_name: acc?.name || item.item_name || item.description || item.name || item.service_name || 'Item',
                                description: item.description || item.name || '',
                                qty: parseFloat(item.qty) || parseFloat(item.quantity) || 1,
                                unit: item.unit || 'Job',
                                rate: parseFloat(item.rate) || parseFloat(item.unitPrice) || parseFloat(item.price) || 0,
                                amount: parseFloat(item.amount) || parseFloat(item.total) ||
                                    ((parseFloat(item.qty) || parseFloat(item.quantity) || 1) * (parseFloat(item.rate) || parseFloat(item.unitPrice) || 0)),
                                tax_amount: typeof item.tax_amount !== 'undefined' ? Number(item.tax_amount) : 0,
                                tax_rate: typeof item.tax_rate !== 'undefined' ? Number(item.tax_rate) : 0,
                                currency: item.currency || shipment.currency || 'IDR',
                                // Direct coa_id takes priority - this is the key fix
                                coa_id: item.coa_id || acc?.id || null,
                                coa_code: item.coa_code || acc?.code || item.itemCode || null
                            };
                        });
                    }
                    return [{
                        item_name: (shipment.service_type || 'Freight').toUpperCase(),
                        description: `${(shipment.service_type || 'Freight').toUpperCase()} - ${shipment.origin} to ${shipment.destination}`,
                        qty: 1,
                        unit: 'Shipment',
                        rate: shipment.quoted_amount || 0,
                        amount: shipment.quoted_amount || 0,
                        tax_amount: 0,
                        coa_id: null
                    }];
                })(),
                // Extract COGS from shipment buying_items and old cogs JSON
                cogs_items: (() => {
                    const extractedItems = [];
                    // 1. From Buying Items — Bug Fix #3: carry coa_id so COGS journals post
                    //    to the correct specific HPP account (e.g. 5-01-003 THC), not the default.
                    if (shipment.buying_items && Array.isArray(shipment.buying_items)) {
                        shipment.buying_items.forEach(item => {
                            extractedItems.push({
                                description: item.description || item.item_name || item.name || 'Cost Item',
                                qty: item.qty || item.quantity || 1,
                                unit: item.unit || 'Job',
                                rate: item.rate || item.unitPrice || item.price || 0,
                                amount: item.amount || item.total || 0,
                                vendor: item.vendor || item.supplier || '',
                                currency: item.currency || shipment.currency || 'IDR',
                                coa_id: item.coa_id || null  // ← Key fix: preserve COA mapping
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
                { item_name: '', description: '', qty: 1, unit: 'Job', rate: 0, amount: 0, tax_rate: 0, tax_amount: 0, currency: prev.billing_currency || 'IDR', coa_id: null, coa_code: null }
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

            // Auto-map COA if item_name changes
            if (field === 'item_name') {
                const acc = (typeof revenueAccounts !== 'undefined' && revenueAccounts) ? revenueAccounts.find(a => a.name === value || a.code === value) : null;
                if (acc) {
                    items[index].coa_id = acc.id;
                    items[index].coa_code = acc.code;
                }
            }

            // Auto-calculate amount
            if (field === 'qty' || field === 'rate') {
                items[index].amount = items[index].qty * items[index].rate;
            }

            // Auto-calculate tax_amount from tax_rate percentage
            if (field === 'qty' || field === 'rate' || field === 'tax_rate') {
                const rate = field === 'tax_rate' ? value : (items[index].tax_rate || 0);
                items[index].tax_amount = items[index].amount * (rate / 100);
            }

            return { ...prev, invoice_items: items };
        });
    };

    const handleGlobalTaxRateChange = (rate) => {
        setFormData(prev => ({
            ...prev,
            tax_rate: rate,
            invoice_items: prev.invoice_items.map(item => {
                const amount = item.amount || 0;
                const taxAmount = amount * (rate / 100);
                return { ...item, tax_rate: rate, tax_amount: taxAmount };
            })
        }));
    };
    const calculateTotals = () => {
        const rate = parseFloat(formData.exchange_rate) > 0 ? parseFloat(formData.exchange_rate) : 1;
        const subtotal = formData.invoice_items.reduce((sum, item) => {
            let itemVal = item.amount || 0;
            const itemCurr = item.currency || formData.billing_currency;
            if (itemCurr !== formData.billing_currency) {
                if (formData.billing_currency === 'IDR' && itemCurr !== 'IDR') itemVal *= rate;
                else if (formData.billing_currency !== 'IDR' && itemCurr === 'IDR') itemVal /= rate;
                // simplified mapping for USD/SGD vs IDR assuming IDR is base for non-matching ones except same
            }
            return sum + itemVal;
        }, 0);
        // User wants per-item tax accumulation
        const taxAmount = formData.invoice_items.reduce((sum, item) => {
            let itemTax = Number(item.tax_amount) || 0;
            const itemCurr = item.currency || formData.billing_currency;
            if (itemCurr !== formData.billing_currency) {
                if (formData.billing_currency === 'IDR' && itemCurr !== 'IDR') itemTax *= rate;
                else if (formData.billing_currency !== 'IDR' && itemCurr === 'IDR') itemTax /= rate;
            }
            return sum + itemTax;
        }, 0);
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

        // FIX: Warn if non-IDR currency has exchange_rate = 1 (user likely forgot to set it)
        const selectedCurrencyCheck = formData.billing_currency || 'IDR';
        if (selectedCurrencyCheck !== 'IDR') {
            const rateCheck = parseFloat(formData.exchange_rate) || 0;
            if (rateCheck === 1) {
                const proceed = window.confirm(
                    `⚠️ Perhatian: Kurs ${selectedCurrencyCheck} saat ini adalah ${rateCheck}.\n\n` +
                    `Nilai kurs belum disesuaikan untuk mata uang non-IDR. ` +
                    `Pastikan kurs sudah benar (contoh: USD → 16000).\n\n` +
                    `Lanjutkan tetap membuat invoice dengan kurs ${rateCheck}?`
                );
                if (!proceed) return;
            }
        }

        const normalizeRate = (value) => {
            const parsed = Number(value);
            if (!Number.isFinite(parsed) || parsed <= 0) return 1;
            return parsed; // Kembalikan nilai mentah tanpa dibulatkan agar nilai di atas 0 tetap digunakan apa adanya
        };

        try {
            // 1. Validate duplicates for the same SO / shipment reference.
            // Memperketat: Hanya boleh 1 invoice per mata uang (currency) untuk SO/Job yang sama.
            if (formData.job_number) {
                const { data: allInvoices, error: allCheckError } = await supabase
                    .from('bridge_invoices')
                    .select('id, invoice_number, status, currency, exchange_rate, shipment_id, so_number, job_number, created_at')
                    .eq('job_number', formData.job_number)
                    .not('invoice_number', 'ilike', '%-RB')
                    .neq('status', 'cancelled');

                if (allCheckError) throw allCheckError;

                const selectedShipmentId = formData.shipment_id || selectedShipment?.id || null;
                const selectedSoNumber = formData.so_number || selectedShipment?.so_number || null;
                const selectedCurrency = formData.billing_currency || 'IDR';

                // Cari invoice yang relevan dengan shipment/SO yang sama.
                const relevantInvoices = (allInvoices || []).filter(inv => {
                    if (formData.job_number && inv.job_number === formData.job_number) return true;
                    if (selectedShipmentId && inv.shipment_id === selectedShipmentId) return true;
                    if (selectedSoNumber && inv.so_number === selectedSoNumber) return true;
                    return false;
                });

                // Cari invoice dengan currency yang sama
                const sameCurrencyInvoices = relevantInvoices.filter(inv => (inv.currency || 'IDR') === selectedCurrency);

                if (sameCurrencyInvoices.length > 0) {
                    const duplicateInv = sameCurrencyInvoices[0];
                    alert(
                        `Tidak bisa membuat invoice: Invoice dengan mata uang ${selectedCurrency} sudah terdaftar sebelumnya (${duplicateInv.invoice_number || '-'}) untuk SO/Job ini.\n\n` +
                        `Hanya diperbolehkan maksimal 1 invoice untuk setiap mata uang.`
                    );
                    return;
                }
            }

            const { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin } = calculateTotals();

            // 2. Generate unique invoice number (async)
            // If previous invocies were cancelled, this will auto-generate suffix (e.g. -1)
            const quotationNum = selectedQuotation?.quotation_number || selectedQuotation?.quotationNumber || formData.job_number;
            const invoiceNumber = await generateBridgeInvoiceNumber(quotationNum);

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
                exchange_rate: (formData.billing_currency || 'IDR') === 'IDR' ? 1 : (parseFloat(formData.exchange_rate) > 0 ? parseFloat(formData.exchange_rate) : 1),
                subtotal: subtotal,
                tax_rate: formData.tax_rate,
                tax_amount: taxAmount,
                discount_amount: formData.discount_amount || 0,
                total_amount: total,
                paid_amount: 0,
                outstanding_amount: total,
                status: 'draft',
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
                .from('bridge_invoices')
                .insert([newInvoice])
                .select();

            if (error) throw error;

            const insertedInvoice = data[0];
            await fetchInvoices();

            await logTransaction({
                transactionType: TRANSACTION_TYPES.INVOICE,
                transactionId: insertedInvoice.id,
                referenceNumber: insertedInvoice.invoice_number,
                module: MODULES.FINANCE,
                action: ACTIONS.CREATE,
                description: `Invoice created for ${formData.customer_name || formData.customer_company} - ${formData.job_number}`,
                amount: total,
                currency: formData.billing_currency || 'IDR',
                partnerId: formData.customer_id,
                partnerName: formData.customer_name || formData.customer_company,
                accountId: formData.account_id,
                accountName: formData.account_name,
                status: 'draft',
                paymentMethod: formData.payment_method,
                sourceAction: 'create_invoice',
                submenuContext: 'bridge_invoices',
                user
            });

            setShowCreateModal(false);

            resetForm();
            alert('Invoice created successfully! Invoice will be posted to accounting after manager approval.');
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice: ' + error.message);
        }
    };

    const handleEditInvoice = (invoice) => {
        // Attempt to find original reference
        const q = quotations.find(qt => qt.id === invoice.quotation_id);
        const s = shipments.find(sh => sh.id === invoice.quotation_id); // In legacy some SOs are saved as quotation_id

        if (q) {
            setSelectedQuotation(q);
            setReferenceType('quotation');
        } else if (s) {
            setSelectedShipment(s);
            setReferenceType('so');
        } else {
            setSelectedQuotation(null);
            setSelectedShipment(null);
        }

        // Migrate tax logic for older invoices
        const migratedItems = (invoice.invoice_items || []).map(it => {
            const amount = parseFloat(it.amount) || 0;
            const taxAmount = typeof it.tax_amount !== 'undefined' ? Number(it.tax_amount) : (amount * (invoice.tax_rate || 0) / 100);
            const taxRate = typeof it.tax_rate !== 'undefined' ? Number(it.tax_rate) : (amount > 0 ? (taxAmount / amount) * 100 : (invoice.tax_rate || 0));
            return {
                ...it,
                tax_amount: taxAmount,
                tax_rate: taxRate
            };
        });

        setFormData({
            quotation_id: invoice.quotation_id || '',
            job_number: invoice.job_number || '',
            payment_terms: invoice.payment_terms || 'NET 30',
            invoice_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
            due_date: invoice.due_date || '',
            billing_currency: invoice.currency || 'IDR',
            exchange_rate: invoice.exchange_rate || 1,
            payment_bank_id: invoice.payment_bank_id || '',
            invoice_items: migratedItems,
            cogs_items: invoice.cogs_items || [],
            tax_rate: invoice.tax_rate || 0,
            discount_amount: invoice.discount_amount || 0,
            customer_notes: invoice.customer_notes || '',
            notes: invoice.notes || '',
            consignor: invoice.consignor || '',
            consignee: invoice.consignee || '',
            order_reference: invoice.order_reference || '',
            goods_description: invoice.goods_description || '',
            import_broker: invoice.import_broker || '',
            chargeable_weight: invoice.chargeable_weight || '',
            packages: invoice.packages || '',
            vessel_name: invoice.vessel_name || '',
            voyage_number: invoice.voyage_number || '',
            ocean_bl: invoice.ocean_bl || '',
            house_bl: invoice.house_bl || '',
            etd: invoice.etd || '',
            eta: invoice.eta || '',
            origin: invoice.origin || '',
            destination: invoice.destination || '',
            customer_id: invoice.customer_id || '',
            customer_name: invoice.customer_name || '',
            customer_company: invoice.customer_company || '',
            customer_address: invoice.customer_address || '',
            service_type: invoice.service_type || ''
        });
        
        setIsEditingInvoice(true);
        setEditInvoiceId(invoice.id);
        setShowCreateModal(true);
        setShowViewModal(false);
    };

    const handleUpdateInvoice = async (e) => {
        e.preventDefault();
        
        try {
            // Validate duplicates for the same SO / shipment reference.
            if (formData.job_number) {
                const { data: allInvoices, error: allCheckError } = await supabase
                    .from('bridge_invoices')
                    .select('id, invoice_number, status, currency, exchange_rate, shipment_id, so_number, job_number, created_at')
                    .eq('job_number', formData.job_number)
                    .not('invoice_number', 'ilike', '%-RB')
                    .neq('status', 'cancelled');

                if (allCheckError) throw allCheckError;

                const selectedShipmentId = formData.shipment_id || selectedShipment?.id || null;
                const selectedSoNumber = formData.so_number || selectedShipment?.so_number || null;
                const selectedCurrency = formData.billing_currency || 'IDR';

                // Cari invoice yang relevan dengan shipment/SO yang sama, mengecualikan invoice yang sedang diedit.
                const relevantInvoices = (allInvoices || []).filter(inv => {
                    if (inv.id === editInvoiceId) return false;
                    if (formData.job_number && inv.job_number === formData.job_number) return true;
                    if (selectedShipmentId && inv.shipment_id === selectedShipmentId) return true;
                    if (selectedSoNumber && inv.so_number === selectedSoNumber) return true;
                    return false;
                });

                // Cari invoice dengan currency yang sama
                const sameCurrencyInvoices = relevantInvoices.filter(inv => (inv.currency || 'IDR') === selectedCurrency);

                if (sameCurrencyInvoices.length > 0) {
                    const duplicateInv = sameCurrencyInvoices[0];
                    alert(
                        `Tidak bisa memperbarui invoice: Invoice dengan mata uang ${selectedCurrency} sudah terdaftar sebelumnya (${duplicateInv.invoice_number || '-'}) untuk SO/Job ini.\n\n` +
                        `Hanya diperbolehkan maksimal 1 invoice untuk setiap mata uang.`
                    );
                    return;
                }
            }

            const { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin } = calculateTotals();
            
            const currentInvoice = invoices.find(inv => inv.id === editInvoiceId);
            if (currentInvoice && currentInvoice.paid_amount > 0) {
                alert('Invoice tidak dapat diedit karena sudah terdapat pembayaran tercatat.');
                return;
            }

            const updates = {
                job_number: formData.job_number || '',
                payment_terms: formData.payment_terms,
                invoice_date: formData.invoice_date,
                due_date: formData.due_date,
                currency: formData.billing_currency,
                exchange_rate: formData.billing_currency === 'IDR' ? 1 : (parseFloat(formData.exchange_rate) > 0 ? parseFloat(formData.exchange_rate) : 1),
                payment_bank_id: formData.payment_bank_id || null,
                invoice_items: formData.invoice_items,
                cogs_items: formData.cogs_items || [],
                tax_rate: formData.tax_rate || 0,
                discount_amount: formData.discount_amount || 0,
                customer_notes: formData.customer_notes || '',
                notes: formData.notes || '',
                subtotal: subtotal,
                tax_amount: taxAmount,
                total_amount: total,
                cogs_subtotal: cogsSubtotal,
                gross_profit: grossProfit,
                profit_margin: profitMargin,
                outstanding_amount: total, // since paid_amount is 0
                consignor: formData.consignor || '',
                consignee: formData.consignee || '',
                order_reference: formData.order_reference || '',
                goods_description: formData.goods_description || '',
                import_broker: formData.import_broker || '',
                chargeable_weight: typeof formData.chargeable_weight === 'number' ? formData.chargeable_weight : parseFloat(formData.chargeable_weight) || 0,
                packages: formData.packages || '',
                vessel_name: formData.vessel_name || '',
                voyage_number: formData.voyage_number || '',
                ocean_bl: formData.ocean_bl || '',
                house_bl: formData.house_bl || '',
                etd: formData.etd || null,
                eta: formData.eta || null,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('bridge_invoices')
                .update(updates)
                .eq('id', editInvoiceId);

            if (error) throw error;
            
            // Sync AR transaction if it exists
            await supabase
                .from('bridge_ar_transactions')
                .update({
                    original_amount: total,
                    outstanding_amount: total,
                    due_date: formData.due_date,
                    currency: formData.billing_currency
                })
                .eq('invoice_id', editInvoiceId);
                
            // Sync big AR transaction if it exists
            await supabase
                .from('big_ar_transactions')
                .update({
                    original_amount: total,
                    outstanding_amount: total,
                    due_date: formData.due_date
                })
                .eq('invoice_id', editInvoiceId);

            // Delete old journal entries so they can be recreated with new amounts
            // Bug Fix #4: capture delete result so failures are visible in console
            const { error: delInvJournalErr } = await supabase
                .from('bridge_journal_entries')
                .delete()
                .eq('reference_id', editInvoiceId)
                .in('reference_type', ['ar', 'blink_invoice']);
            if (delInvJournalErr) {
                console.warn('[Invoice Update] ⚠️ Failed to delete old journal entries:', delInvJournalErr.message);
            } else {
                console.log('[Invoice Update] ✅ Old journal entries deleted for Invoice:', editInvoiceId);
            }
                
            // Re-create journal entries for the updated invoice
            const { data: updatedInv } = await supabase
                .from('bridge_invoices')
                .select('*')
                .eq('id', editInvoiceId)
                .single();
                
            if (updatedInv && updatedInv.status === 'unpaid') {
                const coaList = await getAllCOA();
                await createInvoiceJournal({ invoice: updatedInv, coaList });
            }
            
            await fetchInvoices();
            setShowCreateModal(false);
            resetForm();
            alert('Invoice updated successfully!');
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Failed to update invoice: ' + error.message);
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
                { item_name: 'Freight', description: 'Ocean Freight', qty: 1, unit: 'Job', rate: 0, amount: 0, tax_amount: 0, coa_id: null }
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
        setIsEditingInvoice(false);
        setEditInvoiceId(null);
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
            const stripCoaPrefix = (str) => {
                return str.replace(/^[A-Z0-9\s]{1,10}\s*:\s*/gm, '').trim();
            };
            const itemsRows = invoice.invoice_items?.map((item, index) => {
                let rawDesc = String(item.description || item.item_name || '');
                // Split by <br/>, remove duplicates, and join
                let parts = rawDesc.split(/<br\s*\/?>/i).map(p => p.trim()).filter(Boolean);
                
                // Strip COA prefix like "OI : ", "FR : ", etc. from each part
                parts = parts.map(p => stripCoaPrefix(p)).filter(Boolean);
                
                // If parts has more than 1 item, the first item is the COA title (e.g. "Document Fee").
                // We remove it to only show the actual item description.
                if (parts.length > 1) {
                    parts.shift();
                }
                
                // If parts is empty after filtering (meaning description was empty), fallback to item_name
                if (parts.length === 0 && item.item_name) {
                    parts.push(`<b>${stripCoaPrefix(item.item_name.trim())}</b>`);
                }
                
                let uniqueParts = [...new Set(parts)];
                let finalDesc = uniqueParts.join('<br/>');

                return `
                <tr>
                    <td style="text-align: center; vertical-align: top; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px;">${index + 1}</td>
                    <td style="vertical-align: top; text-transform: capitalize; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px;">
                        <span style="color: #444;">${finalDesc}</span>
                    </td>
                    <td style="text-align: center; vertical-align: top; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px;">${item.qty || 1} ${item.unit || ''}</td>
                    <td style="text-align: right; vertical-align: top; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px;">${formatCurrency(item.rate || item.amount || 0, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                    <td style="text-align: right; vertical-align: top; border-bottom: 1px solid #ccc; border-right: 1px solid #ccc; padding: 4px 8px;">${formatCurrency(typeof item.tax_amount !== 'undefined' ? Number(item.tax_amount) : ((item.amount || 0) * (invoice.tax_rate || 0) / 100), invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                    <td style="text-align: right; vertical-align: top; border-bottom: 1px solid #ccc; padding: 4px 8px; padding-right: 10px;">${formatCurrency(item.amount || 0, invoice.currency).replace('Rp ', '').replace('$', '')}</td>
                </tr>
                `;
            }).join('') || '<tr><td colspan="6" style="text-align: center; padding: 10px;">No items</td></tr>';

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
                        .company-logo img { max-height: 64px; max-width: 160px; object-fit: contain; display: block; }
                        .company-logo h1 { margin: 0; font-size: 24px; font-weight: bold; font-style: italic; color: #000; }
                        .company-logo p { margin: 0; font-size: 9px; letter-spacing: 3px; color: #555; text-transform: uppercase; }
                        .company-address { text-align: right; font-size: 10px; line-height: 1.4; color: #333; }

                        /* Invoice Title Bar */
                        .invoice-title-bar { 
                            background-color: #FF9B00;
                            color: #000000;
                            padding: 6px 10px; margin-bottom: 20px; font-weight: bold; font-size: 16px; 
                            display: flex; justify-content: space-between; align-items: center;
                            border: none;
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
                        .shipment-header { background: #FF9B00; color: #000000; font-weight: bold; padding: 4px 8px; text-transform: uppercase; font-size: 11px; border-bottom: none; }
                        
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
                        .grand-total { background: #FF9B00; color: #000000; padding: 10px; font-size: 13px; text-transform: uppercase; font-weight: bold; }

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
                            background: #FF9B00; color: white; 
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
                                ${companySettings?.logo_url
                                    ? `<img src="${companySettings.logo_url}" alt="Logo" />`
                                    : `<h1>${companySettings?.company_name?.split(' ')[0] || 'FREIGHT'}ONE</h1><p>LOGISTICS SOLUTIONS</p>`
                                }
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
                             <span style="font-size: 10px; font-weight: normal; color: rgba(0,0,0,0.6);">Page 1 of 1</span>
                        </div>

                        <!-- Top Info -->
                        <div class="info-section">
                            <div class="info-left">
                                <div style="margin-bottom: 4px; font-weight: bold; font-size: 9px; color: #555;">BILL TO / CUSTOMER:</div>
                                <div style="font-weight: bold; font-size: 12px; margin-bottom: 3px;">${invoice.customer_name}</div>
                                <div style="margin-bottom: 3px; font-size: 10px;">
                                    ${(() => {
                                        const addr = findBusinessPartnerAddress(invoice, bridgeBusinessPartners, false);
                                        return addr && addr.trim() !== '-' ? String(addr).replace(/\n/g, '<br>') : '';
                                    })()}
                                </div>
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
                        <div style="margin-bottom: 2px; font-weight: bold; font-size: 11px; margin-top: 10px;">CHARGES BREAKDOWN</div>
                        <table class="charges-table">
                            <thead>
                                <tr>
                                    <th style="width: 5%; text-align: center;">NO</th>
                                    <th style="width: 35%; text-align: left; padding-left: 10px;">DESCRIPTION</th>
                                    <th style="width: 10%; text-align: center;">QTY</th>
                                    <th style="width: 15%; text-align: right;">UNIT PRICE</th>
                                    <th style="width: 15%; text-align: right;">TAX</th>
                                    <th style="width: 20%; text-align: right; padding-right: 10px;">TOTAL</th>
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
                                    <span>TAX Total</span>
                                    <span>${formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
                                </div>
                                 <div class="totals-row grand-total">
                                    <span>TOTAL AMOUNT</span>
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

                                <div style="margin-top: 10px; border: 1px solid #d7d7d7; background: #fafafa;">
                                    <div style="padding: 8px 10px; font-size: 10px; line-height: 1.55; border-bottom: 1px solid #e3e3e3; font-style: normal;">
                                        All payments shall be made in full amount, except for withholding tax deductions. The full invoiced amount must be received by the Seller within thirty (30) calendar days from the invoice date.
                                    </div>
                                    <div style="padding: 8px 10px; font-size: 10px; line-height: 1.55; font-style: normal;">
                                        Any payment received after the thirty (30)-day due date shall be subject to a late payment charge of 2% of the total invoice amount per month, calculated from the due date until the date on which full payment is received.
                                    </div>
                                </div>
                                
                                <div style="margin-top: 10px; font-style: italic; white-space: pre-line;">
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
        if (!canCreate('bridge_invoices') && !canEdit('bridge_invoices')) {
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
                .from('bridge_invoices')
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

    // ── Create Reimbursement Invoice ───────────────────────────────────────────
    // Creates separate invoice with -RB suffix linked to original invoice
    // Blocked if original invoice has partial payments
    const handleCreateReimbursement = async (invoice, newItems, amendmentNote) => {
        if (!canEdit('bridge_invoices')) {
            alert('Anda tidak memiliki hak akses untuk memanipulasi (Edit) invoice.');
            return;
        }

        // Validate: Cannot create reimbursement if invoice has partial payments
        if (invoice.paid_amount && invoice.paid_amount > 0) {
            alert('❌ Reimbursement tidak dapat dibuat untuk invoice dengan pembayaran sebagian.\n\nInvoice ini sudah menerima pembayaran. Hubungi finance team untuk adjustment.');
            return;
        }

        try {
            const taxRate = invoice.tax_rate || 0;
            const discountAmount = invoice.discount_amount || 0;

            // Generate new reimbursement invoice number with -RB suffix
            const baseInvoiceNumber = invoice.invoice_number;
            const reimbursementInvoiceNumber = `${baseInvoiceNumber}-RB`;

            // Calculate totals for new items
            const newItemsSubtotal = newItems.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);
            const newItemsTax = newItems.reduce((s, it) => s + (parseFloat(it.tax_amount) || 0), 0);

            // Merge existing + new items (for original invoice notes only)
            const existingItems = invoice.invoice_items || [];
            const processedNew = newItems.map(it => ({
                ...it,
                tax_amount: typeof it.tax_amount !== 'undefined' ? Number(it.tax_amount) : ((parseFloat(it.amount) || 0) * taxRate / 100)
            }));

            // Build amendment notes for original invoice
            const timestamp = new Date().toISOString();
            const prevNote = invoice.notes || '';
            const amendNote = `[REIMBURSEMENT ${timestamp.slice(0, 10)}] ${amendmentNote || 'Reimbursement invoice created'}. See ${reimbursementInvoiceNumber} for additional charges.`;
            const updatedNotes = prevNote ? `${prevNote}\n${amendNote}` : amendNote;

            // ── 1. Create NEW Reimbursement Invoice ──────────────────────────────
            const reimbursementData = {
                job_number: invoice.job_number || '',
                quotation_id: invoice.quotation_id || null,
                shipment_id: invoice.shipment_id || null,
                so_number: invoice.so_number || null,
                customer_id: invoice.customer_id,
                customer_name: invoice.customer_name,
                invoice_number: reimbursementInvoiceNumber,
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: invoice.due_date || null,
                currency: invoice.currency,
                exchange_rate: invoice.exchange_rate || 1,
                payment_terms: invoice.payment_terms || 'NET 30',
                payment_bank_id: invoice.payment_bank_id || null,
                invoice_items: processedNew,
                cogs_items: [],
                subtotal: newItemsSubtotal,
                tax_amount: newItemsTax,
                tax_rate: taxRate,
                discount_amount: 0,
                total_amount: newItemsSubtotal + newItemsTax,
                paid_amount: 0,
                outstanding_amount: newItemsSubtotal + newItemsTax,
                status: 'draft',
                is_reimbursement: true,
                reimbursement_reference_invoice_id: invoice.id,
                notes: amendmentNote || 'Reimbursement invoice for additional charges',
                consignor: invoice.consignor || null,
                consignee: invoice.consignee || null,
                order_reference: invoice.order_reference || null,
                goods_description: invoice.goods_description || null,
                import_broker: invoice.import_broker || null,
                chargeable_weight: invoice.chargeable_weight || null,
                packages: invoice.packages || null,
                vessel_name: invoice.vessel_name || null,
                voyage_number: invoice.voyage_number || null,
                ocean_bl: invoice.ocean_bl || null,
                house_bl: invoice.house_bl || null,
                etd: invoice.etd || null,
                eta: invoice.eta || null,
                containers: invoice.containers || null,
                created_at: timestamp,
                updated_at: timestamp,
            };

            const { data: reimb, error: reimbError } = await supabase
                .from('bridge_invoices')
                .insert([reimbursementData])
                .select();

            if (reimbError) throw reimbError;

            // ── 2. Update Original Invoice with Amendment Notes ─────────────────
            const { data, error } = await supabase
                .from('bridge_invoices')
                .update({
                    notes: updatedNotes,
                    updated_at: timestamp,
                })
                .eq('id', invoice.id)
                .select();

            if (error) throw error;

            alert(`✅ Reimbursement invoice berhasil dibuat!\n\nOriginal Invoice: ${invoice.invoice_number}\nReimbursement: ${reimbursementInvoiceNumber}\nAmount: ${formatCurrency(newItemsSubtotal + newItemsTax, invoice.currency)}\n\n⚠️ Reimbursement invoice dalam status Draft — silakan review dan approve.`);

            await fetchInvoices();
            setShowReimbursementModal(false);
            setReimbursementInvoice(null);
            setShowViewModal(false);
            setSelectedInvoice(null);
        } catch (error) {
            console.error('Error creating reimbursement:', error);
            alert('Failed to create reimbursement: ' + error.message);
        }
    };



    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = !searchTerm ||
            inv.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.job_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.customer_name?.toLowerCase().includes(searchTerm.toLowerCase());

        if (!matchesSearch) return false;

        // Default: hide cancelled and rejected unless explicitly filtered
        if (filter === 'all') {
            return inv.status !== 'cancelled' && inv.status !== 'rejected';
        }

        // Status filter
        if (filter === 'unpaid') return inv.status === 'unpaid' || inv.status === 'partially_paid';
        return inv.status === filter;
    });

    const isAllFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedInvoiceIds.includes(inv.id));

    const toggleSelectInvoice = (invoiceId) => {
        setSelectedInvoiceIds(prev => (
            prev.includes(invoiceId)
                ? prev.filter(id => id !== invoiceId)
                : [...prev, invoiceId]
        ));
    };

    const toggleSelectAllFiltered = () => {
        if (isAllFilteredSelected) {
            setSelectedInvoiceIds(prev => prev.filter(id => !filteredInvoices.some(inv => inv.id === id)));
            return;
        }

        setSelectedInvoiceIds(prev => {
            const merged = new Set(prev);
            filteredInvoices.forEach(inv => merged.add(inv.id));
            return Array.from(merged);
        });
    };

    // Calculate summary stats excluding draft, manager_approval, cancelled, and rejected
    const activeInvoices = invoices.filter(inv => !['draft', 'manager_approval', 'cancelled', 'rejected'].includes(inv.status));
    const totalRevenue = activeInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const totalOutstanding = activeInvoices.reduce((sum, inv) => sum + (inv.outstanding_amount || 0), 0);
    const overdueCount = activeInvoices.filter(inv => inv.status === 'overdue').length;

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

    const handleCleanseAllBridgeInvoices = async () => {
        if (!canCleanseBridgeInvoice) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk cleansing Invoice Bridge.');
            return;
        }
        if (invoices.length === 0) {
            alert('Tidak ada data invoice Bridge untuk dihapus.');
            return;
        }

        const confirm1 = confirm(`Cleansing akan menghapus SEMUA invoice Bridge (${invoices.length} baris) beserta AR, pembayaran, dan jurnal terkait. Lanjutkan?`);
        if (!confirm1) return;

        const confirm2 = confirm('Konfirmasi terakhir: semua data invoice Bridge akan dihapus permanen. Yakin lanjut?');
        if (!confirm2) return;

        try {
            setIsCleansing(true);
            setCleanseProgress('Memulai cleansing invoice Bridge...');
            const success = await deleteBridgeInvoiceCascade(invoices.map(inv => inv.id), {
                onProgress: (message) => setCleanseProgress(message)
            });
            if (!success) return;
            await fetchInvoices();
            alert('✅ Cleansing invoice Bridge selesai.');
        } catch (error) {
            console.error('Error cleansing bridge invoices:', error);
            alert('❌ Gagal cleansing invoice Bridge: ' + (error.message || error));
        } finally {
            setIsCleansing(false);
        }
    };

    const handleDeleteSelectedBridgeInvoices = async () => {
        if (!canCleanseBridgeInvoice) {
            alert('Akses Ditolak: Anda tidak memiliki hak untuk menghapus Invoice Bridge.');
            return;
        }
        if (selectedInvoiceIds.length === 0) {
            alert('Pilih minimal 1 invoice Bridge untuk dihapus.');
            return;
        }

        const confirm1 = confirm(`Hapus ${selectedInvoiceIds.length} invoice Bridge terpilih beserta AR, payment, dan jurnal terkait?`);
        if (!confirm1) return;
        const confirm2 = confirm('Konfirmasi terakhir: data terpilih akan dihapus permanen. Lanjutkan?');
        if (!confirm2) return;

        try {
            setIsCleansing(true);
            setCleanseProgress('Memulai hapus invoice Bridge terpilih...');
            const success = await deleteBridgeInvoiceCascade(selectedInvoiceIds, {
                onProgress: (message) => setCleanseProgress(message)
            });
            if (!success) return;
            await fetchInvoices();
            setSelectedInvoiceIds([]);
            alert('✅ Invoice Bridge terpilih berhasil dihapus.');
        } catch (error) {
            console.error('Error deleting selected bridge invoices:', error);
            alert('❌ Gagal hapus invoice Bridge terpilih: ' + (error.message || error));
        } finally {
            setIsCleansing(false);
        }
    };

    // (migration helper removed)

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Invoice Management</h1>
                    <p className="text-silver-dark mt-1">Kelola invoice dan tracking pembayaran</p>
                </div>
                    <div className="flex items-center gap-3">
                    {canRunSuperAdminBatch && (
                        <>
                            <Button
                                onClick={handleDeleteSelectedBridgeInvoices}
                                variant="danger"
                                icon={Trash}
                                disabled={selectedInvoiceIds.length === 0 || isCleansing}
                            >
                                Hapus Terpilih ({selectedInvoiceIds.length})
                            </Button>
                            <Button
                                onClick={handleCleanseAllBridgeInvoices}
                                variant="danger"
                                icon={Trash}
                                disabled={invoices.length === 0 || isCleansing}
                            >
                                {isCleansing ? 'Cleansing...' : 'Bersihkan Semua Data'}
                            </Button>
                        </>
                    )}
                    <Button onClick={handleExportXLS} variant="secondary" icon={Download}>
                        Export XLS
                    </Button>
                    {canCreate('bridge_invoices') && (
                        <Button onClick={() => setShowCreateModal(true)} icon={Plus}>
                            Generate Invoice
                        </Button>
                    )}
                </div>
            </div>

            {isCleansing && (
                <div className="glass-card px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10">
                    <p className="text-xs text-amber-300">Progress Cleansing: {cleanseProgress || 'Sedang memproses...'}</p>
                </div>
            )}

            {/* Summary Cards - Compact */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-silver-dark">Total Invoices</p>
                        <FileText className="w-4 h-4 text-blue-400" />
                    </div>
                    <p className="text-xl font-bold text-silver-light">{activeInvoices.length}</p>
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
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">
                                    <input
                                        type="checkbox"
                                        checked={isAllFilteredSelected}
                                        onChange={toggleSelectAllFiltered}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-4 h-4"
                                    />
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Invoice #</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Job Number</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Customer</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Date</th>
                                <th className="px-3 py-2 text-left text-xs font-semibold text-white uppercase whitespace-nowrap">Due Date</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Tax</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Amount</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-white uppercase whitespace-nowrap">Outstanding</th>
                                <th className="px-3 py-2 text-center text-xs font-semibold text-white uppercase whitespace-nowrap">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredInvoices.length === 0 ? (
                                <tr>
                                    <td colSpan="10" className="px-3 py-8 text-center text-silver-dark">
                                        <FileText className="w-10 h-10 text-silver-dark mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">
                                            {filter === 'all'
                                                ? 'Belum ada invoice yang diproses.'
                                                : `Tidak ada invoice dengan status "${statusConfig[filter]?.label || filter}"`}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredInvoices.map((invoice) => (
                                    <tr
                                        key={invoice.id}
                                        className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                        onClick={() => {
                                            setSelectedInvoice(invoice);
                                            setShowViewModal(true);
                                        }}
                                    >
                                        <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={selectedInvoiceIds.includes(invoice.id)}
                                                onChange={() => toggleSelectInvoice(invoice.id)}
                                                className="w-4 h-4"
                                            />
                                        </td>
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
                                            <span className="text-silver-dark">{formatCurrency(invoice.tax_amount || 0, invoice.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className="font-semibold text-silver-light">{formatCurrency(invoice.subtotal ?? invoice.total_amount, invoice.currency)}</span>
                                        </td>
                                        <td className="px-3 py-2 text-right whitespace-nowrap">
                                            <span className={`font-semibold ${invoice.outstanding_amount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                                                {formatCurrency(invoice.outstanding_amount, invoice.currency)}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusConfig[invoice.status]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                                {statusConfig[invoice.status]?.label || invoice.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Invoice Modal */}
            {
                showCreateModal && (
                    <InvoiceCreateModal
                        isEditing={isEditingInvoice}
                        editInvoiceId={editInvoiceId}
                        invoices={invoices}
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
                        handleCreateInvoice={isEditingInvoice ? handleUpdateInvoice : handleCreateInvoice}
                        formatCurrency={formatCurrency}
                        bankAccounts={bankAccounts}
                        revenueAccounts={revenueAccounts}
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
                            setReimbursementInvoice(selectedInvoice);
                            setShowReimbursementModal(true);
                        }}
                        statusConfig={statusConfig}
                        canEditInvoice={canEdit('bridge_invoices')}
                        canSubmitInvoice={canCreate('bridge_invoices') || canEdit('bridge_invoices')}
                        onEdit={() => handleEditInvoice(selectedInvoice)}
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
                        bridgeBusinessPartners={bridgeBusinessPartners}
                        onClose={() => {
                            setShowPrintPreview(false);
                            setPreviewInvoiceData(null);
                        }}
                        onPrint={() => handlePrintInvoice(previewInvoiceData)}
                    />
                )
            }
            {/* Create Reimbursement Invoice Modal */}
            {
                showReimbursementModal && reimbursementInvoice && (
                    <ReimbursementModal
                        invoice={reimbursementInvoice}
                        formatCurrency={formatCurrency}
                        revenueAccounts={revenueAccounts}
                        onClose={() => {
                            setShowReimbursementModal(false);
                            setReimbursementInvoice(null);
                        }}
                        onSave={handleCreateReimbursement}
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
const InvoiceCreateModal = ({ isEditing, editInvoiceId, invoices = [], quotations, shipments, formData, setFormData, selectedQuotation, selectedShipment,
    referenceType, setReferenceType, handleQuotationSelect, handleShipmentSelect, handlePaymentTermsChange,
    addInvoiceItem, removeInvoiceItem, updateInvoiceItem, calculateTotals, handleGlobalTaxRateChange,
    handleCreateInvoice, formatCurrency, onClose, bankAccounts, revenueAccounts }) => {

    const { subtotal, taxAmount, total, cogsSubtotal, grossProfit, profitMargin } = calculateTotals();

    const getUsedCurrenciesForSelectedJob = () => {
        const targetJobNumber = formData.job_number;
        const targetShipmentId = formData.shipment_id;
        const targetSoNumber = formData.so_number;
        if (!targetJobNumber && !targetShipmentId && !targetSoNumber) return [];
        const activeInvoicesForJob = invoices.filter(inv => {
            const matchesJob = targetJobNumber && inv.job_number === targetJobNumber;
            const matchesShipment = targetShipmentId && inv.shipment_id === targetShipmentId;
            const matchesSo = targetSoNumber && inv.so_number === targetSoNumber;
            return (matchesJob || matchesShipment || matchesSo) &&
                inv.status !== 'cancelled' &&
                (!isEditing || inv.id !== editInvoiceId) &&
                !inv.invoice_number.toUpperCase().endsWith('-RB');
        });
        return activeInvoicesForJob.map(inv => inv.currency || 'IDR');
    };

    // Local UI state for COA dropdowns within the modal
    const [coaSearchMapInv, setCoaSearchMapInv] = useState({});    // { [itemIndex]: searchTerm }
    const [coaDropdownMapInv, setCoaDropdownMapInv] = useState({}); // { [itemIndex]: boolean open }

    // Blend both quotations and shipments so user can select either pengajuan (inbound/outbound) or shipment
    const blendedReferences = [
        // Quotations first
        ...quotations.map(q => ({
            id: q.id,
            type: 'quotation',
            combinedId: `quotation-${q.id}`,
            label: `[PQ] ${q.quotationNumber || q.jobNumber || q.quotation_number || q.jobNumber || '-'} - ${q.customerName || q.customer_name || q.customer || '-'} (${q.origin || '-'} → ${q.destination || '-'})`,
            data: q
        })),
        // Shipments (SO)
        ...shipments.map(s => ({
            id: s.id,
            type: 'shipment',
            combinedId: `shipment-${s.id}`,
            label: `[SO] ${s.so_number || s.job_number || s.jobNumber || '-'} - ${s.customer || '-'} (${s.origin || '-'} → ${s.destination || '-'})`,
            data: s
        }))
    ];

    const handleReferenceSelect = (e) => {
        const selectedCombined = e.target.value;
        const reference = blendedReferences.find(r => r.combinedId === selectedCombined);

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
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-5xl">
            <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold gradient-text">
                            {isEditing ? 'Edit Invoice' : 'Create New Invoice'}
                        </h2>
                        <p className="text-silver-dark text-sm mt-1">
                            {isEditing ? 'Make changes to the invoice details' : 'Draft a new invoice from Sales Order (SO)'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-dark-surface rounded-full smooth-transition text-silver-dark hover:text-silver-light">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleCreateInvoice} className="space-y-6">
                    {/* Reference Selection */}
                    {!isEditing && (
                        <div className="glass-card p-4 rounded-lg">
                            <label className="block text-[11px] font-semibold text-silver-light mb-1.5">
                                Referensi (Sales Order) <span className="text-red-400">*</span>
                            </label>
                            <div className="text-[11px] text-silver-dark mb-2">
                                <span className="mr-3">Pengajuan: <strong className="text-silver-light">{quotations.length}</strong></span>
                                <span>Shipments: <strong className="text-silver-light">{shipments.length}</strong></span>
                            </div>
                            <select
                                value={selectedQuotation ? `quotation-${selectedQuotation.id}` : (selectedShipment ? `shipment-${selectedShipment.id}` : '')}
                                onChange={handleReferenceSelect}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded text-silver-light text-[11px]"
                                required
                            >
                                <option value="">-- Pilih Sales Order / Pengajuan --</option>
                                {quotations.length > 0 && (
                                    <optgroup label={`Pengajuan (${quotations.length})`}>
                                        {quotations.map(q => (
                                            <option key={`quotation-${q.id}`} value={`quotation-${q.id}`}>
                                                {`[PQ] ${q.quotationNumber || q.jobNumber || q.jobNumber || q.quotation_number || '-'} - ${q.customerName || q.customer_name || q.customer || '-'}`}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                                {shipments.length > 0 && (
                                    <optgroup label={`Shipments (${shipments.length})`}>
                                        {shipments.map(s => (
                                            <option key={`shipment-${s.id}`} value={`shipment-${s.id}`}>
                                                {`[SO] ${s.so_number || s.job_number || s.jobNumber || '-'} - ${s.customer || '-'}`}
                                            </option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>

                        </div>
                    )}

                    {/* Existing Invoices Indicator */}
                    {(selectedShipment || selectedQuotation) && (
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
                                <h3 className="text-[11px] font-semibold text-accent-orange mb-1.5">Informasi SO</h3>
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
                            <div className="col-span-1 md:col-span-4 lg:col-span-4">
                                <label className="block text-[10px] text-silver-dark mb-1">Customer Address (Printed in Invoice)</label>
                                <textarea
                                    value={formData.customer_address || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, customer_address: e.target.value }))}
                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-xs"
                                    placeholder="Alamat Customer..."
                                    rows="2"
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
                                    let defaultRate = 1;
                                    if (newCurrency !== 'IDR') {
                                        if (selectedQuotation && (selectedQuotation.currency === newCurrency || selectedQuotation.billing_currency === newCurrency)) {
                                            defaultRate = selectedQuotation.exchange_rate || selectedQuotation.exchangeRate || 1;
                                        } else if (selectedShipment && (selectedShipment.currency === newCurrency || selectedShipment.billing_currency === newCurrency)) {
                                            defaultRate = selectedShipment.exchange_rate || selectedShipment.exchangeRate || 1;
                                        }
                                    }
                                    setFormData(prev => ({
                                        ...prev,
                                        billing_currency: newCurrency,
                                        exchange_rate: newCurrency === 'IDR' ? 1 : (defaultRate || prev.exchange_rate || 1)
                                    }));
                                }}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                required
                            >
                                {(() => {
                                    const usedCurrencies = getUsedCurrenciesForSelectedJob();
                                    const options = [
                                        { value: 'IDR', label: 'IDR (Rupiah)' },
                                        { value: 'USD', label: 'USD (US Dollar)' },
                                        { value: 'SGD', label: 'SGD (Singapore Dollar)' },
                                        { value: 'EUR', label: 'EUR (Euro)' },
                                        { value: 'RMB', label: 'RMB (Chinese Yuan)' }
                                    ];
                                    const filteredOptions = options.filter(opt => !usedCurrencies.includes(opt.value));
                                    // Ensure the current selected currency is visible even if it's in usedCurrencies (e.g., when editing or first selected)
                                    if (formData.billing_currency && !filteredOptions.some(opt => opt.value === formData.billing_currency)) {
                                        const originalOpt = options.find(opt => opt.value === formData.billing_currency) || {
                                            value: formData.billing_currency,
                                            label: formData.billing_currency
                                        };
                                        filteredOptions.push(originalOpt);
                                    }
                                    return filteredOptions.map(opt => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ));
                                })()}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-silver-light mb-1">
                                Kurs Rate ({formData.billing_currency || 'USD'} ke IDR)
                                {formData.billing_currency !== 'IDR' && (
                                    <span className="text-red-400 ml-1">*</span>
                                )}
                            </label>
                            <input
                                type="number"
                                value={formData.exchange_rate}
                                onChange={(e) => setFormData(prev => ({ ...prev, exchange_rate: e.target.value }))}
                                className={`w-full px-2.5 py-1.5 bg-dark-surface border rounded-lg text-silver-light ${
                                    formData.billing_currency !== 'IDR' && parseFloat(formData.exchange_rate) <= 0
                                        ? 'border-red-500 ring-1 ring-red-500/40'
                                        : 'border-dark-border'
                                }`}
                                disabled={formData.billing_currency === 'IDR'}
                                min="0.000001"
                                step="any"
                                placeholder="e.g., 16000"
                            />
                            <p className={`text-xs mt-1 ${
                                formData.billing_currency !== 'IDR' && parseFloat(formData.exchange_rate) <= 0
                                    ? 'text-red-400'
                                    : 'text-silver-dark'
                            }`}>
                                {formData.billing_currency === 'IDR'
                                    ? 'Tidak diperlukan untuk IDR'
                                    : parseFloat(formData.exchange_rate) <= 0
                                        ? `⚠️ Kurs rate harus lebih besar dari 0`
                                        : `1 ${formData.billing_currency} = Rp ${Number(formData.exchange_rate || 1).toLocaleString('id-ID')}`
                                }
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

                        <div className="overflow-x-auto pb-40">
                            <table className="min-w-[1100px] table-fixed w-full">
                                <thead className="bg-accent-orange">
                                    <tr>
                                        <th className="px-2 py-2 text-center text-xs text-white w-10 font-normal">No</th>
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[200px] font-normal">Item (COA)</th>
                                        <th className="px-2 py-2 text-left text-xs text-white min-w-[200px] font-normal">Description</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-32 font-normal">Qty</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-28 font-normal">Unit</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-20 font-normal">Curr</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[140px] font-normal">Price</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[80px] font-normal">Tax %</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[140px] font-normal">Tax Amt</th>
                                        <th className="px-2 py-2 text-right text-xs text-white min-w-[160px] font-normal">Total</th>
                                        <th className="px-2 py-2 text-center text-xs text-white w-10 font-normal">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {formData.invoice_items.map((item, index) => (
                                        <tr key={index} className="hover:bg-dark-surface/50 smooth-transition">
                                            <td className="px-2 py-2 text-center text-silver-light text-xs">{index + 1}</td>
                                            <td className="px-3 py-2">
                                                {/* COA Revenue Dropdown Picker */}
                                                <div className="relative">
                                                    <div
                                                        className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded cursor-pointer flex justify-between items-center text-sm shadow-sm"
                                                        onClick={() => setCoaDropdownMapInv(prev => ({ ...prev, [index]: !prev[index] }))}
                                                    >
                                                        <span className={item.item_name ? 'text-black font-semibold truncate text-xs' : 'text-gray-500 text-xs'}>
                                                            {item.item_name || 'Pilih COA...'}
                                                        </span>
                                                        <span className="text-black text-xs ml-1">▼</span>
                                                    </div>
                                                    {coaDropdownMapInv[index] && (
                                                        <div className="absolute z-50 top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-2xl max-h-52 flex flex-col w-full min-w-[280px]">
                                                            <div className="p-2 border-b border-gray-200">
                                                                <input
                                                                    type="text"
                                                                    placeholder="Cari kode / nama akun revenue..."
                                                                    value={coaSearchMapInv[index] || ''}
                                                                    onChange={e => setCoaSearchMapInv(prev => ({ ...prev, [index]: e.target.value }))}
                                                                    className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded text-black text-xs focus:outline-none focus:border-blue-500"
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <div className="overflow-y-auto flex-1">
                                                                {(() => {
                                                                    const q = (coaSearchMapInv[index] || '').toLowerCase();
                                                                    const filtered = q
                                                                        ? revenueAccounts.filter(a =>
                                                                            a.name?.toLowerCase().includes(q) ||
                                                                            a.code?.toLowerCase().includes(q))
                                                                        : revenueAccounts;
                                                                    return filtered.slice(0, 50).length === 0
                                                                        ? <div className="px-3 py-2 text-black text-xs">Tidak ditemukan</div>
                                                                        : filtered.slice(0, 50).map(acc => (
                                                                            <button
                                                                                type="button"
                                                                                key={acc.id}
                                                                                onClick={() => {
                                                                                    updateInvoiceItem(index, 'item_name', acc.name);
                                                                                    updateInvoiceItem(index, 'coa_id', acc.id);
                                                                                    updateInvoiceItem(index, 'coa_code', acc.code);
                                                                                    setCoaDropdownMapInv(prev => ({ ...prev, [index]: false }));
                                                                                    setCoaSearchMapInv(prev => ({ ...prev, [index]: '' }));
                                                                                }}
                                                                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-xs border-b border-gray-100 last:border-0 ${item.coa_id === acc.id ? 'bg-blue-50 text-blue-700 font-bold' : 'text-black font-medium'}`}
                                                                            >
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="font-mono text-gray-500 text-[10px] w-20 shrink-0">{acc.code}</span>
                                                                                    <span className="flex-1 truncate">{acc.name}</span>
                                                                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 bg-green-100 text-green-700">REV</span>
                                                                                </div>
                                                                            </button>
                                                                        ));
                                                                })()}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 min-w-[200px]">
                                                <input
                                                    type="text"
                                                    value={item.description}
                                                    onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                    placeholder="Deskripsi layanan"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 w-32 text-center">
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
                                            <td className="px-3 py-2 w-28 text-center">
                                                <input
                                                    type="text"
                                                    value={item.unit}
                                                    onChange={(e) => updateInvoiceItem(index, 'unit', e.target.value)}
                                                    className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                                    placeholder="Unit"
                                                    required
                                                />
                                            </td>
                                            <td className="px-3 py-2 w-20 text-center">
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
                                            <td className="px-3 py-2 text-right min-w-[140px]">
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
                                            <td className="px-2 py-2 text-right min-w-[80px]">
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number"
                                                        value={item.tax_rate ?? ''}
                                                        onChange={(e) => updateInvoiceItem(index, 'tax_rate', parseFloat(e.target.value) || 0)}
                                                        className="w-14 px-1 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-right"
                                                        min="0"
                                                        max="100"
                                                        step="0.01"
                                                        placeholder="0"
                                                    />
                                                    <span className="text-silver-dark text-xs">%</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right min-w-[140px]">
                                                <span className="text-silver-dark text-sm">{formatCurrency(item.tax_amount || 0, item.currency || formData.billing_currency)}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-semibold min-w-[160px]">
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
                                Global Tax Rate (%)
                            </label>
                            <input
                                type="number"
                                value={formData.tax_rate}
                                onChange={(e) => handleGlobalTaxRateChange(parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="e.g., 11"
                            />
                            <p className="text-[10px] text-silver-dark mt-1">
                                Mengubah ini akan mengupdate semua item di atas
                            </p>
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
                                <span className="text-silver-dark">Tax (from items):</span>
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
                            {isEditing ? 'Update Invoice' : 'Buat Invoice'}
                        </button>
                    </div>
                </form>
            </div >
        </Modal >
    );
};

// Invoice View Modal Component
const InvoiceViewModal = ({ invoice, formatCurrency, onClose, onPayment, onPrint, onPreview, onSubmit, onAddItem, statusConfig, canEditInvoice, canSubmitInvoice, bankAccounts, onInvoiceUpdate, onEdit }) => {
    const [payments, setPayments] = useState([]);
    const [loadingPayments, setLoadingPayments] = useState(true);
    const [selectedBankId, setSelectedBankId] = useState(invoice.payment_bank_id || '');
    const [savingBank, setSavingBank] = useState(false);

    const handleBankChange = async (bankId) => {
        setSelectedBankId(bankId);
        setSavingBank(true);
        try {
            const { error } = await supabase
                .from('bridge_invoices')
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

            // Strategy 1: match by reference_id = invoice.id (direct match)
            const { data: d1 } = await supabase
                .from('bridge_payments')
                .select('*')
                .or(`reference_type.eq.invoice,reference_type.eq.ar_payment,payment_type.eq.incoming`)
                .eq('reference_id', invoice.id)
                .order('payment_date', { ascending: false });

            // Strategy 2: match by invoice_number stored as reference_number
            const { data: d2 } = await supabase
                .from('bridge_payments')
                .select('*')
                .eq('reference_number', invoice.invoice_number)
                .order('payment_date', { ascending: false });

            // Merge and deduplicate by id
            const merged = [...(d1 || []), ...(d2 || [])];
            const seen = new Set();
            const unique = merged.filter(p => {
                if (seen.has(p.id)) return false;
                seen.add(p.id);
                return true;
            });

            setPayments(unique);
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                        <div className="grid grid-cols-1 gap-4 md:col-span-2 xl:col-span-1">
                            {/* Shipment Details Card */}
                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 mb-3">
                                    <Receipt className="w-4 h-4 text-accent-orange" />
                                    <h3 className="text-sm font-semibold text-accent-orange">Shipment</h3>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="text-silver-dark">Route:</span>
                                        <span className="text-silver-light ml-2 whitespace-normal break-words leading-snug inline-block align-top">
                                            {invoice.origin} → {invoice.destination}
                                        </span>
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
                                        <th className="py-2.5 px-4 text-white font-semibold text-xs tracking-wider uppercase text-right w-32">Tax</th>
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
                                            <td className="px-4 py-3 text-right text-silver-light align-top">{formatCurrency(item.tax_amount || 0, invoice.currency)}</td>
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
                                    <span className="text-silver-dark">Tax (from items):</span>
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

                        {/* Create Reimbursement — always visible, but blocked if partial payment exists */}
                        {onAddItem && canEditInvoice && (
                            <button
                                onClick={onAddItem}
                                disabled={invoice.paid_amount > 0}
                                className={`flex items-center gap-2 px-4 py-2 border rounded-lg smooth-transition font-semibold ${
                                    invoice.paid_amount > 0
                                        ? 'border-gray-500/40 text-gray-500 cursor-not-allowed opacity-50'
                                        : 'border-green-500 text-green-400 hover:bg-green-500/10'
                                }`}
                                title={invoice.paid_amount > 0 ? "Cannot create reimbursement for partially paid invoice" : "Create reimbursement invoice for additional charges"}
                            >
                                <Plus className="w-4 h-4" />
                                Create Reimbursement
                            </button>
                        )}

                        {canEditInvoice && onEdit && (!invoice.paid_amount || invoice.paid_amount <= 0) && (
                            <button
                                onClick={onEdit}
                                className="flex items-center gap-2 px-5 py-2 border border-blue-500 text-blue-400 rounded-lg hover:bg-blue-500/10 smooth-transition"
                                title="Edit invoice details and amounts"
                            >
                                <div className="w-4 h-4">✏️</div>
                                Edit
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
                .from('bridge_payments')
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
                .from('bridge_invoices')
                .update({
                    paid_amount: newPaidAmount,
                    outstanding_amount: newOutstanding,
                    status: newStatus
                })
                .eq('id', invoice.id);

            if (invoiceError) throw invoiceError;

            // CREATE PAYMENT JOURNAL ENTRY
            try {
                const journalResult = await createARPaymentJournal(invoice, parseFloat(formData.amount), formData.payment_date, supabase);
                if (!journalResult.success) {
                    console.warn('Journal creation warning:', journalResult.message);
                } else {
                    console.log('✅ Payment journal created:', journalResult.entryNumber);
                }
            } catch (journalError) {
                console.error('Journal creation failed:', journalError);
            }

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
const PrintPreviewModal = ({ invoice, formatCurrency, onClose, onPrint, companySettings, bankAccounts, bridgeBusinessPartners }) => {

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

    const [printTaxRate, setPrintTaxRate] = useState(invoice.tax_rate || 0);

    const isSplit = splitItems.some(item => !item.isSelected || item.splitQty !== (item.qty || 1) || item.splitRate !== (item.rate || 0));

    // Calculate split totals
    const splitSubtotal = splitItems.reduce((sum, item) => sum + (item.isSelected ? (item.splitQty * item.splitRate) : 0), 0);
    
    // Improved tax calculation: sum of item taxes if possible, otherwise use global rate
    const splitTax = splitItems.reduce((sum, item) => {
        if (!item.isSelected) return sum;
        const amount = item.splitQty * item.splitRate;
        // If item has its own tax_rate, use it. Otherwise fallback to the printTaxRate
        const taxRate = typeof item.tax_rate !== 'undefined' ? item.tax_rate : printTaxRate;
        return sum + (amount * taxRate / 100);
    }, 0);
    
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
                            <label className="text-xs text-silver-light font-medium whitespace-nowrap">Tax Rate (%):</label>
                            <input
                                type="number"
                                step="0.01"
                                value={printTaxRate}
                                onChange={(e) => setPrintTaxRate(parseFloat(e.target.value) || 0)}
                                className="bg-dark-surface border border-dark-border text-silver-light px-2 py-1 rounded text-sm w-20 ml-1 shadow-none"
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
                            <div>
                                {companySettings?.logo_url ? (
                                    <img src={companySettings.logo_url} alt="Logo" style={{ maxHeight: '64px', maxWidth: '160px', objectFit: 'contain', display: 'block' }} />
                                ) : (
                                    <>
                                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', fontStyle: 'italic', color: '#000' }}>
                                            {companySettings?.company_name?.split(' ')[0] || 'FREIGHT'}ONE
                                        </h1>
                                        <p style={{ margin: 0, fontSize: '8px', letterSpacing: '3px', color: '#555', textTransform: 'uppercase' }}>LOGISTICS SOLUTIONS</p>
                                    </>
                                )}
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
                            backgroundColor: '#FF9B00', color: '#000000', padding: '8px 10px', marginBottom: '15px',
                            fontWeight: 'bold', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <span>TAX INVOICE {invoice.invoice_number}</span>
                            <span style={{ fontSize: '10px', fontWeight: 'normal', color: 'rgba(0,0,0,0.6)' }}>Page 1 of 1</span>
                        </div>

                        {/* Top Info */}
                        <div style={{ display: 'flex', marginBottom: '25px' }}>
                            <div style={{ width: '55%', paddingRight: '20px' }}>
                                <div style={{ marginBottom: '4px', fontWeight: 'bold', fontSize: '9px', color: '#555' }}>BILL TO / CUSTOMER:</div>
                                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>{invoice.customer_name}</div>
                                <div style={{ marginBottom: '3px', fontSize: '11px' }}>
                                    {(() => {
                                        const addr = findBusinessPartnerAddress(invoice, bridgeBusinessPartners, false);
                                        return addr && addr.trim() !== '-' ? String(addr).split('\n').map((line, i) => <span key={i}>{line}<br /></span>) : null;
                                    })()}
                                </div>
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
                            <div style={{ background: '#FF9B00', color: '#000000', fontWeight: 'bold', padding: '4px 8px', textTransform: 'uppercase', fontSize: '11px', borderBottom: 'none' }}>
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
                        <div style={{ marginBottom: '2px', fontWeight: 'bold', fontSize: '11px', marginTop: '10px' }}>CHARGES BREAKDOWN</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5px', border: '1px solid #000' }}>
                            <thead>
                                <tr style={{ background: '#e0e0e0' }}>
                                    <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #ccc', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', width: '5%' }}>NO</th>
                                    <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #ccc', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', fontSize: '11px', width: '35%', paddingLeft: '10px' }}>DESCRIPTION</th>
                                    <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #ccc', padding: '6px 8px', textAlign: 'center', fontWeight: 'bold', fontSize: '11px', width: '10%' }}>QTY</th>
                                    <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #ccc', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', width: '15%' }}>UNIT PRICE</th>
                                    <th style={{ borderBottom: '1px solid #000', borderRight: '1px solid #ccc', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', width: '15%' }}>TAX</th>
                                    <th style={{ borderBottom: '1px solid #000', padding: '6px 8px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px', width: '20%', paddingRight: '10px' }}>TOTAL ({printCurrency})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {splitItems.filter(item => item.isSelected).length > 0 ? (
                                    splitItems.filter(item => item.isSelected).map((item, index) => {
                                        const calcAmount = item.splitQty * item.splitRate;
                                        const taxRate = typeof item.tax_rate !== 'undefined' ? item.tax_rate : printTaxRate;
                                        const calcTax = calcAmount * taxRate / 100;
                                        return (
                                            <tr key={index}>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'center' }}>
                                                    {index + 1}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textTransform: 'capitalize' }}>
                                                    {(() => {
                                                        const stripCoa = (str) => str.replace(/^[A-Z0-9\s]{1,10}\s*:\s*/g, '').trim();
                                                        let rawDesc = String(item.description || '').trim();
                                                        if (!rawDesc && item.item_name) {
                                                            rawDesc = item.item_name.trim();
                                                        }
                                                        let parts = rawDesc.split(/<br\s*\/?>/i).map(p => p.trim()).filter(Boolean);
                                                        let uniqueParts = [...new Set(parts.map(p => stripCoa(p)))];
                                                        
                                                        // If uniqueParts has more than 1 item, the first item is the COA title (e.g. "Document Fee").
                                                        // We remove it to only show the actual item description.
                                                        if (uniqueParts.length > 1) {
                                                            uniqueParts.shift();
                                                        }
                                                        
                                                        return uniqueParts.map((part, i) => (
                                                            <div key={i} style={{ color: i === 0 ? '#000' : '#444', fontWeight: i === 0 ? 'bold' : 'normal' }}>
                                                                {part}
                                                            </div>
                                                        ));
                                                    })()}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'center' }}>
                                                    {item.splitQty} {item.unit}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>
                                                    {formatCurrency(item.splitRate, printCurrency).replace('Rp ', '').replace('$', '')}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', borderRight: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right' }}>
                                                    {formatCurrency(calcTax, printCurrency).replace('Rp ', '').replace('$', '')}
                                                </td>
                                                <td style={{ borderBottom: '1px solid #ccc', padding: '4px 8px', fontSize: '11px', verticalAlign: 'top', textAlign: 'right', paddingRight: '10px' }}>
                                                    {formatCurrency(calcAmount, printCurrency).replace('Rp ', '').replace('$', '')}
                                                </td>
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
                                    <span>TAX Total</span>
                                    <span>{formatCurrency(splitTax, printCurrency)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', fontWeight: 'bold', fontSize: '13px', background: '#FF9B00', color: 'black' }}>
                                    <span>TOTAL AMOUNT</span>
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

                                <div style={{ marginTop: '10px', border: '1px solid #d7d7d7', background: '#fafafa' }}>
                                    <div style={{ padding: '8px 10px', fontSize: '10px', lineHeight: 1.55, borderBottom: '1px solid #e3e3e3', fontStyle: 'normal' }}>
                                        All payments shall be made in full amount, except for withholding tax deductions. The full invoiced amount must be received by the Seller within thirty (30) calendar days from the invoice date.
                                    </div>
                                    <div style={{ padding: '8px 10px', fontSize: '10px', lineHeight: 1.55, fontStyle: 'normal' }}>
                                        Any payment received after the thirty (30)-day due date shall be subject to a late payment charge of 2% of the total invoice amount per month, calculated from the due date until the date on which full payment is received.
                                    </div>
                                </div>

                                <div style={{ marginTop: '10px', fontStyle: 'italic', whiteSpace: 'pre-line' }}>
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
                    .from('bridge_invoices')
                    .select('invoice_number, currency, status, total_amount, exchange_rate, created_at')
                    .eq('job_number', jobNumber)
                    .neq('status', 'cancelled')
                    .not('invoice_number', 'ilike', '%-RB')
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
                        Beda kurs aktif: invoice baru per mata uang harus menggunakan kurs yang berbeda
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
                            <div>Kurs: {Number(idrInvoice.exchange_rate || 1).toLocaleString('id-ID')}</div>
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
                            <div>Kurs: {Number(usdInvoice.exchange_rate || 1).toLocaleString('id-ID')}</div>
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
// ReimbursementModal — Create new reimbursement invoice for additional charges
// Creates separate invoice with -RB suffix linked to original invoice
// ─────────────────────────────────────────────────────────────────────────────
const ReimbursementModal = ({ invoice, formatCurrency, revenueAccounts, onClose, onSave }) => {
    const emptyItem = () => ({ item_name: '', description: '', qty: 1, unit: 'Job', rate: 0, amount: 0, tax_amount: 0, coa_id: null });
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
    const newItemsTax = newItems.reduce((s, it) => s + (parseFloat(it.tax_amount) || 0), 0);
    const existingSubtotal = invoice.subtotal || 0;
    const existingTax = invoice.tax_amount || 0;
    const preview = {
        subtotal: existingSubtotal + newItemsSubtotal,
        tax: existingTax + newItemsTax,
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
                            <Plus className="w-5 h-5 text-green-400" />
                            Create Reimbursement Invoice
                        </h2>
                        <p className="text-silver-dark text-sm mt-1">
                            Original: {invoice.invoice_number} — {invoice.customer_name}
                        </p>
                    </div>
                    {/* Status badge */}
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] bg-green-500/15 border border-green-500/40 text-green-400 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wider">
                            ✓ New Invoice
                        </span>
                        <span className="text-[10px] text-silver-dark">Will use: <span className="text-silver-light font-mono font-bold">{invoice.invoice_number}-RB</span></span>
                    </div>
                </div>

                {/* Original invoice summary */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                        { label: 'Original Total', value: formatCurrency(invoice.total_amount, invoice.currency), color: 'text-silver-light' },
                        { label: 'Status', value: invoice.status, color: 'text-silver-light' },
                        { label: 'Reimbursement Will Link To', value: invoice.invoice_number, color: 'text-blue-400 font-mono font-bold' },
                    ].map(c => (
                        <div key={c.label} className="glass-card p-3 rounded-lg border border-dark-border text-center">
                            <p className="text-[10px] text-silver-dark uppercase tracking-wider">{c.label}</p>
                            <p className={`text-sm font-bold mt-1 ${c.color}`}>{c.value}</p>
                        </div>
                    ))}
                </div>

                {/* Reimbursement Items Table */}
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-green-400">Reimbursement Items</h3>
                        <button onClick={addRow}
                            className="flex items-center gap-1 text-xs text-green-400 border border-green-400/40 px-2.5 py-1 rounded hover:bg-green-400/10 smooth-transition">
                            <Plus className="w-3 h-3" /> Add Row
                        </button>
                    </div>
                    <div className="glass-card rounded-lg overflow-hidden border border-dark-border">
                        <table className="w-full text-xs">
                            <thead className="bg-dark-surface">
                                <tr>
                                    {['Item Name', 'Description', 'Qty', 'Unit', 'Rate', 'Tax', 'Amount', 'COA', ''].map((h, i) => (
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
                                        <td className="px-2 py-1.5 w-28">
                                            <input type="number" value={item.tax_amount} min="0"
                                                onChange={e => updateItem(idx, 'tax_amount', e.target.value)}
                                                className="w-full bg-dark-surface border border-dark-border rounded px-2 py-1 text-silver-light text-xs text-right focus:border-yellow-500/60 outline-none" placeholder="Pajak" />
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

                {/* Reimbursement Note */}
                <div className="mb-5">
                    <label className="block text-xs text-silver-dark mb-1">Reimbursement Note</label>
                    <input value={amendmentNote}
                        onChange={e => setAmendmentNote(e.target.value)}
                        placeholder="e.g. Additional handling charges per customer request..."
                        className="w-full bg-dark-surface border border-dark-border rounded-lg px-3 py-2 text-silver-light text-sm focus:border-green-500/60 outline-none" />
                </div>

                {/* Reimbursement Total Preview */}
                {newItemsSubtotal > 0 && (
                    <div className="mb-5 glass-card p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                        <h3 className="text-xs font-semibold text-green-400 mb-3 uppercase tracking-wider">Reimbursement Invoice Summary</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                                <p className="text-[10px] text-silver-dark">Reimbursement Items</p>
                                <p className="font-mono font-bold text-green-400">{formatCurrency(newItemsSubtotal, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">Tax Amount</p>
                                <p className="font-mono font-bold text-silver-light">{formatCurrency(preview.tax, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">Total (incl. tax)</p>
                                <p className="font-mono font-bold text-accent-orange">{formatCurrency(preview.total, invoice.currency)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-silver-dark">Invoice Number</p>
                                <p className="font-mono font-bold text-blue-400">{invoice.invoice_number}-RB</p>
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
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg smooth-transition font-semibold disabled:opacity-50">
                        {saving ? (
                            <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Creating...</>
                        ) : (
                            <><Plus className="w-4 h-4" /> Create Reimbursement Invoice</>
                        )}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// Helper to find a business partner's address by ID or robust name matching
const findBusinessPartnerAddress = (doc, partners, isVendor = false) => {
    if (!partners || !Array.isArray(partners)) {
        return doc ? (isVendor ? doc.vendor_address : doc.customer_address) : '';
    }

    const docId = isVendor ? doc.vendor_id : doc.customer_id;
    const docName = (isVendor ? doc.vendor_name : doc.customer_name) || '';

    // 1. Match by ID (preferred, strictly typed or stringified)
    if (docId) {
        const match = partners.find(p => String(p.id) === String(docId));
        if (match) {
            const addr = match.address_line1 || match.address;
            if (addr && addr.trim() !== '' && addr.trim() !== '-') {
                return addr;
            }
        }
    }

    // Name normalization helper: strips common prefixes, suffixes, trims, and lowercases
    const normalizeName = (name) => {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .replace(/\b(pt|cv|pd|tbk|ltd|co|corp|inc|gmbh)\b/gi, '')
            .replace(/[^a-z0-9]/gi, '')
            .trim();
    };

    const docNameNormalized = normalizeName(docName);

    if (docNameNormalized) {
        // 2. Exact normalized name match
        let match = partners.find(p => normalizeName(p.partner_name) === docNameNormalized);
        
        // 3. Partial normalized name match (one contains the other)
        if (!match) {
            match = partners.find(p => {
                const pNameNorm = normalizeName(p.partner_name);
                return pNameNorm && (pNameNorm.includes(docNameNormalized) || docNameNormalized.includes(pNameNorm));
            });
        }

        if (match) {
            const addr = match.address_line1 || match.address;
            if (addr && addr.trim() !== '' && addr.trim() !== '-') {
                return addr;
            }
        }
    }

    // 4. Fallback to document address
    return isVendor ? doc.vendor_address : doc.customer_address;
};

export default BridgeInvoiceManagement;
