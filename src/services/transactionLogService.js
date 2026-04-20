import { supabase } from '../lib/supabase';
import { generateUUID } from '../utils/journalHelper';

const TRANSACTION_TYPES = {
    INVOICE: 'invoice',
    PURCHASE_ORDER: 'purchase_order',
    ACCOUNTS_RECEIVABLE: 'accounts_receivable',
    ACCOUNTS_PAYABLE: 'accounts_payable',
    QUOTATION: 'quotation',
    SHIPMENT: 'shipment',
    SALES_QUOTATION: 'sales_quotation',
    PAYMENT: 'payment',
    JOURNAL: 'journal'
};

const MODULES = {
    FINANCE: 'finance',
    OPERATIONS: 'operations',
    SALES: 'sales',
    APPROVAL: 'approval'
};

const ACTIONS = {
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
    APPROVE: 'approve',
    REJECT: 'reject',
    PAY: 'pay',
    CANCEL: 'cancel',
    SEND: 'send',
    PRINT: 'print'
};

export async function logTransaction({
    transactionType,
    transactionId,
    referenceNumber,
    module,
    action,
    description,
    amount,
    currency = 'IDR',
    partnerId,
    partnerName,
    accountId,
    accountName,
    status,
    paymentMethod,
    deviceInfo = {},
    sourceAction,
    submenuContext,
    user
}) {
    try {
        // Get timezone from browser or default
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';

        const logData = {
            transaction_type: transactionType,
            transaction_id: transactionId,
            reference_number: referenceNumber,
            module: module,
            action: action,
            description: description,
            amount: amount,
            currency: currency,
            partner_id: partnerId,
            partner_name: partnerName,
            account_id: accountId,
            account_name: accountName,
            status: status,
            payment_method: paymentMethod,
            timezone: timezone,
            device_info: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                ...deviceInfo
            },
            source_action: sourceAction,
            submenu_context: submenuContext,
            user_id: user?.id,
            user_email: user?.email,
            metadata: {
                timestamp: new Date().toISOString(),
                version: '2.0'
            }
        };

        const { data, error } = await supabase
            .from('blink_transaction_logs')
            .insert(logData)
            .select();

        if (error) {
            console.error('Failed to log transaction:', error);
            return { success: false, error };
        }

        return { success: true, data: data?.[0] };
    } catch (err) {
        console.error('Error logging transaction:', err);
        return { success: false, error: err };
    }
}

export async function getTransactionLogs({
    startDate,
    endDate,
    transactionType,
    module,
    action,
    partnerId,
    accountId,
    status,
    paymentMethod,
    submenuContext,
    userId,
    limit = 100,
    offset = 0
}) {
    try {
        let query = supabase
            .from('blink_transaction_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }
        if (transactionType) {
            query = query.eq('transaction_type', transactionType);
        }
        if (module) {
            query = query.eq('module', module);
        }
        if (action) {
            query = query.eq('action', action);
        }
        if (partnerId) {
            query = query.eq('partner_id', partnerId);
        }
        if (accountId) {
            query = query.eq('account_id', accountId);
        }
        if (status) {
            query = query.eq('status', status);
        }
        if (paymentMethod) {
            query = query.eq('payment_method', paymentMethod);
        }
        if (submenuContext) {
            query = query.eq('submenu_context', submenuContext);
        }
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error('Failed to fetch transaction logs:', error);
            return { success: false, error };
        }

        return { success: true, data, count };
    } catch (err) {
        console.error('Error fetching transaction logs:', err);
        return { success: false, error: err };
    }
}

export async function getTransactionSummary({
    startDate,
    endDate,
    groupBy = 'type' // 'type', 'action', 'module', 'submenu', 'status'
}) {
    try {
        let query = supabase
            .from('blink_transaction_logs')
            .select('transaction_type, action, module, submenu_context, status, amount, currency, created_at');

        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch transaction summary:', error);
            return { success: false, error };
        }

        const summary = {
            totalTransactions: data?.length || 0,
            totalAmount: 0,
            byType: {},
            byAction: {},
            byModule: {},
            bySubmenu: {},
            byStatus: {},
            byCurrency: {},
            timeRange: { startDate, endDate }
        };

        data?.forEach(log => {
            // Count by different groupings
            summary.byType[log.transaction_type] = (summary.byType[log.transaction_type] || 0) + 1;
            summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
            summary.byModule[log.module] = (summary.byModule[log.module] || 0) + 1;
            summary.bySubmenu[log.submenu_context] = (summary.bySubmenu[log.submenu_context] || 0) + 1;
            summary.byStatus[log.status] = (summary.byStatus[log.status] || 0) + 1;

            // Amount aggregations
            if (log.amount) {
                const currency = log.currency || 'IDR';
                summary.totalAmount += parseFloat(log.amount);
                summary.byCurrency[currency] = (summary.byCurrency[currency] || 0) + parseFloat(log.amount);
            }
        });

        return { success: true, data: summary };
    } catch (err) {
        console.error('Error fetching transaction summary:', err);
        return { success: false, error: err };
    }
}

export { TRANSACTION_TYPES, MODULES, ACTIONS };

// Export function for CSV generation
export async function exportTransactionLogs({
    startDate,
    endDate,
    transactionType,
    module,
    action,
    submenuContext,
    maskSensitive = true
}) {
    try {
        const { success, data, error } = await getTransactionLogs({
            startDate,
            endDate,
            transactionType,
            module,
            action,
            submenuContext,
            limit: 10000 // Large limit for export
        });

        if (!success) return { success: false, error };

        // Prepare CSV headers
        const headers = [
            'Transaction ID',
            'Reference Number',
            'Type',
            'Action',
            'Module',
            'Submenu Context',
            'Amount',
            'Currency',
            'Partner Name',
            'Account Name',
            'Status',
            'Payment Method',
            'User Email',
            'Timezone',
            'Created At',
            'Description'
        ];

        // Prepare CSV rows with masking
        const rows = data.map(log => [
            log.transaction_id,
            log.reference_number,
            log.transaction_type,
            log.action,
            log.module,
            log.submenu_context,
            log.amount,
            log.currency,
            maskSensitive ? maskString(log.partner_name) : log.partner_name,
            log.account_name,
            log.status,
            log.payment_method,
            maskSensitive ? maskEmail(log.user_email) : log.user_email,
            log.timezone,
            log.created_at,
            log.description
        ]);

        // Generate CSV content
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field || ''}"`).join(','))
            .join('\n');

        return { success: true, data: csvContent, filename: `transaction_logs_${new Date().toISOString().split('T')[0]}.csv` };
    } catch (err) {
        console.error('Error exporting transaction logs:', err);
        return { success: false, error: err };
    }
}

// Helper functions for data masking
function maskString(str) {
    if (!str) return '';
    if (str.length <= 2) return '*'.repeat(str.length);
    return str.substring(0, 2) + '*'.repeat(str.length - 4) + str.substring(str.length - 2);
}

function maskEmail(email) {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return maskString(local) + '@' + domain;
}