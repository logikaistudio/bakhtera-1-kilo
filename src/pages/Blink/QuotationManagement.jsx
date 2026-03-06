import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { supabase } from '../../lib/supabase';
import { generateQuotationNumber } from '../../utils/documentNumbers';
import Button from '../../components/Common/Button';
import Modal from '../../components/Common/Modal';
import ServiceItemManager from '../../components/Common/ServiceItemManager';
import PartnerPicker from '../../components/Common/PartnerPicker';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
    User, DollarSign, Calendar, MapPin, Package, Ship, Plane, Truck, FileText, X,
    CheckCircle, Clock, XCircle, Send, ArrowRight, TrendingUp, Users, Eye, Edit,
    Plus, Check, Filter, Download, Search, Trash, Circle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const QuotationManagement = () => {
    const { canCreate, canEdit, canDelete, canView, canApprove } = useAuth();
    const navigate = useNavigate();
    const { customers, companySettings } = useData();
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingQuotation, setViewingQuotation] = useState(null);
    const [isEditingQuotation, setIsEditingQuotation] = useState(false);
    const [editedQuotation, setEditedQuotation] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [quotations, setQuotations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPrintPreview, setShowPrintPreview] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        partnerId: '', // Changed from customerId
        customerName: '',
        customerCompany: '',
        customerAddress: '',
        salesPerson: '',
        quotationType: 'RG', // Regular by default
        quotationDate: new Date().toISOString().split('T')[0], // Today's date
        origin: '',
        destination: '',
        serviceType: 'sea',
        cargoType: '',
        weight: '',
        volume: '',
        grossWeight: '',
        netWeight: '',
        measure: '',
        commodity: '',
        currency: 'USD',
        totalAmount: '',
        validityDays: 30,
        notes: '',
        validityDays: 30,
        notes: '',
        incoterm: '',
        paymentTerms: 'Net 30 Days',
        packageType: '',
        quantity: '',
        customerContact: '',
        customerEmail: '',
        customerPhone: '',
        serviceItems: [],
        termsConditions: `1. All rates are subject to change without prior notice.
2. Payment terms: Net 30 Days.
3. Subject to space and equipment availability.
4. Standard Trading Conditions apply.`
    });

    const statusConfig = {
        draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400', icon: FileText },
        manager_approval: { label: 'Manager Approval', color: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
        sent: { label: 'Sent', color: 'bg-purple-500/20 text-purple-400', icon: Send },
        revision_requested: { label: 'Revision Requested', color: 'bg-orange-500/20 text-orange-400', icon: Edit },
        approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400', icon: Check },
        rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400', icon: X },
        converted: { label: 'SO Created', color: 'bg-emerald-500/20 text-emerald-400', icon: Check },
    };

    const serviceTypeIcons = {
        sea: Ship,
        air: Plane,
        land: Truck
    };

    // Fetch quotations from Supabase on mount
    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_quotations')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Map snake_case to camelCase for UI
            const mapped = (data || []).map(q => ({
                ...q,
                jobNumber: q.job_number || q.jobNumber,
                quotationNumber: q.quotation_number || q.quotationNumber,
                customerName: q.customer_name || q.customerName || '',
                customerCompany: q.customer_company || q.customerCompany || '',
                customerId: q.partner_id || null,
                customerAddress: q.customer_address || q.customerAddress || '',
                salesPerson: q.sales_person || q.salesPerson || '',
                quotationType: q.quotation_type || q.quotationType || 'RG',
                quotationDate: q.quotation_date || q.quotationDate,
                validUntil: q.valid_until || q.validUntil,
                serviceType: q.service_type || q.serviceType,
                cargoType: q.cargo_type || q.cargoType,
                totalAmount: q.total_amount || q.totalAmount || 0,
                serviceItems: q.service_items || q.serviceItems || [],
                rejectionReason: q.rejection_reason || q.rejectionReason,
                createdAt: q.created_at || q.createdAt,
                updatedAt: q.updated_at || q.updatedAt,
                currency: q.currency || 'USD',
                status: q.status || 'draft',
                grossWeight: q.gross_weight || q.grossWeight,
                netWeight: q.net_weight || q.netWeight,
                netWeight: q.net_weight || q.netWeight,
                netWeight: q.net_weight || q.netWeight,
                measure: q.measure || q.measure,
                incoterm: q.incoterm,
                paymentTerms: q.payment_terms || 'Net 30 Days',
                packageType: q.package_type,
                quantity: q.quantity,
                customerContact: q.customer_contact_name,
                customerEmail: q.customer_email,
                customerPhone: q.customer_phone,
                termsConditions: q.terms_and_conditions || `1. All rates are subject to change without prior notice.
2. Payment terms: Net 30 Days.
3. Subject to space and equipment availability.
4. Standard Trading Conditions apply.`
            }));

            console.log('✅ Mapped', mapped.length, 'quotations');
            setQuotations(mapped);
        } catch (error) {
            console.error('Error fetching quotations:', error);
            alert('Failed to load quotations from database');
        } finally {
            setLoading(false);
        }
    };

    // Auto-populate customer data when partner selected
    const handlePartnerChange = (partnerId) => {
        setFormData(prev => ({
            ...prev,
            partnerId: partnerId
        }));
    };

    // Callback when partner data is loaded from picker
    const handlePartnerLoad = (partner) => {
        if (partner) {
            setFormData(prev => ({
                ...prev,
                customerName: partner.partner_name,
                customerCompany: partner.partner_name, // Or separate field if exists
                customerAddress: `${partner.address_line1 || ''} ${partner.address_line2 || ''} ${partner.city || ''} ${partner.country || ''}`.trim(),
                customerContact: partner.contact_person || '',
                customerEmail: partner.email || '',
                customerPhone: partner.phone || ''
            }));
        }
    };

    const handleSubmit = async (e, status = 'draft') => {
        e.preventDefault();
        if (!canCreate('blink_quotations')) {
            alert('You do not have permission to create Quotation.');
            return;
        }

        // Generate Job Number using centralized generator - Format: BLKYYMM-XXXX
        const jobNumber = await generateQuotationNumber();

        // Calculate validity date
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + parseInt(formData.validityDays));

        const newQuotation = {
            job_number: jobNumber,
            quotation_number: jobNumber,
            customer_name: formData.customerName,
            customer_company: formData.customerCompany,
            partner_id: formData.partnerId || null, // Link to business partner

            customer_address: formData.customerAddress,
            sales_person: formData.salesPerson,
            quotation_type: formData.quotationType,
            quotation_date: formData.quotationDate,
            valid_until: validUntil.toISOString().split('T')[0],
            origin: formData.origin,
            destination: formData.destination,
            service_type: formData.serviceType,
            cargo_type: formData.cargoType,
            // Automatically set legacy weight to grossWeight if provided
            weight: formData.grossWeight ? parseFloat(formData.grossWeight) : (formData.weight ? parseFloat(formData.weight) : null),
            volume: formData.volume ? parseFloat(formData.volume) : null,
            gross_weight: formData.grossWeight ? parseFloat(formData.grossWeight) : null,
            net_weight: formData.netWeight ? parseFloat(formData.netWeight) : null,
            measure: formData.measure ? parseFloat(formData.measure) : null,
            commodity: formData.commodity,
            currency: formData.currency,
            total_amount: formData.totalAmount ? parseInt(formData.totalAmount.toString().replace(/\./g, '')) : 0,
            status: status,
            notes: formData.notes,
            service_items: formData.serviceItems,
            terms_and_conditions: formData.termsConditions,
            incoterm: formData.incoterm,
            payment_terms: formData.paymentTerms,
            package_type: formData.packageType,
            quantity: formData.quantity ? parseFloat(formData.quantity) : null,
            customer_contact_name: formData.customerContact,
            customer_email: formData.customerEmail,
            customer_phone: formData.customerPhone
        };

        try {
            const { data, error } = await supabase
                .from('blink_quotations')
                .insert([newQuotation])
                .select();

            if (error) throw error;

            // Refresh quotations list
            await fetchQuotations();

            setShowModal(false);
            resetForm();

            const message = status === 'draft'
                ? `Job Number ${jobNumber} saved as draft!`
                : `Job Number ${jobNumber} created and sent for Finance approval!`;
            alert(message + '\nThis will be the reference for SO, Shipment, and BL/AWB.');
        } catch (error) {
            console.error('Error creating quotation:', error);
            alert('Failed to create quotation: ' + error.message);
        }
    };

    // Finance approval handlers


    const handleManagerReject = async (quotationId, reason) => {
        if (!canApprove('blink_quotations')) {
            alert('You do not have permission to reject Quotation.');
            return;
        }
        const rejectionReason = prompt('Reject reason (optional):');
        try {
            const { error } = await supabase
                .from('blink_quotations')
                .update({
                    status: 'rejected',
                    rejection_reason: rejectionReason
                })
                .eq('id', quotationId);

            if (error) throw error;

            await fetchQuotations();
            alert('❌ Quotation rejected. Sales needs revision.');
            setShowViewModal(false);
        } catch (error) {
            console.error('Error rejecting quotation:', error);
            alert('Failed to reject quotation: ' + error.message);
        }
    };

    // Handle edit quotation
    const handleEditQuotation = () => {
        if (!canEdit('blink_quotations')) {
            alert('You do not have permission to edit Quotation.');
            return;
        }
        setEditedQuotation({ ...viewingQuotation });
        setIsEditingQuotation(true);
    };

    const handleSaveEditedQuotation = async () => {
        try {
            // Calculate total from service items if available
            const total = editedQuotation.serviceItems?.reduce((sum, item) =>
                sum + (parseFloat(item.amount) || 0), 0) || editedQuotation.totalAmount;

            // Update in Supabase
            const { error } = await supabase
                .from('blink_quotations')
                .update({
                    // Customer info
                    customer_name: editedQuotation.customerName,
                    customer_address: editedQuotation.customerAddress,
                    customer_contact_name: editedQuotation.customerContact,
                    customer_email: editedQuotation.customerEmail,
                    customer_phone: editedQuotation.customerPhone,
                    sales_person: editedQuotation.salesPerson,

                    // Route & Service
                    origin: editedQuotation.origin,
                    destination: editedQuotation.destination,
                    service_type: editedQuotation.serviceType,
                    cargo_type: editedQuotation.cargoType,
                    commodity: editedQuotation.commodity,

                    // Cargo details
                    volume: editedQuotation.volume ? parseFloat(editedQuotation.volume) : null,
                    gross_weight: editedQuotation.grossWeight ? parseFloat(editedQuotation.grossWeight) : null,
                    net_weight: editedQuotation.netWeight ? parseFloat(editedQuotation.netWeight) : null,
                    measure: editedQuotation.measure ? parseFloat(editedQuotation.measure) : null,

                    // Pricing
                    total_amount: total,
                    service_items: editedQuotation.serviceItems || [],

                    // Additional details
                    incoterm: editedQuotation.incoterm,
                    payment_terms: editedQuotation.paymentTerms,
                    package_type: editedQuotation.packageType,
                    quantity: editedQuotation.quantity ? parseFloat(editedQuotation.quantity) : null,

                    // Notes
                    notes: editedQuotation.notes,
                    terms_and_conditions: editedQuotation.termsConditions
                })
                .eq('id', editedQuotation.id);

            if (error) throw error;

            // Refresh list
            await fetchQuotations();
            setViewingQuotation(editedQuotation);
            setIsEditingQuotation(false);
            alert('✅ Quotation updated successfully!');
        } catch (error) {
            console.error('Error updating quotation:', error);
            alert('Failed to update: ' + error.message);
        }
    };

    const handleCancelEdit = () => {
        setEditedQuotation(null);
        setIsEditingQuotation(false);
    };

    const resetForm = () => {
        setFormData({
            partnerId: '',
            customerName: '',
            customerCompany: '',
            customerAddress: '',
            salesPerson: '',
            quotationType: 'RG',
            quotationDate: new Date().toISOString().split('T')[0],
            origin: '',
            destination: '',
            serviceType: 'sea',
            cargoType: '',
            weight: '',
            volume: '',
            grossWeight: '',
            netWeight: '',
            measure: '',
            commodity: '',
            currency: 'USD',
            totalAmount: '',
            validityDays: 30,
            notes: '',
            serviceItems: [],
            termsConditions: `1. All rates are subject to change without prior notice.
2. Payment terms: Net 30 Days.
3. Subject to space and equipment availability.
4. Standard Trading Conditions apply.`
        });
    };

    // View quotation detail
    const handleViewQuotation = (quotation) => {
        setViewingQuotation(quotation);
        setShowViewModal(true);
    };

    // Delete quotation
    const handleDeleteQuotation = async (quotationId) => {
        if (!canDelete('blink_quotations')) {
            alert('You do not have permission to delete Quotation.');
            return;
        }
        try {
            // First, get quotation details to show what will be deleted
            const quotation = quotations.find(q => q.id === quotationId);

            // Fetch related data counts
            const { data: relatedShipments } = await supabase
                .from('blink_shipments')
                .select('*')
                .eq('quotation_id', quotationId);

            const { data: relatedInvoices } = await supabase
                .from('blink_invoices')
                .select('*')
                .eq('quotation_id', quotationId);

            // Build confirmation message
            let confirmMessage = `Are you sure you want to delete quotation ${quotation?.jobNumber || 'this'}?\n\n`;
            confirmMessage += `Data that will be deleted:\n`;
            confirmMessage += `- 1 Quotation\n`;

            if (relatedShipments && relatedShipments.length > 0) {
                confirmMessage += `- ${relatedShipments.length} Shipment(s)\n`;
            }

            if (relatedInvoices && relatedInvoices.length > 0) {
                confirmMessage += `- ${relatedInvoices.length} Invoice(s)\n`;
            }

            confirmMessage += `\n⚠️ This action cannot be undone!`;

            if (!confirm(confirmMessage)) {
                return;
            }

            // Extra confirmation for converted quotations
            if (quotation?.status === 'converted' && (relatedShipments?.length > 0 || relatedInvoices?.length > 0)) {
                if (!confirm('This Quotation is already converted to SO with active shipment/invoice. Are you sure you want to continue?')) {
                    return;
                }
            }

            console.log('🗑️ Starting cascade delete for quotation:', quotationId);

            // Step 1: Delete related invoices
            if (relatedInvoices && relatedInvoices.length > 0) {
                console.log(`Deleting ${relatedInvoices.length} related invoice(s)...`);
                const { error: invoiceError } = await supabase
                    .from('blink_invoices')
                    .delete()
                    .eq('quotation_id', quotationId);

                if (invoiceError) {
                    throw new Error(`Failed to delete invoices: ${invoiceError.message}`);
                }
                console.log('✅ Invoices deleted');
            }

            // Step 2: Delete related shipments
            if (relatedShipments && relatedShipments.length > 0) {
                console.log(`Deleting ${relatedShipments.length} related shipment(s)...`);
                const { error: shipmentError } = await supabase
                    .from('blink_shipments')
                    .delete()
                    .eq('quotation_id', quotationId);

                if (shipmentError) {
                    throw new Error(`Failed to delete shipments: ${shipmentError.message}`);
                }
                console.log('✅ Shipments deleted');
            }

            // Step 3: Delete the quotation itself
            console.log('Deleting quotation...');
            const { error: quotationError } = await supabase
                .from('blink_quotations')
                .delete()
                .eq('id', quotationId);

            if (quotationError) throw quotationError;

            console.log('✅ Quotation deleted successfully');

            // Refresh quotations list
            await fetchQuotations();

            // Success message with details
            let successMsg = '✅ Successfully deleted:\n';
            successMsg += `- 1 Quotation\n`;
            if (relatedShipments?.length > 0) successMsg += `- ${relatedShipments.length} Shipment(s)\n`;
            if (relatedInvoices?.length > 0) successMsg += `- ${relatedInvoices.length} Invoice(s)\n`;

            alert(successMsg);
            setShowViewModal(false);
        } catch (error) {
            console.error('❌ Error deleting quotation:', error);
            alert('❌ Failed to delete quotation: ' + error.message);
        }
    };

    // Request revision from customer
    const handleRequestRevision = async (quotationId) => {
        if (!canEdit('blink_quotations')) {
            alert('Anda tidak memiliki hak akses untuk meminta revisi.');
            return;
        }
        const reason = prompt('Revision reason from customer:');
        if (!reason || reason.trim() === '') {
            alert('Revision reason is required');
            return;
        }

        try {
            const { error } = await supabase
                .from('blink_quotations')
                .update({
                    status: 'revision_requested',
                    revision_reason: reason.trim()
                })
                .eq('id', quotationId);

            if (error) throw error;

            await fetchQuotations();
            alert('✅ Revision request created. Sales can now create a revised quotation.');
            setShowViewModal(false);
        } catch (error) {
            console.error('Error requesting revision:', error);
            alert('❌ Failed to request revision: ' + error.message);
        }
    };

    // Create revision (new version) of quotation
    const handleCreateRevision = async (quotationId) => {
        if (!canCreate('blink_quotations')) {
            alert('You do not have permission to create Quotation revision.');
            return;
        }
        try {
            const parentQuotation = quotations.find(q => q.id === quotationId);
            if (!parentQuotation) {
                alert('Quotation not found');
                return;
            }

            const nextRevisionNumber = (parentQuotation.revision_number || 1) + 1;

            const revisedQuotation = {
                job_number: parentQuotation.jobNumber,
                quotation_number: parentQuotation.quotationNumber,

                customer_name: parentQuotation.customerName,
                customer_company: parentQuotation.customerCompany,
                customer_address: parentQuotation.customerAddress,
                sales_person: parentQuotation.salesPerson,
                quotation_type: parentQuotation.quotationType,
                quotation_date: new Date().toISOString().split('T')[0],
                origin: parentQuotation.origin,
                destination: parentQuotation.destination,
                service_type: parentQuotation.serviceType,
                cargo_type: parentQuotation.cargoType,
                weight: parentQuotation.weight,
                volume: parentQuotation.volume,
                commodity: parentQuotation.commodity,
                currency: parentQuotation.currency,
                total_amount: parentQuotation.totalAmount,
                validity_days: parentQuotation.validityDays || 30,
                notes: parentQuotation.notes,
                service_items: parentQuotation.serviceItems,
                revision_number: nextRevisionNumber,
                parent_quotation_id: parentQuotation.parent_quotation_id || parentQuotation.id,
                revision_reason: parentQuotation.revision_reason,
                revised_at: new Date().toISOString(),
                revised_by: 'Current User',
                status: 'manager_approval',
                is_superseded: false
            };

            const { data: newRevision, error: createError } = await supabase
                .from('blink_quotations')
                .insert([revisedQuotation])
                .select()
                .single();

            if (createError) throw createError;

            const { error: updateError } = await supabase
                .from('blink_quotations')
                .update({
                    is_superseded: true,
                    superseded_by_id: newRevision.id
                })
                .eq('id', quotationId);

            if (updateError) throw updateError;

            await fetchQuotations();
            alert(`✅ Revision Rev ${nextRevisionNumber} created!\n\nStatus: Waiting manager approval\nJob Number: ${parentQuotation.jobNumber} Rev ${nextRevisionNumber}`);
            setShowViewModal(false);
        } catch (error) {
            console.error('❌ Error creating revision:', error);
            alert('❌ Failed to create revision: ' + error.message);
        }
    };

    // Update quotation status
    const handleUpdateStatus = async (quotationId, newStatus) => {
        if (!canApprove('blink_quotations')) {
            alert('You do not have permission to change Quotation status (Approve).');
            return;
        }
        try {
            const { error } = await supabase
                .from('blink_quotations')
                .update({ status: newStatus })
                .eq('id', quotationId);

            if (error) throw error;

            await fetchQuotations();
            alert(`Status updated to: ${newStatus}`);
            setShowViewModal(false);
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    // Print quotation handler
    const handlePrintQuotation = (quotation) => {
        try {
            const printWindow = window.open('', '_blank');

            if (!printWindow) {
                alert('Pop-up blocked! Please allow pop-ups for this site.');
                return;
            }

            const formatCurrency = (value, currency = 'IDR') => {
                return currency === 'USD'
                    ? `$${(value || 0).toLocaleString('id-ID')}`
                    : `Rp ${(value || 0).toLocaleString('id-ID')}`;
            };

            const items = quotation.serviceItems || quotation.service_items || [];
            const itemsRows = items.map((item, index) => `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${item.name || item.description}</td>
                    <td style="text-align: center;">${item.quantity || 1}</td>
                    <td style="text-align: center;">${item.unit || 'Job'}</td>
                    <td style="text-align: right;">${formatCurrency(item.unitPrice || item.price, quotation.currency)}</td>
                    <td style="text-align: right;">${formatCurrency(item.total || ((item.quantity || 1) * (item.unitPrice || 0)), quotation.currency)}</td>
                </tr>
            `).join('');

            const termsLines = (quotation.termsConditions || `1. All rates are subject to change without prior notice.
2. Payment terms: Net 30 Days.
3. Subject to space and equipment availability.
4. Standard Trading Conditions apply.`).split('\n').map(line => `<li>${line.replace(/^\d+\.\s*/, '')}</li>`).join('');

            const content = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Quotation - ${quotation.quotationNumber || quotation.quotation_number}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 12px; }
                        .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                        .title { font-size: 24px; font-weight: bold; color: #333; }
                        .company-info { margin-bottom: 30px; }
                        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
                        .section { background: #f9f9f9; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th, td { padding: 10px; border-bottom: 1px solid #ddd; }
                        th { text-align: left; background: #333; color: white; }
                        .total-row { text-align: right; background: #333; color: white; padding: 10px; font-weight: bold; font-size: 14px; }
                        .footer { margin-top: 50px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 20px; }
                    </style>
                </head>
                <body>
                     <div class="header">
                        <div>
                            <div class="title">QUOTATION</div>
                            <div style="margin-top: 5px; font-size: 16px;">${quotation.quotationNumber || quotation.quotation_number}</div>
                        </div>
                        <div style="text-align: right;">
                            <div>Date: ${new Date(quotation.quotationDate || quotation.created_at).toLocaleDateString('id-ID')}</div>
                        </div>
                    </div>

                    <div class="grid-2">
                         <div>
                            <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555;">FROM:</h3>
                            <div style="font-weight: bold;">${companySettings?.company_name || 'PT Bakhtera Satu Indonesia'}</div>
                            <div>${(companySettings?.company_address || 'Jakarta, Indonesia').replace(/\n/g, '<br/>')}</div>
                            ${companySettings?.company_phone ? `<div>Tel: ${companySettings.company_phone}</div>` : ''}
                            ${companySettings?.company_email ? `<div>Email: ${companySettings.company_email}</div>` : ''}
                        </div>
                        <div>
                            <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555;">TO:</h3>
                            <div style="font-weight: bold;">${quotation.customerName || quotation.customer_name}</div>
                            <div>${quotation.customerCompany || quotation.customer_company || ''}</div>
                            <div>${quotation.customerAddress || quotation.customer_address || ''}</div>
                             ${(quotation.salesPerson || quotation.sales_person) ? `<div>Attn: ${quotation.salesPerson || quotation.sales_person}</div>` : ''}
                        </div>
                    </div>

                    <div class="section">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                            <div><strong>Service:</strong> ${(quotation.serviceType || quotation.service_type || '-').toUpperCase()}</div>
                            <div><strong>Route:</strong> ${quotation.origin || '-'} → ${quotation.destination || '-'}</div>
                            <div><strong>Commodity:</strong> ${quotation.commodity || '-'}</div>
                            <div><strong>Validity:</strong> ${quotation.validityDays || 30} Days</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50px; text-align: center;">No</th>
                                <th>Description</th>
                                <th style="width: 80px; text-align: center;">Qty</th>
                                <th style="width: 80px; text-align: center;">Unit</th>
                                <th style="width: 120px; text-align: right;">Unit Price</th>
                                <th style="width: 120px; text-align: right;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsRows}
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: flex-end;">
                        <div style="background: #333; color: white; padding: 10px 20px; border-radius: 4px; display: inline-flex; gap: 20px;">
                            <span>TOTAL ESTIMATED:</span>
                            <span style="font-weight: bold;">${formatCurrency(quotation.totalAmount || quotation.total_amount, quotation.currency)}</span>
                        </div>
                    </div>

                    <div style="margin-top: 40px; border-top: 1px solid #ddd; padding-top: 20px;">
                        <h4 style="font-size: 12px; font-weight: bold; margin-bottom: 10px;">TERMS & CONDITIONS:</h4>
                        <ol style="padding-left: 20px; margin: 0; line-height: 1.5;">
                            ${termsLines}
                        </ol>
                    </div>

                    <div class="footer">
                        Thank you for your business inquiry!
                    </div>
                    
                    <script>
                        window.print();
                    </script>
                </body>
                </html>
            `;

            printWindow.document.write(content);
            printWindow.document.close();
        } catch (error) {
            console.error('Print error:', error);
            alert('Failed to print');
        }
    };

    // Create SO from approved quotation
    const handleCreateSO = async (quotation) => { // Added async
        if (!canCreate('blink_shipments') || !canEdit('blink_quotations')) {
            alert('You do not have permission (Create Shipment / Edit Quotation) to convert to Sales Order.');
            return;
        }
        console.log('🔵 Create SO clicked for quotation:', quotation.id);
        // Generate SO Number using centralized generator - Format: BLKYYMM-SO-XXXX
        const { generateSONumber } = await import('../../utils/documentNumbers');
        const soNumber = generateSONumber(quotation.jobNumber || quotation.quotationNumber);
        console.log('📝 Generated SO Number:', soNumber);

        // Auto-create Shipment in Operations
        const newShipment = {
            jobNumber: quotation.jobNumber, // Already mapped to camelCase
            soNumber: soNumber,
            customer: quotation.customerName, // Already mapped
            salesPerson: quotation.salesPerson, // Already mapped
            quotationType: quotation.quotationType || 'RG',
            quotationDate: quotation.quotationDate,
            origin: quotation.origin,
            destination: quotation.destination,
            serviceType: quotation.serviceType,
            cargoType: quotation.cargoType,
            weight: quotation.weight,
            volume: quotation.volume,
            commodity: quotation.commodity,
            quotedAmount: quotation.totalAmount || 0, // Already mapped
            status: 'pending',
            createdAt: new Date().toISOString().split('T')[0],
            createdFrom: 'sales_order'
        };

        // Save shipment to Supabase FIRST, then update quotation status on success
        try {
            // Determine BL type based on service type
            const isAirFreight = (quotation.serviceType || '').toLowerCase() === 'air';
            const blType = isAirFreight ? 'AWB' : 'MBL';
            const blPrefix = isAirFreight ? 'AWB' : 'BL';
            const blNumber = `${blPrefix}-${soNumber}`;

            const { data: shipmentData, error } = await supabase
                .from('blink_shipments')
                .insert([{
                    job_number: newShipment.jobNumber,
                    so_number: newShipment.soNumber,
                    quotation_id: quotation.id,
                    customer: newShipment.customer,
                    sales_person: newShipment.salesPerson,
                    quotation_type: newShipment.quotationType,
                    quotation_date: newShipment.quotationDate,
                    origin: newShipment.origin,
                    destination: newShipment.destination,
                    service_type: newShipment.serviceType,
                    cargo_type: newShipment.cargoType,
                    weight: newShipment.weight,
                    volume: newShipment.volume,
                    commodity: newShipment.commodity,
                    quoted_amount: newShipment.quotedAmount,
                    currency: quotation.currency || 'USD',
                    status: newShipment.status,
                    created_from: 'sales_order',

                    service_items: quotation.serviceItems || [],
                    notes: quotation.notes || '',
                    gross_weight: quotation.grossWeight || null,
                    net_weight: quotation.netWeight || null,
                    measure: quotation.measure || null,
                    selling_items: quotation.serviceItems || [],
                    // === AUTO-CREATE BL/AWB DRAFT ===
                    bl_number: blNumber,
                    bl_type: blType,
                    bl_status: 'draft',
                    bl_subject: `${quotation.serviceType?.toUpperCase() || 'SEA'} Freight - ${quotation.origin} to ${quotation.destination}`,
                    bl_shipper_name: quotation.customerName || quotation.customer_name || '',
                    bl_consignee_name: quotation.consigneeName || '',
                    bl_place_of_receipt: quotation.origin || '',
                    bl_place_of_delivery: quotation.destination || '',
                    bl_description_packages: quotation.commodity || '',
                    bl_gross_weight_text: quotation.weight ? `${quotation.weight} KGS` : '',
                    bl_measurement_text: quotation.volume ? `${quotation.volume} CBM` : '',
                    bl_export_references: `SO: ${soNumber}\nJOB: ${quotation.jobNumber}`,
                }])
                .select();

            if (error) throw error;

            // ✅ Only update quotation status AFTER shipment is successfully created
            const { error: updateError } = await supabase
                .from('blink_quotations')
                .update({ status: 'converted', updated_at: new Date().toISOString() })
                .eq('id', quotation.id);
            if (updateError) console.error('Warning: status update failed after SO creation:', updateError);

            await fetchQuotations();
            setShowViewModal(false);

            const docLabel = isAirFreight ? 'AWB' : 'BL';
            alert(`✅ Sales Order ${soNumber} created!\n\n📦 Shipment auto-created with Job Number: ${quotation.jobNumber}\n📄 Draft ${docLabel} (${blNumber}) auto-generated\n\n➡️ Navigating to Operations...`);

            // Navigate to shipments page
            setTimeout(() => {
                navigate('/blink/shipments');
            }, 1000);

        } catch (error) {
            console.error('Error creating shipment:', error);
            alert('Failed to create SO: ' + error.message);
        }
    };

    const filteredQuotations = quotations.filter(q => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            q.jobNumber?.toLowerCase().includes(search) ||
            q.customerName?.toLowerCase().includes(search) ||
            q.customerCompany?.toLowerCase().includes(search) ||
            q.origin?.toLowerCase().includes(search) ||
            q.destination?.toLowerCase().includes(search)
        );
    });

    // Only show active customers
    const activeCustomers = customers.filter(c => c.status === 'active');

    const handleExportXLS = () => {
        import('../../utils/exportXLS').then(({ exportToXLS }) => {
            const headerRows = [
                { value: companySettings?.company_name || 'PT Bakhtera Satu Indonesia', style: 'company' },
                { value: 'QUOTATION REPORT', style: 'title' },
                { value: `Report Date: ${new Date().toLocaleDateString('id-ID')}`, style: 'normal' },
                '' // Empty row for gap
            ];

            const xlsColumns = [
                { header: 'No', key: 'no', width: 5, align: 'center' },
                { header: 'Job Number', key: 'jobNumber', width: 20 },
                { header: 'Customer', key: 'customerName', width: 25 },
                { header: 'Route', render: (item) => `${item.origin || '-'} -> ${item.destination || '-'}`, width: 30 },
                { header: 'Service', key: 'serviceType', width: 15 },
                {
                    header: 'Amount',
                    key: 'totalAmount',
                    width: 20,
                    align: 'right',
                    render: (item) => `${item.currency || 'USD'} ${item.totalAmount?.toLocaleString('id-ID') || 0}`
                },
                { header: 'Valid Until', key: 'validUntil', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            exportToXLS(filteredQuotations, 'Quotation_Report', headerRows, xlsColumns);
        }).catch(err => console.error("Failed to load export utility", err));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold gradient-text">Operations Quotation</h1>
                    <p className="text-silver-dark mt-1">Manage operational quotations</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button onClick={handleExportXLS} variant="secondary" icon={Download}>
                        Export XLS
                    </Button>
                    {canCreate('blink_quotations') && (
                        <Button onClick={() => setShowModal(true)} icon={Plus}>
                            New Quotation
                        </Button>
                    )}
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-silver-dark" />
                <input
                    type="text"
                    placeholder="Search Job Number, Customer, or Route..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-dark-surface border border-dark-border rounded-lg text-silver-light focus:outline-none focus:border-accent-orange smooth-transition"
                />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Total Quotations</p>
                            <p className="text-2xl font-bold text-silver-light mt-1">{quotations.length}</p>
                        </div>
                        <FileText className="w-8 h-8 text-blue-400" />
                    </div>
                </div>
                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Manager Approval</p>
                            <p className="text-2xl font-bold text-yellow-400 mt-1">
                                {quotations.filter(q => q.status === 'manager_approval').length}
                            </p>
                        </div>
                        <Clock className="w-8 h-8 text-yellow-400" />
                    </div>
                </div>

                <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-silver-dark">Converted to SO</p>
                            <p className="text-2xl font-bold text-emerald-400 mt-1">
                                {quotations.filter(q => q.status === 'converted').length}
                            </p>
                        </div>
                        <Check className="w-8 h-8 text-emerald-400" />
                    </div>
                </div>
            </div>

            {/* Quotations Table */}
            <div className="glass-card rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-accent-orange">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Job Number</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Customer</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Route</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Service</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Amount</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Valid Until</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {filteredQuotations.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-12 text-center">
                                        <FileText className="w-12 h-12 text-silver-dark mx-auto mb-3" />
                                        <p className="text-silver-dark">
                                            {searchTerm
                                                ? `No quotation matches the search for "${searchTerm}"`
                                                : 'No quotation yet. Click "New Quotation" to start.'
                                            }
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredQuotations.map((quote) => {
                                    const StatusIcon = statusConfig[quote.status]?.icon || FileText;
                                    const ServiceIcon = serviceTypeIcons[quote.serviceType] || Ship;
                                    return (
                                        <tr
                                            key={quote.id}
                                            onClick={() => handleViewQuotation(quote)}
                                            className="hover:bg-dark-surface smooth-transition cursor-pointer"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-accent-orange">{quote.jobNumber}</span>
                                                    {quote.revision_number > 1 && (
                                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
                                                            Rev {quote.revision_number}
                                                        </span>
                                                    )}
                                                    {quote.is_superseded && (
                                                        <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded">
                                                            Superseded
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-silver-dark" />
                                                    <div>
                                                        <div className="text-silver-light font-medium">{quote.customer}</div>
                                                        {quote.customerCompany && (
                                                            <div className="text-xs text-silver-dark">{quote.customerCompany}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-silver-dark" />
                                                    <span className="text-silver-light text-sm">
                                                        {quote.origin} → {quote.destination}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <ServiceIcon className="w-4 h-4 text-silver-dark" />
                                                    <span className="text-silver-light capitalize">{quote.serviceType}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-silver-light">
                                                    {quote.currency === 'USD'
                                                        ? `$${(quote.totalAmount || quote.total_amount || 0).toLocaleString('id-ID')}`
                                                        : `Rp ${(quote.totalAmount || quote.total_amount || 0).toLocaleString('id-ID')}`
                                                    }
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-silver-dark text-sm">{quote.validUntil || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {(() => {
                                                    const config = statusConfig[quote.status];
                                                    const StatusIcon = config?.icon || Circle;
                                                    const isPending = quote.status === 'pending_approval';

                                                    return (
                                                        <div className="relative inline-flex">
                                                            <div className={`
                                                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                                                ${config?.color}
                                                                border border-current/30
                                                                smooth-transition
                                                                hover:scale-105 hover:shadow-md hover:border-current/50
                                                                cursor-pointer
                                                            `}>
                                                                <StatusIcon className="w-3.5 h-3.5" />
                                                                <span className="text-xs font-semibold">
                                                                    {config?.label}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </td>

                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for New Quotation */}
            <Modal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    resetForm();
                }}
                title="New Quotation"
                size="large"
            >
                <form onSubmit={(e) => handleSubmit(e, 'draft')} className="space-y-6">


                    {/* Customer Selection - using PartnerPicker */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Customer <span className="text-red-400">*</span>
                        </label>
                        <PartnerPicker
                            value={formData.partnerId}
                            onChange={handlePartnerChange}
                            onPartnerLoad={handlePartnerLoad}
                            roleFilter="customer"
                            placeholder="Select Customer..."
                            required={true}
                            theme="light"
                        />
                        {formData.customerAddress && (
                            <p className="text-xs text-silver-dark mt-1">
                                📍 {formData.customerAddress}
                            </p>
                        )}
                    </div>

                    {/* Person in Charge Dropdown */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Person in Charge <span className="text-red-400">*</span>
                        </label>
                        <select
                            required
                            value={formData.salesPerson}
                            onChange={(e) => setFormData({ ...formData, salesPerson: e.target.value })}
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                        >
                            <option value="">Select Person in Charge...</option>
                            <option value="Operations">Operations</option>
                            <option value="John Doe">John Doe</option>
                            <option value="Jane Smith">Jane Smith</option>
                            <option value="Bob Johnson">Bob Johnson</option>
                        </select>
                    </div>

                    {/* Quotation Type & Date */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quotation Type <span className="text-red-400">*</span>
                            </label>
                            <select
                                required
                                value={formData.quotationType}
                                onChange={(e) => setFormData({ ...formData, quotationType: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            >
                                <option value="RG">Regular (RG)</option>
                                <option value="PJ">Project (PJ)</option>
                                <option value="EV">Event (EV)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quotation Date <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.quotationDate}
                                onChange={(e) => setFormData({ ...formData, quotationDate: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                    </div>

                    {/* Route Information */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Origin <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.origin}
                                onChange={(e) => setFormData({ ...formData, origin: e.target.value })}
                                placeholder="e.g., Jakarta"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Destination <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.destination}
                                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                                placeholder="e.g., Singapore"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                    </div>

                    {/* Service Type & Cargo Info */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Service Type <span className="text-red-400">*</span>
                            </label>
                            <select
                                required
                                value={formData.serviceType}
                                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            >
                                <option value="sea">Sea Freight</option>
                                <option value="air">Air Freight</option>
                                <option value="land">Land Transport</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cargo Type
                            </label>
                            <select
                                value={formData.cargoType}
                                onChange={(e) => setFormData({ ...formData, cargoType: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            >
                                <option value="">Select...</option>
                                <option value="FCL">FCL (Full Container)</option>
                                <option value="LCL">LCL (Less Container)</option>
                                <option value="General">General Cargo</option>
                                <option value="Dangerous">Dangerous Goods</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Commodity
                            </label>
                            <input
                                type="text"
                                value={formData.commodity}
                                onChange={(e) => setFormData({ ...formData, commodity: e.target.value })}
                                placeholder="e.g., Electronic"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                    </div>

                    {/* Volume (Standalone) */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Volume (CBM)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.volume}
                            onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                            placeholder="5.5"
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                        />
                    </div>

                    {/* Gross Weight, Net Weight & Measure */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Gross Weight (kgs)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.grossWeight}
                                onChange={(e) => setFormData({ ...formData, grossWeight: e.target.value })}
                                placeholder="1200"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Net Weight (kgs)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.netWeight}
                                onChange={(e) => setFormData({ ...formData, netWeight: e.target.value })}
                                placeholder="1000"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Measure (M³)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={formData.measure}
                                onChange={(e) => setFormData({ ...formData, measure: e.target.value })}
                                placeholder="5.500"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                    </div>

                    {/* Additional Shipment Details (Incoterm, Package, etc) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-white rounded-lg border border-gray-300">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Incoterm</label>
                            <input
                                type="text"
                                value={formData.incoterm}
                                onChange={(e) => setFormData({ ...formData, incoterm: e.target.value })}
                                placeholder="e.g. FOB"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms</label>
                            <input
                                type="text"
                                value={formData.paymentTerms}
                                onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                                placeholder="Net 30 Days"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Package Type</label>
                            <input
                                type="text"
                                value={formData.packageType}
                                onChange={(e) => setFormData({ ...formData, packageType: e.target.value })}
                                placeholder="e.g. Cartons"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                            <input
                                type="number"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                placeholder="100"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black text-sm"
                            />
                        </div>

                        {/* Customer Contact Details Override */}
                        <div className="col-span-2 md:col-span-4 grid grid-cols-3 gap-4 pt-2 border-t border-gray-300 mt-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Contact Person (Attn)</label>
                                <input
                                    type="text"
                                    value={formData.customerContact}
                                    onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Contact Email</label>
                                <input
                                    type="email"
                                    value={formData.customerEmail}
                                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-xs"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Contact Phone</label>
                                <input
                                    type="text"
                                    value={formData.customerPhone}
                                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Currency, Amount & Validity */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Currency
                            </label>
                            <select
                                value={formData.currency}
                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            >
                                <option value="USD">USD</option>
                                <option value="IDR">IDR</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Total Amount
                            </label>
                            <input
                                type="text"
                                value={formData.totalAmount ? parseInt(formData.totalAmount.toString().replace(/\./g, '')).toLocaleString('id-ID') : ''}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\./g, '');
                                    if (value === '' || /^\d+$/.test(value)) {
                                        setFormData({ ...formData, totalAmount: value });
                                    }
                                }}
                                placeholder="0"
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Valid for (days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={formData.validityDays}
                                onChange={(e) => setFormData({ ...formData, validityDays: e.target.value })}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                            />
                        </div>
                    </div>

                    {/* Service Items / Cost Breakdown */}
                    <ServiceItemManager
                        items={formData.serviceItems}
                        onChange={(items) => {
                            setFormData({ ...formData, serviceItems: items });
                            // Auto-calculate total from service items
                            const total = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                            setFormData(prev => ({ ...prev, totalAmount: total.toString() }));
                        }}
                        currency={formData.currency}
                    />

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes / Remarks
                        </label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Additional information..."
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black"
                        />
                    </div>

                    {/* Terms & Conditions */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Terms & Conditions
                        </label>
                        <textarea
                            rows={5}
                            value={formData.termsConditions}
                            onChange={(e) => setFormData({ ...formData, termsConditions: e.target.value })}
                            placeholder="Enter terms and conditions..."
                            className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black font-mono text-xs"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setShowModal(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">
                            Save as Draft
                        </Button>
                        <Button
                            type="button"
                            onClick={(e) => handleSubmit(e, 'manager_approval')}
                        >
                            Submit for Manager Approval
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* View Quotation Detail Modal */}
            {viewingQuotation && (
                <Modal
                    isOpen={showViewModal}
                    onClose={() => setShowViewModal(false)}
                    title="" // Clear the title prop as the header is now custom
                    size="large"
                >
                    <div className="pb-4 border-b border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Quotation Details</h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    {viewingQuotation.jobNumber} | Created: {viewingQuotation.createdAt} | Valid: {viewingQuotation.validUntil}
                                </p>
                            </div>
                            <div className="flex gap-2 items-center">
                                {/* Print Actions */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    icon={Eye}
                                    onClick={() => setShowPrintPreview(true)}
                                >
                                    Preview
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    icon={FileText}
                                    onClick={() => handlePrintQuotation(viewingQuotation)}
                                >
                                    Print
                                </Button>

                                {!isEditingQuotation && (
                                    <>
                                        {canEdit('blink_quotations') && (
                                            <Button size="sm" variant="secondary" icon={Edit} onClick={handleEditQuotation}>
                                                Edit
                                            </Button>
                                        )}
                                        {canDelete('blink_quotations') && (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                icon={Trash}
                                                onClick={() => handleDeleteQuotation(viewingQuotation.id)}
                                            >
                                                Delete
                                            </Button>
                                        )}
                                    </>
                                )}
                                {isEditingQuotation && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={handleCancelEdit}>Cancel</Button>
                                        <Button size="sm" onClick={handleSaveEditedQuotation}>Save</Button>
                                    </>
                                )}
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[viewingQuotation.status]?.color}`}>
                                    {statusConfig[viewingQuotation.status]?.label}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {/* Customer & Route & Quotation Info */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Customer</p>
                                {isEditingQuotation ? (
                                    <PartnerPicker
                                        value={editedQuotation?.partnerId || editedQuotation?.customerId}
                                        onChange={(partnerId) => {
                                            setEditedQuotation(prev => ({
                                                ...prev,
                                                partnerId: partnerId,
                                                customerId: partnerId // for backward compatibility
                                            }));
                                        }}
                                        onPartnerLoad={(partner) => {
                                            if (partner) {
                                                setEditedQuotation(prev => ({
                                                    ...prev,
                                                    customerName: partner.partner_name,
                                                    customerCompany: partner.partner_name,
                                                    customerAddress: `${partner.address_line1 || ''} ${partner.address_line2 || ''} ${partner.city || ''} ${partner.country || ''}`.trim()
                                                }));
                                            }
                                        }}
                                        roleFilter="customer"
                                        placeholder="Select Customer..."
                                    />
                                ) : (
                                    <input
                                        type="text"
                                        value={viewingQuotation.customerName || viewingQuotation.customer_name || ''}
                                        readOnly
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm"
                                    />
                                )}
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Customer Address</p>
                                <input
                                    type="text"
                                    value={isEditingQuotation ? (editedQuotation?.customerAddress || '') : (viewingQuotation.customerAddress || viewingQuotation.customer_address || '')}
                                    readOnly={!isEditingQuotation}
                                    onChange={(e) => setEditedQuotation({ ...editedQuotation, customerAddress: e.target.value })}
                                    className={`w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm ${isEditingQuotation ? '' : 'bg-gray-100/50'}`}
                                />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Person in Charge</p>
                                <input
                                    type="text"
                                    value={isEditingQuotation ? (editedQuotation?.salesPerson || '') : (viewingQuotation.salesPerson || '')}
                                    onChange={(e) => setEditedQuotation({ ...editedQuotation, salesPerson: e.target.value })}
                                    disabled={!isEditingQuotation}
                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Quotation Type</p>
                                <p className="text-gray-900 font-medium">
                                    {viewingQuotation.quotationType === 'RG' && 'Regular'}
                                    {viewingQuotation.quotationType === 'PJ' && 'Project'}
                                    {viewingQuotation.quotationType === 'EV' && 'Event'}
                                    {viewingQuotation.quotationType === 'CM' && 'Event'}
                                    {!viewingQuotation.quotationType && 'Regular'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 font-medium mb-1">Quotation Date</p>
                                <p className="text-gray-900 font-medium">{viewingQuotation.quotationDate || viewingQuotation.createdAt}</p>
                            </div>
                            {/* New Fields Edit Section */}
                            {isEditingQuotation && (
                                <div className="col-span-2 md:col-span-5 grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 p-3 bg-white border border-gray-300 rounded-lg">
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Incoterm</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.incoterm || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, incoterm: e.target.value })}
                                            placeholder="FOB"
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Payment Terms</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.paymentTerms || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, paymentTerms: e.target.value })}
                                            placeholder="Net 30 Days"
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Package Type</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.packageType || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, packageType: e.target.value })}
                                            placeholder="Cartons"
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Quantity</p>
                                        <input
                                            type="number"
                                            value={editedQuotation.quantity || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, quantity: e.target.value })}
                                            placeholder="100"
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    {/* Additional Customer Details */}
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Cust. Contact (Attn)</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.customerContact || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, customerContact: e.target.value })}
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Cust. Email</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.customerEmail || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, customerEmail: e.target.value })}
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 mb-1">Cust. Phone</p>
                                        <input
                                            type="text"
                                            value={editedQuotation.customerPhone || ''}
                                            onChange={(e) => setEditedQuotation({ ...editedQuotation, customerPhone: e.target.value })}
                                            className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-black text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Route</p>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={isEditingQuotation ? (editedQuotation?.origin || '') : (viewingQuotation.origin || '')}
                                        onChange={(e) => setEditedQuotation({ ...editedQuotation, origin: e.target.value })}
                                        disabled={!isEditingQuotation}
                                        placeholder="Origin"
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                    />
                                    <span className="text-gray-400">→</span>
                                    <input
                                        type="text"
                                        value={isEditingQuotation ? (editedQuotation?.destination || '') : (viewingQuotation.destination || '')}
                                        onChange={(e) => setEditedQuotation({ ...editedQuotation, destination: e.target.value })}
                                        disabled={!isEditingQuotation}
                                        placeholder="Destination"
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <p className="text-xs text-gray-500 mb-1">Service Type</p>
                            <select
                                value={isEditingQuotation ? (editedQuotation?.serviceType || '') : (viewingQuotation.serviceType || '')}
                                onChange={(e) => setEditedQuotation({ ...editedQuotation, serviceType: e.target.value })}
                                disabled={!isEditingQuotation}
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                            >
                                <option value="sea">Sea Freight</option>
                                <option value="air">Air Freight</option>
                                <option value="land">Land Transport</option>
                            </select>
                        </div>

                        <div>
                            <p className="text-xs text-gray-500 mb-1">Cargo Type</p>
                            <select
                                value={isEditingQuotation ? (editedQuotation?.cargoType || '') : (viewingQuotation.cargoType || '')}
                                onChange={(e) => setEditedQuotation({ ...editedQuotation, cargoType: e.target.value })}
                                disabled={!isEditingQuotation}
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                            >
                                <option value="">Select...</option>
                                <option value="FCL">FCL (Full Container)</option>
                                <option value="LCL">LCL (Less Container)</option>
                                <option value="General">General Cargo</option>
                                <option value="Dangerous">Dangerous Goods</option>
                            </select>
                        </div>

                        <div>
                            <p className="text-xs text-gray-500 mb-1">Commodity</p>
                            <input
                                type="text"
                                value={isEditingQuotation ? (editedQuotation?.commodity || '') : (viewingQuotation.commodity || '')}
                                onChange={(e) => setEditedQuotation({ ...editedQuotation, commodity: e.target.value })}
                                disabled={!isEditingQuotation}
                                placeholder="e.g., Electronics"
                                className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                            />
                        </div>

                        {/* Cargo Details */}
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <h5 className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Cargo Details</h5>

                            <div className="mb-3">
                                <p className="text-xs text-gray-500 mb-1">Volume (CBM)</p>
                                <input
                                    type="number"
                                    value={isEditingQuotation ? (editedQuotation?.volume || '') : (viewingQuotation.volume || '')}
                                    onChange={(e) => setEditedQuotation({ ...editedQuotation, volume: e.target.value })}
                                    disabled={!isEditingQuotation}
                                    className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                    placeholder="-"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Gross (kg)</p>
                                    <input
                                        type="number"
                                        value={isEditingQuotation ? (editedQuotation?.grossWeight || '') : (viewingQuotation.grossWeight || '')}
                                        onChange={(e) => setEditedQuotation({ ...editedQuotation, grossWeight: e.target.value })}
                                        disabled={!isEditingQuotation}
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                        placeholder="-"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Net (kg)</p>
                                    <input
                                        type="number"
                                        value={isEditingQuotation ? (editedQuotation?.netWeight || '') : (viewingQuotation.netWeight || '')}
                                        onChange={(e) => setEditedQuotation({ ...editedQuotation, netWeight: e.target.value })}
                                        disabled={!isEditingQuotation}
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                        placeholder="-"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Measure (M³)</p>
                                    <input
                                        type="number"
                                        value={isEditingQuotation ? (editedQuotation?.measure || '') : (viewingQuotation.measure || '')}
                                        onChange={(e) => setEditedQuotation({ ...editedQuotation, measure: e.target.value })}
                                        disabled={!isEditingQuotation}
                                        className="w-full px-2 py-1 bg-white border border-gray-300 rounded text-gray-900 text-sm disabled:bg-gray-100/50"
                                        placeholder="-"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                            <p className="text-sm text-gray-500 mb-1">Estimated Amount</p>
                            <div className="text-2xl font-bold text-orange-600">
                                {viewingQuotation.currency === 'IDR' ? 'Rp ' : '$'}
                                {(isEditingQuotation
                                    ? (editedQuotation?.totalAmount || 0)
                                    : (viewingQuotation.totalAmount || viewingQuotation.total_amount || 0)
                                ).toLocaleString('id-ID')}
                            </div>
                            {isEditingQuotation && (
                                <input
                                    type="number"
                                    value={editedQuotation?.totalAmount || 0}
                                    onChange={(e) => setEditedQuotation({ ...editedQuotation, totalAmount: parseFloat(e.target.value) || 0 })}
                                    className="mt-2 w-full px-3 py-2 bg-white border border-gray-300 rounded text-gray-900 text-sm"
                                    placeholder="Enter amount"
                                />
                            )}
                        </div>

                        {/* Cost Breakdown */}
                        {(viewingQuotation.serviceItems && viewingQuotation.serviceItems.length > 0) || isEditingQuotation ? (
                            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <ServiceItemManager
                                    items={isEditingQuotation ? (editedQuotation?.serviceItems || []) : viewingQuotation.serviceItems}
                                    onChange={(items) => {
                                        if (isEditingQuotation) {
                                            setEditedQuotation({ ...editedQuotation, serviceItems: items });
                                        }
                                    }}
                                    currency={viewingQuotation.currency}
                                    readOnly={!isEditingQuotation}
                                />
                            </div>
                        ) : null}

                        {/* Terms & Conditions (View/Edit) */}
                        {/* Terms & Conditions (View/Edit) */}
                        <div className="p-4 bg-white rounded-lg border border-gray-200">
                            <h5 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Terms & Conditions</h5>
                            {isEditingQuotation ? (
                                <textarea
                                    rows={5}
                                    value={editedQuotation?.termsConditions || ''}
                                    onChange={(e) => setEditedQuotation({ ...editedQuotation, termsConditions: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black font-mono text-xs"
                                />
                            ) : (
                                <div className="text-sm text-gray-700 whitespace-pre-line pl-4 border-l-2 border-orange-200">
                                    {viewingQuotation.termsConditions}
                                </div>
                            )}
                        </div>

                        {/* Department-Specific Actions */}
                        <div className="flex justify-between gap-3 pt-4 border-t border-gray-200">
                            <div className="flex gap-2">
                                {/* Draft Actions */}
                                {viewingQuotation.status === 'draft' && !isEditingQuotation && (
                                    <>
                                        {canEdit('blink_quotations') && (
                                            <>
                                                <Button onClick={() => handleUpdateStatus(viewingQuotation.id, 'manager_approval')}>
                                                    Submit for Manager Approval
                                                </Button>
                                                <Button variant="secondary" onClick={handleEditQuotation} icon={Edit}>
                                                    Edit
                                                </Button>
                                            </>
                                        )}
                                    </>
                                )}

                                {isEditingQuotation && (
                                    <>
                                        <Button onClick={handleSaveEditedQuotation} className="bg-green-600 hover:bg-green-700 text-white">
                                            Save Changes
                                        </Button>
                                        <Button variant="secondary" onClick={handleCancelEdit}>
                                            Cancel
                                        </Button>
                                    </>
                                )}

                                {/* Manager Approval */}
                                {viewingQuotation.status === 'manager_approval' && canApprove('blink_quotations') && (
                                    <>
                                        <Button
                                            onClick={() => {
                                                if (confirm('Approve and directly create Sales Order (SO)?\n\nThis will:\n1. Change status to Converted\n2. Auto-generate SO number\n3. Create new Shipment in Operations')) {
                                                    handleCreateSO(viewingQuotation);
                                                }
                                            }}
                                            className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-bold border border-blue-500/40"
                                        >
                                            ⚡ Approve & Create SO
                                        </Button>

                                        <Button variant="secondary" onClick={() => handleManagerReject(viewingQuotation.id)} className="bg-red-500/20 hover:bg-red-500/30 text-red-400">
                                            ✗ Reject
                                        </Button>
                                    </>
                                )}



                                {/* Customer Decision */}


                                {/* Create Revision (for revision_requested status) */}
                                {viewingQuotation.status === 'revision_requested' && canCreate('blink_quotations') && (
                                    <Button onClick={() => handleCreateRevision(viewingQuotation.id)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400">
                                        📝 Create Revision
                                    </Button>
                                )}

                                {/* Warning for superseded quotations */}
                                {viewingQuotation.is_superseded && (
                                    <div className="text-orange-400 text-sm flex items-center gap-2">
                                        <span>⚠️ Cannot create SO - quotation has been superseded by newer revision</span>
                                    </div>
                                )}
                            </div>
                            <Button variant="secondary" onClick={() => setShowViewModal(false)}>Close</Button>
                        </div>
                    </div>
                </Modal>
            )}
            {showPrintPreview && viewingQuotation && (
                <QuotationPrintPreviewModal
                    quotation={viewingQuotation}
                    onClose={() => setShowPrintPreview(false)}
                    onPrint={handlePrintQuotation}
                    companySettings={companySettings}
                />
            )}
        </div>
    );
};

const QuotationPrintPreviewModal = ({ quotation, onClose, onPrint, companySettings }) => {
    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (value, currency = 'IDR') => {
        return currency === 'USD'
            ? `$${(value || 0).toLocaleString('id-ID')}`
            : `Rp ${(value || 0).toLocaleString('id-ID')}`;
    };

    return (
        <Modal isOpen={true} onClose={onClose} maxWidth="max-w-5xl">
            <div className="p-0 overflow-hidden rounded-lg">
                <div className="flex items-center justify-between p-6 border-b border-dark-border bg-dark-card">
                    <h2 className="text-xl font-bold text-silver-light">Quotation Preview</h2>
                    <div className="flex gap-2 print:hidden">
                        <button
                            onClick={() => onPrint(quotation)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
                        >
                            <Download className="w-4 h-4" />
                            Print / Save PDF
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 border border-dark-border text-silver-light rounded-lg hover:bg-dark-surface transition-colors text-sm"
                        >
                            Close
                        </button>
                    </div>
                </div>

                {/* Modern Print Layout - 2025 SaaS Style */}
                <div className="print-content bg-white text-slate-900 p-12 font-sans overflow-auto max-h-[80vh] print:max-h-none print:p-0">

                    {/* Header: Logo & Company */}
                    <header className="flex justify-between items-start mb-12">
                        <div>
                            {companySettings?.logo_url ? (
                                <img src={companySettings.logo_url} alt="Logo" className="h-10 object-contain mb-4" />
                            ) : (
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">PT. Bakhtera Freight Worldwide</h1>
                            )}
                            <div className="text-sm text-slate-500 leading-relaxed max-w-xs">
                                <p>{companySettings?.company_address}</p>
                                <div className="mt-2 flex gap-4 text-xs">
                                    <span>Phone: {companySettings?.company_phone}</span>
                                    <span>Email: {companySettings?.company_email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <h2 className="text-4xl font-light tracking-tight text-slate-900 mb-2">Quotation</h2>
                            <p className="text-accent-blue font-mono font-medium text-lg">{quotation.quotationNumber || quotation.quotation_number}</p>
                            <p className="text-sm text-slate-400 mt-1">Issued Date: {new Date(quotation.quotationDate || quotation.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </header>

                    {/* Client & Logic Info Grid */}
                    <div className="grid grid-cols-12 gap-12 mb-12">
                        {/* Client Info */}
                        <div className="col-span-5">
                            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4">Bill To</h3>
                            <div className="text-sm leading-relaxed">
                                <p className="font-bold text-slate-900 text-lg mb-1">{quotation.customerName || quotation.customer_name}</p>
                                <p className="text-slate-600 mb-2">{quotation.customerCompany || quotation.customer_company}</p>
                                <p className="text-slate-500 whitespace-pre-line mb-4">{quotation.customerAddress || quotation.customer_address}</p>

                                <dl className="space-y-1 text-slate-600 text-xs border-l-2 border-slate-100 pl-3">
                                    {(quotation.customerContact || quotation.customer_contact_name) && (
                                        <div className="flex gap-2"><dt className="font-medium text-slate-900 w-12">Attn:</dt> <dd>{quotation.customerContact || quotation.customer_contact_name}</dd></div>
                                    )}
                                    {(quotation.customerEmail || quotation.customer_email) && (
                                        <div className="flex gap-2"><dt className="font-medium text-slate-900 w-12">Email:</dt> <dd>{quotation.customerEmail || quotation.customer_email}</dd></div>
                                    )}
                                    {(quotation.customerPhone || quotation.customer_phone) && (
                                        <div className="flex gap-2"><dt className="font-medium text-slate-900 w-12">Phone:</dt> <dd>{quotation.customerPhone || quotation.customer_phone}</dd></div>
                                    )}
                                </dl>
                            </div>
                        </div>

                        {/* Shipment Details */}
                        <div className="col-span-7">
                            <h3 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-4">Shipment Details</h3>
                            <div className="grid grid-cols-3 gap-y-6 gap-x-8 text-sm">
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Origin (POL)</span>
                                    <span className="font-semibold text-slate-800">{quotation.origin || '—'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Destination (POD)</span>
                                    <span className="font-semibold text-slate-800">{quotation.destination || '—'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Service Mode</span>
                                    <span className="font-semibold text-slate-800 capitalize">{quotation.serviceType || '—'}</span>
                                </div>

                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Commodity</span>
                                    <span className="font-semibold text-slate-800">{quotation.commodity || '—'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Quantity/Package</span>
                                    <span className="font-semibold text-slate-800">
                                        {quotation.quantity || '-'} {quotation.packageType || quotation.package_type || ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Incoterm</span>
                                    <span className="font-semibold text-slate-800 uppercase">{quotation.incoterm || '—'}</span>
                                </div>

                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Weight / Volume</span>
                                    <span className="font-semibold text-slate-800">
                                        NW: {parseFloat(quotation.netWeight || 0).toLocaleString('id-ID')} / GW: {parseFloat(quotation.grossWeight || quotation.weight || 0).toLocaleString('id-ID')} KGS <br />
                                        {parseFloat(quotation.volume || quotation.measure || 0).toLocaleString('id-ID')} CBM
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Payment Term</span>
                                    <span className="font-semibold text-slate-800">{quotation.paymentTerms || quotation.payment_terms || 'Net 30 Days'}</span>
                                </div>
                                <div>
                                    <span className="block text-xs text-slate-400 mb-1">Validity</span>
                                    <span className="font-semibold text-slate-800">{quotation.validityDays || 30} Days</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing Table */}
                    <div className="mb-6">
                        <table className="w-full text-xs leading-tight">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="text-left font-semibold text-slate-900 py-1 uppercase text-[10px] tracking-wider w-[5%] bg-slate-50 pl-4 rounded-l-md">No</th>
                                    <th className="text-left font-semibold text-slate-900 py-1 uppercase text-[10px] tracking-wider w-[40%] bg-slate-50">Description</th>
                                    <th className="text-right font-semibold text-slate-900 py-1 uppercase text-[10px] tracking-wider w-[10%] bg-slate-50">Qty</th>
                                    <th className="text-right font-semibold text-slate-900 py-1 uppercase text-[10px] tracking-wider w-[15%] bg-slate-50">Unit Price</th>
                                    <th className="text-right font-semibold text-slate-900 py-1 uppercase text-[10px] tracking-wider w-[15%] bg-slate-50 pr-4 rounded-r-md">Total ({quotation.currency})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {(quotation.serviceItems || quotation.service_items || []).map((item, index) => {
                                    const amount = item.total || ((item.quantity || 1) * (item.unitPrice || 0));
                                    return (
                                        <tr key={index}>
                                            <td className="py-0.5 pl-4 text-slate-400 font-mono text-[10px]">{index + 1}</td>
                                            <td className="py-0.5 text-slate-800 font-medium capitalize">
                                                {(item.name || item.description || '').toLowerCase()}
                                                {item.notes && <p className="text-[10px] text-slate-400 capitalize">{(item.notes || '').toLowerCase()}</p>}
                                            </td>
                                            <td className="py-0.5 text-right text-slate-600">{item.quantity || 1} {item.unit || 'unit'}</td>
                                            <td className="py-0.5 text-right text-slate-600 font-mono">
                                                {formatCurrency(parseFloat(item.unitPrice || item.price || 0), quotation.currency).replace('Rp', '').replace('$', '')}
                                            </td>
                                            <td className="py-0.5 text-right text-slate-900 font-bold font-mono pr-4">
                                                {formatCurrency(amount, quotation.currency)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* Total Summary */}
                        <div className="flex justify-end mt-4">
                            <div className="w-64 bg-slate-50 p-6 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-slate-500 text-sm">Subtotal</span>
                                    <span className="font-mono text-slate-700">{formatCurrency(quotation.totalAmount || quotation.total_amount, quotation.currency)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                                    <span className="text-slate-500 text-sm">Tax (0%)</span>
                                    <span className="font-mono text-slate-700">-</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-slate-900">Total</span>
                                    <span className="font-bold text-xl text-blue-600">
                                        {formatCurrency(quotation.totalAmount || quotation.total_amount, quotation.currency)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Terms & Footer */}
                    <div className="grid grid-cols-2 gap-12 mt-auto">
                        <div className="text-xs text-slate-500">
                            <h4 className="font-bold text-slate-900 uppercase mb-2">Terms & Conditions</h4>
                            <div className="whitespace-pre-line leading-relaxed">
                                {quotation.termsConditions || 'Standard trading conditions apply.'}
                            </div>
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="flex justify-between items-end gap-8 text-center pt-8">
                                <div className="flex-1">
                                    <div className="h-20 border-b border-slate-300 mb-2"></div>
                                    <p className="font-semibold text-slate-900 text-sm">Prepared By</p>
                                    <p className="text-xs text-slate-500">{quotation.salesPerson || 'Sales Representative'}</p>
                                </div>
                                <div className="flex-1">
                                    <div className="h-20 border-b border-slate-300 mb-2"></div>
                                    <p className="font-semibold text-slate-900 text-sm">Approved By</p>
                                    <p className="text-xs text-slate-500">Management</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style>{`
                @media print {
                    @page { margin: 0; size: A4; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
                    .print-content { 
                        width: 210mm;
                        min-height: 297mm;
                        padding: 15mm;
                        margin: 0 auto;
                        position: absolute;
                        top: 0;
                        left: 0;
                        border: none;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                }
            `}</style>
        </Modal>
    );
};

export default QuotationManagement;
