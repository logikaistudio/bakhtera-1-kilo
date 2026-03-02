import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/Common/Button';
import PartnerPicker from '../../components/Common/PartnerPicker';
import {
    Ship,
    Container,
    Trash2,
    Download,
    Printer,
    Search,
    User
} from 'lucide-react';
import { exportBLCertificateToExcel, exportSellingBuyingReport } from '../../utils/excelExport';
import { printBLCertificate } from '../../utils/printUtils';


const BLManagement = () => {
    const [bls, setBls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedBL, setSelectedBL] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Edit Form State
    const [isEditing, setIsEditing] = useState(false);
    const [activeTab, setActiveTab] = useState('header');
    const [editForm, setEditForm] = useState({});
    const [showShipperPicker, setShowShipperPicker] = useState(false);
    const [showConsigneePicker, setShowConsigneePicker] = useState(false);
    const [showNotifyPartyPicker, setShowNotifyPartyPicker] = useState(false);

    // NEW: Quotation auto-populate support
    const [quotations, setQuotations] = useState([]);
    const [selectedQuotationId, setSelectedQuotationId] = useState(null);

    useEffect(() => {
        fetchBLs();
        fetchQuotations(); // NEW: Fetch quotations for auto-populate
    }, []);

    // Initialize edit form when selectedBL changes
    useEffect(() => {
        if (selectedBL) {
            setEditForm({
                status: selectedBL.status,
                blNumber: selectedBL.blNumber !== '-' ? selectedBL.blNumber : '',
                blDate: selectedBL.blIssuedDate || (selectedBL.createdAt ? new Date(selectedBL.createdAt).toISOString().split('T')[0] : ''),

                // NEW: Subject field
                subject: selectedBL.blSubject || '',

                // Parties
                shipperName: selectedBL.blShipperName || selectedBL.shipperName,
                shipperAddress: selectedBL.blShipperAddress || '',
                consigneeName: selectedBL.blConsigneeName || selectedBL.consigneeName,
                consigneeAddress: selectedBL.blConsigneeAddress || '',
                notifyPartyName: selectedBL.blNotifyPartyName || 'SAME AS CONSIGNEE',
                notifyPartyAddress: selectedBL.blNotifyPartyAddress || '',

                // Routing
                vessel: selectedBL.vessel,
                voyage: selectedBL.voyage,
                placeOfReceipt: selectedBL.blPlaceOfReceipt || selectedBL.portOfLoading,
                portOfLoading: selectedBL.portOfLoading,
                portOfDischarge: selectedBL.portOfDischarge,
                placeOfDelivery: selectedBL.blPlaceOfDelivery || selectedBL.portOfDischarge,
                preCarriageBy: selectedBL.blPreCarriageBy || '',
                loadingPier: selectedBL.blLoadingPier || '',

                // Cargo
                containerNumber: selectedBL.containerNumber,
                sealNumber: selectedBL.sealNumber,
                marksNumbers: selectedBL.blMarksNumbers || selectedBL.containerNumber || 'N/A',
                descriptionPackages: selectedBL.blDescriptionPackages || selectedBL.cargoDescription,
                grossWeight: selectedBL.blGrossWeightText || (selectedBL.grossWeight ? `${selectedBL.grossWeight} KGS` : ''),
                measurement: selectedBL.blMeasurementText || (selectedBL.measurement ? `${selectedBL.measurement} CBM` : ''),
                totalPackages: selectedBL.blTotalPackagesText || 'SAY: ONE CONTAINER ONLY',

                // Footer
                freightPayableAt: selectedBL.blFreightPayableAt || 'DESTINATION',
                numberOfOriginals: selectedBL.blNumberOfOriginals || 'THREE (3)',
                issuedPlace: selectedBL.blIssuedPlace || 'JAKARTA, INDONESIA',
                issuedDate: selectedBL.blIssuedDate || new Date().toISOString().split('T')[0],
                exportReferences: selectedBL.blExportReferences || '',
                forwardingAgentRef: selectedBL.blForwardingAgentRef || '',
            });
            setIsEditing(false);
            setActiveTab('header');

            // NEW: Set selected quotation ID if available
            if (selectedBL.quotationId) {
                setSelectedQuotationId(selectedBL.quotationId);
            }
        }
    }, [selectedBL]);

    const fetchBLs = async () => {
        try {
            setLoading(true);
            const { data: shipments, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const blData = (shipments || []).map(ship => ({
                id: ship.id,
                blType: ship.bl_type || 'MBL',
                blNumber: ship.bl_number || ship.awb_number || '-',
                hasBL: !!ship.bl_number,
                jobNumber: ship.job_number,

                // Base Data
                shipperName: ship.shipper_name || ship.shipper || 'N/A',
                consigneeName: ship.consignee_name || ship.customer_name || ship.customer || 'N/A',
                vessel: ship.vessel_name || ship.booking?.vesselName || '',
                voyage: ship.voyage || ship.booking?.voyageNumber || '',
                portOfLoading: ship.origin || ship.booking?.portOfLoading || '',
                portOfDischarge: ship.destination || ship.booking?.portOfDischarge || '',
                containerNumber: ship.container_number || (ship.containers?.[0]?.containerNumber) || '',
                sealNumber: ship.seal_number || (ship.containers?.[0]?.sealNumber) || '',
                cargoDescription: ship.cargo_description || ship.commodity || '',
                grossWeight: ship.weight,
                measurement: ship.volume,

                // NEW: Subject and Quotation Reference
                blSubject: ship.bl_subject,
                quotationId: ship.quotation_id,

                // New BL Specific Columns
                blShipperName: ship.bl_shipper_name,
                blShipperAddress: ship.bl_shipper_address,
                blConsigneeName: ship.bl_consignee_name,
                blConsigneeAddress: ship.bl_consignee_address,
                blNotifyPartyName: ship.bl_notify_party_name,
                blNotifyPartyAddress: ship.bl_notify_party_address,

                blExportReferences: ship.bl_export_references,
                blForwardingAgentRef: ship.bl_forwarding_agent_ref,
                blPlaceOfReceipt: ship.bl_place_of_receipt,
                blPreCarriageBy: ship.bl_pre_carriage_by,
                blPlaceOfDelivery: ship.bl_place_of_delivery,
                blLoadingPier: ship.bl_loading_pier,

                blMarksNumbers: ship.bl_marks_numbers,
                blDescriptionPackages: ship.bl_description_packages,
                blGrossWeightText: ship.bl_gross_weight_text,
                blMeasurementText: ship.bl_measurement_text,
                blTotalPackagesText: ship.bl_total_packages_text,

                blFreightPayableAt: ship.bl_freight_payable_at,
                blNumberOfOriginals: ship.bl_number_of_originals,
                blIssuedPlace: ship.bl_issued_place,
                blIssuedDate: ship.bl_issued_date,

                // Other
                mbl: ship.mbl || '',
                hbl: ship.hbl || '',
                mawb: ship.mawb || '',
                hawb: ship.hawb || '',
                soNumber: ship.so_number || '',
                createdAt: ship.created_at,
                serviceItems: ship.service_items || [],
                currency: ship.currency || 'USD',
                status: ship.bl_status || 'draft',

                // Financials
                sellingTotal: ship.quoted_amount || 0,
                buyingTotal: ship.actual_cost || 0,
                profit: (ship.quoted_amount || 0) - (ship.actual_cost || 0),
                margin: ship.quoted_amount > 0
                    ? (((ship.quoted_amount - (ship.actual_cost || 0)) / ship.quoted_amount) * 100).toFixed(1)
                    : 0
            }));

            setBls(blData);
            setError(null);
        } catch (error) {
            console.error('❌ Error fetching BLs:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    // NEW: Fetch quotations for auto-populate
    const fetchQuotations = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_quotations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setQuotations(data || []);
        } catch (error) {
            console.error('❌ Error fetching quotations:', error);
        }
    };

    const blTypeConfig = {
        'MBL': { color: 'bg-blue-500/20 text-blue-400', icon: Ship },
        'HBL': { color: 'bg-orange-500/20 text-orange-400', icon: Container },
    };

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400' },
        issued: { label: 'Issued', color: 'bg-blue-500/20 text-blue-400' },
        in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400' },
        arrived: { label: 'Arrived', color: 'bg-green-500/20 text-green-400' },
        delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-400' },
    };

    const filteredBLs = bls.filter(bl => {
        if (!searchTerm) return true;
        return bl.blNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bl.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bl.consigneeName?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleDeleteBL = async (blId) => {
        if (!confirm('Are you sure you want to delete BL ini? Data BL akan dihapus dari shipment.')) return;
        try {
            const { error } = await supabase.from('blink_shipments')
                .update({ bl_number: null, bl_type: null, bl_status: null }).eq('id', blId);
            if (error) throw error;
            alert('✅ BL berhasil dihapus');
            fetchBLs();
        } catch (error) {
            console.error('Error deleting BL:', error);
            alert('❌ Failed to delete BL');
        }
    };

    const handleExportCertificate = (bl) => {
        try {
            const filename = exportBLCertificateToExcel(bl);
            alert(`Certificate exported: ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export certificate');
        }
    };

    const handleExportAllReport = () => {
        try {
            const filename = exportSellingBuyingReport(bls, 'BL');
            alert(`Report exported: ${filename}`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Failed to export report');
        }
    };

    const handlePrintBL = (bl) => {
        try {
            // Merge form data for preview if editing
            const printData = isEditing ? { ...bl, ...editForm } : bl;
            printBLCertificate(printData);
        } catch (error) {
            console.error('Print error:', error);
            alert('Failed to print BL');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-orange"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="glass-card p-8 rounded-lg text-center">
                    <div className="text-red-400 text-2xl mb-4">⚠️</div>
                    <h3 className="text-xl font-semibold text-silver-light mb-2">Error Loading BL Data</h3>
                    <p className="text-silver-dark mb-4">{error}</p>
                    <Button onClick={fetchBLs}>Retry</Button>
                </div>
            </div>
        );
    }

    const handleUpdateBL = async () => {
        try {
            // Find the selected quotation to save its reference data
            const selectedQuotation = selectedQuotationId
                ? quotations.find(q => q.id === selectedQuotationId)
                : null;

            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    bl_status: editForm.status,
                    bl_number: editForm.blNumber || null,

                    // NEW: Subject and Quotation Reference
                    bl_subject: editForm.subject || null,
                    quotation_id: selectedQuotationId || null,
                    quotation_shipper_name: selectedQuotation?.shipper_name || null,
                    quotation_consignee_name: selectedQuotation?.consignee_name || null,

                    // Parties
                    bl_shipper_name: editForm.shipperName,
                    bl_shipper_address: editForm.shipperAddress,
                    bl_consignee_name: editForm.consigneeName,
                    bl_consignee_address: editForm.consigneeAddress,
                    bl_notify_party_name: editForm.notifyPartyName,
                    bl_notify_party_address: editForm.notifyPartyAddress,

                    // Routing
                    bl_place_of_receipt: editForm.placeOfReceipt,
                    bl_place_of_delivery: editForm.placeOfDelivery,
                    bl_pre_carriage_by: editForm.preCarriageBy,
                    bl_loading_pier: editForm.loadingPier,
                    bl_export_references: editForm.exportReferences,
                    bl_forwarding_agent_ref: editForm.forwardingAgentRef,

                    // Cargo
                    bl_marks_numbers: editForm.marksNumbers,
                    bl_description_packages: editForm.descriptionPackages,
                    bl_gross_weight_text: editForm.grossWeight,
                    bl_measurement_text: editForm.measurement,
                    bl_total_packages_text: editForm.totalPackages,

                    // Footer
                    bl_freight_payable_at: editForm.freightPayableAt,
                    bl_number_of_originals: editForm.numberOfOriginals,
                    bl_issued_place: editForm.issuedPlace,
                    bl_issued_date: editForm.issuedDate,
                })
                .eq('id', selectedBL.id);

            if (error) throw error;

            alert('✅ Document updated successfully');
            setIsEditing(false);
            fetchBLs();
            setShowEditModal(false);
        } catch (error) {
            console.error('Error updating document:', error);
            alert('❌ Failed to update document');
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

    // Load partner data into Notify Party fields
    const handleLoadNotifyParty = (partner) => {
        if (partner) {
            setEditForm(prev => ({
                ...prev,
                notifyPartyName: partner.partner_name,
                notifyPartyAddress: `${partner.address_line1 || ''}\n${partner.address_line2 || ''}\n${partner.city || ''}, ${partner.country || ''}\nTel: ${partner.phone || ''}`
                    .replace(/\n+/g, '\n').trim()
            }));
            setShowNotifyPartyPicker(false);
        }
    };

    // NEW: Load data from selected quotation
    const handleLoadFromQuotation = (quotationId) => {
        const quotation = quotations.find(q => q.id === quotationId);
        if (!quotation) return;

        setEditForm(prev => ({
            ...prev,
            // Auto-populate shipper
            shipperName: quotation.shipper_name || '',
            shipperAddress: quotation.shipper_address || '',
            // Auto-populate consignee
            consigneeName: quotation.consignee_name || '',
            consigneeAddress: quotation.consignee_address || '',
            // Auto-populate subject (if quotation has subject field)
            subject: quotation.subject || `Quotation ${quotation.quotation_number}` || '',
        }));

        setSelectedQuotationId(quotationId);
    };

    // --- Render Helpers ---

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

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Document BL/AWB</h1>
                    <p className="text-silver-dark mt-1">Daftar Dokumen BL dan AWB</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        variant="outline"
                        icon={Download}
                        onClick={handleExportAllReport}
                        disabled={bls.length === 0}
                    >
                        Export All
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Total BLs</p>
                    <p className="text-2xl font-bold text-silver-light mt-1">{bls.length}</p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">Master BL</p>
                    <p className="text-2xl font-bold text-blue-400 mt-1">
                        {bls.filter(b => b.blType === 'MBL').length}
                    </p>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <p className="text-xs text-silver-dark">House BL</p>
                    <p className="text-2xl font-bold text-orange-400 mt-1">
                        {bls.filter(b => b.blType === 'HBL').length}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    placeholder="Search BL Number, Job Number, or Consignee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded-lg text-gray-900 dark:text-silver-light"
                />
            </div>

            {/* BL Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full whitespace-nowrap">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">No. AWB/BL</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Tanggal</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">No. SO</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Consignee</th>
                                <th className="px-4 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Type</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredBLs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-4 py-8 text-center">
                                        <Ship className="w-8 h-8 text-silver-dark mx-auto mb-2" />
                                        <p className="text-xs text-silver-dark">
                                            {searchTerm ? 'No BLs match your search' : 'Belum ada Bill of Lading'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBLs.map((bl) => {
                                    const TypeIcon = blTypeConfig[bl.blType]?.icon || Ship;
                                    return (
                                        <tr
                                            key={bl.id}
                                            onClick={() => {
                                                setSelectedBL(bl);
                                                setShowEditModal(true);
                                            }}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer group"
                                        >
                                            <td className="px-4 py-2 text-xs">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-accent-orange hover:underline group-hover:text-accent-orange/80">
                                                        {bl.blNumber !== '-' ? bl.blNumber : (
                                                            bl.mbl || bl.hbl || bl.mawb || bl.hawb || '-'
                                                        )}
                                                    </span>
                                                    {(bl.mbl || bl.mawb) && (
                                                        <span className="text-[10px] text-silver-dark opacity-80">M: {bl.mbl || bl.mawb}</span>
                                                    )}
                                                    {(bl.hbl || bl.hawb) && (
                                                        <span className="text-[10px] text-silver-dark opacity-80">H: {bl.hbl || bl.hawb}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="text-silver-light">
                                                    {bl.createdAt ? new Date(bl.createdAt).toLocaleDateString('id-ID') : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="text-silver-light font-mono">{bl.soNumber || '-'}</span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <span className="text-silver-light truncate max-w-[200px] block" title={bl.consigneeName}>
                                                    {bl.consigneeName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 text-xs">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <TypeIcon className="w-3.5 h-3.5 text-silver-dark" />
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${blTypeConfig[bl.blType]?.color}`}>
                                                        {bl.blType}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BL Edit/View Modal with Tabs */}
            {showEditModal && selectedBL && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-dark-card rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-silver-light flex items-center gap-2">
                                    <Ship className="w-5 h-5 text-accent-orange" />
                                    Document Editor (BL/AWB)
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-silver-dark mt-1 font-mono">
                                    JOB: {selectedBL.jobNumber} | TYPE: {selectedBL.blType}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {isEditing ? (
                                    <>
                                        <Button size="sm" onClick={handleUpdateBL}>Save Changes</Button>
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>Cancel Edit</Button>
                                    </>
                                ) : (
                                    <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit Document</Button>
                                )}
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedBL(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 dark:text-silver-dark dark:hover:text-silver-light transition-colors"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Tabs Navigation */}
                        <div className="flex bg-gray-100/50 dark:bg-dark-bg/50 border-b border-gray-200 dark:border-dark-border shrink-0 px-2 pt-2">
                            {[
                                { id: 'header', label: '1. Header & References' },
                                { id: 'parties', label: '2. Parties (Shipper/Cnee)' },
                                { id: 'routing', label: '3. Routing Info' },
                                { id: 'cargo', label: '4. Cargo Particulars' },
                                { id: 'footer', label: '5. Footer' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`px-4 py-2.5 text-sm font-medium transition-all rounded-t-lg mx-1 ${activeTab === tab.id
                                        ? 'bg-white dark:bg-dark-card text-accent-orange border-t-2 border-accent-orange shadow-sm'
                                        : 'text-gray-500 dark:text-silver-dark hover:text-gray-700 dark:hover:text-silver-light hover:bg-gray-200/50 dark:hover:bg-dark-bg'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-dark-card text-left">

                            {/* TAB: Header */}
                            {activeTab === 'header' && (
                                <div className="animate-fade-in space-y-4">
                                    {/* NEW: Load from Quotation */}
                                    {isEditing && (
                                        <div className="p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30 mb-4">
                                            <label className="block text-xs text-orange-500 font-semibold uppercase mb-2">
                                                🚀 Auto-Populate from Quotation
                                            </label>
                                            <select
                                                value={selectedQuotationId || ''}
                                                onChange={(e) => handleLoadFromQuotation(e.target.value)}
                                                className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                                            >
                                                <option value="">-- Select Quotation to Load --</option>
                                                {quotations.map(q => (
                                                    <option key={q.id} value={q.id}>
                                                        {q.quotation_number} - {q.shipper_name} → {q.consignee_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 dark:text-silver-dark mt-1">
                                                Select a quotation to automatically fill shipper, consignee, and subject details
                                            </p>
                                        </div>
                                    )}

                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 mb-4">
                                        <h3 className="text-sm font-bold text-blue-500 mb-2">Basic Information</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            {renderInput('BL Number', 'blNumber')}
                                            {renderInput('Status', 'status')}
                                        </div>
                                    </div>

                                    {/* NEW: Subject Field */}
                                    <div className="mb-4">
                                        <label className="block text-xs text-gray-500 dark:text-silver-dark font-semibold uppercase mb-1">
                                            Subject
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editForm.subject || ''}
                                                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                                                className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                                                placeholder="e.g., Shipment of Electronics"
                                            />
                                        ) : (
                                            <div className="px-3 py-2 bg-gray-50 dark:bg-dark-hover border border-gray-200 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light">
                                                {editForm.subject || '-'}
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        {renderInput('Export References', 'exportReferences', 'textarea', 'e.g. Invoice No, LC No')}
                                        {renderInput('Forwarding Agent Ref', 'forwardingAgentRef', 'textarea', 'Local Forwarder details')}
                                    </div>
                                </div>
                            )}

                            {/* TAB: Parties */}
                            {activeTab === 'parties' && (
                                <div className="animate-fade-in grid grid-cols-3 gap-6 h-full">
                                    <div className="col-span-1 border-r border-dashed border-gray-200 dark:border-dark-border pr-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-purple-500 font-bold uppercase text-xs tracking-wider">
                                                <span>Shipper / Exporter</span>
                                            </div>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowShipperPicker(!showShipperPicker)}
                                                    className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors"
                                                >
                                                    📋 Load from Partner
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
                                        <div className="space-y-4">
                                            {renderInput('Name', 'shipperName')}
                                            {renderInput('Address (Full Text)', 'shipperAddress', 'textarea', 'Complete address including country and phone')}
                                        </div>
                                    </div>
                                    <div className="col-span-1 border-r border-dashed border-gray-200 dark:border-dark-border pr-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-pink-500 font-bold uppercase text-xs tracking-wider">
                                                <span>Consignee</span>
                                            </div>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowConsigneePicker(!showConsigneePicker)}
                                                    className="text-xs px-2 py-1 bg-pink-500/20 text-pink-400 rounded hover:bg-pink-500/30 transition-colors"
                                                >
                                                    📋 Load from Partner
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
                                        <div className="space-y-4">
                                            {renderInput('Name', 'consigneeName')}
                                            {renderInput('Address (Full Text)', 'consigneeAddress', 'textarea', 'Complete address including country and phone')}
                                        </div>
                                    </div>
                                    <div className="col-span-1">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-orange-500 font-bold uppercase text-xs tracking-wider">
                                                <span>Notify Party</span>
                                            </div>
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowNotifyPartyPicker(!showNotifyPartyPicker)}
                                                    className="text-xs px-2 py-1 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
                                                >
                                                    📋 Load from Partner
                                                </button>
                                            )}
                                        </div>
                                        {isEditing && showNotifyPartyPicker && (
                                            <div className="mb-3">
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadNotifyParty}
                                                    roleFilter="all"
                                                    placeholder="Select notify party..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {renderInput('Name', 'notifyPartyName')}
                                            {renderInput('Address (Full Text)', 'notifyPartyAddress', 'textarea', 'Usually SAME AS CONSIGNEE')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: Routing */}
                            {activeTab === 'routing' && (
                                <div className="animate-fade-in">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        {renderInput('Pre-Carriage By', 'preCarriageBy')}
                                        {renderInput('Place of Receipt', 'placeOfReceipt')}
                                        {renderInput('Ocean Vessel / Voyage', 'vessel')}
                                        {renderInput('Port of Loading', 'portOfLoading')}
                                        {renderInput('Port of Discharge', 'portOfDischarge')}
                                        {renderInput('Place of Delivery', 'placeOfDelivery')}
                                        {renderInput('Loading Pier / Terminal', 'loadingPier')}
                                    </div>
                                </div>
                            )}

                            {/* TAB: Cargo */}
                            {activeTab === 'cargo' && (
                                <div className="animate-fade-in grid grid-cols-12 gap-6">
                                    <div className="col-span-3">
                                        <h3 className="font-bold text-gray-500 dark:text-silver-dark text-xs uppercase mb-3 border-b border-gray-200 dark:border-dark-border pb-1">Container Details</h3>
                                        {renderInput('Container No', 'containerNumber')}
                                        {renderInput('Seal No', 'sealNumber')}
                                        {renderInput('Marks & Numbers', 'marksNumbers', 'textarea', 'e.g. N/M')}
                                    </div>
                                    <div className="col-span-6">
                                        <h3 className="font-bold text-gray-500 dark:text-silver-dark text-xs uppercase mb-3 border-b border-gray-200 dark:border-dark-border pb-1">Description</h3>
                                        {renderInput('Description of Packages and Goods', 'descriptionPackages', 'textarea', 'FULL DESCRIPTION OF GOODS')}
                                        {renderInput('Total Packages Text', 'totalPackages', 'text', 'SAY: ONE CONTAINER ONLY')}
                                    </div>
                                    <div className="col-span-3">
                                        <h3 className="font-bold text-gray-500 dark:text-silver-dark text-xs uppercase mb-3 border-b border-gray-200 dark:border-dark-border pb-1">Measurements</h3>
                                        {renderInput('Gross Weight', 'grossWeight')}
                                        {renderInput('Measurement', 'measurement')}
                                    </div>
                                </div>
                            )}

                            {/* TAB: Footer */}
                            {activeTab === 'footer' && (
                                <div className="animate-fade-in grid grid-cols-2 gap-6">
                                    <div className="bg-gray-50 dark:bg-dark-bg/30 p-4 rounded-lg">
                                        {renderInput('Freight Payable At', 'freightPayableAt')}
                                        {renderInput('Number of Original BLs', 'numberOfOriginals')}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-dark-bg/30 p-4 rounded-lg">
                                        {renderInput('Place of Issue', 'issuedPlace')}
                                        {renderInput('Date of Issue', 'issuedDate', 'date')}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface shrink-0">
                            <span className="text-xs text-gray-400 italic">
                                * Use "Save Changes" to commit edits to database before printing.
                            </span>
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    icon={Printer}
                                    onClick={() => handlePrintBL(selectedBL)}
                                >
                                    Print Preview
                                </Button>
                                <Button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedBL(null);
                                    }}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BLManagement;
