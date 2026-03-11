import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Modal from '../Common/Modal';
import Button from '../Common/Button';
import {
    Ship,
    Edit,
    Trash,
    Package,
    MapPin,
    Calendar,
    User,
    FileText,
    Container,
    Save,
    X,
    Plane,
    Clock,
    DollarSign,
    Plus,
    Upload,
    Download,
    Trash2,
    MapPinned,
    Receipt,
    CheckCircle,
    XCircle,
    ShieldCheck
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import COAPicker from '../Common/COAPicker';

const ShipmentDetailModalEnhanced = ({ isOpen, onClose, shipment, onUpdate, onViewAnalysis, canEditShipment = true, canCreatePO = true }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('details');
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingCOGS, setIsEditingCOGS] = useState(false);
    const [editedShipment, setEditedShipment] = useState(shipment || {});

    // PO Generation state
    const [showPOVendorModal, setShowPOVendorModal] = useState(false);
    const [poVendors, setPOVendors] = useState([]);
    const [selectedPOVendorId, setSelectedPOVendorId] = useState('');
    const [pendingPOItems, setPendingPOItems] = useState([]);
    const [pendingPOTotal, setPendingPOTotal] = useState(0);

    // Auto-population state
    const [vendors, setVendors] = useState([]);
    const [quotationData, setQuotationData] = useState(null);

    // Status management
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');
    const [currentStatus, setCurrentStatus] = useState(shipment?.status || 'pending');

    // Sync currentStatus when shipment prop changes (e.g. after approval center update)
    useEffect(() => {
        if (shipment?.status) {
            setCurrentStatus(shipment.status);
        }
    }, [shipment?.status]);

    const [confirmAction, setConfirmAction] = useState(null);
    const [successMsg, setSuccessMsg] = useState('');

    // === APPROVAL WORKFLOW (via Approval Center) ===
    // Ops team: Submit → Approval Center → Manager Approve/Reject
    const statusConfig = {
        pending: { label: 'Pending', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock },
        manager_approval: { label: 'Menunggu Persetujuan', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: Clock },
        approved: { label: 'Disetujui', color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: ShieldCheck },
        rejected: { label: 'Ditolak', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
    };

    // Transitions visible in shipment modal (ops team only — not approve/reject)
    const statusTransitions = {
        pending: [{ to: 'manager_approval', label: '📤 Ajukan Persetujuan', style: 'primary' }],
        manager_approval: [{ to: 'pending', label: '↩ Batal Ajukan', style: 'secondary' }],
        approved: [{ to: 'pending', label: '↩ Batalkan Persetujuan', style: 'secondary' }],
        rejected: [{ to: 'pending', label: '↩ Kembalikan ke Pending', style: 'secondary' }],
    };

    const handleStatusChangeRequest = (toStatus) => {
        const msgs = {
            manager_approval: 'Kirim shipment ini ke Approval Center untuk persetujuan Manager?',
            pending: 'Kembalikan status ke Pending?',
        };
        setConfirmAction({
            toStatus,
            message: msgs[toStatus] || `Ubah status ke ${toStatus}?`
        });
    };

    const handleConfirmStatusChange = async () => {
        if (!confirmAction) return;
        const { toStatus } = confirmAction;
        setConfirmAction(null);
        try {
            const updateData = {
                status: toStatus,
                updated_at: new Date().toISOString(),
            };
            if (toStatus === 'approved') updateData.approved_at = new Date().toISOString();
            const { error } = await supabase
                .from('blink_shipments')
                .update(updateData)
                .eq('id', shipment.id);
            if (error) throw error;
            setCurrentStatus(toStatus);
            onUpdate({ ...shipment, status: toStatus }, true); // skipDbUpdate = true
            if (toStatus === 'manager_approval') {
                setSuccessMsg('✅ Shipment berhasil dikirim! Manager dapat meninjau dan menyetujuinya di Approval Center.');
                // Auto dismiss after 3 seconds if not closed manually
                setTimeout(() => setSuccessMsg(''), 3000);
            }
        } catch (err) {
            alert('Gagal memperbarui status: ' + err.message);
        }
    };

    // Progress: pending → manager_approval → approved
    const statusSteps = ['pending', 'manager_approval', 'approved'];



    // Container management
    const [showContainerModal, setShowContainerModal] = useState(false);
    const [containers, setContainers] = useState(shipment?.containers || []);
    const [newContainer, setNewContainer] = useState({
        containerNumber: '',
        containerType: '20ft',
        sealNumber: '',
        vgm: ''
    });

    // Tracking management
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [trackingUpdates, setTrackingUpdates] = useState(shipment?.trackingUpdates || []);
    const [newTracking, setNewTracking] = useState({
        location: '',
        notes: '',
        status: shipment?.status || 'pending',
        timestamp: new Date().toISOString().split('T')[0]
    });

    // Delete shipment handler
    const handleDeleteShipment = async () => {
        if (!confirm('Are you sure you want to delete this shipment? This action cannot be undone.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('blink_shipments')
                .delete()
                .eq('id', shipment.id);

            if (error) throw error;

            alert('✅ Shipment deleted successfully');
            onClose(); // Close modal
            // Parent component should refresh the list
        } catch (error) {
            console.error('Error deleting shipment:', error);
            alert('Failed to delete shipment: ' + error.message);
        }
    };

    // Booking management
    const [bookingData, setBookingData] = useState(shipment?.booking || {
        vesselName: shipment?.vessel_name || shipment?.vessel || '',
        voyageNumber: shipment?.voyage || '',
        portOfLoading: shipment?.port_of_loading || shipment?.origin || '',
        portOfDischarge: shipment?.port_of_discharge || shipment?.destination || '',
        etd: '',
        eta: ''
    });

    // Shipping mode (CY/CY, CY/CF, etc.)
    const [shippingMode, setShippingMode] = useState(
        shipment?.shipping_mode || ''
    );

    // Dates management  
    const [dates, setDates] = useState({
        etd: shipment?.etd || '',
        eta: shipment?.eta || '',
        actualDeparture: shipment?.actualDeparture || '',
        actualArrival: shipment?.actualArrival || '',
        deliveryDate: shipment?.deliveryDate || '',
        blDate: shipment?.blDate || ''
    });

    // COGS management
    const [cogsData, setCogsData] = useState(shipment?.cogs || {
        oceanFreight: '',
        airFreight: '',
        trucking: '',
        thc: '',
        documentation: '',
        customs: '',
        insurance: '',
        demurrage: '',
        other: '',
        otherDescription: '',
        // New: Array of additional other costs
        additionalCosts: []
    });

    // Selling items from quotation (read-only reference)
    const [sellingItems, setSellingItems] = useState(shipment?.sellingItems || []);

    // Buying items (editable and can add more)
    const [buyingItems, setBuyingItems] = useState(shipment?.buyingItems || []);

    // Currency management for COGS
    const [cogsCurrency, setCogsCurrency] = useState(shipment?.cogsCurrency || 'USD');
    const [exchangeRate, setExchangeRate] = useState(shipment?.exchangeRate || '');
    const [rateDate, setRateDate] = useState(shipment?.rateDate || new Date().toISOString().split('T')[0]);

    // Document management
    const [documents, setDocuments] = useState(shipment?.documents || []);
    const [isUploading, setIsUploading] = useState(false);
    const [previewDocument, setPreviewDocument] = useState(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    // Auto-populate from quotation when modal opens
    useEffect(() => {
        if (!shipment?.quotation_id || !isOpen) return;

        const fetchQuotationData = async () => {
            try {
                const { data: quotation, error } = await supabase
                    .from('blink_quotations')
                    .select('*')
                    .eq('id', shipment.quotation_id)
                    .single();

                if (error) throw error;

                if (quotation) {
                    console.log('📋 Auto-populating from quotation:', quotation);
                    setQuotationData(quotation);

                    // Auto-populate selling items from quotation if we don't have them yet
                    if (sellingItems.length === 0) {
                        setSellingItems(quotation.service_items || quotation.serviceItems || []);
                    }

                    // Only populate if fields are empty
                    setEditedShipment(prev => ({
                        ...prev,
                        customer: prev.customer || quotation.customer_name || '',
                        salesPerson: prev.salesPerson || quotation.sales_person || '',
                        origin: prev.origin || quotation.origin || '',
                        destination: prev.destination || quotation.destination || '',
                        weight: prev.weight || quotation.weight || '',
                        volume: prev.volume || quotation.volume || '',
                        commodity: prev.commodity || quotation.commodity || '',
                        customerId: prev.customerId || quotation.customer_id || ''
                    }));
                }
            } catch (error) {
                console.error('Error fetching quotation:', error);
            }
        };

        fetchQuotationData();
    }, [shipment?.quotation_id, isOpen]);

    // Fetch vendors for shipper dropdown
    useEffect(() => {
        if (!isOpen) return;

        const fetchVendors = async () => {
            try {
                const { data, error } = await supabase
                    .from('freight_vendors')
                    .select('*')
                    .eq('status', 'active')
                    .order('name');

                if (error) throw error;
                setVendors(data || []);
                console.log('🏢 Fetched vendors:', data?.length || 0);
            } catch (error) {
                console.error('Error fetching vendors:', error);
            }
        };

        fetchVendors();
    }, [isOpen]);

    // Sync voyage field with bookingData.voyageNumber
    useEffect(() => {
        if (bookingData.voyageNumber && bookingData.voyageNumber !== editedShipment.voyage) {
            setEditedShipment(prev => ({
                ...prev,
                voyage: bookingData.voyageNumber
            }));
        }
    }, [bookingData.voyageNumber]);

    // Sync voyage field back to bookingData when edited in cargo details
    useEffect(() => {
        if (editedShipment.voyage && editedShipment.voyage !== bookingData.voyageNumber) {
            setBookingData(prev => ({
                ...prev,
                voyageNumber: editedShipment.voyage
            }));
        }
    }, [editedShipment.voyage]);


    // Sync editedShipment state when shipment prop changes
    useEffect(() => {
        if (shipment) {
            setEditedShipment(shipment);
            // Also sync containers, dates, COGS, and booking data
            setContainers(shipment.containers || []);
            setDates({
                etd: shipment.etd || '',
                eta: shipment.eta || '',
                actualDeparture: shipment.actualDeparture || '',
                actualArrival: shipment.actualArrival || '',
                deliveryDate: shipment.deliveryDate || '',
                blDate: shipment.blDate || ''
            });
            setCogsData(shipment.cogs || {
                oceanFreight: '',
                airFreight: '',
                trucking: '',
                thc: '',
                documentation: '',
                customs: '',
                insurance: '',
                demurrage: '',
                other: '',
                otherDescription: '',
                additionalCosts: []
            });
            setCogsCurrency(shipment.cogsCurrency || 'USD');
            setExchangeRate(shipment.exchangeRate || '');
            setRateDate(shipment.rateDate || new Date().toISOString().split('T')[0]);
            setBookingData(shipment.booking || {
                vesselName: shipment.vessel_name || '',
                voyageNumber: shipment.voyage || '',
                portOfLoading: shipment.origin || '',
                portOfDischarge: shipment.destination || '',
                etd: '',
                eta: ''
            });
            setDocuments(shipment.documents || []);
            // Sync selling and buying items — only update if incoming has data, or if local is empty
            const incomingSellingItems = shipment.sellingItems || shipment.selling_items || [];
            const incomingBuyingItems = shipment.buyingItems || shipment.buying_items || [];
            if (incomingSellingItems.length > 0) {
                setSellingItems(incomingSellingItems);
            }
            if (incomingBuyingItems.length > 0) {
                // Enrich buying items with COA code for display in the Kode column
                const coaIds = incomingBuyingItems.map(i => i.coa_id).filter(Boolean);
                if (coaIds.length > 0) {
                    supabase.from('finance_coa').select('id, code').in('id', coaIds).then(({ data: coaData }) => {
                        const codeMap = {};
                        (coaData || []).forEach(c => { codeMap[c.id] = c.code; });
                        const enriched = incomingBuyingItems.map(item => ({
                            ...item,
                            _coa_code: item._coa_code || codeMap[item.coa_id] || ''
                        }));
                        setBuyingItems(enriched);
                    });
                } else {
                    setBuyingItems(incomingBuyingItems);
                }
            }
        }
    }, [shipment]);



    if (!shipment) return null;



    const containerTypes = ['20ft', '40ft', '40ft HC', '45ft HC'];

    const tabs = [
        { id: 'details', label: 'Details', icon: FileText },
        { id: 'tracking', label: 'Tracking', icon: MapPinned },
        { id: 'booking', label: 'Booking & Dates', icon: Calendar },
        { id: 'documents', label: 'Documents', icon: Upload },
        { id: 'cogs', label: 'COGS & Profit', icon: DollarSign }
    ];

    const handleSaveEdit = () => {
        const updatedShipment = {
            ...editedShipment,
            booking: bookingData,
            ...dates,
            cogs: cogsData,
            cogsCurrency,
            exchangeRate,
            rateDate
        };
        onUpdate(updatedShipment);
        setIsEditing(false);
    };

    const handleGeneratePO = async () => {
        try {
            // 1. Gather Items - only from buyingItems (actual costs with COA)
            const poItemsRaw = [];

            // Legacy COGS fields
            const addIfPresent = (label, value) => {
                const val = parseFloat(String(value || '').replace(/,/g, ''));
                if (val && val > 0) {
                    poItemsRaw.push({
                        item_name: label,
                        description: `${label} - ${shipment.job_number || shipment.jobNumber}`,
                        qty: 1,
                        unit: 'Job',
                        unit_price: val,
                        amount: val,
                        coa_id: null
                    });
                }
            };
            const cogs = cogsData || {};
            addIfPresent('Ocean Freight', cogs.oceanFreight);
            addIfPresent('Air Freight', cogs.airFreight);
            addIfPresent('Trucking', cogs.trucking);
            addIfPresent('THC', cogs.thc);
            addIfPresent('Documentation', cogs.documentation);
            addIfPresent('Customs Clearance', cogs.customs);
            addIfPresent('Insurance', cogs.insurance);
            addIfPresent('Demurrage', cogs.demurrage);
            addIfPresent(cogs.otherDescription || 'Other Charges', cogs.other);

            // Buying items with COA account name lookup
            const coaIds = (buyingItems || []).map(i => i.coa_id).filter(Boolean);
            let coaMap = {};
            if (coaIds.length > 0) {
                const { data: coaData } = await supabase
                    .from('finance_coa')
                    .select('id, name, code')
                    .in('id', coaIds);
                (coaData || []).forEach(c => { coaMap[c.id] = c; });
            }

            (buyingItems || []).forEach(item => {
                const val = parseFloat(String(item.amount || 0).replace(/,/g, ''));
                if (val && val > 0) {
                    const coaAccount = coaMap[item.coa_id];
                    const itemName = coaAccount ? coaAccount.name : (item.description || 'Item');
                    poItemsRaw.push({
                        item_name: itemName,
                        description: item.description || itemName,
                        qty: parseFloat(item.qty) || 1,
                        unit: item.unit || 'Job',
                        unit_price: parseFloat(item.rate) || val,
                        amount: val,
                        coa_id: item.coa_id || null
                    });
                }
            });

            if (poItemsRaw.length === 0) {
                alert('No COGS/Actual Costs found to generate PO items.');
                return;
            }

            // 2. Fetch vendors from blink_business_partners
            const { data: vendorDataRaw } = await supabase
                .from('blink_business_partners')
                .select('*')
                .order('partner_name');
            const vendorData = (vendorDataRaw || []).filter(p => {
                const val = p.is_vendor;
                return val === true || val === 'true' || val === 1 || val === 't' || val === '1' || val === 'Y' || val === 'y' || String(val).toLowerCase() === 'true';
            });
            console.log('Raw Vendors:', vendorDataRaw);
            console.log('Filtered Vendors:', vendorData);

            const totalAmount = poItemsRaw.reduce((sum, i) => sum + i.amount, 0);

            // Store pending items and show vendor selection modal
            setPendingPOItems(poItemsRaw);
            setPendingPOTotal(totalAmount);
            setPOVendors(vendorData || []);
            setSelectedPOVendorId('');
            setShowPOVendorModal(true);

        } catch (error) {
            console.error('Error preparing PO:', error);
            alert('Failed to prepare PO: ' + error.message);
        }
    };

    const handleConfirmGeneratePO = async () => {
        try {
            if (!selectedPOVendorId) {
                alert('Please select a vendor first.');
                return;
            }

            const vendor = poVendors.find(v => v.id === selectedPOVendorId);
            const { generatePONumber } = await import('../../utils/documentNumbers');
            const poNumber = await generatePONumber();

            const newPO = {
                po_number: poNumber,
                vendor_id: vendor.id,
                vendor_name: vendor.partner_name,
                vendor_email: vendor.email || '',
                vendor_phone: vendor.phone || '',
                vendor_address: vendor.address || '',
                po_date: new Date().toISOString().split('T')[0],
                delivery_date: null,
                payment_terms: 'NET 30',
                po_items: pendingPOItems,
                currency: cogsCurrency || 'IDR',
                exchange_rate: parseFloat(exchangeRate) || 1,
                subtotal: pendingPOTotal,
                tax_rate: 0,
                tax_amount: 0,
                discount_amount: 0,
                total_amount: pendingPOTotal,
                status: 'draft',
                shipment_id: shipment.id || null,
                job_number: shipment.job_number || shipment.jobNumber || null,
                notes: `Generated from Shipment Job: ${shipment.job_number || shipment.jobNumber}`
            };

            const { error } = await supabase
                .from('blink_purchase_orders')
                .insert([newPO])
                .select();

            if (error) throw error;

            setShowPOVendorModal(false);
            alert(`✅ Purchase Order ${poNumber} generated successfully!`);
            onClose();
            navigate('/blink/finance/purchase-orders');
        } catch (error) {
            console.error('Error generating PO:', error);
            alert('Failed to generate PO: ' + error.message);
        }
    };

    const handleSaveCOGS = async () => {
        try {
            // Helper to safely parse numbers
            const parseNumber = (value) => {
                if (value === '' || value === null || value === undefined) return null;
                const parsed = parseFloat(String(value).replace(/,/g, ''));
                return isNaN(parsed) ? null : parsed;
            };

            // Parse COGS items - handle both simple values and arrays
            const parsedCOGS = {};
            Object.entries(cogsData).forEach(([key, value]) => {
                if (key === 'additionalCosts' && Array.isArray(value)) {
                    // Keep additionalCosts as array with parsed amounts
                    parsedCOGS[key] = value.map(item => ({
                        description: item.description || '',
                        amount: parseNumber(item.amount)
                    }));
                } else {
                    parsedCOGS[key] = parseNumber(value);
                }
            });

            // Parse buying items
            const parsedBuyingItems = buyingItems.map(item => ({
                id: item.id || `item-${Date.now()}-${Math.random()}`,
                description: item.description || '',
                qty: parseNumber(item.qty) || 1,
                unit: item.unit || 'Job',
                rate: parseNumber(item.rate) || parseNumber(item.amount) || 0,
                amount: parseNumber(item.amount) || ((parseNumber(item.qty) || 1) * (parseNumber(item.rate) || 0)),
                coa_id: item.coa_id || null,
                _coa_code: item._coa_code || '',
                vendor: item.vendor || '',
                currency: item.currency || cogsCurrency
            }));

            // Update shipment with COGS data
            const updateData = {
                cogs: parsedCOGS,
                cogs_currency: cogsCurrency,
                exchange_rate: parseNumber(exchangeRate),
                rate_date: rateDate || null,
                quoted_amount: parseNumber(shipment.quotedAmount),
                selling_items: sellingItems, // Save selling items (read-only reference)
                buying_items: parsedBuyingItems // Save buying items (editable)
            };

            // Remove null/undefined values
            Object.keys(updateData).forEach(key => {
                if (updateData[key] === undefined) {
                    delete updateData[key];
                }
            });

            const { error } = await supabase
                .from('blink_shipments')
                .update(updateData)
                .eq('id', shipment.id);

            if (error) throw error;

            // Update local state
            const updatedShipment = {
                ...shipment,
                cogs: parsedCOGS,
                cogsCurrency: cogsCurrency,
                exchangeRate: parseNumber(exchangeRate),
                rateDate: rateDate,
                quotedAmount: parseNumber(shipment.quotedAmount) || shipment.quotedAmount,
                sellingItems: sellingItems,
                buyingItems: parsedBuyingItems
            };

            onUpdate(updatedShipment, true); // skipDbUpdate = true

            // Exit edit mode and show success
            setIsEditingCOGS(false);
            alert('✅ COGS data saved successfully!');
        } catch (error) {
            console.error('Error saving COGS:', error);
            alert('❌ Failed to save COGS: ' + error.message);
        }
    };

    // Calculate totals
    const calculateQuotedAmount = () => {
        return shipment?.quotedAmount || 0;
    };

    const calculateTotalCOGS = () => {
        const parseVal = (val) => {
            const parsed = parseFloat(String(val || 0).replace(/,/g, ''));
            return isNaN(parsed) ? 0 : parsed;
        };

        // Base COGS items
        const baseCOGS =
            parseVal(cogsData.oceanFreight) +
            parseVal(cogsData.airFreight) +
            parseVal(cogsData.trucking) +
            parseVal(cogsData.thc) +
            parseVal(cogsData.documentation) +
            parseVal(cogsData.customs) +
            parseVal(cogsData.insurance) +
            parseVal(cogsData.demurrage) +
            parseVal(cogsData.other);

        // Additional costs from array
        const additionalTotal = (cogsData.additionalCosts || []).reduce((sum, item) => sum + parseVal(item.amount), 0);

        // Buying items total
        const buyingTotal = (buyingItems || []).reduce((sum, item) => sum + parseVal(item.amount), 0);

        return baseCOGS + additionalTotal + buyingTotal;
    };

    // Convert COGS to quoted/shipment currency
    const calculateTotalCOGSConverted = () => {
        const total = calculateTotalCOGS();
        const baseCurrency = shipment?.currency || 'USD';

        if (cogsCurrency === baseCurrency) {
            return total;
        }

        const rate = parseFloat(exchangeRate) || 0;
        if (!rate) return total; // Fallback to avoid NaN if rate is empty

        // Convert to IDR
        if (baseCurrency === 'IDR' && cogsCurrency === 'USD') {
            return total * rate;
        }
        // Convert to USD
        else if (baseCurrency === 'USD' && cogsCurrency === 'IDR') {
            return total / rate;
        }

        return total;
    };

    const calculateProfit = () => {
        return calculateQuotedAmount() - calculateTotalCOGSConverted();
    };

    const calculateMargin = () => {
        const quoted = calculateQuotedAmount();
        if (quoted === 0) return 0;
        return ((calculateProfit() / quoted) * 100).toFixed(2);
    };

    const handleStatusUpdate = () => {
        const updatedShipment = {
            ...shipment,
            status: newStatus,
            statusHistory: [
                ...(shipment.statusHistory || []),
                {
                    status: newStatus,
                    timestamp: new Date().toISOString(),
                    notes: statusNotes
                }
            ]
        };
        // Ensure manual status update is persisted without crashing on other fields
        // Since we didn't save it directly here, we let the parent do a full save, 
        // OR we just save it directly. It's safer to save it directly here and bypass parent save.
        supabase.from('blink_shipments').update({
            status: newStatus,
            status_history: updatedShipment.statusHistory
        }).eq('id', shipment.id).then(({ error }) => {
            if (error) {
                alert('Failed to update status');
                return;
            }
            onUpdate(updatedShipment, true);
        });

        setShowStatusModal(false);
        setStatusNotes('');
        setNewStatus('');
    };

    const handleAddContainer = async () => {
        if (!newContainer.containerNumber) {
            alert('Container number is required');
            return;
        }
        const updatedContainers = [...containers, { ...newContainer, id: Date.now() }];
        setContainers(updatedContainers);

        try {
            // Save to database immediately
            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    containers: updatedContainers,
                    container_number: updatedContainers[0].containerNumber  // Update first container number
                })
                .eq('id', shipment.id);

            if (error) throw error;

            onUpdate({ ...shipment, containers: updatedContainers }, true);
            setNewContainer({ containerNumber: '', containerType: '20ft', sealNumber: '', vgm: '' });
            setShowContainerModal(false);
            alert('✅ Container added successfully!');
        } catch (error) {
            console.error('Error adding container:', error);
            alert('❌ Failed to add container: ' + error.message);
        }
    };

    const handleDeleteContainer = async (containerId) => {
        const updatedContainers = containers.filter(c => c.id !== containerId);
        setContainers(updatedContainers);

        try {
            const { error } = await supabase
                .from('blink_shipments')
                .update({ containers: updatedContainers })
                .eq('id', shipment.id);
            if (error) throw error;
            onUpdate({ ...shipment, containers: updatedContainers }, true);
        } catch (error) {
            console.error('Error deleting container:', error);
            alert('Failed to delete container');
        }
    };

    const handleGenerateInvoice = async () => {
        try {
            // Check if an invoice already exists for this job number
            const { data: existingInvoices, error: checkError } = await supabase
                .from('blink_invoices')
                .select('*')
                .eq('shipment_id', shipment.id)
                .neq('status', 'cancelled')
                .order('created_at', { ascending: false })
                .limit(1);

            if (checkError) throw checkError;

            const existingInvoice = existingInvoices && existingInvoices.length > 0 ? existingInvoices[0] : null;

            if (existingInvoice) {
                if (!confirm(`An invoice (${existingInvoice.invoice_number}) already exists for this shipment. Do you want to update it with the latest items and COGS?`)) {
                    return;
                }
            } else {
                if (!confirm('Create Invoice for this shipment? This will create a new draft Invoice.')) return;
            }
            // 1. Generate Invoice Number
            const { generateInvoiceNumber } = await import('../../utils/documentNumbers');
            const invoiceNumber = await generateInvoiceNumber(shipment.jobNumber || shipment.soNumber);

            // 2. Prepare Invoice Items from selling items (quotation service items)
            const sourceItems = sellingItems.length > 0
                ? sellingItems
                : (shipment.service_items || shipment.serviceItems || []);

            let invoiceItems = [];
            let subtotal = 0;

            if (sourceItems.length > 0) {
                invoiceItems = sourceItems.map(item => {
                    const qty = parseFloat(item.qty || item.quantity || 1);
                    const initRate = parseFloat(item.selling_rate || item.sellingRate || item.rate || item.unitPrice || item.price || 0);
                    const amount = parseFloat(item.total || item.amount || item.sellingTotal || (qty * initRate) || 0);
                    const rate = initRate || (qty > 0 ? amount / qty : 0);
                    subtotal += amount;
                    return {
                        item_name: item.name || item.item_name || item.item_code || item.description || 'Service',
                        description: item.description || item.name || 'Service',
                        qty,
                        unit: item.unit || 'Job',
                        rate,
                        amount
                    };
                });
            } else {
                // Fallback: single row from quotedAmount
                subtotal = parseFloat(shipment.quotedAmount || 0);
                invoiceItems = [{
                    description: `${(shipment.serviceType || 'Freight').toUpperCase()} - ${shipment.origin || ''} to ${shipment.destination || ''}`,
                    qty: 1,
                    unit: 'Shipment',
                    rate: subtotal,
                    amount: subtotal
                }];
            }

            const taxRate = 11.0;
            const taxAmount = subtotal * (taxRate / 100);
            const totalAmount = subtotal + taxAmount;

            // Prepare COGS Items from buyingItems
            const cogsItems = (buyingItems || []).map(item => {
                const qty = parseFloat(item.quantity || item.qty || 1);
                // "amount" is used heavily for cost so let's check it first
                const amount = parseFloat(item.total || item.amount || 0) || 0;
                // rate could be derived if not explicitly set
                const rate = parseFloat(item.unitPrice || item.rate || item.price || 0) || (qty > 0 ? amount / qty : 0);

                return {
                    description: item.description || item.name || item.item_code || 'Cost Item',
                    qty: qty,
                    unit: item.unit || 'Job',
                    rate: rate,
                    amount: amount,
                    currency: item.currency || shipment.currency || 'IDR',
                    vendor: item.vendor || item.supplier || ''
                };
            });

            const cogsSubtotal = cogsItems.reduce((sum, item) => sum + (item.amount || 0), 0);
            const grossProfit = subtotal - cogsSubtotal;
            const profitMargin = subtotal > 0 ? (grossProfit / subtotal) * 100 : 0;

            if (existingInvoice) {
                // Update existing invoice instead of creating a new one
                const { data: updatedData, error: updateError } = await supabase
                    .from('blink_invoices')
                    .update({
                        invoice_items: invoiceItems,
                        subtotal: subtotal,
                        tax_amount: taxAmount,
                        total_amount: totalAmount,
                        outstanding_amount: totalAmount,
                        cogs_items: cogsItems,
                        cogs_subtotal: cogsSubtotal,
                        gross_profit: grossProfit,
                        profit_margin: profitMargin,
                        consignor: shipment.shipper_name || '',
                        consignee: shipment.consignee_name || shipment.customer || '',
                        vessel_name: shipment.vessel_name || shipment.vessel || '',
                        voyage_number: shipment.voyage_number || shipment.voyage || '',
                        ocean_bl: shipment.mbl_number || shipment.mbl || shipment.bl_awb_number || '',
                        house_bl: shipment.hbl_number || shipment.hbl || '',
                        etd: shipment.etd || null,
                        eta: shipment.eta || null,
                        containers: shipment.container_number || shipment.container_type || (Array.isArray(shipment.containers) ? shipment.containers.map(c => c.containerNumber).join(', ') : shipment.containers) || '',
                        goods_description: shipment.commodity || '',
                        chargeable_weight: parseFloat(shipment.chargeable_weight || shipment.weight) || 0,
                        packages: shipment.packages || '',
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingInvoice.id)
                    .select();

                if (updateError) throw updateError;
                if (!updatedData || updatedData.length === 0) {
                    throw new Error('Update command completed but 0 rows were modified. Possible database rejection or RLS block.');
                }

                alert(`✅ Invoice ${existingInvoice.invoice_number} updated successfully with latest data!`);
                onClose();
                navigate('/blink/finance/invoices');
                return;
            }

            // 3. Create Invoice Object (if not existing)
            const newInvoice = {
                invoice_number: invoiceNumber,
                invoice_date: new Date().toISOString().split('T')[0],
                due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default NET 30
                payment_terms: 'NET 30',
                quotation_id: shipment.quotationId || null,
                shipment_id: shipment.id,
                job_number: shipment.jobNumber,
                so_number: shipment.soNumber,
                customer_id: shipment.customerId,
                customer_name: shipment.customer,
                origin: shipment.origin,
                destination: shipment.destination,
                service_type: shipment.serviceType,
                currency: shipment.currency || 'IDR',
                subtotal,
                tax_rate: taxRate,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                outstanding_amount: totalAmount,
                status: 'draft',
                invoice_items: invoiceItems,
                cogs_items: cogsItems,
                cogs_subtotal: cogsSubtotal,
                gross_profit: grossProfit,
                profit_margin: profitMargin,
                consignor: shipment.shipper_name || '',
                consignee: shipment.consignee_name || shipment.customer || '',
                vessel_name: shipment.vessel_name || shipment.vessel || '',
                voyage_number: shipment.voyage_number || shipment.voyage || '',
                ocean_bl: shipment.mbl_number || shipment.mbl || shipment.bl_awb_number || '',
                house_bl: shipment.hbl_number || shipment.hbl || '',
                etd: shipment.etd || null,
                eta: shipment.eta || null,
                containers: shipment.container_number || shipment.container_type || (Array.isArray(shipment.containers) ? shipment.containers.map(c => c.containerNumber).join(', ') : shipment.containers) || '',
                goods_description: shipment.commodity || '',
                chargeable_weight: parseFloat(shipment.chargeable_weight || shipment.weight) || 0,
                packages: shipment.packages || '',
                notes: `Generated from Shipment: ${shipment.jobNumber}`
            };

            const { data, error } = await supabase
                .from('blink_invoices')
                .insert([newInvoice])
                .select();

            if (error) throw error;

            alert(`✅ Invoice ${invoiceNumber} created successfully with ${invoiceItems.length} line item(s)!`);
            onClose();
            navigate('/blink/finance/invoices');
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice: ' + error.message);
        }
    };

    const handleAddTracking = () => {
        if (!newTracking.location) {
            alert('Location is required');
            return;
        }
        const tracking = {
            ...newTracking,
            id: Date.now(),
            timestamp: new Date().toISOString()
        };
        const updatedTracking = [tracking, ...trackingUpdates];
        setTrackingUpdates(updatedTracking);

        // Update shipment with new tracking and status
        const updatedShipment = {
            ...shipment,
            trackingUpdates: updatedTracking,
            status: newTracking.status // Update shipment status
        };
        onUpdate(updatedShipment, true); // skipDbUpdate = true

        setNewTracking({
            location: '',
            notes: '',
            status: newTracking.status,
            timestamp: new Date().toISOString().split('T')[0]
        });
        setShowTrackingModal(false);
    };

    const handleSaveBooking = () => {
        const updatedShipment = {
            ...shipment,
            booking: bookingData,
            ...dates,
            voyage: bookingData.voyageNumber
        };
        onUpdate(updatedShipment, true); // skipDbUpdate = true
        alert('Booking details and dates saved!');
    };

    const getShipmentType = () => {
        if (shipment.quotationType) {
            return shipment.quotationType === 'RG' ? 'Regular' : 'Non-Regular';
        }
        return shipment.type === 'regular' ? 'Regular' : 'Non-Regular';
    };

    const handleCreateBL = () => {
        localStorage.setItem('bl_prefill_data', JSON.stringify({
            jobNumber: shipment.jobNumber,
            customer: shipment.customer,
            customerId: shipment.customerId,
            origin: shipment.origin,
            destination: shipment.destination,
            cargoType: shipment.cargoType,
            weight: shipment.weight,
            volume: shipment.volume,
            commodity: shipment.commodity,
            containers: containers
        }));
        navigate('/blink/bl');
        onClose();
    };

    const handleCreateAWB = () => {
        localStorage.setItem('awb_prefill_data', JSON.stringify({
            jobNumber: shipment.jobNumber,
            customer: shipment.customer,
            customerId: shipment.customerId,
            origin: shipment.origin,
            destination: shipment.destination,
            weight: shipment.weight,
            volume: shipment.volume,
            commodity: shipment.commodity
        }));
        navigate('/blink/awb');
        onClose();
    };

    const handleSaveChanges = async () => {
        try {
            // Helper to safely handle UUID fields
            const safeUUID = (value) => {
                if (!value ||
                    value === 'undefined' ||
                    value === 'null' ||
                    value === '' ||
                    value === 'NULL' ||
                    String(value).toLowerCase() === 'undefined') {
                    return null;
                }
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidPattern.test(value)) {
                    console.warn(`Invalid UUID format detected: "${value}", returning null`);
                    return null;
                }
                return value;
            };

            // Helper to safely handle numeric fields - convert empty strings to null
            const safeNumber = (value) => {
                if (value === '' || value === null || value === undefined || value === 'undefined') {
                    return null;
                }
                const parsed = parseFloat(String(value).replace(/,/g, ''));
                return isNaN(parsed) ? null : parsed;
            };

            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    customer: editedShipment.customer,
                    origin: editedShipment.origin,
                    destination: editedShipment.destination,
                    cargo_type: editedShipment.cargoType,
                    weight: safeNumber(editedShipment.weight),
                    volume: safeNumber(editedShipment.volume),
                    gross_weight: safeNumber(editedShipment.gross_weight ?? editedShipment.grossWeight),
                    net_weight: safeNumber(editedShipment.net_weight ?? editedShipment.netWeight),
                    packages: editedShipment.packages || null,
                    shipping_mode: shippingMode || null,
                    commodity: editedShipment.commodity,
                    dimensions: editedShipment.dimensions || null,
                    hbl: editedShipment.hbl || null,
                    mbl: editedShipment.mbl || null,
                    hawb: editedShipment.hawb || null,
                    mawb: editedShipment.mawb || null,
                    voyage: bookingData.voyageNumber || null,
                    flight_number: editedShipment.flight_number || null,
                    bl_number: editedShipment.bl_number || null,
                    awb_number: editedShipment.awb_number || null,
                    bl_date: dates.blDate || null,
                    // Vessel/Voyage: only from bookingData (single source of truth)
                    vessel_name: bookingData.vesselName || null,
                    port_of_loading: bookingData.portOfLoading || null,
                    port_of_discharge: bookingData.portOfDischarge || null,
                    container_number: containers.length > 0 ? containers[0].containerNumber : (editedShipment.containerNumber || null),
                    shipper_name: editedShipment.shipper_name || null,
                    shipper: editedShipment.shipper || null,
                    // Container array (JSONB)
                    containers: containers,
                    // UUID fields - validate before sending
                    customer_id: safeUUID(editedShipment.customerId),
                    quotation_id: safeUUID(editedShipment.quotationId),
                    // Numeric fields - safely convert
                    quoted_amount: safeNumber(editedShipment.quotedAmount),
                    measure: safeNumber(editedShipment.measure),
                    // Booking & Dates fields - convert empty strings to null
                    etd: dates.etd || null,
                    eta: dates.eta || null,
                    actual_departure: dates.actualDeparture || null,
                    actual_arrival: dates.actualArrival || null,
                    delivery_date: dates.deliveryDate || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', shipment.id);

            if (error) throw error;

            // Update parent component with ALL saved data for correct optimistic update
            const updatedShipment = {
                ...editedShipment,
                // Booking data
                booking: bookingData,
                vessel_name: bookingData.vesselName || null,
                voyage: bookingData.voyageNumber || null,
                port_of_loading: bookingData.portOfLoading || null,
                port_of_discharge: bookingData.portOfDischarge || null,
                // Dates
                ...dates,
                etd: dates.etd || null,
                eta: dates.eta || null,
                actual_departure: dates.actualDeparture || null,
                actual_arrival: dates.actualArrival || null,
                delivery_date: dates.deliveryDate || null,
                bl_date: dates.blDate || null,
                blDate: dates.blDate || null,
                // Shipping mode & containers
                shippingMode: shippingMode || null,
                shipping_mode: shippingMode || null,
                containers: containers,
            };
            onUpdate(updatedShipment, true); // skipDbUpdate = true (already saved above)
            setIsEditing(false);
            alert('✅ Shipment details updated successfully!');
        } catch (error) {
            console.error('Error updating shipment:', error);
            alert('❌ Failed to update shipment: ' + error.message);
        }
    };

    // Document Upload Handler
    const handleDocumentUpload = async (e) => {
        const files = Array.from(e.target.files);

        // Validate file count
        if (documents.length + files.length > 10) {
            alert('❌ Maksimal 10 dokumen');
            return;
        }

        setIsUploading(true);

        for (const file of files) {
            // Check file type
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(file.type)) {
                alert(`❌ ${file.name}: Hanya file JPEG, PNG, dan PDF yang diizinkan`);
                continue;
            }

            // Check file size (200KB = 200 * 1024 bytes)
            if (file.size > 200 * 1024) {
                alert(`❌ ${file.name}: Ukuran file harus kurang dari 200KB (saat ini: ${(file.size / 1024).toFixed(2)}KB)`);
                continue;
            }

            try {
                // Convert file to base64
                const reader = new FileReader();
                reader.onload = async (event) => {
                    const base64Data = event.target.result;

                    const newDocument = {
                        id: Date.now() + Math.random(),
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        data: base64Data,
                        uploadedAt: new Date().toISOString(),
                        uploadedBy: 'Current User'
                    };

                    const updatedDocuments = [...documents, newDocument];
                    setDocuments(updatedDocuments);

                    // Save to database
                    const { error } = await supabase
                        .from('blink_shipments')
                        .update({ documents: updatedDocuments })
                        .eq('id', shipment.id);

                    if (error) throw error;

                    onUpdate({ ...shipment, documents: updatedDocuments }, true);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('Error uploading document:', error);
                alert('❌ Gagal upload dokumen: ' + error.message);
            }
        }

        setIsUploading(false);
        e.target.value = '';
    };

    // Delete Document Handler
    const handleDeleteDocument = async (documentId) => {
        if (!confirm('Yakin ingin menghapus dokumen ini?')) return;

        try {
            const updatedDocuments = documents.filter(doc => doc.id !== documentId);
            setDocuments(updatedDocuments);

            const { error } = await supabase
                .from('blink_shipments')
                .update({ documents: updatedDocuments })
                .eq('id', shipment.id);

            if (error) throw error;

            onUpdate({ ...shipment, documents: updatedDocuments }, true);
            alert('✅ Dokumen berhasil dihapus');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('❌ Failed to delete dokumen: ' + error.message);
        }
    };

    // Preview Document Handler
    const handlePreviewDocument = (document) => {
        setPreviewDocument(document);
        setShowPreviewModal(true);
    };

    // Download Document Handler
    const handleDownloadDocument = (document) => {
        const link = document.createElement('a');
        link.href = document.data;
        link.download = document.name;
        link.click();
    };

    return (
        <>
            {/* Preview Modal */}
            {showPreviewModal && previewDocument && (
                <Modal
                    isOpen={showPreviewModal}
                    onClose={() => {
                        setShowPreviewModal(false);
                        setPreviewDocument(null);
                    }}
                    title={`Preview: ${previewDocument.name}`}
                    size="large"
                >
                    <div className="flex flex-col items-center justify-center p-4">
                        {previewDocument.type === 'application/pdf' ? (
                            <div className="w-full">
                                <iframe
                                    src={previewDocument.data}
                                    className="w-full h-[600px] border border-dark-border rounded"
                                    title={previewDocument.name}
                                />
                            </div>
                        ) : (
                            <img
                                src={previewDocument.data}
                                alt={previewDocument.name}
                                className="max-w-full max-h-[600px] object-contain rounded"
                            />
                        )}
                        <div className="mt-4 flex gap-2">
                            <Button onClick={() => handleDownloadDocument(previewDocument)} icon={Download}>
                                Download
                            </Button>
                            <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                                Tutup
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}

            <Modal isOpen={isOpen} onClose={onClose} title={`Shipment - ${shipment.jobNumber}`} size="large">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-accent-orange flex items-center gap-2">
                                <Ship className="w-6 h-6" />
                                {shipment.jobNumber}
                            </h2>
                            <p className="text-sm text-silver-dark mt-1">
                                SO: {shipment.soNumber || '-'}
                            </p>
                        </div>
                        <div className="flex gap-2 items-center">
                            {((!isEditing && activeTab !== 'cogs') || (activeTab === 'cogs' && !isEditingCOGS)) && (
                                <>
                                    {canEditShipment && (
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            icon={Edit}
                                            onClick={() => {
                                                if (activeTab === 'cogs') {
                                                    setIsEditingCOGS(true);
                                                } else {
                                                    setIsEditing(true);
                                                }
                                            }}
                                        >
                                            Edit
                                        </Button>
                                    )}
                                    {canCreatePO && activeTab === 'cogs' && calculateTotalCOGS() > 0 && currentStatus === 'approved' && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleGeneratePO}
                                            title="Generate a Purchase Order from actual costs"
                                        >
                                            Generate PO
                                        </Button>
                                    )}
                                    {activeTab === 'cogs' && calculateTotalCOGS() > 0 && currentStatus !== 'approved' && (
                                        <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded" title="Shipment must be approved first">
                                            🔒 Approve to unlock PO
                                        </span>
                                    )}
                                    {currentStatus === 'approved' ? (
                                        <Button
                                            size="sm"
                                            variant="primary"
                                            icon={Receipt}
                                            onClick={handleGenerateInvoice}
                                            title="Create Invoice from this Shipment"
                                        >
                                            Create Inv
                                        </Button>
                                    ) : (
                                        <span className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-1 rounded" title="Shipment must be approved first">
                                            🔒 Approve to invoice
                                        </span>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="danger"
                                        icon={Trash}
                                        onClick={handleDeleteShipment}
                                    >
                                        Delete
                                    </Button>
                                </>
                            )}
                            {((isEditing && activeTab !== 'cogs') || (activeTab === 'cogs' && isEditingCOGS)) && (
                                <>
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        icon={Save}
                                        onClick={() => {
                                            if (activeTab === 'cogs') {
                                                handleSaveCOGS();
                                            } else {
                                                handleSaveChanges();
                                            }
                                        }}
                                    >
                                        Save Changes
                                    </Button>
                                    {activeTab === 'cogs' && isEditingCOGS && (
                                        <span className="text-xs text-silver-dark italic px-1">Save first to generate PO</span>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => {
                                            if (activeTab === 'cogs') {
                                                setIsEditingCOGS(false);
                                                // Reset to original COGS values
                                                setCogsData(shipment.cogs || {
                                                    oceanFreight: '',
                                                    airFreight: '',
                                                    trucking: '',
                                                    thc: '',
                                                    documentation: '',
                                                    customs: '',
                                                    insurance: '',
                                                    demurrage: '',
                                                    other: '',
                                                    otherDescription: ''
                                                });
                                                setCogsCurrency(shipment.cogsCurrency || 'USD');
                                                setExchangeRate(shipment.exchangeRate || '');
                                                setRateDate(shipment.rateDate || new Date().toISOString().split('T')[0]);
                                            } else {
                                                setEditedShipment(shipment);
                                                setIsEditing(false);
                                            }
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {/* Status action buttons */}
                            {!isEditing && !isEditingCOGS && (statusTransitions[currentStatus] || []).map((t) => (
                                <Button
                                    key={t.to}
                                    size="sm"
                                    variant={t.style}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleStatusChangeRequest(t.to);
                                    }}
                                >
                                    {t.label}
                                </Button>
                            ))}
                            {/* Status badge */}
                            {(() => {
                                const cfg = statusConfig[currentStatus] || statusConfig.pending;
                                const Icon = cfg.icon;
                                return (
                                    <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border ${cfg.color}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {cfg.label}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-dark-border">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsEditing(false);
                                        // Auto-activate COGS edit mode when switching to COGS tab
                                        setIsEditingCOGS(tab.id === 'cogs');
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 border-b-2 smooth-transition ${activeTab === tab.id
                                        ? 'border-accent-orange text-accent-orange'
                                        : 'border-transparent text-silver-dark hover:text-silver-light'
                                        }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="font-medium">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'details' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Customer Info */}
                                <div className="glass-card p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <User className="w-4 h-4 text-accent-orange" />
                                        <h4 className="font-semibold text-silver-light">Customer Information</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Customer Name</label>
                                                    <input
                                                        type="text"
                                                        value={editedShipment.customer}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, customer: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Sales Person</label>
                                                    <input
                                                        type="text"
                                                        value={editedShipment.salesPerson}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, salesPerson: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    />
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Customer:</span>
                                                    <span className="text-silver-light font-medium">{shipment.customer}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Sales Person:</span>
                                                    <span className="text-silver-light">{shipment.salesPerson || '-'}</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-silver-dark">Type:</span>
                                            <span className="text-silver-light">{getShipmentType()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Route & Service */}
                                <div className="glass-card p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <MapPin className="w-4 h-4 text-accent-orange" />
                                        <h4 className="font-semibold text-silver-light">Route & Service</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Origin</label>
                                                    <input
                                                        type="text"
                                                        value={editedShipment.origin}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, origin: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Destination</label>
                                                    <input
                                                        type="text"
                                                        value={editedShipment.destination}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, destination: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Cargo Type</label>
                                                    <select
                                                        value={editedShipment.cargoType || 'FCL'}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, cargoType: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    >
                                                        <option value="FCL">FCL (Full Container Load)</option>
                                                        <option value="LCL">LCL (Less than Container Load)</option>
                                                        <option value="General">General Cargo</option>
                                                        <option value="Bulk">Bulk Cargo</option>
                                                    </select>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Origin:</span>
                                                    <span className="text-silver-light font-medium">{shipment.origin}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Destination:</span>
                                                    <span className="text-silver-light font-medium">{shipment.destination}</span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-silver-dark">Service:</span>
                                            <span className="text-silver-light capitalize">{shipment.serviceType}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-silver-dark">Cargo Type:</span>
                                            <span className="text-silver-light">{shipment.cargoType || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cargo Details */}
                                <div className="glass-card p-4 rounded-lg">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Package className="w-4 h-4 text-accent-orange" />
                                        <h4 className="font-semibold text-silver-light">Cargo Details</h4>
                                    </div>
                                    <div className="space-y-2 text-sm">
                                        {isEditing ? (
                                            <>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Weight (kg)</label>
                                                    <input type="number" value={editedShipment.weight} onChange={(e) => setEditedShipment({ ...editedShipment, weight: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Volume (CBM)</label>
                                                    <input type="number" value={editedShipment.volume} onChange={(e) => setEditedShipment({ ...editedShipment, volume: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Commodity</label>
                                                    <input type="text" value={editedShipment.commodity} onChange={(e) => setEditedShipment({ ...editedShipment, commodity: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Dimensions (L x W x H)</label>
                                                    <input type="text" value={editedShipment.dimensions || ''} onChange={(e) => setEditedShipment({ ...editedShipment, dimensions: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="12m x 2.4m x 2.6m" />
                                                </div>

                                                {/* GWT, Net Weight, Packages, Shipping Mode */}
                                                <div>
                                                    <label className="text-silver-dark text-xs">Gross Weight / GWT (kg)</label>
                                                    <input type="number" step="0.01"
                                                        value={editedShipment.gross_weight ?? editedShipment.weight ?? ''}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, gross_weight: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        placeholder="e.g. 1500" />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">Net Weight (kg)</label>
                                                    <input type="number" step="0.01"
                                                        value={editedShipment.net_weight ?? ''}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, net_weight: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        placeholder="e.g. 1400" />
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-xs">No. of Packages / Pieces</label>
                                                    <input type="text"
                                                        value={editedShipment.packages ?? ''}
                                                        onChange={(e) => setEditedShipment({ ...editedShipment, packages: e.target.value })}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        placeholder="e.g. 10 PALLETS" />
                                                </div>
                                                {shipment.serviceType === 'sea' && (
                                                    <div>
                                                        <label className="text-silver-dark text-xs">Shipping Mode</label>
                                                        <select
                                                            value={shippingMode}
                                                            onChange={(e) => setShippingMode(e.target.value)}
                                                            className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        >
                                                            <option value="">Select mode...</option>
                                                            <option value="CY/CY">CY/CY (Container Yard to Container Yard)</option>
                                                            <option value="CY/CF">CY/CF (Container Yard to Container Freight)</option>
                                                            <option value="CF/CY">CF/CY (Container Freight to Container Yard)</option>
                                                            <option value="CF/CF">CF/CF (Container Freight to Container Freight)</option>
                                                        </select>
                                                    </div>
                                                )}

                                                {/* Document Fields - Dynamic Based on Service Type */}
                                                {shipment.serviceType === 'sea' && (
                                                    <>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">HBL (House Bill of Lading)</label>
                                                            <input type="text" value={editedShipment.hbl || ''} onChange={(e) => setEditedShipment({ ...editedShipment, hbl: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="HBL-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">MBL (Master Bill of Lading)</label>
                                                            <input type="text" value={editedShipment.mbl || ''} onChange={(e) => setEditedShipment({ ...editedShipment, mbl: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="MBL-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">BL Number</label>
                                                            <input type="text" value={editedShipment.bl_number || ''} onChange={(e) => setEditedShipment({ ...editedShipment, bl_number: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="BL-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">BL Date</label>
                                                            <input type="date" value={dates.blDate || ''} onChange={(e) => setDates({ ...dates, blDate: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" />
                                                        </div>
                                                    </>
                                                )}

                                                {shipment.serviceType === 'air' && (
                                                    <>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">HAWB (House Air Waybill)</label>
                                                            <input type="text" value={editedShipment.hawb || ''} onChange={(e) => setEditedShipment({ ...editedShipment, hawb: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="HAWB-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">MAWB (Master Air Waybill)</label>
                                                            <input type="text" value={editedShipment.mawb || ''} onChange={(e) => setEditedShipment({ ...editedShipment, mawb: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="MAWB-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">AWB Number</label>
                                                            <input type="text" value={editedShipment.awb_number || ''} onChange={(e) => setEditedShipment({ ...editedShipment, awb_number: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="AWB-xxx" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">AWB Date</label>
                                                            <input type="date" value={dates.blDate || ''} onChange={(e) => setDates({ ...dates, blDate: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">Flight Number</label>
                                                            <input type="text" value={editedShipment.flight_number || ''} onChange={(e) => setEditedShipment({ ...editedShipment, flight_number: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="SQ123" />
                                                        </div>
                                                    </>
                                                )}

                                                {shipment.serviceType === 'land' && (
                                                    <>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">Document Number</label>
                                                            <input type="text" value={editedShipment.bl_number || ''} onChange={(e) => setEditedShipment({ ...editedShipment, bl_number: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="DOC-2025-001" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">Vehicle/Truck Number</label>
                                                            <input type="text" value={editedShipment.voyage || ''} onChange={(e) => setEditedShipment({ ...editedShipment, voyage: e.target.value })} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="B 1234 ABC" />
                                                        </div>
                                                    </>
                                                )}

                                                {/* Common fields for all service types */}
                                                <div>
                                                    <label className="text-silver-dark text-xs">Shipper (Vendor)</label>
                                                    <select
                                                        value={editedShipment.shipper_name || editedShipment.shipperName || editedShipment.shipper || ''}
                                                        onChange={(e) => {
                                                            const selectedVendor = vendors.find(v => v.name === e.target.value);
                                                            setEditedShipment({
                                                                ...editedShipment,
                                                                shipper_name: e.target.value,
                                                                shipperName: e.target.value,
                                                                shipper: e.target.value,
                                                                shipper_address: selectedVendor?.address || ''
                                                            });
                                                        }}
                                                        className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    >
                                                        <option value="">Select Vendor...</option>
                                                        {vendors.map(v => (
                                                            <option key={v.id} value={v.name}>
                                                                {v.name} {v.company && `(${v.company})`}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                            </>
                                        ) : (
                                            <>
                                                {/* Cargo key figures - view mode */}
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Weight (N/W):</span>
                                                    <span className="text-silver-light">{shipment.net_weight ? `${shipment.net_weight} kg` : (shipment.weight ? `${shipment.weight} kg` : '-')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Gross Weight (G/W):</span>
                                                    <span className="text-silver-light font-medium">{shipment.gross_weight ? `${shipment.gross_weight} kg` : (shipment.weight ? `${shipment.weight} kg` : '-')}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Volume:</span>
                                                    <span className="text-silver-light">{shipment.volume ? `${shipment.volume} CBM` : '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Packages:</span>
                                                    <span className="text-silver-light">{shipment.packages || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Commodity:</span>
                                                    <span className="text-silver-light">{shipment.commodity || '-'}</span>
                                                </div>
                                                {shipment.dimensions && (
                                                    <div className="flex justify-between">
                                                        <span className="text-silver-dark">Dimensions:</span>
                                                        <span className="text-silver-light">{shipment.dimensions}</span>
                                                    </div>
                                                )}
                                                {shipment.shipping_mode && (
                                                    <div className="flex justify-between">
                                                        <span className="text-silver-dark">Shipping Mode:</span>
                                                        <span className="text-blue-400 font-semibold">{shipment.shipping_mode}</span>
                                                    </div>
                                                )}
                                                {/* Vessel info (read only reference from Booking tab) */}
                                                {(bookingData.vesselName) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-silver-dark">Vessel/Flight:</span>
                                                        <span className="text-silver-light">{bookingData.vesselName}{bookingData.voyageNumber ? ` / ${bookingData.voyageNumber}` : ''}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Containers (for sea freight) */}
                                {shipment.serviceType === 'sea' && (
                                    <div className="glass-card p-4 rounded-lg">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <Container className="w-4 h-4 text-accent-orange" />
                                                <h4 className="font-semibold text-silver-light">Containers</h4>
                                            </div>
                                            {isEditing && (
                                                <Button size="sm" variant="secondary" onClick={() => setShowContainerModal(true)}>
                                                    Add
                                                </Button>
                                            )}
                                        </div>
                                        {containers.length === 0 ? (
                                            <p className="text-sm text-silver-dark text-center py-4">No containers added</p>
                                        ) : (
                                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                                {containers.map((container) => (
                                                    <div key={container.id} className="bg-dark-surface p-3 rounded border border-dark-border">
                                                        <div className="flex justify-between items-start">
                                                            <div className="text-sm space-y-1">
                                                                <div className="font-medium text-accent-orange">{container.containerNumber}</div>
                                                                <div className="text-silver-dark">Type: {container.containerType}</div>
                                                                {container.sealNumber && <div className="text-silver-dark">Seal: {container.sealNumber}</div>}
                                                                {container.vgm && <div className="text-silver-dark">VGM: {container.vgm} kg</div>}
                                                            </div>
                                                            <button onClick={() => handleDeleteContainer(container.id)} className="text-red-400 hover:text-red-300">
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'tracking' && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold text-silver-light">Tracking Timeline</h4>
                                    <Button size="sm" icon={Plus} onClick={() => setShowTrackingModal(true)}>
                                        Add Update
                                    </Button>
                                </div>
                                {trackingUpdates.length === 0 ? (
                                    <div className="glass-card p-12 rounded-lg text-center">
                                        <MapPinned className="w-12 h-12 text-silver-dark mx-auto mb-4" />
                                        <p className="text-silver-dark">No tracking updates yet</p>
                                        <p className="text-sm text-silver-dark mt-2">Click "Add Update" to track shipment location</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {trackingUpdates.map((update) => (
                                            <div key={update.id} className="glass-card p-4 rounded-lg border-l-4 border-accent-orange">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <MapPinned className="w-4 h-4 text-accent-orange" />
                                                        <span className="font-semibold text-silver-light">{update.location}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {update.status && (
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${update.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                                                update.status === 'in_transit' ? 'bg-blue-500/20 text-blue-400' :
                                                                    'bg-yellow-500/20 text-yellow-400'
                                                                }`}>
                                                                {update.status === 'in_transit' ? 'In Transit' :
                                                                    update.status === 'delivered' ? 'Delivered' : 'Pending'}
                                                            </span>
                                                        )}
                                                        <span className="text-xs text-silver-dark">{new Date(update.timestamp).toLocaleString('id-ID')}</span>
                                                    </div>
                                                </div>
                                                {update.notes && <p className="text-sm text-silver-light mt-2">{update.notes}</p>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'booking' && (
                            <div className="space-y-6">
                                {/* Booking Info */}
                                <div className="glass-card p-4 rounded-lg">
                                    <h4 className="font-semibold text-silver-light mb-4">Booking Information</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-silver-dark text-sm">
                                                {shipment.serviceType === 'sea' ? 'Vessel Name' : shipment.serviceType === 'air' ? 'Flight Number' : 'Vehicle'}
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={bookingData.vesselName}
                                                    onChange={(e) => setBookingData({ ...bookingData, vesselName: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    placeholder={shipment.serviceType === 'sea' ? 'MV Ocean Star' : 'SQ123'}
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{bookingData.vesselName || '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">
                                                {shipment.serviceType === 'sea' ? 'Voyage Number' : 'Reference'}
                                            </label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={bookingData.voyageNumber}
                                                    onChange={(e) => setBookingData({ ...bookingData, voyageNumber: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    placeholder="VOY123"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{bookingData.voyageNumber || '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">Port/Airport of Loading</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={bookingData.portOfLoading}
                                                    onChange={(e) => setBookingData({ ...bookingData, portOfLoading: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    placeholder="IDJKT"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{bookingData.portOfLoading || '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">Port/Airport of Discharge</label>
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={bookingData.portOfDischarge}
                                                    onChange={(e) => setBookingData({ ...bookingData, portOfDischarge: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    placeholder="SGSIN"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{bookingData.portOfDischarge || '-'}</p>
                                            )}
                                        </div>
                                        {/* Shipping Mode - Sea Freight only */}
                                        {shipment.serviceType === 'sea' && (
                                            <div className="col-span-2">
                                                <label className="text-silver-dark text-sm">Shipping Mode</label>
                                                {isEditing ? (
                                                    <select
                                                        value={shippingMode}
                                                        onChange={(e) => setShippingMode(e.target.value)}
                                                        className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    >
                                                        <option value="">Select shipping mode...</option>
                                                        <option value="CY/CY">CY/CY — Container Yard to Container Yard (Door to Door)</option>
                                                        <option value="CY/CF">CY/CF — Container Yard to Container Freight</option>
                                                        <option value="CF/CY">CF/CY — Container Freight to Container Yard</option>
                                                        <option value="CF/CF">CF/CF — Container Freight to Container Freight</option>
                                                    </select>
                                                ) : (
                                                    <p className={`font-semibold mt-1 ${shippingMode ? 'text-blue-400' : 'text-silver-dark'
                                                        }`}>{shippingMode || '-'}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Dates */}
                                <div className="glass-card p-4 rounded-lg">
                                    <h4 className="font-semibold text-silver-light mb-4">Important Dates</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-silver-dark text-sm">ETD (Estimated Departure)</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={dates.etd}
                                                    onChange={(e) => setDates({ ...dates, etd: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{dates.etd ? new Date(dates.etd).toLocaleDateString() : '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">ETA (Estimated Arrival)</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={dates.eta}
                                                    onChange={(e) => setDates({ ...dates, eta: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{dates.eta ? new Date(dates.eta).toLocaleDateString() : '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">Actual Departure</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={dates.actualDeparture}
                                                    onChange={(e) => setDates({ ...dates, actualDeparture: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{dates.actualDeparture ? new Date(dates.actualDeparture).toLocaleDateString() : '-'}</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="text-silver-dark text-sm">Actual Arrival</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={dates.actualArrival}
                                                    onChange={(e) => setDates({ ...dates, actualArrival: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{dates.actualArrival ? new Date(dates.actualArrival).toLocaleDateString() : '-'}</p>
                                            )}
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-silver-dark text-sm">Delivery Date</label>
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={dates.deliveryDate}
                                                    onChange={(e) => setDates({ ...dates, deliveryDate: e.target.value })}
                                                    className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                />
                                            ) : (
                                                <p className="text-silver-light font-medium mt-1">{dates.deliveryDate ? new Date(dates.deliveryDate).toLocaleDateString() : '-'}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div className="space-y-4">
                                {/* Upload Section */}
                                <div className="glass-card p-4 rounded-lg">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-semibold text-silver-light">Dokumen Pendukung</h4>
                                        <div className="text-sm text-silver-dark">
                                            {documents.length} / 10 dokumen
                                        </div>
                                    </div>

                                    {/* Upload Button */}
                                    <div className="mb-4">
                                        <label className="cursor-pointer">
                                            <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${documents.length >= 10
                                                ? 'border-gray-600 bg-gray-800/20 cursor-not-allowed'
                                                : 'border-accent-orange/50 hover:border-accent-orange hover:bg-accent-orange/5'
                                                }`}>
                                                <Upload className={`w-10 h-10 mx-auto mb-2 ${documents.length >= 10 ? 'text-gray-600' : 'text-accent-orange'
                                                    }`} />
                                                <p className={`text-sm font-medium ${documents.length >= 10 ? 'text-gray-600' : 'text-silver-light'
                                                    }`}>
                                                    {isUploading ? 'Mengupload...' : documents.length >= 10 ? 'Maksimal 10 dokumen tercapai' : 'Klik untuk upload dokumen'}
                                                </p>
                                                <p className="text-xs text-silver-dark mt-1">
                                                    JPEG, PNG, PDF (Maks. 100KB)
                                                </p>
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept=".jpg,.jpeg,.png,.pdf"
                                                multiple
                                                onChange={handleDocumentUpload}
                                                disabled={documents.length >= 10 || isUploading}
                                            />
                                        </label>
                                    </div>

                                    {/* Document List */}
                                    {documents.length === 0 ? (
                                        <div className="text-center py-8">
                                            <FileText className="w-12 h-12 text-silver-dark mx-auto mb-3" />
                                            <p className="text-silver-dark">Belum ada dokumen</p>
                                            <p className="text-sm text-silver-dark mt-1">Upload dokumen pendukung shipment</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {documents.map((doc, index) => (
                                                <div key={doc.id} className="bg-dark-surface border border-dark-border rounded-lg p-3 hover:border-accent-orange/50 transition-colors">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                                            {/* Icon */}
                                                            <div className="mt-1">
                                                                {doc.type === 'application/pdf' ? (
                                                                    <FileText className="w-5 h-5 text-red-400" />
                                                                ) : (
                                                                    <FileText className="w-5 h-5 text-blue-400" />
                                                                )}
                                                            </div>

                                                            {/* Info */}
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm fontmedium text-silver-light truncate">
                                                                    {doc.name}
                                                                </p>
                                                                <div className="flex items-center gap-3 mt-1 text-xs text-silver-dark">
                                                                    <span>{(doc.size / 1024).toFixed(2)} KB</span>
                                                                    <span>•</span>
                                                                    <span>{new Date(doc.uploadedAt).toLocaleDateString('id-ID', {
                                                                        day: '2-digit',
                                                                        month: 'short',
                                                                        year: 'numeric',
                                                                        hour: '2-digit',
                                                                        minute: '2-digit'
                                                                    })}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handlePreviewDocument(doc)}
                                                                className="p-2 hover:bg-blue-500/20 text-blue-400 rounded transition-colors"
                                                                title="Preview"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownloadDocument(doc)}
                                                                className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-colors"
                                                                title="Download"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteDocument(doc.id)}
                                                                className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                                                                title="Hapus"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'cogs' && (
                            <div className="space-y-6">
                                {/* Check if quotedAmount exists */}
                                {!shipment?.quotedAmount || shipment.quotedAmount === 0 ? (
                                    <div className="glass-card p-8 rounded-lg">
                                        <div className="text-center mb-6">
                                            <DollarSign className="w-12 h-12 text-silver-dark mx-auto mb-3" />
                                            <h4 className="text-lg font-semibold text-silver-light mb-2">No Quoted Amount</h4>
                                            <p className="text-sm text-silver-dark">
                                                This shipment doesn't have a quoted amount from quotation.
                                            </p>
                                        </div>

                                        {/* Manual Input Option */}
                                        <div className="max-w-md mx-auto">
                                            <p className="text-sm text-silver-dark mb-4 text-center">
                                                You can manually enter the sales/quoted amount to enable COGS tracking:
                                            </p>
                                            <div className="flex gap-3">
                                                <input
                                                    type="number"
                                                    placeholder="Enter quoted amount (USD)"
                                                    className="flex-1 px-4 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const amount = parseFloat(e.target.value);
                                                            if (amount > 0) {
                                                                onUpdate({ ...shipment, quotedAmount: amount });
                                                                e.target.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <Button onClick={(e) => {
                                                    const input = e.target.closest('.flex').querySelector('input');
                                                    const amount = parseFloat(input.value);
                                                    if (amount > 0) {
                                                        onUpdate({ ...shipment, quotedAmount: amount });
                                                        input.value = '';
                                                    } else {
                                                        alert('Please enter a valid amount');
                                                    }
                                                }}>
                                                    Set Amount
                                                </Button>
                                            </div>
                                            <p className="text-xs text-silver-dark mt-2 text-center">
                                                Press Enter or click "Set Amount" to save
                                            </p>
                                        </div>

                                        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded">
                                            <p className="text-sm text-blue-400">
                                                💡 <strong>Tip:</strong> For future shipments, create them from Sales Orders with approved quotations to auto-fill this amount.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Currency Settings */}
                                        <div className="glass-card p-4 rounded-lg">
                                            <h4 className="font-semibold text-silver-light mb-4">Currency Settings</h4>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div>
                                                    <label className="text-silver-dark text-sm">COGS Currency</label>
                                                    <select
                                                        value={cogsCurrency}
                                                        onChange={(e) => setCogsCurrency(e.target.value)}
                                                        disabled={!isEditingCOGS}
                                                        className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="USD">USD ($)</option>
                                                        <option value="IDR">IDR (Rp)</option>
                                                    </select>
                                                </div>
                                                {cogsCurrency !== (shipment?.currency || 'USD') && (
                                                    <>
                                                        <div>
                                                            <label className="text-silver-dark text-sm">Exchange Rate (USD ↔ IDR)</label>
                                                            <input
                                                                type="number"
                                                                value={exchangeRate || ''}
                                                                onChange={(e) => setExchangeRate(e.target.value)}
                                                                disabled={!isEditingCOGS}
                                                                placeholder="e.g., 15750"
                                                                className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light disabled:opacity-50 disabled:cursor-not-allowed"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-sm">Rate Date</label>
                                                            <input
                                                                type="date"
                                                                value={rateDate || ''}
                                                                onChange={(e) => setRateDate(e.target.value)}
                                                                disabled={!isEditingCOGS}
                                                                className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light disabled:opacity-50 disabled:cursor-not-allowed"
                                                            />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {cogsCurrency !== (shipment?.currency || 'USD') && exchangeRate && (
                                                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                                                    <p className="text-sm text-blue-400">
                                                        💱 1 USD = Rp {parseFloat(exchangeRate).toLocaleString('id-ID')} (as of {rateDate || 'Today'})
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Summary Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div className="glass-card p-4 rounded-lg">
                                                <div className="text-sm text-silver-dark">Quoted Amount</div>
                                                <div className="text-2xl font-bold text-blue-400">
                                                    {shipment.currency === 'IDR'
                                                        ? `Rp ${calculateQuotedAmount().toLocaleString('id-ID')}`
                                                        : `$${calculateQuotedAmount().toLocaleString('id-ID')}`
                                                    }
                                                </div>
                                                <div className="text-xs text-silver-dark mt-1">{shipment.currency || 'USD'}</div>
                                            </div>
                                            <div className="glass-card p-4 rounded-lg">
                                                <div className="text-sm text-silver-dark mb-1">Total COGS</div>
                                                <div className="text-2xl font-bold text-orange-400">
                                                    {cogsCurrency === 'USD' ? '$' : 'Rp '}{(calculateTotalCOGS() || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}
                                                </div>
                                                <div className="text-xs text-silver-dark mt-1">
                                                    {cogsCurrency}
                                                    {cogsCurrency !== (shipment?.currency || 'USD') && exchangeRate && (
                                                        <> ≈ {shipment?.currency === 'IDR' ? 'Rp' : '$'} {(calculateTotalCOGSConverted() || 0).toLocaleString('id-ID', { minimumFractionDigits: 2 })}</>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="glass-card p-4 rounded-lg">
                                                <div className="text-sm text-silver-dark mb-1">Profit/Loss</div>
                                                <div className={`text-2xl font-bold ${calculateProfit() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {shipment.currency === 'IDR'
                                                        ? `Rp ${calculateProfit().toLocaleString('id-ID', { minimumFractionDigits: 2 })}`
                                                        : `$${calculateProfit().toLocaleString('id-ID', { minimumFractionDigits: 2 })}`
                                                    }
                                                </div>
                                                <div className="text-xs text-silver-dark mt-1">{shipment.currency || 'USD'}</div>
                                            </div>
                                            <div className="glass-card p-4 rounded-lg">
                                                <div className="text-sm text-silver-dark mb-1">Margin</div>
                                                <div className={`text-2xl font-bold ${calculateMargin() >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {calculateMargin()}%
                                                </div>
                                            </div>
                                        </div>

                                        {/* COGS Input Form */}
                                        <div className="glass-card p-6 rounded-lg mt-6">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-semibold text-silver-light">
                                                    Actual Costs (COGS) - {cogsCurrency}
                                                </h4>
                                                {isEditingCOGS && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => {
                                                            setBuyingItems([...buyingItems, {
                                                                id: `item-${Date.now()}`,
                                                                description: '',
                                                                qty: 1,
                                                                unit: 'Job',
                                                                rate: 0,
                                                                amount: 0,
                                                                coa_id: null
                                                            }]);
                                                        }}
                                                        icon={Plus}
                                                    >
                                                        Tambah Biaya
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead className="bg-accent-orange">
                                                        <tr>
                                                            <th className="px-2 py-2 text-center text-xs text-white w-10 font-normal">No</th>
                                                            <th className="px-2 py-2 text-left text-xs text-white min-w-[120px] font-normal">Kode</th>
                                                            <th className="px-2 py-2 text-left text-xs text-white min-w-[260px] font-normal">Item</th>
                                                            <th className="px-2 py-2 text-left text-xs text-white min-w-[280px] font-normal">Description</th>
                                                            <th className="px-2 py-2 text-center text-xs text-white min-w-[110px] font-normal">Qty</th>
                                                            <th className="px-2 py-2 text-center text-xs text-white min-w-[110px] font-normal">Unit</th>
                                                            <th className="px-2 py-2 text-right text-xs text-white min-w-[150px] font-normal">Price</th>
                                                            <th className="px-2 py-2 text-right text-xs text-white min-w-[150px] font-normal">Total</th>
                                                            {isEditingCOGS && <th className="px-2 py-2 text-center text-xs text-white min-w-[60px] font-normal">Aksi</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-dark-border">
                                                        {buyingItems.length === 0 && (
                                                            <tr>
                                                                <td colSpan={isEditingCOGS ? 9 : 8} className="text-center py-6 text-silver-dark text-sm">
                                                                    Belum ada rincian biaya aktual.
                                                                </td>
                                                            </tr>
                                                        )}
                                                        {buyingItems.map((item, index) => (
                                                            <tr key={index} className="hover:bg-dark-surface/50 smooth-transition">
                                                                <td className="px-2 py-2 text-center text-silver-light text-xs">{index + 1}</td>
                                                                <td className="px-2 py-2">
                                                                    <span className="text-xs font-mono text-accent-orange whitespace-nowrap">
                                                                        {item._coa_code || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-2 py-2">
                                                                    <COAPicker
                                                                        value={item.coa_id}
                                                                        onChange={(coaId, coaData) => {
                                                                            const updated = [...buyingItems];
                                                                            updated[index].coa_id = coaId;
                                                                            updated[index]._coa_code = coaData?.code || '';
                                                                            setBuyingItems(updated);
                                                                        }}
                                                                        context="COGS"
                                                                        minLevel={1}
                                                                        placeholder="Pilih Akun"
                                                                        size="sm"
                                                                        showCode={true}
                                                                        disabled={!isEditingCOGS}
                                                                    />
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    {isEditingCOGS ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.description || ''}
                                                                            onChange={(e) => {
                                                                                const updated = [...buyingItems];
                                                                                updated[index].description = e.target.value;
                                                                                setBuyingItems(updated);
                                                                            }}
                                                                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                                            placeholder="Deskripsi biaya"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-silver-light text-sm">{item.description}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {isEditingCOGS ? (
                                                                        <input
                                                                            type="number"
                                                                            value={item.qty || 0}
                                                                            onChange={(e) => {
                                                                                const updated = [...buyingItems];
                                                                                updated[index].qty = e.target.value;
                                                                                updated[index].amount = (parseFloat(e.target.value) || 0) * parseFloat(updated[index].rate || 0);
                                                                                setBuyingItems(updated);
                                                                            }}
                                                                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                                                            min="0"
                                                                            step="0.01"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-silver-light text-sm">{item.qty}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-center">
                                                                    {isEditingCOGS ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.unit || ''}
                                                                            onChange={(e) => {
                                                                                const updated = [...buyingItems];
                                                                                updated[index].unit = e.target.value;
                                                                                setBuyingItems(updated);
                                                                            }}
                                                                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-center"
                                                                            placeholder="Unit"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-silver-light text-sm">{item.unit}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2 text-right">
                                                                    {isEditingCOGS ? (
                                                                        <input
                                                                            type="text"
                                                                            value={item.rate !== undefined ? parseFloat(item.rate.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                                            onChange={(e) => {
                                                                                const valStr = e.target.value.replace(/\./g, '');
                                                                                const numVal = parseFloat(valStr) || 0;
                                                                                const updated = [...buyingItems];
                                                                                updated[index].rate = numVal;
                                                                                updated[index].amount = numVal * parseFloat(updated[index].qty || 1);
                                                                                setBuyingItems(updated);
                                                                            }}
                                                                            className="w-full px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light text-sm text-right"
                                                                            placeholder="0"
                                                                        />
                                                                    ) : (
                                                                        <span className="text-silver-light text-sm">{parseFloat(item.rate || 0).toLocaleString('id-ID')}</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2 py-2 text-right">
                                                                    <span className="text-silver-light text-sm font-medium">
                                                                        {parseFloat(item.amount || 0).toLocaleString('id-ID')}
                                                                    </span>
                                                                </td>
                                                                {isEditingCOGS && (
                                                                    <td className="px-2 py-2 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = buyingItems.filter((_, i) => i !== index);
                                                                                setBuyingItems(updated);
                                                                            }}
                                                                            className="p-1.5 hover:bg-red-500/20 text-red-500 rounded transition-colors"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="mt-6">
                                                {calculateProfit() < 0 && (
                                                    <div className="flex items-center gap-2 text-red-400">
                                                        <span className="text-sm">⚠️ Warning: This shipment is running at a loss!</span>
                                                    </div>
                                                )}
                                                {calculateMargin() > 0 && calculateMargin() < 10 && (
                                                    <div className="flex items-center gap-2 text-yellow-400">
                                                        <span className="text-sm">⚠️ Low margin: Consider reviewing costs</span>
                                                    </div>
                                                )}
                                                {calculateMargin() >= 10 && (
                                                    <div className="flex items-center gap-2 text-green-400">
                                                        <span className="text-sm">✓ Healthy margin</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Link to Selling vs Buying Page */}
                                        <div className="glass-card p-4 rounded-lg border border-blue-500/30 bg-blue-500/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <DollarSign className="w-6 h-6 text-blue-400" />
                                                    <div>
                                                        <h4 className="font-semibold text-silver-light">Selling vs Buying Analysis</h4>
                                                        <p className="text-xs text-silver-dark">
                                                            Untuk analisis perbandingan lengkap, gunakan halaman khusus Selling vs Buying
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const currentShipmentState = {
                                                            ...shipment,
                                                            ...editedShipment,
                                                            cogs: cogsData,
                                                            cogsCurrency,
                                                            exchangeRate,
                                                            rateDate,
                                                            buyingItems,
                                                            sellingItems
                                                        };
                                                        onClose();
                                                        if (onViewAnalysis) {
                                                            onViewAnalysis(currentShipmentState);
                                                        } else {
                                                            // Fallback if prop not provided
                                                            window.location.href = `/blink/finance/selling-buying?id=${shipment.id}`;
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                >
                                                    Lihat Analisis
                                                    <span>→</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>


                    {/* Approval Status Bar */}
                    <div className="mt-6 pt-4 border-t border-dark-border">
                        <p className="text-xs text-silver-dark mb-3 font-medium uppercase tracking-wider">Approval Status</p>
                        {currentStatus === 'rejected' ? (
                            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                                <XCircle className="w-4 h-4 flex-shrink-0" />
                                <span className="text-sm font-medium">Shipment Rejected — gunakan tombol ↩ Reset di atas untuk mengembalikan ke Pending.</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-0">
                                {statusSteps.map((step, idx) => {
                                    const cfg = statusConfig[step];
                                    const Icon = cfg.icon;
                                    const currentIdx = statusSteps.indexOf(currentStatus) >= 0
                                        ? statusSteps.indexOf(currentStatus) : 0;
                                    const isDone = idx < currentIdx;
                                    const isCurrent = idx === currentIdx;
                                    return (
                                        <React.Fragment key={step}>
                                            <div className="flex flex-col items-center min-w-[80px] text-center">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isDone ? 'bg-accent-orange border-accent-orange text-white' :
                                                    isCurrent ? 'bg-accent-orange/20 border-accent-orange text-accent-orange animate-pulse' :
                                                        'bg-dark-surface border-dark-border text-silver-dark'
                                                    }`}>
                                                    <Icon className="w-4 h-4" />
                                                </div>
                                                <span className={`text-xs mt-1 font-medium ${isDone || isCurrent ? 'text-accent-orange' : 'text-silver-dark'
                                                    }`}>{cfg.label}</span>
                                                {isCurrent && step === 'pending' && (
                                                    <span className="text-xs text-yellow-400 mt-0.5">Menunggu approval</span>
                                                )}
                                                {isDone && step === 'pending' && (
                                                    <span className="text-xs text-green-400 mt-0.5">✓ Done</span>
                                                )}
                                                {isCurrent && step === 'approved' && (
                                                    <span className="text-xs text-green-400 mt-0.5">PO & BL terbuka ✓</span>
                                                )}
                                            </div>
                                            {idx < statusSteps.length - 1 && (
                                                <div className={`flex-1 h-0.5 mb-7 mx-2 ${idx < currentIdx ? 'bg-accent-orange' : 'bg-dark-border'
                                                    }`} />
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </Modal >

            {/* Status Update Modal */}
            < Modal isOpen={showStatusModal} onClose={() => setShowStatusModal(false)} title="Update Status" size="small" >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">New Status</label>
                        <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light">
                            <option value="">Select status...</option>
                            {Object.entries(statusConfig).map(([key, config]) => (
                                <option key={key} value={key}>{config.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Notes (optional)</label>
                        <textarea rows={3} value={statusNotes} onChange={(e) => setStatusNotes(e.target.value)} placeholder="Add notes..." className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setShowStatusModal(false)}>Cancel</Button>
                        <Button onClick={handleStatusUpdate} disabled={!newStatus}>Update</Button>
                    </div>
                </div>
            </Modal >

            {/* Add Container Modal */}
            < Modal isOpen={showContainerModal} onClose={() => setShowContainerModal(false)} title="Add Container" size="small" >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Container Number <span className="text-red-400">*</span></label>
                        <input type="text" value={newContainer.containerNumber} onChange={(e) => setNewContainer({ ...newContainer, containerNumber: e.target.value.toUpperCase() })} placeholder="ABCD1234567" className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Container Type</label>
                        <select value={newContainer.containerType} onChange={(e) => setNewContainer({ ...newContainer, containerType: e.target.value })} className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light">
                            {containerTypes.map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Seal Number</label>
                        <input type="text" value={newContainer.sealNumber} onChange={(e) => setNewContainer({ ...newContainer, sealNumber: e.target.value.toUpperCase() })} placeholder="SEAL12345" className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">VGM (kg)</label>
                        <input type="number" value={newContainer.vgm} onChange={(e) => setNewContainer({ ...newContainer, vgm: e.target.value })} placeholder="28500" className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setShowContainerModal(false)}>Cancel</Button>
                        <Button onClick={handleAddContainer}>Add Container</Button>
                    </div>
                </div>
            </Modal >

            {/* Add Tracking Update Modal */}
            < Modal isOpen={showTrackingModal} onClose={() => setShowTrackingModal(false)} title="Add Tracking Update" size="small" >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Location <span className="text-red-400">*</span></label>
                        <input type="text" value={newTracking.location} onChange={(e) => setNewTracking({ ...newTracking, location: e.target.value })} placeholder="e.g., Singapore Port, Jakarta Warehouse" className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Notes</label>
                        <textarea rows={3} value={newTracking.notes} onChange={(e) => setNewTracking({ ...newTracking, notes: e.target.value })} placeholder="Container departed on schedule..." className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">Status Tracking</label>
                        <select
                            value={newTracking.status}
                            onChange={(e) => setNewTracking({ ...newTracking, status: e.target.value })}
                            className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light"
                        >
                            <option value="pending">Pending</option>
                            <option value="in_transit">In Transit</option>
                            <option value="delivered">Delivered</option>
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="secondary" onClick={() => setShowTrackingModal(false)}>Cancel</Button>
                        <Button onClick={handleAddTracking}>Add Update</Button>
                    </div>
                </div>
            </Modal >

            {/* Generate PO - Vendor Selector Modal */}
            <Modal
                isOpen={showPOVendorModal}
                onClose={() => setShowPOVendorModal(false)}
                title="Generate Purchase Order"
                size="medium"
            >
                <div className="space-y-5">
                    {/* PO Items Preview */}
                    <div>
                        <p className="text-sm font-medium text-silver mb-3">
                            PO Items Preview ({pendingPOItems.length} items)
                        </p>
                        <div className="max-h-52 overflow-y-auto rounded-lg border border-dark-border">
                            <table className="w-full text-xs">
                                <thead className="bg-dark-surface sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-silver-dark">Item</th>
                                        <th className="px-3 py-2 text-left text-silver-dark">Description</th>
                                        <th className="px-3 py-2 text-center text-silver-dark">Qty</th>
                                        <th className="px-3 py-2 text-right text-silver-dark">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-dark-border">
                                    {pendingPOItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-dark-surface/50">
                                            <td className="px-3 py-2 text-blue-300 font-medium">{item.item_name}</td>
                                            <td className="px-3 py-2 text-silver-light">{item.description}</td>
                                            <td className="px-3 py-2 text-center text-silver-dark">{item.qty}</td>
                                            <td className="px-3 py-2 text-right text-green-400 font-mono">
                                                {item.amount.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-dark-card border-t border-accent-orange/50">
                                    <tr>
                                        <td colSpan="3" className="px-3 py-2 text-right font-bold text-silver-light text-xs">TOTAL</td>
                                        <td className="px-3 py-2 text-right font-bold text-accent-orange text-sm font-mono">
                                            {cogsCurrency} {pendingPOTotal.toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Vendor Selection */}
                    <div>
                        <label className="block text-sm font-medium text-silver mb-2">
                            Select Vendor (Blink Mitra) <span className="text-red-400">*</span>
                        </label>
                        {poVendors.length === 0 ? (
                            <div className="px-3 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-sm">
                                ⚠️ No vendor mitra found. Please add vendors in Blink Master Data → Business Partners and check the "Vendor" role.
                            </div>
                        ) : (
                            <div className="space-y-1 max-h-52 overflow-y-auto rounded-lg border border-dark-border">
                                {poVendors.map(v => (
                                    <button
                                        type="button"
                                        key={v.id}
                                        onClick={() => setSelectedPOVendorId(v.id)}
                                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between ${selectedPOVendorId === v.id
                                            ? 'bg-accent-orange/30 border-l-4 border-accent-orange text-accent-orange'
                                            : 'bg-dark-surface hover:bg-dark-card text-silver-light'
                                            }`}
                                    >
                                        <div>
                                            <span className="font-medium">{v.partner_name}</span>
                                            {v.partner_code && <span className="ml-2 text-xs text-silver-dark">({v.partner_code})</span>}
                                        </div>
                                        {selectedPOVendorId === v.id && (
                                            <span className="text-accent-orange text-sm">✓ Selected</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="secondary" onClick={() => setShowPOVendorModal(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmGeneratePO}
                            disabled={!selectedPOVendorId}
                        >
                            Generate PO
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Status Confirmation Modal */}
            <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title="Konfirmasi" size="small">
                <div className="space-y-4 text-silver-light">
                    <p className="text-lg">{confirmAction?.message}</p>
                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="secondary" onClick={() => setConfirmAction(null)}>Batal</Button>
                        <Button variant="primary" onClick={handleConfirmStatusChange}>Ya, Lanjutkan</Button>
                    </div>
                </div>
            </Modal>

            {/* Success Message Modal */}
            <Modal isOpen={!!successMsg} onClose={() => setSuccessMsg('')} title="Berhasil" size="small">
                <div className="space-y-4 text-center">
                    <p className="text-lg text-emerald-400 font-semibold mt-4">{successMsg}</p>
                    <div className="flex justify-center mt-6">
                        <Button variant="primary" onClick={() => setSuccessMsg('')}>Tutup</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default ShipmentDetailModalEnhanced;
