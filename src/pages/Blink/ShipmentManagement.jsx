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

            // Map snake_case to camelCase
            const mapped = (data || []).map(s => ({
                ...s,
                jobNumber: s.job_number || s.jobNumber,
                soNumber: s.so_number || s.soNumber,
                quotationId: s.quotation_id || s.quotationId,
                customerId: s.customer_id || s.customerId,
                salesPerson: s.sales_person || s.salesPerson,
                quotationType: s.quotation_type || s.quotationType,
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
                currency: s.currency || 'USD', // Add currency mapping
                // New document fields
                mawb: s.mawb || null,
                hawb: s.hawb || null,
                hbl: s.hbl || null,
                mbl: s.mbl || null,
                consignee_name: s.consignee_name || null,
                shipperName: s.shipper_name || s.shipper || null,
                shipper: s.shipper || s.shipper_name || null,
                // Add items mapping
                sellingItems: s.selling_items || s.sellingItems || [],
                buyingItems: s.buying_items || s.buyingItems || []
            }));

            console.log(`✅ Mapped ${mapped.length} shipments`);
            console.log('Mapped sample:', mapped?.[0]);

            setShipments(mapped);
        } catch (error) {
            console.error('❌ Error fetching shipments:', error);
            setShipments([]);
        } finally {
            setLoading(false);
        }
    };

    const statusConfig = {
        pending: { label: 'Pending', color: 'bg-gray-500/20 text-gray-400' },
        manager_approval: { label: 'Waiting Approval', color: 'bg-yellow-500/20 text-yellow-400' },
        approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400' },
        rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400' },
    };

    // Helper function to get shipment type from quotationType or type field
    const getShipmentType = (shipment) => {
        // If has quotationType (from SO conversion), map it
        if (shipment.quotationType) {
            return shipment.quotationType === 'RG' ? 'regular' : 'non-regular';
        }
        // Otherwise use existing type field (backward compatibility)
        return shipment.type || 'regular';
    };

    // Filter shipments berdasarkan type, status, service, and search
    const filteredShipments = shipments.filter(s => {
        // Type filter
        if (filter !== 'all' && getShipmentType(s) !== filter) return false;

        // Status filter
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;

        // Service filter
        if (serviceFilter !== 'all' && s.serviceType !== serviceFilter) return false;

        // Search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return (
                s.jobNumber?.toLowerCase().includes(query) ||
                s.customer?.toLowerCase().includes(query) ||
                s.origin?.toLowerCase().includes(query) ||
                s.destination?.toLowerCase().includes(query) ||
                s.soNumber?.toLowerCase().includes(query)
            );
        }

        return true;
    });

    // Export to Excel
    const handleExportToExcel = () => {
        // Simplified export - create CSV
        const headers = ['Job Number', 'SO Number', 'Customer', 'Origin', 'Destination', 'Service Type', 'Status', 'Created Date'];
        const rows = filteredShipments.map(s => [
            s.jobNumber,
            s.soNumber || '-',
            s.customer,
            s.origin,
            s.destination,
            s.serviceType,
            s.status,
            s.createdAt || '-'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `shipments_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
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
    const handleUpdateShipment = async (updatedShipment) => {
        if (!canEdit('blink_shipments')) {
            alert('Anda tidak memiliki hak akses untuk mengedit shipment ini.');
            return;
        }
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

            // Map to database format
            // Only include buying/selling items if they are explicitly provided (not undefined)
            const dbFormat = {
                job_number: updatedShipment.jobNumber,
                so_number: updatedShipment.soNumber,
                customer: updatedShipment.customer,
                origin: updatedShipment.origin,
                destination: updatedShipment.destination,
                service_type: updatedShipment.serviceType,
                quoted_amount: updatedShipment.quotedAmount,
                cogs: updatedShipment.cogs,
                cogs_currency: updatedShipment.cogsCurrency,
                exchange_rate: updatedShipment.exchangeRate,
                status: updatedShipment.status,
                // UUID fields - validate before sending
                customer_id: safeUUID(updatedShipment.customerId),
                quotation_id: safeUUID(updatedShipment.quotationId),
                // Shipping details
                weight: updatedShipment.weight || null,
                cbm: updatedShipment.cbm || updatedShipment.volume || null,
                dimensions: updatedShipment.dimensions || null,
                container_type: updatedShipment.container_type || null,
                bl_number: updatedShipment.bl_number || null,
                awb_number: updatedShipment.awb_number || null,
                voyage: updatedShipment.voyage || null,
                flight_number: updatedShipment.flight_number || null,
                shipper_name: updatedShipment.shipper_name || updatedShipment.shipper || null,
                shipper: updatedShipment.shipper_name || updatedShipment.shipper || null,
                // Date fields - convert empty strings to null
                delivery_date: updatedShipment.deliveryDate || null,
                eta: updatedShipment.eta || null,
                etd: updatedShipment.etd || null,
                // New document fields
                mawb: updatedShipment.mawb || null,
                hawb: updatedShipment.hawb || null,
                hbl: updatedShipment.hbl || null,
                mbl: updatedShipment.mbl || null,
                consignee_name: updatedShipment.consignee_name || null,
                bl_date: updatedShipment.blDate || null,
                vessel_name: updatedShipment.vessel_name || null,
                container_number: updatedShipment.container_number || null,
            };

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

            // Refresh list - after refresh, update selectedShipment with fresh DB data
            await fetchShipments();

            // After refresh, get a fresh copy of the shipment from the updated list
            // This ensures buying_items / selling_items are always from the latest DB state
            // We merge with updatedShipment to keep any unsaved in-memory changes
            setSelectedShipment(prev => ({
                ...(prev || {}),
                ...updatedShipment,
                sellingItems: updatedShipment.sellingItems ?? prev?.sellingItems ?? [],
                buyingItems: updatedShipment.buyingItems ?? prev?.buyingItems ?? []
            }));
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
                        Belum Ada Shipment
                    </h3>
                    <p className="text-silver-dark mb-4">
                        Shipment dibuat otomatis dari Sales Order yang sudah confirmed
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
