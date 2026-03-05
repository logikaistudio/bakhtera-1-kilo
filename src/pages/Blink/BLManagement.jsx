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
    User,
    RefreshCw,
    CheckCircle,
    Clock,
    Send,
    ShieldCheck,
    XCircle
} from 'lucide-react';
import { exportBLCertificateToExcel, exportSellingBuyingReport } from '../../utils/excelExport';
import { printBLCertificate } from '../../utils/printUtils';
import { useAuth } from '../../context/AuthContext';

const BLManagement = () => {
    const { canEdit, canDelete, canApprove } = useAuth();
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
    // Partner pickers are always shown when editing - no toggle needed

    // Quotation & Shipment auto-populate support
    const [quotations, setQuotations] = useState([]);
    const [shipments, setShipments] = useState([]);
    const [selectedQuotationId, setSelectedQuotationId] = useState(null);

    useEffect(() => {
        fetchBLs();
        fetchQuotations();
        fetchShipments();
    }, []);

    // Initialize edit form when selectedBL changes
    useEffect(() => {
        if (selectedBL) {
            setEditForm({
                status: selectedBL.status,
                blNumber: selectedBL.blNumber !== '-' ? selectedBL.blNumber : '',
                blDate: selectedBL.blIssuedDate || (selectedBL.createdAt ? new Date(selectedBL.createdAt).toISOString().split('T')[0] : ''),

                // Document Numbers
                mbl: selectedBL.mbl || '',
                hbl: selectedBL.hbl || '',
                mawb: selectedBL.mawb || '',
                hawb: selectedBL.hawb || '',

                // Subject
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

                // NEW: Extra routing fields for print
                typeOfMove: selectedBL.blTypeOfMove || 'FCL/FCL',
                countryOfOrigin: selectedBL.blCountryOfOrigin || 'INDONESIA',

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

                // NEW: Freight & charges fields
                freightCharges: selectedBL.blFreightCharges || '',
                prepaid: selectedBL.blPrepaid || '',
                collect: selectedBL.blCollect || '',
                shippedOnBoardDate: selectedBL.blShippedOnBoardDate || '',
            });
            setIsEditing(false);
            setActiveTab('header');

            if (selectedBL.quotationId) {
                setSelectedQuotationId(selectedBL.quotationId);
            }
        }
    }, [selectedBL]);

    const fetchBLs = async () => {
        try {
            setLoading(true);
            const { data: shipmentsData, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const blData = (shipmentsData || []).map(ship => ({
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

                // Subject and Quotation Reference
                blSubject: ship.bl_subject,
                quotationId: ship.quotation_id,

                // BL Specific Columns
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

                // NEW: Extra BL fields
                blTypeOfMove: ship.bl_type_of_move,
                blCountryOfOrigin: ship.bl_country_of_origin,
                blFreightCharges: ship.bl_freight_charges,
                blPrepaid: ship.bl_prepaid,
                blCollect: ship.bl_collect,
                blShippedOnBoardDate: ship.bl_shipped_on_board_date,

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

                // Shipment data for reference
                origin: ship.origin,
                destination: ship.destination,
                serviceType: ship.service_type,
                etd: ship.etd,
                eta: ship.eta,
                commodity: ship.commodity,

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

    // Fetch quotations for auto-populate
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

    // Fetch shipments for SO auto-populate
    const fetchShipments = async () => {
        try {
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setShipments(data || []);
        } catch (error) {
            console.error('❌ Error fetching shipments for SO:', error);
        }
    };

    const blTypeConfig = {
        'MBL': { color: 'bg-blue-500/20 text-blue-400', icon: Ship },
        'HBL': { color: 'bg-orange-500/20 text-orange-400', icon: Container },
    };

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: Clock },
        submitted: { label: 'Submitted', color: 'bg-yellow-500/20 text-yellow-400', icon: Send },
        approved: { label: 'Approved', color: 'bg-teal-500/20 text-teal-400', icon: ShieldCheck },
        rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400', icon: XCircle },
        issued: { label: 'Issued', color: 'bg-blue-500/20 text-blue-400', icon: CheckCircle },
        in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400', icon: Ship },
        arrived: { label: 'Arrived', color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
        delivered: { label: 'Delivered', color: 'bg-emerald-500/20 text-emerald-400', icon: CheckCircle },
    };

    // Status transition rules: which statuses can transition to which
    const statusTransitions = {
        draft: [
            { to: 'submitted', label: 'Submit for Approval', icon: Send, color: 'bg-yellow-500 hover:bg-yellow-600 text-white' }
        ],
        submitted: [
            { to: 'approved', label: 'Approve', icon: ShieldCheck, color: 'bg-teal-500 hover:bg-teal-600 text-white' },
            { to: 'rejected', label: 'Reject', icon: XCircle, color: 'bg-red-500 hover:bg-red-600 text-white' },
            { to: 'draft', label: 'Return to Draft', icon: RefreshCw, color: 'bg-gray-500 hover:bg-gray-600 text-white' }
        ],
        approved: [
            { to: 'issued', label: 'Issue Document', icon: CheckCircle, color: 'bg-blue-500 hover:bg-blue-600 text-white' }
        ],
        rejected: [
            { to: 'draft', label: 'Revise (Back to Draft)', icon: RefreshCw, color: 'bg-gray-500 hover:bg-gray-600 text-white' }
        ],
        issued: [
            { to: 'in_transit', label: 'Mark In Transit', icon: Ship, color: 'bg-purple-500 hover:bg-purple-600 text-white' }
        ],
        in_transit: [
            { to: 'arrived', label: 'Mark Arrived', icon: CheckCircle, color: 'bg-green-500 hover:bg-green-600 text-white' }
        ],
        arrived: [
            { to: 'delivered', label: 'Mark Delivered', icon: CheckCircle, color: 'bg-emerald-500 hover:bg-emerald-600 text-white' }
        ],
        delivered: []
    };

    // Handle status change with confirmation
    const handleStatusChange = async (newStatus) => {
        const statusLabel = statusConfig[newStatus]?.label || newStatus;
        const confirmMsg = newStatus === 'approved'
            ? `Are you sure you want to APPROVE this BL/AWB document?`
            : newStatus === 'rejected'
                ? `Are you sure you want to REJECT this BL/AWB? The document will need revision.`
                : `Change status to "${statusLabel}"?`;

        if (!canApprove('blink_bl')) {
            alert('Anda tidak memiliki hak akses untuk mengubah status BL/AWB.');
            return;
        }
        if (!confirm(confirmMsg)) return;

        try {
            const updateData = {
                bl_status: newStatus,
            };

            // Record approval metadata
            if (newStatus === 'approved') {
                updateData.bl_approved_at = new Date().toISOString();
                updateData.bl_approved_by = 'Current User'; // TODO: get from auth context
            }
            if (newStatus === 'issued') {
                updateData.bl_issued_date = new Date().toISOString().split('T')[0];
            }

            const { error } = await supabase
                .from('blink_shipments')
                .update(updateData)
                .eq('id', selectedBL.id);

            if (error) throw error;

            alert(`✅ Status changed to: ${statusLabel}`);
            // Refresh data
            await fetchBLs();
            // Update local state
            setSelectedBL(prev => ({ ...prev, status: newStatus }));
            setEditForm(prev => ({ ...prev, status: newStatus }));
        } catch (error) {
            console.error('Error changing status:', error);
            alert('❌ Failed to change status: ' + error.message);
        }
    };

    const filteredBLs = bls.filter(bl => {
        if (!searchTerm) return true;
        return bl.blNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bl.jobNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bl.consigneeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bl.soNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleDeleteBL = async (blId) => {
        if (!canDelete('blink_bl')) {
            alert('Anda tidak memiliki hak akses untuk menghapus BL/AWB.');
            return;
        }
        if (!confirm('Are you sure you want to delete this BL? Data will be cleared from the shipment.')) return;
        try {
            const { error } = await supabase.from('blink_shipments')
                .update({ bl_number: null, bl_type: null, bl_status: null }).eq('id', blId);
            if (error) throw error;
            alert('✅ BL deleted successfully');
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
        if (!canEdit('blink_bl')) {
            alert('Anda tidak memiliki hak akses untuk memanipulasi (Edit) BL/AWB.');
            return;
        }
        try {
            const selectedQuotation = selectedQuotationId
                ? quotations.find(q => q.id === selectedQuotationId)
                : null;

            const { error } = await supabase
                .from('blink_shipments')
                .update({
                    bl_status: editForm.status,
                    bl_number: editForm.blNumber || null,

                    // Subject and Quotation Reference
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

                    // NEW: Extra routing/print fields
                    bl_type_of_move: editForm.typeOfMove,
                    bl_country_of_origin: editForm.countryOfOrigin,

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

                    // NEW: Freight & charge fields
                    bl_freight_charges: editForm.freightCharges,
                    bl_prepaid: editForm.prepaid,
                    bl_collect: editForm.collect,
                    bl_shipped_on_board_date: editForm.shippedOnBoardDate,

                    // Also sync basic routing from form
                    vessel_name: editForm.vessel,
                    voyage: editForm.voyage,

                    // Document numbers
                    mbl: editForm.mbl || null,
                    hbl: editForm.hbl || null,
                    mawb: editForm.mawb || null,
                    hawb: editForm.hawb || null,
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
                shipperAddress: [partner.address_line1, partner.address_line2, `${partner.city || ''}, ${partner.country || ''}`, partner.phone ? `Tel: ${partner.phone}` : ''].filter(Boolean).join('\n').trim()
            }));
        }
    };

    // Load partner data into Consignee fields
    const handleLoadConsignee = (partner) => {
        if (partner) {
            setEditForm(prev => ({
                ...prev,
                consigneeName: partner.partner_name,
                consigneeAddress: [partner.address_line1, partner.address_line2, `${partner.city || ''}, ${partner.country || ''}`, partner.phone ? `Tel: ${partner.phone}` : ''].filter(Boolean).join('\n').trim()
            }));
        }
    };

    // Load partner data into Notify Party fields
    const handleLoadNotifyParty = (partner) => {
        if (partner) {
            setEditForm(prev => ({
                ...prev,
                notifyPartyName: partner.partner_name,
                notifyPartyAddress: [partner.address_line1, partner.address_line2, `${partner.city || ''}, ${partner.country || ''}`, partner.phone ? `Tel: ${partner.phone}` : ''].filter(Boolean).join('\n').trim()
            }));
        }
    };

    // Load data from selected quotation
    const handleLoadFromQuotation = (quotationId) => {
        const quotation = quotations.find(q => q.id === quotationId);
        if (!quotation) return;

        setEditForm(prev => ({
            ...prev,
            shipperName: quotation.shipper_name || quotation.customer_name || prev.shipperName,
            shipperAddress: quotation.shipper_address || prev.shipperAddress,
            consigneeName: quotation.consignee_name || prev.consigneeName,
            consigneeAddress: quotation.consignee_address || prev.consigneeAddress,
            subject: quotation.subject || `Quotation ${quotation.quotation_number}` || prev.subject,
            // Routing from quotation
            portOfLoading: quotation.origin || prev.portOfLoading,
            portOfDischarge: quotation.destination || prev.portOfDischarge,
            placeOfReceipt: quotation.origin || prev.placeOfReceipt,
            placeOfDelivery: quotation.destination || prev.placeOfDelivery,
            // Cargo from quotation
            descriptionPackages: quotation.commodity || prev.descriptionPackages,
            grossWeight: quotation.weight ? `${quotation.weight} KGS` : prev.grossWeight,
            measurement: quotation.volume ? `${quotation.volume} CBM` : prev.measurement,
        }));

        setSelectedQuotationId(quotationId);
    };

    // ENHANCED: Load ALL data from SO/Shipment – comprehensive field mapping
    const handleLoadFromShipment = (shipmentId) => {
        const ship = shipments.find(s => s.id === shipmentId);
        if (!ship) return;

        // Extract booking data (JSONB field)
        const booking = ship.booking || {};

        // Build container marks/numbers from container array
        const containersArr = ship.containers || [];
        const firstContainer = containersArr[0] || {};
        const allContainerNumbers = containersArr.map(c => c.containerNumber).filter(Boolean).join('\n');
        const allSealNumbers = containersArr.map(c => c.sealNumber).filter(Boolean).join('\n');

        // Map cargo_type to TypeOfMove
        const cargoTypeMap = {
            'FCL': 'FCL/FCL',
            'LCL': 'LCL/LCL',
            'General': 'CY/CY',
            'Bulk': 'CY/CY',
        };
        const typeOfMove = cargoTypeMap[ship.cargo_type] || ship.cargo_type || 'FCL/FCL';

        // Build marks text from containers
        const marksText = containersArr.length > 0
            ? containersArr.map(c => `${c.containerNumber || 'N/M'}`).join('\n')
            : (ship.container_number || 'N/M');

        // Build total packages text
        const totalContainers = containersArr.length || 1;
        const containerTypes = containersArr.map(c => c.containerType || '').filter(Boolean);
        const uniqueTypes = [...new Set(containerTypes)];
        const packagesText = totalContainers === 1
            ? 'SAY: ONE CONTAINER ONLY'
            : `SAY: ${numberToWords(totalContainers).toUpperCase()} CONTAINERS${uniqueTypes.length > 0 ? ` (${uniqueTypes.join(', ')})` : ''} ONLY`;

        // Build export references
        const exportRefs = [
            ship.so_number ? `SO: ${ship.so_number}` : '',
            ship.job_number ? `JOB: ${ship.job_number}` : '',
        ].filter(Boolean).join('\n');

        setEditForm(prev => ({
            ...prev,
            // === ROUTING ===
            vessel: ship.vessel_name || booking.vesselName || prev.vessel,
            voyage: ship.voyage || booking.voyageNumber || prev.voyage,
            portOfLoading: ship.origin || booking.portOfLoading || prev.portOfLoading,
            portOfDischarge: ship.destination || booking.portOfDischarge || prev.portOfDischarge,
            placeOfReceipt: ship.origin || booking.portOfLoading || prev.placeOfReceipt,
            placeOfDelivery: ship.destination || booking.portOfDischarge || prev.placeOfDelivery,

            // === CONTAINER & CARGO ===
            containerNumber: ship.container_number || allContainerNumbers || firstContainer.containerNumber || prev.containerNumber,
            sealNumber: ship.seal_number || allSealNumbers || firstContainer.sealNumber || prev.sealNumber,
            marksNumbers: marksText || prev.marksNumbers,
            descriptionPackages: ship.cargo_description || ship.commodity || prev.descriptionPackages,
            grossWeight: ship.gross_weight
                ? `${ship.gross_weight} KGS`
                : (ship.weight ? `${ship.weight} KGS` : prev.grossWeight),
            measurement: ship.measure
                ? `${ship.measure} CBM`
                : (ship.volume || ship.cbm ? `${ship.volume || ship.cbm} CBM` : prev.measurement),
            totalPackages: packagesText || prev.totalPackages,

            // === TYPE OF MOVE ===
            typeOfMove: typeOfMove || prev.typeOfMove,

            // === PARTIES ===
            shipperName: ship.shipper_name || ship.shipper || prev.shipperName,
            consigneeName: ship.consignee_name || ship.customer_name || ship.customer || prev.consigneeName,

            // === DOCUMENT NUMBERS ===
            mbl: ship.mbl || prev.mbl,
            hbl: ship.hbl || prev.hbl,
            mawb: ship.mawb || prev.mawb,
            hawb: ship.hawb || prev.hawb,
            blNumber: ship.bl_number || ship.awb_number || prev.blNumber,

            // === SUBJECT & EXPORT REFS ===
            subject: ship.bl_subject || (ship.so_number ? `SO ${ship.so_number}` : '') || prev.subject,
            exportReferences: exportRefs || prev.exportReferences,

            // === DATES ===
            shippedOnBoardDate: ship.etd || ship.actual_departure || prev.shippedOnBoardDate,
        }));

        // Show feedback
        const filledFields = [];
        if (ship.vessel_name || booking.vesselName) filledFields.push('Vessel');
        if (ship.voyage || booking.voyageNumber) filledFields.push('Voyage');
        if (ship.origin) filledFields.push('POL');
        if (ship.destination) filledFields.push('POD');
        if (ship.container_number || containersArr.length > 0) filledFields.push(`Container(${containersArr.length || 1})`);
        if (ship.shipper_name || ship.shipper) filledFields.push('Shipper');
        if (ship.consignee_name || ship.customer) filledFields.push('Consignee');
        if (ship.commodity) filledFields.push('Cargo');
        if (ship.mbl || ship.hbl || ship.mawb || ship.hawb) filledFields.push('Doc Numbers');

        if (filledFields.length > 0) {
            console.log(`✅ Loaded from SO/Shipment: ${filledFields.join(', ')}`);
        }
    };

    // Helper: number to words (for packages text)
    const numberToWords = (num) => {
        const words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
            'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
        return words[num] || String(num);
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
                ) : type === 'select' ? null : (
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

    const renderSelect = (label, key, options) => (
        <div className="mb-4">
            <label className="block text-xs text-gray-500 dark:text-silver-dark font-semibold uppercase mb-1">{label}</label>
            {isEditing ? (
                <select
                    value={editForm[key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : (
                <div className="text-sm text-gray-900 dark:text-silver-light font-medium p-2 bg-gray-50 dark:bg-dark-bg/50 rounded border border-transparent">
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
                    <p className="text-silver-dark mt-1">Bill of Lading & Air Waybill Management</p>
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
                    placeholder="Search BL Number, Job Number, SO Number, or Consignee..."
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
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Date</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">No. SO</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Consignee</th>
                                <th className="px-4 py-2 text-left text-[10px] font-bold text-white uppercase tracking-wider">Route</th>
                                <th className="px-4 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Type</th>
                                <th className="px-4 py-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredBLs.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-8 text-center">
                                        <Ship className="w-8 h-8 text-silver-dark mx-auto mb-2" />
                                        <p className="text-xs text-silver-dark">
                                            {searchTerm ? 'No BLs match your search' : 'No Bill of Lading yet'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredBLs.map((bl) => {
                                    const TypeIcon = blTypeConfig[bl.blType]?.icon || Ship;
                                    const stCfg = statusConfig[bl.status] || statusConfig.draft;
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
                                                <span className="text-silver-dark">
                                                    {bl.portOfLoading || '-'} → {bl.portOfDischarge || '-'}
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
                                            <td className="px-4 py-2 text-xs text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${stCfg.color}`}>
                                                    {stCfg.label}
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
                                <div className="flex items-center gap-3 mt-1">
                                    <p className="text-xs text-gray-500 dark:text-silver-dark font-mono">
                                        JOB: {selectedBL.jobNumber} | TYPE: {selectedBL.blType}
                                        {selectedBL.soNumber && <> | SO: {selectedBL.soNumber}</>}
                                    </p>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusConfig[editForm.status || selectedBL.status]?.color || 'bg-gray-500/20 text-gray-400'}`}>
                                        {(() => { const IconComp = statusConfig[editForm.status || selectedBL.status]?.icon; return IconComp ? <IconComp className="w-3 h-3" /> : null; })()}
                                        {statusConfig[editForm.status || selectedBL.status]?.label || editForm.status || selectedBL.status}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2 items-center">
                                {/* Status Action Buttons */}
                                {!isEditing && (statusTransitions[editForm.status || selectedBL.status] || []).map(transition => (
                                    <button
                                        key={transition.to}
                                        onClick={() => handleStatusChange(transition.to)}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${transition.color}`}
                                    >
                                        <transition.icon className="w-3.5 h-3.5" />
                                        {transition.label}
                                    </button>
                                ))}
                                {/* Divider */}
                                {!isEditing && (statusTransitions[editForm.status || selectedBL.status] || []).length > 0 && (
                                    <div className="w-px h-6 bg-gray-300 dark:bg-dark-border mx-1" />
                                )}
                                {isEditing ? (
                                    <>
                                        <Button size="sm" onClick={handleUpdateBL}>Save Changes</Button>
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(false)}>Cancel Edit</Button>
                                    </>
                                ) : (
                                    canEdit('blink_bl') && (
                                        <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit Document</Button>
                                    )
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
                                { id: 'footer', label: '5. Footer & Freight' }
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
                                    {/* Load from Quotation */}
                                    {isEditing && (
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="p-3 bg-orange-50/50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
                                                <label className="block text-xs text-orange-500 font-semibold uppercase mb-2">
                                                    🚀 Auto-Populate from Quotation
                                                </label>
                                                <select
                                                    value={selectedQuotationId || ''}
                                                    onChange={(e) => handleLoadFromQuotation(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-accent-orange"
                                                >
                                                    <option value="">-- Select Quotation --</option>
                                                    {quotations.map(q => (
                                                        <option key={q.id} value={q.id}>
                                                            {q.quotation_number} - {q.customer_name} ({q.origin} → {q.destination})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-gray-500 dark:text-silver-dark mt-1">
                                                    Fills shipper, consignee, routing, cargo
                                                </p>
                                            </div>
                                            <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                                <label className="block text-xs text-blue-500 font-semibold uppercase mb-2">
                                                    📦 Auto-Populate from SO/Shipment
                                                </label>
                                                <select
                                                    onChange={(e) => handleLoadFromShipment(e.target.value)}
                                                    className="w-full px-3 py-2 bg-white dark:bg-dark-surface border border-gray-300 dark:border-dark-border rounded text-sm text-gray-900 dark:text-silver-light focus:border-blue-500"
                                                >
                                                    <option value="">-- Select SO/Shipment --</option>
                                                    {shipments.map(s => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.so_number || s.job_number} - {s.customer_name || s.customer} ({s.origin} → {s.destination})
                                                        </option>
                                                    ))}
                                                </select>
                                                <p className="text-xs text-gray-500 dark:text-silver-dark mt-1">
                                                    Fills vessel, voyage, routing, container, seal, cargo, marks, shipper, consignee, doc numbers, dates
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="p-3 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 mb-4">
                                        <h3 className="text-sm font-bold text-blue-500 mb-2">Basic Information</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {renderInput('BL Number', 'blNumber')}
                                            {renderSelect('Status', 'status', [
                                                { value: 'draft', label: '📝 Draft' },
                                                { value: 'submitted', label: '📤 Submitted' },
                                                { value: 'approved', label: '✅ Approved' },
                                                { value: 'rejected', label: '❌ Rejected' },
                                                { value: 'issued', label: '📄 Issued' },
                                                { value: 'in_transit', label: '🚢 In Transit' },
                                                { value: 'arrived', label: '📍 Arrived' },
                                                { value: 'delivered', label: '✔️ Delivered' },
                                            ])}
                                            {renderSelect('BL Type', 'blType', [
                                                { value: 'MBL', label: 'Master BL (MBL)' },
                                                { value: 'HBL', label: 'House BL (HBL)' },
                                            ])}
                                        </div>
                                    </div>

                                    {/* Document Numbers */}
                                    <div className="p-3 bg-green-50/50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-900/30 mb-4">
                                        <h3 className="text-sm font-bold text-green-500 mb-2">Document Numbers</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            {renderInput('MBL No.', 'mbl', 'text', 'Master B/L Number')}
                                            {renderInput('HBL No.', 'hbl', 'text', 'House B/L Number')}
                                            {renderInput('MAWB No.', 'mawb', 'text', 'Master AWB Number')}
                                            {renderInput('HAWB No.', 'hawb', 'text', 'House AWB Number')}
                                        </div>
                                    </div>

                                    {/* Subject Field */}
                                    {renderInput('Subject', 'subject', 'text', 'e.g. Shipment of Electronics')}

                                    <div className="grid grid-cols-2 gap-6">
                                        {renderInput('Export References', 'exportReferences', 'textarea', 'e.g. Invoice No, LC No, SO No')}
                                        {renderInput('Forwarding Agent Ref', 'forwardingAgentRef', 'textarea', 'Local Forwarder details')}
                                    </div>
                                </div>
                            )}

                            {/* TAB: Parties */}
                            {activeTab === 'parties' && (
                                <div className="animate-fade-in grid grid-cols-3 gap-6 h-full">
                                    {/* SHIPPER */}
                                    <div className="col-span-1 border-r border-dashed border-gray-200 dark:border-dark-border pr-6">
                                        <div className="flex items-center gap-2 text-purple-500 font-bold uppercase text-xs tracking-wider mb-3">
                                            <User className="w-3.5 h-3.5" />
                                            <span>Shipper / Exporter</span>
                                        </div>
                                        {isEditing && (
                                            <div className="mb-3">
                                                <label className="block text-xs text-gray-400 mb-1">Select from Business Partners</label>
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadShipper}
                                                    roleFilter="all"
                                                    placeholder="🔍 Search & select shipper..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {renderInput('Name', 'shipperName')}
                                            {renderInput('Address', 'shipperAddress', 'textarea', 'Full address with country & phone')}
                                        </div>
                                    </div>
                                    {/* CONSIGNEE */}
                                    <div className="col-span-1 border-r border-dashed border-gray-200 dark:border-dark-border pr-6">
                                        <div className="flex items-center gap-2 text-pink-500 font-bold uppercase text-xs tracking-wider mb-3">
                                            <User className="w-3.5 h-3.5" />
                                            <span>Consignee</span>
                                        </div>
                                        {isEditing && (
                                            <div className="mb-3">
                                                <label className="block text-xs text-gray-400 mb-1">Select from Business Partners</label>
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadConsignee}
                                                    roleFilter="all"
                                                    placeholder="🔍 Search & select consignee..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {renderInput('Name', 'consigneeName')}
                                            {renderInput('Address', 'consigneeAddress', 'textarea', 'Full address with country & phone')}
                                        </div>
                                    </div>
                                    {/* NOTIFY PARTY */}
                                    <div className="col-span-1">
                                        <div className="flex items-center gap-2 text-orange-500 font-bold uppercase text-xs tracking-wider mb-3">
                                            <User className="w-3.5 h-3.5" />
                                            <span>Notify Party</span>
                                        </div>
                                        {isEditing && (
                                            <div className="mb-3">
                                                <label className="block text-xs text-gray-400 mb-1">Select from Business Partners</label>
                                                <PartnerPicker
                                                    value={""}
                                                    onChange={() => { }}
                                                    onPartnerLoad={handleLoadNotifyParty}
                                                    roleFilter="all"
                                                    placeholder="🔍 Search & select notify party..."
                                                    size="sm"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            {renderInput('Name', 'notifyPartyName')}
                                            {renderInput('Address', 'notifyPartyAddress', 'textarea', 'Usually SAME AS CONSIGNEE')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: Routing */}
                            {activeTab === 'routing' && (
                                <div className="animate-fade-in">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                        {renderInput('Pre-Carriage By', 'preCarriageBy', 'text', 'e.g. TRUCK')}
                                        {renderInput('Place of Receipt', 'placeOfReceipt')}
                                        {renderInput('Ocean Vessel', 'vessel', 'text', 'Vessel name')}
                                        {renderInput('Voyage No.', 'voyage', 'text', 'Voyage number')}
                                        {renderInput('Port of Loading', 'portOfLoading')}
                                        {renderInput('Port of Discharge', 'portOfDischarge')}
                                        {renderInput('Place of Delivery', 'placeOfDelivery')}
                                        {renderInput('Loading Pier / Terminal', 'loadingPier')}
                                    </div>
                                    <div className="border-t border-gray-200 dark:border-dark-border pt-4 mt-4">
                                        <h3 className="text-xs font-bold text-silver-dark uppercase mb-3">Print-Specific Fields</h3>
                                        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                                            {renderInput('Type of Move', 'typeOfMove', 'text', 'e.g. FCL/FCL, LCL/LCL, CY/CY')}
                                            {renderInput('Point and Country of Origin', 'countryOfOrigin', 'text', 'e.g. INDONESIA')}
                                        </div>
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
                                        {renderInput('Gross Weight', 'grossWeight', 'text', 'e.g. 18,500 KGS')}
                                        {renderInput('Measurement', 'measurement', 'text', 'e.g. 33.20 CBM')}
                                    </div>
                                </div>
                            )}

                            {/* TAB: Footer & Freight */}
                            {activeTab === 'footer' && (
                                <div className="animate-fade-in space-y-6">
                                    {/* Freight & Charges Section */}
                                    <div>
                                        <h3 className="text-sm font-bold text-accent-orange mb-3">Freight & Charges</h3>
                                        <div className="grid grid-cols-4 gap-4">
                                            {renderInput('Freight & Charges', 'freightCharges', 'text', 'e.g. AS ARRANGED')}
                                            {renderInput('Prepaid', 'prepaid', 'text', 'Prepaid amount/text')}
                                            {renderInput('Collect', 'collect', 'text', 'Collect amount/text')}
                                            {renderInput('Freight Payable At', 'freightPayableAt', 'text', 'e.g. DESTINATION')}
                                        </div>
                                    </div>

                                    {/* Issue & Signature Section */}
                                    <div>
                                        <h3 className="text-sm font-bold text-accent-orange mb-3">Issuance Details</h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-gray-50 dark:bg-dark-bg/30 p-4 rounded-lg">
                                                {renderInput('Number of Original BLs', 'numberOfOriginals')}
                                                {renderInput('Place of Issue', 'issuedPlace')}
                                                {renderInput('Date of Issue', 'issuedDate', 'date')}
                                            </div>
                                            <div className="bg-gray-50 dark:bg-dark-bg/30 p-4 rounded-lg">
                                                {renderInput('Shipped on Board Date', 'shippedOnBoardDate', 'date')}
                                                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-200 dark:border-yellow-900/30">
                                                    <p className="text-xs text-yellow-600 dark:text-yellow-400">
                                                        ⚠️ "Shipped on Board Date" appears at the bottom-left of the BL print. Leave blank if not yet shipped.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer with Status Flow */}
                        <div className="border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface shrink-0">
                            {/* Status Flow Bar */}
                            <div className="px-4 pt-3 pb-1">
                                <div className="flex items-center gap-1 overflow-x-auto">
                                    {['draft', 'submitted', 'approved', 'issued', 'in_transit', 'arrived', 'delivered'].map((step, idx, arr) => {
                                        const stepConfig = statusConfig[step];
                                        const currentStatus = editForm.status || selectedBL.status;
                                        const stepOrder = arr.indexOf(step);
                                        const currentOrder = arr.indexOf(currentStatus);
                                        const isActive = step === currentStatus;
                                        const isPast = currentStatus !== 'rejected' && stepOrder < currentOrder;
                                        const isRejected = currentStatus === 'rejected' && step === 'rejected';
                                        return (
                                            <React.Fragment key={step}>
                                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all ${isActive || isRejected
                                                    ? stepConfig.color + ' ring-2 ring-offset-1 ring-current'
                                                    : isPast
                                                        ? 'bg-green-500/20 text-green-400'
                                                        : 'bg-gray-200/50 dark:bg-dark-bg/50 text-gray-400 dark:text-silver-dark'
                                                    }`}>
                                                    {isPast ? <CheckCircle className="w-3 h-3" /> : (() => { const IC = stepConfig.icon; return IC ? <IC className="w-3 h-3" /> : null; })()}
                                                    {stepConfig.label}
                                                </div>
                                                {idx < arr.length - 1 && (
                                                    <div className={`w-4 h-0.5 ${isPast ? 'bg-green-400' : 'bg-gray-300 dark:bg-dark-border'}`} />
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                            {/* Action Bar */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <span className="text-xs text-gray-400 italic">
                                    {isEditing
                                        ? '* Save changes first, then use status buttons to transition.'
                                        : '* Use status action buttons above to change document status.'
                                    }
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
                </div>
            )}
        </div>
    );
};

export default BLManagement;
