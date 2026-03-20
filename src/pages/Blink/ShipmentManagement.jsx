import React, { useState, useEffect } from 'react';
import Button from '../../components/Common/Button';
import ShipmentDetailModal from '../../components/Blink/ShipmentDetailModalEnhanced';
import SellingBuyingDetailModal from '../../components/Blink/SellingBuyingDetailModal';
import { Ship, Plus, MapPin, Filter, Search, Download, X, ShoppingCart, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const ShipmentManagement = () => {
    const { canCreate, canEdit, canDelete, canView, canApprove, canAccess } = useAuth();
    const [filter, setFilter] = useState('all');
    const [shipments, setShipments] = useState([]);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [analysisShipment, setAnalysisShipment] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [showFilters, setShowFilters] = useState(false);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // PO generation from list
    const [showListPOModal, setShowListPOModal] = useState(false);
    const [listPOVendors, setListPOVendors] = useState([]);
    const [listPOSelectedVendor, setListPOSelectedVendor] = useState('');
    const [listPOShipment, setListPOShipment] = useState(null);

    // Load shipments from Supabase
    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            console.log('🔍 Fetching shipments from Supabase...');

            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Fetch error:', error);
                throw error;
            }

            console.log(`📦 Fetched ${data?.length || 0} shipments from DB`);
            console.log('Raw data sample:', data?.[0]);

            // Returns mapped data so callers can pick individual records

            // Map snake_case to camelCase
            const mapped = (data || []).map(s => ({
                ...s,
                jobNumber: s.job_number || s.jobNumber,
                soNumber: s.so_number || s.soNumber,
                quotationId: s.quotation_id || s.quotationId,
                customerId: s.customer_id || s.customerId,
                salesPerson: s.sales_person || s.salesPerson,
                quotationType: s.quotation_type || s.quotationType || null,
                quotationDate: s.quotation_date || s.quotationDate,
                serviceType: s.service_type || s.serviceType,
                cargoType: s.cargo_type || s.cargoType,
                quotedAmount: s.quoted_amount || s.quotedAmount,
                cogsCurrency: s.cogs_currency || s.cogsCurrency,
                exchangeRate: s.exchange_rate || s.exchangeRate,
                rateDate: s.rate_date || s.rateDate,
                actualDeparture: s.actual_departure || s.actualDeparture,
                actualArrival: s.actual_arrival || s.actualArrival,
                deliveryDate: s.delivery_date || s.deliveryDate,
                createdAt: s.created_at || s.createdAt,
                updatedAt: s.updated_at || s.updatedAt,
                createdFrom: s.created_from || s.createdFrom,
                currency: s.currency || 'USD',
                // Document / BL / AWB fields
                mawb: s.mawb || null,
                hawb: s.hawb || null,
                hbl: s.hbl || null,
                mbl: s.mbl || null,
                bl_number: s.bl_number || null,
                awb_number: s.awb_number || null,
                bl_date: s.bl_date || null,
                blDate: s.bl_date || null,
                // Shipment detail fields
                consignee_name: s.consignee_name || null,
                shipperName: s.shipper_name || s.shipper || null,
                shipper: s.shipper || s.shipper_name || null,
                shipper_name: s.shipper_name || null,
                grossWeight: s.gross_weight || s.grossWeight || null,
                gross_weight: s.gross_weight || null,
                netWeight: s.net_weight || s.netWeight || null,
                net_weight: s.net_weight || null,
                packages: s.packages || null,
                measure: s.measure || null,
                shippingMode: s.shipping_mode || s.shippingMode || null,
                shipping_mode: s.shipping_mode || null,
                // Booking / vessel / port
                vessel_name: s.vessel_name || null,
                voyage: s.voyage || null,
                flight_number: s.flight_number || null,
                port_of_loading: s.port_of_loading || null,
                port_of_discharge: s.port_of_discharge || null,
                // Containers
                containers: s.containers || [],
                // Documents
                documents: s.documents || [],
                // Trade & transport terms
                incoterm: s.incoterm || null,
                paymentTerms: s.payment_terms || s.paymentTerms || null,
                payment_terms: s.payment_terms || null,
                // Items mapping
                sellingItems: s.selling_items || s.sellingItems || [],
                buyingItems: s.buying_items || s.buyingItems || []
            }));

            // Sort by created_at descending (newest first) - client-side guarantee
            mapped.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.created_at || 0);
                const dateB = new Date(b.createdAt || b.created_at || 0);
                return dateB - dateA;
            });

            console.log(`✅ Mapped ${mapped.length} shipments`);
            console.log('Mapped sample:', mapped?.[0]);

            setShipments(mapped);
            return mapped; // Allow callers to get fresh data
        } catch (error) {
            console.error('❌ Error fetching shipments:', error);
            setShipments([]);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        pending: { label: 'Pending', color: 'bg-gray-500/20 text-gray-400' },
        manager_approval: { label: 'Waiting Approval', color: 'bg-yellow-500/20 text-yellow-400' },
        approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400' },
        rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400' },
        confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
        booked: { label: 'Booked', color: 'bg-indigo-500/20 text-indigo-400' },
        in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400' },
        arrived: { label: 'Arrived', color: 'bg-teal-500/20 text-teal-400' },
        customs_clearance: { label: 'Customs', color: 'bg-orange-500/20 text-orange-400' },
        delivered: { label: 'Delivered', color: 'bg-cyan-500/20 text-cyan-400' },
        completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-400' },
    };

    // Helper function to get shipment type from quotationType or type field
    const getShipmentType = (shipment) => {
        // If has quotationType (from SO conversion), map it
        const qt = shipment.quotationType || shipment.quotation_type;
        if (qt) {
            if (qt === 'RG') return 'regular';
            if (qt === 'NR' || qt === 'non-regular' || qt === 'Non-Regular') return 'non-regular';
            if (qt === 'urgent' || qt === 'Urgent') return 'urgent';
            return 'non-regular'; // Default for unknown quotationType
        }
        // Otherwise use existing type field (backward compatibility)
        const t = shipment.type || '';
        if (t === 'regular') return 'regular';
        if (t === 'non-regular') return 'non-regular';
        if (t === 'urgent') return 'urgent';
        return 'regular'; // Default fallback
    };

    // Filter shipments berdasarkan type, status, service, and search
    const filteredShipments = shipments.filter(s => {
        // Type filter (folder tab)
        if (filter !== 'all' && getShipmentType(s) !== filter) return false;

        // Status filter
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;

        // Service filter
        if (serviceFilter !== 'all' && (s.serviceType || '').toLowerCase() !== serviceFilter.toLowerCase()) return false;

        // Search filter - must be checked LAST, does not short-circuit other filters
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesSearch = (
                (s.jobNumber || '').toLowerCase().includes(query) ||
                (s.soNumber || '').toLowerCase().includes(query) ||
                (s.customer || '').toLowerCase().includes(query) ||
                (s.origin || '').toLowerCase().includes(query) ||
                (s.destination || '').toLowerCase().includes(query)
            );
            if (!matchesSearch) return false;
        }

        return true;
    });



    // Export to Excel
    const handleExportToExcel = () => {
        import('../../utils/exportXLS').then(({ exportToXLS }) => {
            const headerRows = [
                { value: 'SHIPMENT MANAGEMENT REPORT', style: 'title' },
                { value: `Report Date: ${new Date().toLocaleDateString('id-ID')}`, style: 'normal' },
                ''
            ];

            const xlsColumns = [
                { header: 'No', key: 'no', width: 5, align: 'center' },
                { header: 'Job Number', key: 'jobNumber', width: 20 },
                { header: 'SO Number', key: 'soNumber', width: 20 },
                { header: 'Customer', key: 'customer', width: 25 },
                { header: 'Route', render: (item) => `${item.origin || '-'} -> ${item.destination || '-'}`, width: 30 },
                { header: 'Service Type', key: 'serviceType', width: 15 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Created Date', key: 'createdAt', width: 15 }
            ];

            exportToXLS(filteredShipments, `Shipments_Report_${new Date().toISOString().split('T')[0]}`, headerRows, xlsColumns);
        }).catch(err => console.error("Failed to load export utility", err));
    };

    // Handle view shipment detail
    const handleViewShipment = (shipment) => {
        setSelectedShipment(shipment);
        setShowDetailModal(true);
    };

    const handleViewAnalysis = (shipment) => {
        setAnalysisShipment(shipment);
        setShowAnalysisModal(true);
    };

    const handleGeneratePOFromList = async (ship, e) => {
        e.stopPropagation();
        if (!canCreate('blink_purchase_order')) {
            alert('Anda tidak memiliki hak akses untuk membuat PO.');
            return;
        }
        try {
            // Gather buying items from the shipment
            const buyingItems = ship.buyingItems || ship.buying_items || [];
            const cogsData = ship.cogs || {};

            const poItemsRaw = [];

            // Legacy COGS fields
            const addIfPresent = (label, value) => {
                const val = parseFloat(String(value || '').replace(/,/g, ''));
                if (val && val > 0) {
                    poItemsRaw.push({ item_name: label, description: `${label} - ${ship.jobNumber}`, qty: 1, unit: 'Job', unit_price: val, amount: val, coa_id: null });
                }
            };
            addIfPresent('Ocean Freight', cogsData.oceanFreight);
            addIfPresent('Air Freight', cogsData.airFreight);
            addIfPresent('Trucking', cogsData.trucking);
            addIfPresent('THC', cogsData.thc);
            addIfPresent('Documentation', cogsData.documentation);
            addIfPresent('Customs Clearance', cogsData.customs);
            addIfPresent('Insurance', cogsData.insurance);
            addIfPresent('Demurrage', cogsData.demurrage);
            addIfPresent(cogsData.otherDescription || 'Other Charges', cogsData.other);

            // Buying items with COA name lookup
            const coaIds = buyingItems.map(i => i.coa_id).filter(Boolean);
            let coaMap = {};
            if (coaIds.length > 0) {
                const { data: coaData } = await supabase.from('finance_coa').select('id, name').in('id', coaIds);
                (coaData || []).forEach(c => { coaMap[c.id] = c; });
            }
            buyingItems.forEach(item => {
                const val = parseFloat(String(item.amount || 0).replace(/,/g, ''));
                if (val && val > 0) {
                    const coaAccount = coaMap[item.coa_id];
                    const itemName = coaAccount ? coaAccount.name : (item.description || 'Item');
                    poItemsRaw.push({ item_name: itemName, description: item.description || itemName, qty: parseFloat(item.qty) || 1, unit: item.unit || 'Job', unit_price: parseFloat(item.rate) || val, amount: val, coa_id: item.coa_id || null });
                }
            });

            if (poItemsRaw.length === 0) {
                alert('No actual cost items found for this shipment. Please add COGS/Actual Costs first.');
                return;
            }

            // Fetch vendors
            const { data: vendorDataRaw } = await supabase
                .from('blink_business_partners')
                .select('*')
                .order('partner_name');
            const vendorData = (vendorDataRaw || []).filter(p => {
                const val = p.is_vendor;
                return val === true || val === 'true' || val === 1 || val === 't' || val === '1' || val === 'Y' || val === 'y' || String(val).toLowerCase() === 'true';
            });
            console.log('Raw Vendors List:', vendorDataRaw);
            console.log('Filtered Vendors List:', vendorData);

            setListPOShipment({ ...ship, pending_po_items: poItemsRaw });
            setListPOVendors(vendorData || []);
            setListPOSelectedVendor('');
            setShowListPOModal(true);
        } catch (error) {
            console.error('Error preparing PO from list:', error);
            alert('Failed to prepare PO: ' + error.message);
        }
    };

    const handleConfirmListPO = async () => {
        try {
            if (!listPOSelectedVendor) {
                alert('Please select a vendor.');
                return;
            }
            const vendor = listPOVendors.find(v => v.id === listPOSelectedVendor);
            const { generatePONumber } = await import('../../utils/documentNumbers');
            const poNumber = await generatePONumber();
            const items = listPOShipment.pending_po_items;
            const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

            const { error } = await supabase.from('blink_purchase_orders').insert([{
                po_number: poNumber,
                vendor_id: vendor.id,
                vendor_name: vendor.partner_name,
                vendor_email: vendor.email || '',
                vendor_phone: vendor.phone || '',
                vendor_address: vendor.address || '',
                po_date: new Date().toISOString().split('T')[0],
                payment_terms: '30 Days (NET 30)',
                po_items: items,
                currency: listPOShipment.cogsCurrency || listPOShipment.cogs_currency || 'IDR',
                exchange_rate: parseFloat(listPOShipment.exchangeRate || listPOShipment.exchange_rate) || 1,
                subtotal: totalAmount,
                tax_rate: 0,
                tax_amount: 0,
                discount_amount: 0,
                total_amount: totalAmount,
                status: 'draft',
                shipment_id: listPOShipment.id,
                job_number: listPOShipment.soNumber || listPOShipment.jobNumber || listPOShipment.so_number || listPOShipment.job_number,
                notes: `Generated from Shipment: ${listPOShipment.jobNumber}`
            }]);

            if (error) throw error;

            setShowListPOModal(false);
            alert(`✅ Purchase Order ${poNumber} generated successfully!`);
            navigate('/blink/finance/purchase-orders');
        } catch (error) {
            console.error('Error generating PO from list:', error);
            alert('Failed to generate PO: ' + error.message);
        }
    };

    // Handle update shipment
    const handleUpdateShipment = async (updatedShipment, skipDbUpdate = false) => {
        if (!canEdit('blink_shipments')) {
            alert('Anda tidak memiliki hak akses untuk mengedit shipment ini.');
            return;
        }
        try {
            // Only update DB if skipDbUpdate is false
            if (!skipDbUpdate) {
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

                // Map to database format
                // dynamically to prevent wiping unprovided fields
                const dbFormat = {};

                const fieldMappings = {
                    jobNumber: 'job_number',
                    soNumber: 'so_number',
                    customer: 'customer',
                    origin: 'origin',
                    destination: 'destination',
                    serviceType: 'service_type',
                    quotedAmount: 'quoted_amount',
                    cogs: 'cogs',
                    cogsCurrency: 'cogs_currency',
                    exchangeRate: 'exchange_rate',
                    status: 'status',
                    weight: 'weight',
                    cbm: 'cbm',
                    volume: 'cbm', // map volume to cbm if explicitly passed
                    dimensions: 'dimensions',
                    container_type: 'container_type',
                    bl_number: 'bl_number',
                    awb_number: 'awb_number',
                    voyage: 'voyage',
                    flight_number: 'flight_number',
                    shipper_name: 'shipper_name',
                    shipper: 'shipper_name', // fallback
                    deliveryDate: 'delivery_date',
                    eta: 'eta',
                    etd: 'etd',
                    shipping_mode: 'shipping_mode',
                    packages: 'packages',
                    gross_weight: 'gross_weight',
                    net_weight: 'net_weight',
                    mbl: 'mbl',
                    hbl: 'hbl',
                    mawb: 'mawb',
                    hawb: 'hawb',
                    incoterm: 'incoterm',
                    paymentTerms: 'payment_terms',
                    payment_terms: 'payment_terms',
                    measure: 'measure',
                    commodity: 'commodity',
                    notes: 'notes',
                };

                for (const [key, dbKey] of Object.entries(fieldMappings)) {
                    if (updatedShipment[key] !== undefined) {
                        if (updatedShipment[key] === '' && ['deliveryDate', 'eta', 'etd'].includes(key)) {
                            dbFormat[dbKey] = null;
                        } else {
                            if (dbFormat[dbKey] === undefined) {
                                dbFormat[dbKey] = updatedShipment[key];
                            }
                        }
                    }
                }

                // UUID fields - validate before sending
                if (updatedShipment.customerId !== undefined) {
                    dbFormat.customer_id = safeUUID(updatedShipment.customerId);
                }
                if (updatedShipment.quotationId !== undefined) {
                    dbFormat.quotation_id = safeUUID(updatedShipment.quotationId);
                }

                // Only update buying/selling items if they are explicitly passed
                // This prevents overwriting data with empty arrays when saving other fields
                if (updatedShipment.sellingItems !== undefined) {
                    dbFormat.selling_items = updatedShipment.sellingItems;
                }
                if (updatedShipment.buyingItems !== undefined) {
                    dbFormat.buying_items = updatedShipment.buyingItems;
                }

                const { error } = await supabase
                    .from('blink_shipments')
                    .update(dbFormat)
                    .eq('id', updatedShipment.id);

                if (error) throw error;
            }

            // Optimistically update the list without waiting for fetch  
            setShipments(prev => prev.map(s => s.id === updatedShipment.id ? { ...s, ...updatedShipment } : s));

            // Immediate update for modal so user sees changes right away
            setSelectedShipment(prev => ({
                ...(prev || {}),
                ...updatedShipment,
                sellingItems: updatedShipment.sellingItems ?? prev?.sellingItems ?? [],
                buyingItems: updatedShipment.buyingItems ?? prev?.buyingItems ?? []
            }));

            // Refresh from DB then sync selectedShipment with fully-mapped fresh data
            // Use returned mapped array to find the correct record by ID directly
            setTimeout(async () => {
                const freshList = await fetchShipments();
                const freshRecord = freshList.find(s => s.id === updatedShipment.id);
                if (freshRecord) {
                    setSelectedShipment(prev => ({
                        ...freshRecord,
                        // Preserve items arrays in case the fresh DB record has empty arrays
                        sellingItems: (freshRecord.sellingItems?.length > 0)
                            ? freshRecord.sellingItems
                            : (prev?.sellingItems || []),
                        buyingItems: (freshRecord.buyingItems?.length > 0)
                            ? freshRecord.buyingItems
                            : (prev?.buyingItems || [])
                    }));
                }
            }, 800);
        } catch (error) {
            console.error('Error updating shipment:', error);
            alert('Failed to update shipment: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Shipment Management</h1>
                    <p className="text-silver-dark mt-1">Kelola semua pengiriman regular dan non-regular</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant="secondary"
                        icon={Download}
                        onClick={handleExportToExcel}
                        disabled={shipments.length === 0}
                    >
                        Export Excel
                    </Button>
                    <Button size="sm" variant="secondary" icon={Filter} onClick={() => setShowFilters(!showFilters)}>
                        Filters
                    </Button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="glass-card p-4 rounded-lg">
                <div className="flex items-center gap-3">
                    <Search className="w-5 h-5 text-silver-dark" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Job Number, Customer, Origin, Destination, SO Number..."
                        className="flex-1 bg-transparent border-none outline-none text-silver-light placeholder-silver-dark"
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="text-silver-dark hover:text-silver-light">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
                <div className="glass-card p-4 rounded-lg">
                    <h4 className="text-sm font-semibold text-silver-light mb-3">Advanced Filters</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs text-silver-dark mb-1 block">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                            >
                                <option value="all">All Statuses</option>
                                <option value="pending">Pending</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="booked">Booked</option>
                                <option value="in_transit">In Transit</option>
                                <option value="arrived">Arrived</option>
                                <option value="customs_clearance">Customs Clearance</option>
                                <option value="delivered">Delivered</option>
                                <option value="completed">Completed</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-silver-dark mb-1 block">Service Type</label>
                            <select
                                value={serviceFilter}
                                onChange={(e) => setServiceFilter(e.target.value)}
                                className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded text-silver-light text-sm"
                            >
                                <option value="all">All Services</option>
                                <option value="sea">Sea Freight</option>
                                <option value="air">Air Freight</option>
                                <option value="land">Land Transport</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                    setStatusFilter('all');
                                    setServiceFilter('all');
                                    setSearchQuery('');
                                }}
                                className="w-full"
                            >
                                Reset Filters
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                    { value: 'all', label: 'Semua' },
                    { value: 'regular', label: 'Regular' },
                    { value: 'non-regular', label: 'Non-Regular' },
                    { value: 'urgent', label: 'Urgent' }
                ].map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setFilter(tab.value)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap smooth-transition ${filter === tab.value
                            ? 'bg-accent-orange text-white'
                            : 'bg-dark-surface text-silver-dark hover:bg-dark-card'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Total Shipments</p>
                    <p className="text-2xl font-bold text-silver-light mt-1">{shipments.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Regular</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {shipments.filter(s => getShipmentType(s) === 'regular').length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Non-Regular</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                        {shipments.filter(s => getShipmentType(s) === 'non-regular').length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">In Transit</p>
                    <p className="text-2xl font-bold text-purple-400 mt-1">
                        {shipments.filter(s => s.status === 'in_transit').length}
                    </p>
                </div>
            </div>

            {/* Empty State atau Table */}
            {shipments.length === 0 ? (
                <div className="glass-card rounded-lg p-12 text-center">
                    <Ship className="w-16 h-16 text-silver-dark mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-silver-light mb-2">
                        No Shipments Found
                    </h3>
                    <p className="text-silver-dark mb-4">
                        Shipments are automatically created from confirmed Sales Orders
                    </p>
                    <p className="text-sm text-silver-dark">
                        Flow: Quotation → Sales Order → <span className="text-accent-orange font-semibold">Create Shipment</span>
                    </p>
                </div>
            ) : (
                <div className="glass-card rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-accent-orange">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Job Number</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Customer</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Route</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Service</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {filteredShipments.map((ship) => (
                                    <tr
                                        key={ship.id}
                                        onClick={() => handleViewShipment(ship)}
                                        className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                    >
                                        <td className="px-4 py-3 font-medium text-accent-orange">
                                            {ship.jobNumber}
                                        </td>
                                        <td className="px-4 py-3 text-silver-light">{ship.customer}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-sm">
                                                <MapPin className="w-3 h-3" />
                                                <span>{ship.origin} → {ship.destination}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs ${getShipmentType(ship) === 'regular'
                                                ? 'bg-blue-500/20 text-blue-400'
                                                : 'bg-orange-500/20 text-orange-400'
                                                }`}>
                                                {getShipmentType(ship) === 'regular' ? 'Regular' : 'Non-Regular'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-silver-light">
                                            {ship.serviceType}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-3 py-1 rounded-full text-xs ${statusConfig[ship.status]?.color}`}>
                                                {statusConfig[ship.status]?.label}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Shipment Detail Modal */}
            <ShipmentDetailModal
                isOpen={showDetailModal}
                onClose={() => {
                    setShowDetailModal(false);
                    fetchShipments();
                }}
                shipment={selectedShipment}
                onUpdate={handleUpdateShipment}
                onViewAnalysis={handleViewAnalysis}
                canEditShipment={canEdit('blink_shipments')}
                canCreatePO={canCreate('blink_purchase_order')}
            />

            {/* Selling Buying Analysis Modal */}
            <SellingBuyingDetailModal
                isOpen={showAnalysisModal}
                onClose={() => setShowAnalysisModal(false)}
                shipment={analysisShipment}
            />

            {/* Generate PO from List - Vendor Selection Modal */}
            {showListPOModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-dark-card border border-dark-border rounded-xl shadow-2xl w-full max-w-lg">
                        <div className="px-6 py-4 border-b border-dark-border flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="w-5 h-5 text-accent-orange" />
                                <h3 className="text-lg font-bold text-silver-light">Generate Purchase Order</h3>
                            </div>
                            <button onClick={() => setShowListPOModal(false)} className="p-1 hover:bg-white/10 rounded-full text-silver-dark">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {listPOShipment && (
                                <div className="bg-dark-surface rounded-lg px-4 py-3 text-sm">
                                    <p className="text-silver-dark text-xs mb-1">Shipment</p>
                                    <p className="text-accent-orange font-bold">{listPOShipment.jobNumber}</p>
                                    <p className="text-silver-light text-xs mt-1">{listPOShipment.customer} • {listPOShipment.origin} → {listPOShipment.destination}</p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm font-medium text-silver mb-2">Items ({listPOShipment?.pending_po_items?.length || 0})</p>
                                <div className="max-h-40 overflow-y-auto rounded-lg border border-dark-border">
                                    <table className="w-full text-xs">
                                        <thead className="bg-dark-surface">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-silver-dark">Item</th>
                                                <th className="px-3 py-2 text-left text-silver-dark">Description</th>
                                                <th className="px-3 py-2 text-right text-silver-dark">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-dark-border">
                                            {(listPOShipment?.pending_po_items || []).map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-3 py-2 text-blue-300 font-medium">{item.item_name}</td>
                                                    <td className="px-3 py-2 text-silver-light">{item.description}</td>
                                                    <td className="px-3 py-2 text-right text-green-400 font-mono">{item.amount.toLocaleString('id-ID')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-silver mb-2">Select Vendor (Blink Mitra) <span className="text-red-400">*</span></label>
                                {listPOVendors.length === 0 ? (
                                    <p className="text-yellow-400 text-sm">⚠️ No active vendor found in Blink Mitra.</p>
                                ) : (
                                    <select
                                        value={listPOSelectedVendor}
                                        onChange={e => setListPOSelectedVendor(e.target.value)}
                                        className="w-full px-3 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:outline-none focus:border-accent-orange"
                                    >
                                        <option value="">-- Select Vendor --</option>
                                        {listPOVendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.partner_name}{v.partner_code ? ` (${v.partner_code})` : ''}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <Button variant="secondary" onClick={() => setShowListPOModal(false)}>Cancel</Button>
                                <Button onClick={handleConfirmListPO} disabled={!listPOSelectedVendor}>Generate PO</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShipmentManagement;
