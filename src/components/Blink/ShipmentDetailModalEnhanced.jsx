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
    Receipt
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ShipmentDetailModalEnhanced = ({ isOpen, onClose, shipment, onUpdate, onViewAnalysis }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('details');
    const [isEditing, setIsEditing] = useState(false);
    const [isEditingCOGS, setIsEditingCOGS] = useState(false);
    const [editedShipment, setEditedShipment] = useState(shipment || {});

    // Auto-population state
    const [vendors, setVendors] = useState([]);
    const [quotationData, setQuotationData] = useState(null);

    // Status management
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [statusNotes, setStatusNotes] = useState('');

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
        vesselName: shipment?.vessel_name || '',
        voyageNumber: shipment?.voyage || '',
        portOfLoading: shipment?.origin || '',
        portOfDischarge: shipment?.destination || '',
        etd: '',
        eta: ''
    });

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
            // Sync selling and buying items
            setSellingItems(shipment.sellingItems || []);
            setBuyingItems(shipment.buyingItems || []);
        }
    }, [shipment]);



    if (!shipment) return null;

    const statusConfig = {
        pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
        confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
        booked: { label: 'Booked', color: 'bg-indigo-500/20 text-indigo-400' },
        in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400' },
        arrived: { label: 'Arrived', color: 'bg-green-500/20 text-green-400' },
        customs_clearance: { label: 'Customs Clearance', color: 'bg-orange-500/20 text-orange-400' },
        delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-400' },
        completed: { label: 'Completed', color: 'bg-teal-500/20 text-teal-400' }
    };

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
        if (!confirm('Generate Purchase Order from these COGS items? This will create a new draft PO.')) return;

        try {
            // 1. Gather Items
            const poItems = [];
            const addIfPresent = (label, value) => {
                const val = parseFloat(String(value).replace(/,/g, ''));
                if (val && val > 0) {
                    poItems.push({
                        description: `${label} - ${shipment.job_number}`,
                        qty: 1,
                        unit: 'Job',
                        unit_price: val,
                        amount: val
                    });
                }
            };

            const cogs = cogsData;
            addIfPresent('Ocean Freight', cogs.oceanFreight);
            addIfPresent('Air Freight', cogs.airFreight);
            addIfPresent('Trucking', cogs.trucking);
            addIfPresent('THC', cogs.thc);
            addIfPresent('Documentation', cogs.documentation);
            addIfPresent('Customs Clearance', cogs.customs);
            addIfPresent('Insurance', cogs.insurance);
            addIfPresent('Demurrage', cogs.demurrage);
            addIfPresent(cogs.otherDescription || 'Other Charges', cogs.other);

            if (poItems.length === 0) {
                alert('No COGS amounts found to generate PO items.');
                return;
            }

            // 2. Generate PO number using centralized generator
            const { generatePONumber } = await import('../../utils/documentNumbers');
            const poNumber = await generatePONumber();

            // 3. Create PO
            const totalAmount = poItems.reduce((sum, item) => sum + item.amount, 0);

            const newPO = {
                po_number: poNumber,
                vendor_id: null, // User must select vendor later
                vendor_name: 'To Be Assigned',
                po_date: new Date().toISOString().split('T')[0],
                delivery_date: null,
                payment_terms: 'NET 30',
                po_items: poItems,
                currency: cogsCurrency || 'IDR',
                exchange_rate: exchangeRate || 1,
                subtotal: totalAmount,
                tax_rate: 0, // Default 0 for freight usually, user can change
                tax_amount: 0,
                discount_amount: 0,
                total_amount: totalAmount,
                status: 'draft',
                notes: `Generated from Shipment Job: ${shipment.job_number}`
            };

            const { data, error } = await supabase
                .from('blink_purchase_orders')
                .insert([newPO])
                .select();

            if (error) {
                console.error('Supabase insert error:', error);
                throw error;
            }

            console.log('✅ PO inserted successfully:', data);
            alert(`✅ Purchase Order ${poNumber} generated successfully!`);

            // Close the shipment modal
            onClose();

            // Navigate to Purchase Order page
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
                const parsed = parseFloat(value);
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
                description: item.description || '',
                amount: parseNumber(item.amount)
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

            onUpdate(updatedShipment);

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
        // Base COGS items
        const baseCOGS =
            parseFloat(cogsData.oceanFreight || 0) +
            parseFloat(cogsData.airFreight || 0) +
            parseFloat(cogsData.trucking || 0) +
            parseFloat(cogsData.thc || 0) +
            parseFloat(cogsData.documentation || 0) +
            parseFloat(cogsData.customs || 0) +
            parseFloat(cogsData.insurance || 0) +
            parseFloat(cogsData.demurrage || 0) +
            parseFloat(cogsData.other || 0);

        // Additional costs from array
        const additionalTotal = (cogsData.additionalCosts || []).reduce((sum, item) => {
            return sum + parseFloat(item.amount || 0);
        }, 0);

        // Buying items total
        const buyingTotal = (buyingItems || []).reduce((sum, item) => {
            return sum + parseFloat(item.amount || 0);
        }, 0);

        return baseCOGS + additionalTotal + buyingTotal;
    };

    // Convert COGS to USD if in IDR
    const calculateTotalCOGSInUSD = () => {
        const total = calculateTotalCOGS();
        if (cogsCurrency === 'IDR' && exchangeRate) {
            return total / parseFloat(exchangeRate);
        }
        return total;
    };

    const calculateProfit = () => {
        return calculateQuotedAmount() - calculateTotalCOGSInUSD();
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
        onUpdate(updatedShipment);
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

            onUpdate({ ...shipment, containers: updatedContainers });
            setNewContainer({ containerNumber: '', containerType: '20ft', sealNumber: '', vgm: '' });
            setShowContainerModal(false);
            alert('✅ Container added successfully!');
        } catch (error) {
            console.error('Error adding container:', error);
            alert('❌ Failed to add container: ' + error.message);
        }
    };

    const handleDeleteContainer = (containerId) => {
        const updatedContainers = containers.filter(c => c.id !== containerId);
        setContainers(updatedContainers);
        onUpdate({ ...shipment, containers: updatedContainers });
    };

    const handleGenerateInvoice = async () => {
        if (!confirm('Create Invoice for this shipment? This will create a new draft Invoice.')) return;

        try {
            // 1. Generate Invoice Number
            const { generateInvoiceNumber } = await import('../../utils/documentNumbers');
            const invoiceNumber = await generateInvoiceNumber(shipment.jobNumber || shipment.soNumber);

            // 2. Prepare Invoice Items
            // Use quotedAmount as the main item
            const invoiceItems = [{
                description: `${(shipment.serviceType || 'Freight').toUpperCase()} - ${shipment.origin || ''} to ${shipment.destination || ''}`,
                qty: 1,
                unit: 'Shipment',
                rate: shipment.quotedAmount || 0,
                amount: shipment.quotedAmount || 0
            }];

            // 3. Create Invoice Object
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
                currency: shipment.currency || 'IDR', // Default to shipment currency
                subtotal: shipment.quotedAmount || 0,
                tax_rate: 11.0, // Default VAT
                tax_amount: (shipment.quotedAmount || 0) * 0.11,
                total_amount: (shipment.quotedAmount || 0) * 1.11,
                outstanding_amount: (shipment.quotedAmount || 0) * 1.11,
                status: 'draft',
                invoice_items: invoiceItems,
                // COGS from shipment (optional, but good to link)
                cogs_items: [], // Populated later or leave empty
                notes: `Generated from Shipment: ${shipment.jobNumber}`
            };

            const { data, error } = await supabase
                .from('blink_invoices')
                .insert([newInvoice])
                .select();

            if (error) throw error;

            alert(`✅ Invoice ${invoiceNumber} created successfully!`);
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
        onUpdate(updatedShipment);

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
        onUpdate(updatedShipment);
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
                // Return null for falsy values, "undefined" string, empty string, or invalid UUIDs
                if (!value ||
                    value === 'undefined' ||
                    value === 'null' ||
                    value === '' ||
                    value === 'NULL' ||
                    String(value).toLowerCase() === 'undefined') {
                    return null;
                }
                // Additional check: ensure it looks like a valid UUID format
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (!uuidPattern.test(value)) {
                    console.warn(`Invalid UUID format detected: "${value}", returning null`);
                    return null;
                }
                return value;
            };

            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    customer: editedShipment.customer,
                    origin: editedShipment.origin,
                    destination: editedShipment.destination,
                    cargo_type: editedShipment.cargoType,
                    weight: editedShipment.weight,
                    volume: editedShipment.volume,
                    commodity: editedShipment.commodity,
                    dimensions: editedShipment.dimensions,
                    hbl: editedShipment.hbl,
                    mbl: editedShipment.mbl,
                    hawb: editedShipment.hawb,
                    mawb: editedShipment.mawb,
                    voyage: editedShipment.voyage,
                    flight_number: editedShipment.flight_number,
                    bl_number: editedShipment.bl_number,
                    awb_number: editedShipment.awb_number,
                    bl_date: dates.blDate || null,
                    // Ensure root columns for critical data are updated
                    vessel_name: bookingData.vesselName || editedShipment.vessel || null,
                    container_number: containers.length > 0 ? containers[0].containerNumber : (editedShipment.containerNumber || null),
                    shipper_name: editedShipment.shipper_name,
                    shipper: editedShipment.shipper,
                    // Container array (JSONB)
                    containers: containers,
                    // UUID fields - validate before sending
                    customer_id: safeUUID(editedShipment.customerId),
                    quotation_id: safeUUID(editedShipment.quotationId),
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

            // Update parent component with all data
            const updatedShipment = {
                ...editedShipment,
                booking: bookingData,
                ...dates
            };
            onUpdate(updatedShipment);
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

                    onUpdate({ ...shipment, documents: updatedDocuments });
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

            onUpdate({ ...shipment, documents: updatedDocuments });
            alert('✅ Dokumen berhasil dihapus');
        } catch (error) {
            console.error('Error deleting document:', error);
            alert('❌ Gagal menghapus dokumen: ' + error.message);
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
                                    <Button
                                        size="sm"
                                        variant="primary"
                                        icon={Receipt}
                                        onClick={handleGenerateInvoice}
                                        title="Create Invoice from this Shipment"
                                    >
                                        Create Inv
                                    </Button>
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
                                    {activeTab === 'cogs' && calculateTotalCOGS() > 0 && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleGeneratePO}
                                            title="Generate a PO from these costs"
                                        >
                                            Generate PO
                                        </Button>
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
                            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${shipment.status === 'delivered' ? 'bg-green-500/20 text-green-400' :
                                shipment.status === 'in_transit' ? 'bg-blue-500/20 text-blue-400' :
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                {shipment.status}
                            </span>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 border-b border-dark-border">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
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
                                                        <div>
                                                            <label className="text-silver-dark text-xs">Vessel Name</label>
                                                            <input type="text" value={editedShipment.vessel || bookingData.vesselName || ''} onChange={(e) => {
                                                                setEditedShipment({ ...editedShipment, vessel: e.target.value });
                                                                setBookingData({ ...bookingData, vesselName: e.target.value });
                                                            }} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="MV Ocean Star" />
                                                        </div>
                                                        <div>
                                                            <label className="text-silver-dark text-xs">Voyage Number</label>
                                                            <input type="text" value={editedShipment.voyage || bookingData.voyageNumber || ''} onChange={(e) => {
                                                                setEditedShipment({ ...editedShipment, voyage: e.target.value });
                                                                setBookingData({ ...bookingData, voyageNumber: e.target.value });
                                                            }} className="w-full mt-1 px-2 py-1 bg-dark-surface border border-dark-border rounded text-silver-light" placeholder="V2025-001" />
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
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Weight:</span>
                                                    <span className="text-silver-light">{shipment.weight ? `${shipment.weight} kg` : '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Volume:</span>
                                                    <span className="text-silver-light">{shipment.volume ? `${shipment.volume} CBM` : '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Commodity:</span>
                                                    <span className="text-silver-light">{shipment.commodity || '-'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-silver-dark">Dimensions:</span>
                                                    <span className="text-silver-light">{shipment.dimensions || '-'}</span>
                                                </div>

                                                {/* Document Fields Display - Dynamic */}
                                                {shipment.serviceType === 'sea' && (
                                                    <>
                                                        {shipment.hbl && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">HBL:</span>
                                                                <span className="text-silver-light">{shipment.hbl}</span>
                                                            </div>
                                                        )}
                                                        {shipment.mbl && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">MBL:</span>
                                                                <span className="text-silver-light">{shipment.mbl}</span>
                                                            </div>
                                                        )}
                                                        {shipment.voyage && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">Voyage:</span>
                                                                <span className="text-silver-light">{shipment.voyage}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {shipment.serviceType === 'air' && (
                                                    <>
                                                        {shipment.hawb && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">HAWB:</span>
                                                                <span className="text-silver-light">{shipment.hawb}</span>
                                                            </div>
                                                        )}
                                                        {shipment.mawb && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">MAWB:</span>
                                                                <span className="text-silver-light">{shipment.mawb}</span>
                                                            </div>
                                                        )}
                                                        {shipment.flight_number && (
                                                            <div className="flex justify-between">
                                                                <span className="text-silver-dark">Flight:</span>
                                                                <span className="text-silver-light">{shipment.flight_number}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}

                                                {(shipment.shipper_name || shipment.shipper) && (
                                                    <div className="flex justify-between">
                                                        <span className="text-silver-dark">Shipper:</span>
                                                        <span className="text-silver-light">{shipment.shipper_name || shipment.shipper}</span>
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
                                                {cogsCurrency === 'IDR' && (
                                                    <>
                                                        <div>
                                                            <label className="text-silver-dark text-sm">Exchange Rate (USD to IDR)</label>
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
                                            {cogsCurrency === 'IDR' && exchangeRate && (
                                                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                                                    <p className="text-sm text-blue-400">
                                                        💱 1 USD = Rp {parseFloat(exchangeRate).toLocaleString('id-ID')} (as of {rateDate})
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
                                                    {cogsCurrency === 'USD' ? '$' : 'Rp '}{(calculateTotalCOGS() || 0).toLocaleString('id-ID')}
                                                </div>
                                                <div className="text-xs text-silver-dark mt-1">
                                                    {cogsCurrency}
                                                    {cogsCurrency === 'IDR' && exchangeRate && (
                                                        <> ≈ ${(calculateTotalCOGSInUSD() || 0).toLocaleString('id-ID')}</>
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
                                        <div className="glass-card p-6 rounded-lg">
                                            <h4 className="font-semibold text-silver-light mb-4">
                                                Actual Costs (COGS) - {cogsCurrency}
                                            </h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                {shipment.serviceType === 'sea' && (
                                                    <div>
                                                        <label className="text-silver-dark text-sm">Ocean Freight ({cogsCurrency})</label>
                                                        {isEditingCOGS ? (
                                                            <input
                                                                type="text"
                                                                value={cogsData.oceanFreight ? parseFloat(cogsData.oceanFreight.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value.replace(/\./g, '');
                                                                    setCogsData({ ...cogsData, oceanFreight: value });
                                                                }}
                                                                placeholder="0"
                                                                className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                            />
                                                        ) : (
                                                            <p className="text-silver-light font-medium mt-1">
                                                                {cogsData.oceanFreight ? parseFloat(cogsData.oceanFreight).toLocaleString('id-ID') : '-'}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                {shipment.serviceType === 'air' && (
                                                    <div>
                                                        <label className="text-silver-dark text-sm">Air Freight ({cogsCurrency})</label>
                                                        {isEditingCOGS ? (
                                                            <input
                                                                type="text"
                                                                value={cogsData.airFreight ? parseFloat(cogsData.airFreight.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                                onChange={(e) => {
                                                                    const value = e.target.value.replace(/\./g, '');
                                                                    setCogsData({ ...cogsData, airFreight: value });
                                                                }}
                                                                placeholder="0"
                                                                className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                            />
                                                        ) : (
                                                            <p className="text-silver-light font-medium mt-1">
                                                                {cogsData.airFreight ? parseFloat(cogsData.airFreight).toLocaleString('id-ID') : '-'}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                                <div>
                                                    <label className="text-silver-dark text-sm">Trucking ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.trucking ? parseFloat(cogsData.trucking.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, trucking: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.trucking ? parseFloat(cogsData.trucking).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">THC - Terminal Handling ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.thc ? parseFloat(cogsData.thc.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, thc: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.thc ? parseFloat(cogsData.thc).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Documentation Fee ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.documentation ? parseFloat(cogsData.documentation.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, documentation: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.documentation ? parseFloat(cogsData.documentation).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Customs Clearance ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.customs ? parseFloat(cogsData.customs.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, customs: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.customs ? parseFloat(cogsData.customs).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Insurance ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.insurance ? parseFloat(cogsData.insurance.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, insurance: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.insurance ? parseFloat(cogsData.insurance).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Demurrage/Detention ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.demurrage ? parseFloat(cogsData.demurrage.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, demurrage: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.demurrage ? parseFloat(cogsData.demurrage).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Other Costs ({cogsCurrency})</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.other ? parseFloat(cogsData.other.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                            onChange={(e) => {
                                                                const value = e.target.value.replace(/\./g, '');
                                                                setCogsData({ ...cogsData, other: value });
                                                            }}
                                                            placeholder="0"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.other ? parseFloat(cogsData.other).toLocaleString('id-ID') : '-'}
                                                        </p>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-silver-dark text-sm">Other Description</label>
                                                    {isEditingCOGS ? (
                                                        <input
                                                            type="text"
                                                            value={cogsData.otherDescription}
                                                            onChange={(e) => setCogsData({ ...cogsData, otherDescription: e.target.value })}
                                                            placeholder="Description for other costs"
                                                            className="w-full mt-1 px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light"
                                                        />
                                                    ) : (
                                                        <p className="text-silver-light font-medium mt-1">
                                                            {cogsData.otherDescription || '-'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Additional Other Costs - Dynamic List */}
                                            {isEditingCOGS && (
                                                <div className="mt-6 p-4 border border-dashed border-dark-border rounded-lg">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h5 className="text-sm font-semibold text-silver-light">Biaya Lain-lain Tambahan</h5>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newCosts = [...(cogsData.additionalCosts || []), { description: '', amount: '' }];
                                                                setCogsData({ ...cogsData, additionalCosts: newCosts });
                                                            }}
                                                            className="text-accent-orange hover:text-accent-orange/80 text-xs flex items-center gap-1"
                                                        >
                                                            <Plus className="w-4 h-4" /> Tambah Biaya
                                                        </button>
                                                    </div>

                                                    {(cogsData.additionalCosts || []).length === 0 && (
                                                        <p className="text-xs text-silver-dark text-center py-3">
                                                            Belum ada biaya tambahan. Klik "Tambah Biaya" untuk menambahkan.
                                                        </p>
                                                    )}

                                                    <div className="space-y-2">
                                                        {(cogsData.additionalCosts || []).map((cost, index) => (
                                                            <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                                                <div className="col-span-6">
                                                                    <input
                                                                        type="text"
                                                                        value={cost.description}
                                                                        onChange={(e) => {
                                                                            const updated = [...cogsData.additionalCosts];
                                                                            updated[index].description = e.target.value;
                                                                            setCogsData({ ...cogsData, additionalCosts: updated });
                                                                        }}
                                                                        placeholder="Deskripsi biaya"
                                                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                                    />
                                                                </div>
                                                                <div className="col-span-4">
                                                                    <input
                                                                        type="text"
                                                                        value={cost.amount ? parseFloat(cost.amount.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                                                        onChange={(e) => {
                                                                            const value = e.target.value.replace(/\./g, '');
                                                                            const updated = [...cogsData.additionalCosts];
                                                                            updated[index].amount = value;
                                                                            setCogsData({ ...cogsData, additionalCosts: updated });
                                                                        }}
                                                                        placeholder="Jumlah"
                                                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                                                                    />
                                                                </div>
                                                                <div className="col-span-2 flex justify-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const updated = cogsData.additionalCosts.filter((_, i) => i !== index);
                                                                            setCogsData({ ...cogsData, additionalCosts: updated });
                                                                        }}
                                                                        className="p-2 hover:bg-red-500/20 text-red-400 rounded"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Display Additional Costs in View Mode */}
                                            {!isEditingCOGS && (cogsData.additionalCosts || []).length > 0 && (
                                                <div className="mt-4 p-3 bg-dark-card rounded-lg">
                                                    <h5 className="text-xs font-semibold text-silver-dark mb-2">Biaya Lain-lain Tambahan:</h5>
                                                    <div className="space-y-1">
                                                        {(cogsData.additionalCosts || []).map((cost, index) => (
                                                            <div key={index} className="flex justify-between text-sm">
                                                                <span className="text-silver-light">{cost.description || `Biaya #${index + 1}`}</span>
                                                                <span className="text-silver-light font-medium">
                                                                    {cost.amount ? parseFloat(cost.amount).toLocaleString('id-ID') : '-'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

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
                                                        onClose();
                                                        if (onViewAnalysis) {
                                                            onViewAnalysis(shipment);
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
        </>
    );
};

export default ShipmentDetailModalEnhanced;
