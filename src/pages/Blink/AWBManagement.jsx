import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import PartnerPicker from '../../components/Common/PartnerPicker';
import {
    Plane,
    Package,
    Trash2,
    Download,
    Printer,
    Search,
    FileText,
    User
} from 'lucide-react';
import { printBLCertificate } from '../../utils/printUtils'; // We can reuse print logic or create printAWBUtils later
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

    useEffect(() => {
        fetchAWBs();
    }, []);

    // Initialize edit form when selectedAWB changes
    useEffect(() => {
        if (selectedAWB) {
            setEditForm({
                status: selectedAWB.status,
                awbNumber: selectedAWB.awbNumber !== '-' ? selectedAWB.awbNumber : '',
                awbDate: selectedAWB.awbIssuedDate || (selectedAWB.createdAt ? new Date(selectedAWB.createdAt).toISOString().split('T')[0] : ''),

                // Parties - Explicit separation
                // Note: Customer is shown as reference, but Shipper/Consignee are editable document fields
                shipperName: selectedAWB.blShipperName || selectedAWB.shipperName,
                shipperAddress: selectedAWB.blShipperAddress || '',
                consigneeName: selectedAWB.blConsigneeName || selectedAWB.consigneeName,
                consigneeAddress: selectedAWB.blConsigneeAddress || '',

                // Routing (Air)
                flightNumber: selectedAWB.vessel, // reusing vessel col for flight
                airportDeparture: selectedAWB.portOfLoading,
                airportDestination: selectedAWB.portOfDischarge,

                // Cargo
                descriptionGoods: selectedAWB.blDescriptionPackages || selectedAWB.cargoDescription,
                grossWeight: selectedAWB.blGrossWeightText || (selectedAWB.grossWeight ? `${selectedAWB.grossWeight} KGS` : ''),
                chargeableWeight: selectedAWB.chargeableWeight || (selectedAWB.grossWeight ? `${selectedAWB.grossWeight} KGS` : ''), // Usually calc based on vol
                pieces: selectedAWB.blTotalPackagesText || selectedAWB.packages || 'AS PER ATTACHED LIST',

                // Footer
                executedAt: selectedAWB.blIssuedPlace || 'JAKARTA, INDONESIA',
                executedDate: selectedAWB.blIssuedDate || new Date().toISOString().split('T')[0],
                agentIataCode: selectedAWB.blForwardingAgentRef || '', // Using this col for IATA code
                accountingInfo: selectedAWB.blExportReferences || '', // Using this col for Accounting Info
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

            // Filter for Air shipments loosely (if service_type exists)
            const airShipments = shipments.filter(s =>
                (s.service_type && s.service_type.toLowerCase().includes('air')) ||
                (s.mbl && s.mbl.startsWith('MAWB')) || // Heuristic
                (s.transport_mode === 'AIR') // If column exists
            );

            // If no strict filter, just use all for now, or maybe the user wants to see all documentable shipments
            // Let's stick to 'blink_shipments' and assume the user manages all here, but we mark them

            const awbData = (shipments || []).map(ship => ({
                id: ship.id,
                type: 'MAWB', // Default
                awbNumber: ship.awb_number || ship.bl_number || '-', // Fallback
                jobNumber: ship.job_number,

                // Base Shipment Data (The "Truth")
                customerName: ship.customer || ship.customer_name || 'N/A', // The payer
                shipperName: ship.shipper || ship.shipper_name || 'N/A',
                consigneeName: ship.consignee_name || 'N/A', // If empty, it's NOT same as customer automatically

                vessel: ship.vessel_name || ship.flight_number || '', // Flight No
                portOfLoading: ship.origin || '',
                portOfDischarge: ship.destination || '',

                cargoDescription: ship.cargo_description || ship.commodity || '',
                grossWeight: ship.weight,
                volume: ship.volume,
                packages: ship.packages || null,

                // Document Specific (Editable Overrides)
                blShipperName: ship.bl_shipper_name,
                blShipperAddress: ship.bl_shipper_address,
                blConsigneeName: ship.bl_consignee_name,
                blConsigneeAddress: ship.bl_consignee_address,

                blDescriptionPackages: ship.bl_description_packages,
                blGrossWeightText: ship.bl_gross_weight_text,
                blTotalPackagesText: ship.bl_total_packages_text,

                blIssuedPlace: ship.bl_issued_place,
                blIssuedDate: ship.bl_issued_date,
                blForwardingAgentRef: ship.bl_forwarding_agent_ref,
                blExportReferences: ship.bl_export_references, // Accounting Info

                createdAt: ship.created_at,
                status: ship.bl_status || 'draft',
            }));

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
            // Mapping back AWB fields to the generic BL columns in DB
            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    bl_status: editForm.status,
                    awb_number: editForm.awbNumber || null,
                    // BL number field is also updated for consistency if needed, or kept separate

                    // Parties
                    bl_shipper_name: editForm.shipperName,
                    bl_shipper_address: editForm.shipperAddress,
                    bl_consignee_name: editForm.consigneeName,
                    bl_consignee_address: editForm.consigneeAddress,

                    // Footer / Info
                    bl_issued_place: editForm.executedAt,
                    bl_issued_date: editForm.executedDate,
                    bl_forwarding_agent_ref: editForm.agentIataCode,
                    bl_export_references: editForm.accountingInfo,

                    // Cargo
                    bl_description_packages: editForm.descriptionGoods,
                    bl_gross_weight_text: editForm.grossWeight,
                    bl_total_packages_text: editForm.pieces,
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
                                    {awb.createdAt ? new Date(awb.createdAt).toLocaleDateString() : '-'}
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
                                </div>
                            )}

                            {activeTab === 'routing' && (
                                <div className="grid grid-cols-3 gap-4">
                                    {renderInput('Airport of Departure', 'airportDeparture')}
                                    {renderInput('Airport of Destination', 'airportDestination')}
                                    {renderInput('Flight / Date', 'flightNumber')}
                                </div>
                            )}

                            {activeTab === 'cargo' && (
                                <div className="grid grid-cols-12 gap-4">
                                    <div className="col-span-3">
                                        {renderInput('No. of Pieces', 'pieces')}
                                        {renderInput('Gross Weight', 'grossWeight')}
                                        {renderInput('Chargeable Weight', 'chargeableWeight')}
                                    </div>
                                    <div className="col-span-9">
                                        {renderInput('Nature and Quantity of Goods', 'descriptionGoods', 'textarea')}
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
