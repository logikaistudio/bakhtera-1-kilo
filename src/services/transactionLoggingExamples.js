// Example implementation of comprehensive transaction logging
// This file demonstrates how to implement logging for different transaction types and actions

import { logTransaction, TRANSACTION_TYPES, MODULES, ACTIONS } from '../services/transactionLogService';

// Example 1: Invoice Creation (already updated in InvoiceManagement.jsx)
export async function logInvoiceCreation(invoiceData, user) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.INVOICE,
        transactionId: invoiceData.id,
        referenceNumber: invoiceData.invoice_number,
        module: MODULES.FINANCE,
        action: ACTIONS.CREATE,
        description: `Invoice created for ${invoiceData.customer_name} - ${invoiceData.job_number}`,
        amount: invoiceData.total_amount,
        currency: invoiceData.currency,
        partnerId: invoiceData.customer_id,
        partnerName: invoiceData.customer_name,
        accountId: invoiceData.account_id,
        accountName: invoiceData.account_name,
        status: 'draft',
        paymentMethod: invoiceData.payment_method,
        sourceAction: 'create_invoice',
        submenuContext: 'blink_invoices',
        user
    });
}

// Example 2: Invoice Approval
export async function logInvoiceApproval(invoiceData, user, approver) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.INVOICE,
        transactionId: invoiceData.id,
        referenceNumber: invoiceData.invoice_number,
        module: MODULES.FINANCE,
        action: ACTIONS.APPROVE,
        description: `Invoice approved by ${approver.email}`,
        amount: invoiceData.total_amount,
        currency: invoiceData.currency,
        partnerId: invoiceData.customer_id,
        partnerName: invoiceData.customer_name,
        accountId: invoiceData.account_id,
        accountName: invoiceData.account_name,
        status: 'approved',
        paymentMethod: invoiceData.payment_method,
        sourceAction: 'approve_invoice',
        submenuContext: 'blink_invoices',
        user: approver
    });
}

// Example 3: Payment Processing
export async function logPaymentProcessing(paymentData, user) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.PAYMENT,
        transactionId: paymentData.id,
        referenceNumber: paymentData.payment_reference,
        module: MODULES.FINANCE,
        action: ACTIONS.PAY,
        description: `Payment processed for invoice ${paymentData.invoice_number}`,
        amount: paymentData.amount,
        currency: paymentData.currency,
        partnerId: paymentData.customer_id,
        partnerName: paymentData.customer_name,
        accountId: paymentData.account_id,
        accountName: paymentData.account_name,
        status: 'completed',
        paymentMethod: paymentData.payment_method,
        sourceAction: 'process_payment',
        submenuContext: 'blink_ar', // Accounts Receivable
        user
    });
}

// Example 4: Journal Entry Update
export async function logJournalUpdate(journalData, user, changes) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.JOURNAL,
        transactionId: journalData.id,
        referenceNumber: journalData.journal_number,
        module: MODULES.FINANCE,
        action: ACTIONS.UPDATE,
        description: `Journal entry updated: ${Object.keys(changes).join(', ')}`,
        amount: journalData.total_debit,
        currency: journalData.currency,
        accountId: journalData.account_id,
        accountName: journalData.account_name,
        status: journalData.status,
        sourceAction: 'update_journal',
        submenuContext: 'blink_journal',
        user
    });
}

// Example 5: Purchase Order Cancellation
export async function logPurchaseOrderCancellation(poData, user, reason) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.PURCHASE_ORDER,
        transactionId: poData.id,
        referenceNumber: poData.po_number,
        module: MODULES.FINANCE,
        action: ACTIONS.CANCEL,
        description: `Purchase Order cancelled: ${reason}`,
        amount: poData.total_amount,
        currency: poData.currency,
        partnerId: poData.vendor_id,
        partnerName: poData.vendor_name,
        accountId: poData.account_id,
        accountName: poData.account_name,
        status: 'cancelled',
        sourceAction: 'cancel_po',
        submenuContext: 'blink_purchase_order',
        user
    });
}

// Example 6: Quotation Status Change
export async function logQuotationStatusChange(quotationData, user, oldStatus, newStatus) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.QUOTATION,
        transactionId: quotationData.id,
        referenceNumber: quotationData.quotation_number,
        module: MODULES.SALES,
        action: ACTIONS.UPDATE,
        description: `Quotation status changed from ${oldStatus} to ${newStatus}`,
        amount: quotationData.total_amount,
        currency: quotationData.currency,
        partnerId: quotationData.customer_id,
        partnerName: quotationData.customer_name,
        status: newStatus,
        sourceAction: 'change_quotation_status',
        submenuContext: 'blink_quotations',
        user
    });
}

// Example 7: Shipment Tracking Update
export async function logShipmentUpdate(shipmentData, user, trackingInfo) {
    return await logTransaction({
        transactionType: TRANSACTION_TYPES.SHIPMENT,
        transactionId: shipmentData.id,
        referenceNumber: shipmentData.bl_number,
        module: MODULES.OPERATIONS,
        action: ACTIONS.UPDATE,
        description: `Shipment tracking updated: ${trackingInfo.status}`,
        amount: shipmentData.total_value,
        currency: shipmentData.currency,
        partnerId: shipmentData.customer_id,
        partnerName: shipmentData.customer_name,
        status: trackingInfo.status,
        sourceAction: 'update_shipment_tracking',
        submenuContext: 'blink_shipments',
        user
    });
}

// Example 8: AR/AP Status Update
export async function logArApStatusUpdate(arapData, user, transactionType, oldStatus, newStatus) {
    const submenuMap = {
        [TRANSACTION_TYPES.ACCOUNTS_RECEIVABLE]: 'blink_ar',
        [TRANSACTION_TYPES.ACCOUNTS_PAYABLE]: 'blink_ap'
    };

    return await logTransaction({
        transactionType: transactionType,
        transactionId: arapData.id,
        referenceNumber: arapData.reference_number,
        module: MODULES.FINANCE,
        action: ACTIONS.UPDATE,
        description: `${transactionType} status changed from ${oldStatus} to ${newStatus}`,
        amount: arapData.amount,
        currency: arapData.currency,
        partnerId: arapData.partner_id,
        partnerName: arapData.partner_name,
        accountId: arapData.account_id,
        accountName: arapData.account_name,
        status: newStatus,
        sourceAction: 'update_arap_status',
        submenuContext: submenuMap[transactionType],
        user
    });
}

// Example 9: Document Print Action
export async function logDocumentPrint(documentData, user, documentType) {
    const submenuMap = {
        'invoice': 'blink_invoices',
        'po': 'blink_purchase_order',
        'quotation': 'blink_quotations',
        'journal': 'blink_journal'
    };

    return await logTransaction({
        transactionType: documentType.toUpperCase(),
        transactionId: documentData.id,
        referenceNumber: documentData.number,
        module: MODULES.FINANCE,
        action: ACTIONS.PRINT,
        description: `${documentType} document printed`,
        amount: documentData.amount,
        currency: documentData.currency,
        partnerId: documentData.partner_id,
        partnerName: documentData.partner_name,
        status: 'printed',
        sourceAction: 'print_document',
        submenuContext: submenuMap[documentType],
        user
    });
}

// Example 10: Bulk Operations Logging
export async function logBulkOperation(operationData, user, operationType) {
    return await logTransaction({
        transactionType: operationData.transactionType,
        transactionId: `bulk_${Date.now()}`,
        referenceNumber: `BULK_${operationType}_${Date.now()}`,
        module: operationData.module,
        action: operationData.action,
        description: `Bulk ${operationType}: ${operationData.count} records processed`,
        amount: operationData.totalAmount,
        currency: operationData.currency,
        status: 'completed',
        sourceAction: `bulk_${operationType}`,
        submenuContext: operationData.submenuContext,
        user
    });
}