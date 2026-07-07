import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import PartnerPicker from '../../components/Common/PartnerPicker';
import {
    Plane,
    Package,
    Trash2,
    Printer,
    Search,
} from 'lucide-react';
import { printBLCertificate } from '../../utils/printUtils'; // We can reuse print logic or create printAWBUtils later
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';

const AWBManagement = () => {
    const { canEdit } = useAuth();
    const [awbs, setAwbs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedAWB, setSelectedAWB] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('header');
    const [editForm, setEditForm] = useState({});
    const [showShipperPicker, setShowShipperPicker] = useState(false);
    const [showConsigneePicker, setShowConsigneePicker] = useState(false);

    const { companySettings } = useData();

    const numberToWords = (n) => {
        const words = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
        return words[n] || String(n);
    };

    const normalizeContainers = (rawContainers) => {
        if (!rawContainers) return [];

        if (Array.isArray(rawContainers)) return rawContainers;

        if (typeof rawContainers === 'string') {
            try {
                const parsed = JSON.parse(rawContainers);
                if (Array.isArray(parsed)) return parsed;
                if (parsed && typeof parsed === 'object') return [parsed];
            } catch {
                return [];
            }
        }

        if (typeof rawContainers === 'object') return [rawContainers];
        return [];
    };

    const buildPackagesInWordsFromContainers = (containers = []) => {
        const normalizedContainers = normalizeContainers(containers);
        const count = normalizedContainers.reduce((sum, c) => {
            const qty = Number(c?.qty ?? c?.quantity ?? c?.pieces ?? 1);
            return sum + (Number.isFinite(qty) && qty > 0 ? qty : 1);
        }, 0);
        if (count <= 0) return '';
        return `SAY: ${numberToWords(count)} (${count}) CONTAINER${count > 1 ? 'S' : ''} ONLY`;
    };

    const flattenShipmentItems = (items = []) => {
        if (!Array.isArray(items)) return [];
        return items.flatMap((entry) => Array.isArray(entry?.items) ? flattenShipmentItems(entry.items) : [entry]);
    };

    const buildCargoItemsFromShipment = (ship = {}) => {
        const sourceItems = [
            ...flattenShipmentItems(ship.service_items || []),
            ...flattenShipmentItems(ship.selling_items || [])
        ];
        if (sourceItems.length > 0) {
            return sourceItems.map((item, index) => ({
                marks: index === 0 ? (ship.bl_marks_numbers || ship.container_number || 'N/M') : '',
                packages: item.qty || item.quantity || item.pieces || item.unit || '',
                description: item.description || item.name || item.item_name || item.service_name || item.itemCode || item.item_code || '',
                grossWeight: item.grossWeight || item.gross_weight || item.weight || '',
                measurement: item.measurement || item.measure || item.volume || item.cbm || ''
            })).filter(item => item.description || item.packages || item.grossWeight || item.measurement || item.marks);
        }

        return [{
            marks: ship.bl_marks_numbers || ship.container_number || 'N/M',
            packages: ship.bl_number_of_packages || ship.packages || '',
            description: ship.bl_description_packages || ship.cargo_description || ship.commodity || '',
            grossWeight: ship.bl_gross_weight_text || ship.gross_weight || ship.weight || '',
            measurement: ship.bl_measurement_text || ship.volume || ''
        }];
    };

    useEffect(() => {
        fetchAWBs();
    }, []);

    // Initialize edit form when selectedAWB changes
    useEffect(() => {
        if (selectedAWB) {
            const inferredGrossWeight = selectedAWB.grossWeight || selectedAWB.gross_weight || '';
            const inferredChargeableWeight = selectedAWB.chargeableWeight || selectedAWB.chargeable_weight || inferredGrossWeight || '';
            const derivedPieces = buildPackagesInWordsFromContainers(selectedAWB.containers || []);
            const cargoItems = selectedAWB.cargoItems?.length > 0 ? selectedAWB.cargoItems : buildCargoItemsFromShipment(selectedAWB.rawShipment || {});
            setEditForm({
                status: selectedAWB.status,
                awbNumber: selectedAWB.awbNumber !== '-' ? selectedAWB.awbNumber : '',
                awbDate: selectedAWB.awbIssuedDate || (selectedAWB.createdAt ? new Date(selectedAWB.createdAt).toISOString().split('T')[0] : ''),

                // Parties - Explicit separation
                // Note: Customer is shown as reference, but Shipper/Consignee are editable document fields
                shipperName: selectedAWB.blShipperName || selectedAWB.shipperName,
                shipperAddress: selectedAWB.blShipperAddress || selectedAWB.shipperAddress || '',
                consigneeName: selectedAWB.blConsigneeName || selectedAWB.consigneeName,
                consigneeAddress: selectedAWB.blConsigneeAddress || selectedAWB.consigneeAddress || selectedAWB.customerAddress || '',
                notifyPartyName: selectedAWB.blNotifyPartyName || 'SAME AS CONSIGNEE',
                notifyPartyAddress: selectedAWB.blNotifyPartyAddress || '',

                // Routing (Air)
                flightNumber: selectedAWB.flightNumber || selectedAWB.vessel || '',
                airportDeparture: selectedAWB.portOfLoading,
                airportDestination: selectedAWB.portOfDischarge,
                placeOfReceipt: selectedAWB.blPlaceOfReceipt || selectedAWB.portOfLoading || '',
                placeOfDelivery: selectedAWB.blPlaceOfDelivery || selectedAWB.portOfDischarge || '',
                typeOfMove: selectedAWB.blTypeOfMove || 'AIR/AIR',
                freightPayableAt: selectedAWB.blFreightPayableAt || 'DESTINATION',
                numberOfOriginals: selectedAWB.blNumberOfOriginals || 'THREE (3)',

                // Cargo
                descriptionGoods: selectedAWB.blDescriptionPackages || selectedAWB.cargoDescription,
                grossWeight: selectedAWB.blGrossWeightText || (inferredGrossWeight ? `${inferredGrossWeight} KGS` : ''),
                chargeableWeight: selectedAWB.blChargeableWeightText || (inferredChargeableWeight ? `${inferredChargeableWeight} KGS` : ''),
                measurement: selectedAWB.blMeasurementText || (selectedAWB.volume ? `${selectedAWB.volume} CBM` : ''),
                pieces: selectedAWB.blTotalPackagesText || derivedPieces || selectedAWB.blNumberOfPackages || selectedAWB.packages || 'AS PER ATTACHED LIST',
                cargoItems,

                // Footer
                executedAt: selectedAWB.blIssuedPlace || 'JAKARTA, INDONESIA',
                executedDate: selectedAWB.blIssuedDate || new Date().toISOString().split('T')[0],
                agentIataCode: selectedAWB.blForwardingAgentRef || '', // Using this col for IATA code
                accountingInfo: selectedAWB.blExportReferences || '', // Using this col for Accounting Info
                freightCharges: selectedAWB.blFreightCharges || '',
                prepaid: selectedAWB.blPrepaid || '',
                collect: selectedAWB.blCollect || '',
                shippedOnBoardDate: selectedAWB.blShippedOnBoardDate || '',
                releaseType: selectedAWB.releaseType || '',
            });
            setIsEditing(false);
            setActiveTab('header');
        }
    }, [selectedAWB]);

    const fetchAWBs = async () => {
        try {
            setLoading(true);
            // Fetch only Air shipments or all shipments
            // Assuming 'Air' service type, or just filtering client side for robustness
            const { data: shipments, error } = await supabase
                .from('blink_shipments')
                .select('*')
                // .eq('service_type', 'Air') // Uncomment if strict filtering needed
                .order('created_at', { ascending: false });

            if (error) throw error;

            const awbData = (shipments || []).map(ship => {
                const containers = normalizeContainers(ship.containers);
                const derivedPieces = buildPackagesInWordsFromContainers(containers);
                const cargoItems = buildCargoItemsFromShipment(ship);
                return {
                id: ship.id,
                rawShipment: ship,
                type: 'MAWB', // Default
                awbNumber: ship.awb_number || ship.bl_number || '-', // Fallback
                jobNumber: ship.job_number,

                // Base Shipment Data (The "Truth")
                customerName: ship.customer || ship.customer_name || 'N/A', // The payer
                customerAddress: ship.customer_address || '',
                shipperName: ship.shipper || ship.shipper_name || 'N/A',
                shipperAddress: ship.shipper_address || '',
                consigneeName: ship.consignee_name || 'N/A', // If empty, it's NOT same as customer automatically
                consigneeAddress: ship.consignee_address || '',

                vessel: ship.vessel_name || ship.flight_number || '', // Flight No
                flightNumber: ship.flight_number || ship.vessel_name || '',
                portOfLoading: ship.origin || '',
                portOfDischarge: ship.destination || '',

                cargoDescription: ship.cargo_description || ship.commodity || '',
                grossWeight: ship.weight,
                gross_weight: ship.gross_weight,
                chargeableWeight: ship.chargeable_weight,
                chargeable_weight: ship.chargeable_weight,
                volume: ship.volume,
                packages: ship.packages || null,
                containers,
                serviceItems: ship.service_items || [],
                sellingItems: ship.selling_items || [],
                cargoItems,

                // Document Specific (Editable Overrides)
                blShipperName: ship.bl_shipper_name,
                blShipperAddress: ship.bl_shipper_address,
                blConsigneeName: ship.bl_consignee_name,
                blConsigneeAddress: ship.bl_consignee_address,
                blNotifyPartyName: ship.bl_notify_party_name,
                blNotifyPartyAddress: ship.bl_notify_party_address,

                blDescriptionPackages: ship.bl_description_packages,
                blGrossWeightText: ship.bl_gross_weight_text,
                blChargeableWeightText: ship.bl_chargeable_weight_text,
                blMeasurementText: ship.bl_measurement_text,
                blNumberOfPackages: ship.bl_number_of_packages,
                blTotalPackagesText: ship.bl_total_packages_in_words || derivedPieces,
                blPlaceOfReceipt: ship.bl_place_of_receipt,
                blPlaceOfDelivery: ship.bl_place_of_delivery,
                blFreightPayableAt: ship.bl_freight_payable_at,
                blNumberOfOriginals: ship.bl_number_of_originals,
                blTypeOfMove: ship.bl_type_of_move,
                blFreightCharges: ship.bl_freight_charges,
                blPrepaid: ship.bl_prepaid,
                blCollect: ship.bl_collect,
                blShippedOnBoardDate: ship.bl_shipped_on_board_date,

                awbIssuedDate: ship.awb_date || ship.bl_issued_date,

                blIssuedPlace: ship.bl_issued_place,
                blIssuedDate: ship.bl_issued_date,
                blForwardingAgentRef: ship.bl_forwarding_agent_ref,
                blExportReferences: ship.bl_export_references, // Accounting Info

                createdAt: ship.created_at,
                status: ship.bl_status || 'draft',
            };
            });

            setAwbs(awbData);
            setError(null);
        } catch (error) {
            console.error('❌ Error fetching AWBs:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAWB = async () => {
        if (!canEdit('blink_awb')) {
            alert('Anda tidak memiliki hak akses untuk memanipulasi (Edit) AWB.');
            return;
        }
        try {
            const cargoItems = editForm.cargoItems || [];
            const descriptionGoods = cargoItems.length > 0
                ? cargoItems.map(item => item.description).filter(Boolean).join('\n')
                : editForm.descriptionGoods;
            const marksNumbers = cargoItems.length > 0
                ? cargoItems.map(item => item.marks).filter(Boolean).join('\n')
                : null;
            // Mapping back AWB fields to the generic BL columns in DB
            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    bl_status: editForm.status,
                    awb_number: editForm.awbNumber || null,
                    awb_date: editForm.awbDate || null,
                    flight_number: editForm.flightNumber || null,
                    origin: editForm.airportDeparture || null,
                    destination: editForm.airportDestination || null,
                    // BL number field is also updated for consistency if needed, or kept separate

                    // Parties
                    bl_shipper_name: editForm.shipperName,
                    bl_shipper_address: editForm.shipperAddress,
                    bl_consignee_name: editForm.consigneeName,
                    bl_consignee_address: editForm.consigneeAddress,
                    bl_notify_party_name: editForm.notifyPartyName,
                    bl_notify_party_address: editForm.notifyPartyAddress,

                    // Footer / Info
                    bl_issued_place: editForm.executedAt,
                    bl_issued_date: editForm.executedDate,
                    bl_forwarding_agent_ref: editForm.agentIataCode,
                    bl_export_references: editForm.accountingInfo,
                    bl_freight_payable_at: editForm.freightPayableAt,
                    bl_number_of_originals: editForm.numberOfOriginals,
                    bl_type_of_move: editForm.typeOfMove,
                    bl_freight_charges: editForm.freightCharges,
                    bl_prepaid: editForm.prepaid,
                    bl_collect: editForm.collect,
                    bl_shipped_on_board_date: editForm.shippedOnBoardDate,
                    bl_place_of_receipt: editForm.placeOfReceipt,
                    bl_place_of_delivery: editForm.placeOfDelivery,

                    // Cargo
                    bl_marks_numbers: marksNumbers,
                    bl_description_packages: descriptionGoods,
                    bl_gross_weight_text: editForm.grossWeight,
                    bl_chargeable_weight_text: editForm.chargeableWeight,
                    bl_measurement_text: editForm.measurement,
                    bl_number_of_packages: editForm.pieces || null,
                    bl_total_packages_in_words: editForm.pieces,
                })
                .eq('id', selectedAWB.id);

            if (error) throw error;

            alert('✅ AWB Document updated successfully');
            setIsEditing(false);
            fetchAWBs();
            setShowEditModal(false);
        } catch (error) {
            console.error('Error updating AWB:', error);
            alert('❌ Failed to update AWB');
        }
    };

    // Load partner data into Shipper fields
    const handleLoadShipper = (partner) => {
        if (partner) {
            setEditForm(prev => ({
                ...prev,
                shipperName: partner.partner_name,
                shipperAddress: `${partner.address_line1 || ''}\n${partner.address_line2 || ''}\n${partner.city || ''}, ${partner.country || ''}\nTel: ${partner.phone || ''}`
                    .replace(/\n+/g, '\n').trim()
            }));
            setShowShipperPicker(false);
        }
    };

    // Load partner data into Consignee fields
    const handleLoadConsignee = (partner) => {
        if (partner) {
            setEditForm(prev => ({
                ...prev,
                consigneeName: partner.partner_name,
                consigneeAddress: `${partner.address_line1 || ''}\n${partner.address_line2 || ''}\n${partner.city || ''}, ${partner.country || ''}\nTel: ${partner.phone || ''}`
                    .replace(/\n+/g, '\n').trim()
            }));
            setShowConsigneePicker(false);
        }
    };

    const handlePrintPreview = () => {
        if (!selectedAWB) return;
        const printData = {
            ...selectedAWB,
            blType: 'AWB',
            type: 'AWB',
            blNumber: editForm.awbNumber || selectedAWB.awbNumber,
            blShipperName: editForm.shipperName,
            blShipperAddress: editForm.shipperAddress,
            blConsigneeName: editForm.consigneeName,
            blConsigneeAddress: editForm.consigneeAddress,
            blNotifyPartyName: editForm.notifyPartyName,
            blNotifyPartyAddress: editForm.notifyPartyAddress,
            blPlaceOfReceipt: editForm.placeOfReceipt,
            blPlaceOfDelivery: editForm.placeOfDelivery,
            blTypeOfMove: editForm.typeOfMove,
            blFreightPayableAt: editForm.freightPayableAt,
            blNumberOfOriginals: editForm.numberOfOriginals,
            blIssuedPlace: editForm.executedAt,
            blIssuedDate: editForm.executedDate,
            blForwardingAgentRef: editForm.agentIataCode,
            blExportReferences: editForm.accountingInfo,
            blFreightCharges: editForm.freightCharges,
            blPrepaid: editForm.prepaid,
            blCollect: editForm.collect,
            blShippedOnBoardDate: editForm.shippedOnBoardDate,
            blDescriptionPackages: editForm.descriptionGoods,
            blGrossWeightText: editForm.grossWeight,
            blChargeableWeightText: editForm.chargeableWeight,
            blMeasurementText: editForm.measurement,
            blNumberOfPackages: editForm.pieces,
            blTotalPackagesInWords: editForm.pieces,
            cargoItems: editForm.cargoItems || [],
            portOfLoading: editForm.airportDeparture,
            portOfDischarge: editForm.airportDestination,
            vessel: editForm.flightNumber,
            flightNumber: editForm.flightNumber,
            logo_url: companySettings?.logo_url || '',
            releaseType: editForm.releaseType || null,
        };
        printBLCertificate(printData);
    };

    const updateCargoItem = (index, key, value) => {
        setEditForm(prev => {
            const cargoItems = [...(prev.cargoItems || [])];
            cargoItems[index] = { ...cargoItems[index], [key]: value };
            return { ...prev, cargoItems };
        });
    };

    const addCargoItem = () => {
        setEditForm(prev => ({
            ...prev,
            cargoItems: [
                ...(prev.cargoItems || []),
                { marks: '', packages: '', description: '', grossWeight: '', measurement: '' }
            ]
        }));
    };

    const removeCargoItem = (index) => {
        setEditForm(prev => ({
            ...prev,
            cargoItems: (prev.cargoItems || []).filter((_, itemIndex) => itemIndex !== index)
        }));
    };


    const renderInput = (label, key, type = 'text', placeholder = '') => (
        <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-silver-dark font-semibold uppercase mb-1">{label}</label>
            {isEditing ? (
                type === 'textarea' ? (
                    <textarea
                        value={editForm[key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange h-24 font-mono"
                        placeholder={placeholder}
                    />
                ) : (
                    <input
                        type={type}
                        value={editForm[key] || ''}
                        onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                        className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                        placeholder={placeholder}
                    />
                )
            ) : (
                <div className={`text-sm text-gray-900 dark:text-silver-light font-medium p-2 bg-gray-50 dark:bg-dark-bg/50 rounded border border-transparent ${type === 'textarea' ? 'whitespace-pre-wrap font-mono text-xs' : ''}`}>
                    {editForm[key] || '-'}
                </div>
            )}
        </div>
    );

    const renderSelect = (label, key, options = []) => (
        <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-silver-dark font-semibold uppercase mb-1">{label}</label>
            {isEditing ? (
                <select
                    value={editForm[key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                >
                    {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
            ) : (
                <div className="text-sm text-gray-900 dark:text-silver-light font-medium p-2 bg-gray-50 dark:bg-dark-bg/50 rounded border border-transparent">
                    {editForm[key] || '-'}
                </div>
            )}
        </div>
    );

    // Filter AWBs
    const filteredAwbs = awbs.filter(awb => {
        if (!searchTerm) return true;
        return awb.awbNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            awb.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            awb.consigneeName?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (loading) return <div className="p-12 text-center text-silver-dark">Loading AWB data...</div>;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">AWB Management</h1>
                    <p className="text-silver-dark mt-1">Air Waybill Documentation</p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    placeholder="Search AWB, Job No, or Consignee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                />
            </div>

            {/* AWB List */}
            <div className="glass-card rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-accent-orange">
                        <tr>
                            <th className="px-4 py-2 text-left text-xs text-white font-bold">AWB Number</th>
                            <th className="px-4 py-2 text-left text-xs text-white font-bold">Date</th>
                            <th className="px-4 py-2 text-left text-xs text-white font-bold">Job No</th>
                            <th className="px-4 py-2 text-left text-xs text-white font-bold">Shipper (Doc)</th>
                            <th className="px-4 py-2 text-left text-xs text-white font-bold">Consignee (Doc)</th>
                            <th className="px-4 py-2 text-center text-xs text-white font-bold">Pieces</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-border">
                        {filteredAwbs.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-silver-dark">No AWBs found</td></tr>
                        ) : filteredAwbs.map(awb => (
                            <tr
                                key={awb.id}
                                onClick={() => { setSelectedAWB(awb); setShowEditModal(true); }}
                                className="hover:bg-dark-surface/50 cursor-pointer transition-colors"
                            >
                                <td className="px-4 py-3 text-sm font-semibold text-accent-orange">{awb.awbNumber}</td>
                                <td className="px-4 py-3 text-xs text-silver-light">
                                    {awb.awbIssuedDate
                                        ? new Date(awb.awbIssuedDate).toLocaleDateString()
                                        : (awb.createdAt ? new Date(awb.createdAt).toLocaleDateString() : '-')}
                                </td>
                                <td className="px-4 py-3 text-xs font-mono text-silver-dark">{awb.jobNumber}</td>
                                <td className="px-4 py-3 text-xs text-silver-light">{awb.blShipperName || awb.shipperName}</td>
                                <td className="px-4 py-3 text-xs text-silver-light">{awb.blConsigneeName || awb.consigneeName}</td>
                                <td className="px-4 py-3 text-xs text-center text-silver-dark">{awb.blTotalPackagesText || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {showEditModal && selectedAWB && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-card rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-silver-light flex items-center gap-2">
                                    <Plane className="w-5 h-5 text-accent-orange" />
                                    AWB Editor
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-silver-dark mt-1 font-mono">
                                    JOB: {selectedAWB.jobNumber} | Customer (Bill To): {selectedAWB.customerName}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="secondary" onClick={handlePrintPreview}>
                                    <Printer className="w-4 h-4 mr-1" />
                                    Print Preview
                                </Button>
                                {isEditing ? (
                                    <>
                                        <Button size="sm" onClick={handleUpdateAWB}>Save Changes</Button>
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Button>
                                    </>
                                ) : (
                                    canEdit('blink_awb') && (
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit Document</Button>
                                    )
                                )}
                                <button onClick={() => setShowEditModal(false)} className="mx-2 text-gray-400 hover:text-white">✕</button>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-gray-100/50 dark:bg-dark-bg/50 border-b border-gray-200 dark:border-dark-border shrink-0 px-2 pt-2">
                            {['header', 'parties', 'routing', 'cargo'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setActiveTab(t)}
                                    className={`px-4 py-2.5 text-sm font-medium uppercase rounded-t-lg mx-1 ${activeTab === t ? 'bg-white dark:bg-dark-card text-accent-orange border-t-2 border-accent-orange' : 'text-gray-500 hover:text-gray-800'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-card text-left">
                            {activeTab === 'header' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {renderInput('AWB Number', 'awbNumber')}
                                    {renderInput('Executed On (Date)', 'executedDate', 'date')}
                                    {renderInput('Executed At (Place)', 'executedAt')}
                                    {renderInput('Agent IATA Code', 'agentIataCode')}
                                    {renderInput('Freight Payable At', 'freightPayableAt')}
                                    {renderInput('No. of Original AWB', 'numberOfOriginals')}
                                    {renderInput('Freight Charges', 'freightCharges')}
                                    {renderInput('Prepaid', 'prepaid')}
                                    {renderInput('Collect', 'collect')}
                                    {renderInput('Shipped On Board Date', 'shippedOnBoardDate', 'date')}
                                    {renderSelect('Release Stamp', 'releaseType', [
                                        { value: '', label: 'None' },
                                        { value: 'TELEX RELEASE', label: 'TELEX RELEASE' },
                                        { value: 'SURRENDER', label: 'SURRENDER' }
                                    ])}
                                    {renderInput('Accounting Information', 'accountingInfo', 'textarea')}
                                </div>
                            )}

                            {activeTab === 'parties' && (
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="border-r border-dashed pr-4 border-gray-700">
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-blue-400 font-bold uppercase text-xs">Shipper</h3>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowShipperPicker(!showShipperPicker)}
                                                    className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                                >
                                                    📋 Load
                                                </button>
                                            )}
                                        </div>
                                        {isEditing && showShipperPicker && (
                                            <div className="mb-3">
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadShipper}
                                                    roleFilter="all"
                                                    placeholder="Select shipper..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        {renderInput('Shipper Name', 'shipperName')}
                                        {renderInput('Shipper Address', 'shipperAddress', 'textarea')}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-green-400 font-bold uppercase text-xs">Consignee</h3>
                                                <p className="text-[10px] text-gray-500 mt-0.5">Note: Often different from "Customer"</p>
                                            </div>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConsigneePicker(!showConsigneePicker)}
                                                    className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                                                >
                                                    📋 Load
                                                </button>
                                            )}
                                        </div>
                                        {isEditing && showConsigneePicker && (
                                            <div className="mb-3">
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadConsignee}
                                                    roleFilter="all"
                                                    placeholder="Select consignee..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        {renderInput('Consignee Name', 'consigneeName')}
                                        {renderInput('Consignee Address', 'consigneeAddress', 'textarea')}
                                    </div>
                                    <div className="col-span-2 border-t border-dashed border-gray-300 dark:border-gray-700 pt-4">
                                        <h3 className="text-amber-500 font-bold uppercase text-xs mb-3">Notify Party</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {renderInput('Notify Party Name', 'notifyPartyName')}
                                            {renderInput('Notify Party Address', 'notifyPartyAddress', 'textarea')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'routing' && (
                                <div className="grid grid-cols-3 gap-4">
                                    {renderInput('Place of Receipt', 'placeOfReceipt')}
                                    {renderInput('Airport of Departure', 'airportDeparture')}
                                    {renderInput('Airport of Destination', 'airportDestination')}
                                    {renderInput('Place of Delivery', 'placeOfDelivery')}
                                    {renderInput('Flight / Date', 'flightNumber')}
                                    {renderInput('Type of Move', 'typeOfMove')}
                                </div>
                            )}

                            {activeTab === 'cargo' && (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-4 gap-4">
                                        {renderInput('No. of Pieces', 'pieces')}
                                        {renderInput('Gross Weight', 'grossWeight')}
                                        {renderInput('Chargeable Weight', 'chargeableWeight')}
                                        {renderInput('Measurement', 'measurement')}
                                    </div>
                                    <div>
                                        {renderInput('Nature and Quantity of Goods', 'descriptionGoods', 'textarea')}
                                    </div>
                                    <div className="border border-gray-200 dark:border-dark-border rounded-lg overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border">
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-900 dark:text-silver-light flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-accent-orange" />
                                                    Document Cargo Items
                                                </h3>
                                                <p className="text-xs text-gray-500 dark:text-silver-dark mt-1">Rows are populated from Sales Order item details.</p>
                                            </div>
                                            {isEditing && (
                                                <Button size="sm" variant="secondary" onClick={addCargoItem}>Add Row</Button>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[900px]">
                                                <thead className="bg-gray-100 dark:bg-dark-bg/70">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-silver-dark uppercase w-[18%]">Marks & Numbers</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-silver-dark uppercase w-[14%]">No. of Packages</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-silver-dark uppercase">Description of Goods</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-silver-dark uppercase w-[14%]">Gross Weight</th>
                                                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 dark:text-silver-dark uppercase w-[14%]">Measurement</th>
                                                        {isEditing && <th className="px-3 py-2 w-12"></th>}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200 dark:divide-dark-border">
                                                    {(editForm.cargoItems || []).length === 0 ? (
                                                        <tr>
                                                            <td colSpan={isEditing ? 6 : 5} className="px-3 py-6 text-center text-sm text-gray-500 dark:text-silver-dark">
                                                                No cargo rows available.
                                                            </td>
                                                        </tr>
                                                    ) : (editForm.cargoItems || []).map((item, index) => (
                                                        <tr key={index} className="align-top">
                                                            {['marks', 'packages', 'description', 'grossWeight', 'measurement'].map((key) => (
                                                                <td key={key} className="px-3 py-2 text-sm text-gray-900 dark:text-silver-light">
                                                                    {isEditing ? (
                                                                        key === 'description' ? (
                                                                            <textarea
                                                                                value={item[key] || ''}
                                                                                onChange={(e) => updateCargoItem(index, key, e.target.value)}
                                                                                className="w-full min-h-[70px] px-2 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-xs font-mono"
                                                                            />
                                                                        ) : (
                                                                            <input
                                                                                value={item[key] || ''}
                                                                                onChange={(e) => updateCargoItem(index, key, e.target.value)}
                                                                                className="w-full px-2 py-1 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-xs"
                                                                            />
                                                                        )
                                                                    ) : (
                                                                        <span className={key === 'description' ? 'whitespace-pre-wrap font-mono text-xs' : ''}>{item[key] || '-'}</span>
                                                                    )}
                                                                </td>
                                                            ))}
                                                            {isEditing && (
                                                                <td className="px-3 py-2 text-center">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeCargoItem(index)}
                                                                        className="p-1.5 rounded text-red-500 hover:bg-red-500/10"
                                                                        title="Remove row"
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
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AWBManagement;
