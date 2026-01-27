import React, { useState, useEffect } from 'react';
import Button from '../../components/Common/Button';
import ShipmentDetailModal from '../../components/Blink/ShipmentDetailModalEnhanced';
import SellingBuyingDetailModal from '../../components/Blink/SellingBuyingDetailModal';
import { Ship, Plus, MapPin, Filter, Search, Download, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ShipmentManagement = () => {
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
                shipper: s.shipper || s.shipper_name || null
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
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400' },
        pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400' },
        confirmed: { label: 'Confirmed', color: 'bg-blue-500/20 text-blue-400' },
        in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400' },
        arrived: { label: 'Arrived', color: 'bg-green-500/20 text-green-400' },
        delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-400' },
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

    // Handle update shipment
    const handleUpdateShipment = async (updatedShipment) => {
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

            const { error } = await supabase
                .from('blink_shipments')
                .update(dbFormat)
                .eq('id', updatedShipment.id);

            if (error) throw error;

            // Refresh list
            await fetchShipments();

            // Update selected
            setSelectedShipment(updatedShipment);
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
                shipment={selectedShipment}
                onUpdate={handleUpdateShipment}
                onViewAnalysis={handleViewAnalysis}
            />

            {/* Selling Buying Analysis Modal (Compact & Instant) */}
            <SellingBuyingDetailModal
                isOpen={showAnalysisModal}
                onClose={() => setShowAnalysisModal(false)}
                shipment={analysisShipment}
            />
        </div>
    );
};

export default ShipmentManagement;
