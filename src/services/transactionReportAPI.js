// API endpoints for Transaction Report with submenu filtering
// This file contains API functions for the Report module

import { getTransactionLogs, getTransactionSummary, exportTransactionLogs } from './transactionLogService';

// API: Get transaction logs filtered by submenu
export async function getTransactionLogsBySubmenu(submenuContext, filters = {}) {
    const apiFilters = {
        submenuContext,
        ...filters
    };

    return await getTransactionLogs(apiFilters);
}

// API: Get summary statistics by submenu
export async function getTransactionSummaryBySubmenu(submenuContext, dateRange = {}) {
    return await getTransactionSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
    });
}

// API: Get drill-down data for specific submenu
export async function getSubmenuDrillDown(submenuContext, filters = {}) {
    // Get detailed logs for drill-down analysis
    const { success, data, count } = await getTransactionLogsBySubmenu(submenuContext, {
        ...filters,
        limit: 1000 // Larger limit for drill-down
    });

    if (!success) return { success: false, data: null };

    // Group by different dimensions for drill-down
    const drillDown = {
        byAction: {},
        byStatus: {},
        byUser: {},
        byTimeRange: {},
        totalAmount: 0,
        transactionCount: count
    };

    data.forEach(log => {
        // Group by action
        drillDown.byAction[log.action] = drillDown.byAction[log.action] || { count: 0, amount: 0 };
        drillDown.byAction[log.action].count++;
        drillDown.byAction[log.action].amount += parseFloat(log.amount || 0);

        // Group by status
        drillDown.byStatus[log.status] = drillDown.byStatus[log.status] || { count: 0, amount: 0 };
        drillDown.byStatus[log.status].count++;
        drillDown.byStatus[log.status].amount += parseFloat(log.amount || 0);

        // Group by user
        const userKey = log.user_email || 'unknown';
        drillDown.byUser[userKey] = drillDown.byUser[userKey] || { count: 0, amount: 0 };
        drillDown.byUser[userKey].count++;
        drillDown.byUser[userKey].amount += parseFloat(log.amount || 0);

        // Group by time (daily)
        const dateKey = new Date(log.created_at).toISOString().split('T')[0];
        drillDown.byTimeRange[dateKey] = drillDown.byTimeRange[dateKey] || { count: 0, amount: 0 };
        drillDown.byTimeRange[dateKey].count++;
        drillDown.byTimeRange[dateKey].amount += parseFloat(log.amount || 0);

        // Total amount
        drillDown.totalAmount += parseFloat(log.amount || 0);
    });

    return { success: true, data: drillDown };
}

// API: Export transaction logs for specific submenu
export async function exportSubmenuTransactionLogs(submenuContext, filters = {}, maskSensitive = true) {
    return await exportTransactionLogs({
        submenuContext,
        ...filters,
        maskSensitive
    });
}

// Submenu-specific API endpoints
export const SUBMENU_APIS = {
    // Finance Submenus
    blink_invoices: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_invoices', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_invoices', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_invoices', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_invoices', filters, mask)
    },

    blink_purchase_order: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_purchase_order', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_purchase_order', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_purchase_order', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_purchase_order', filters, mask)
    },

    blink_ar: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_ar', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_ar', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_ar', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_ar', filters, mask)
    },

    blink_ap: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_ap', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_ap', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_ap', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_ap', filters, mask)
    },

    blink_journal: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_journal', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_journal', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_journal', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_journal', filters, mask)
    },

    // Sales Submenus
    blink_quotations: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_quotations', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_quotations', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_quotations', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_quotations', filters, mask)
    },

    blink_sales_quotations: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_sales_quotations', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_sales_quotations', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_sales_quotations', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_sales_quotations', filters, mask)
    },

    // Operations Submenus
    blink_shipments: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_shipments', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_shipments', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_shipments', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_shipments', filters, mask)
    },

    blink_bl: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_bl', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_bl', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_bl', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_bl', filters, mask)
    },

    blink_awb: {
        getLogs: (filters) => getTransactionLogsBySubmenu('blink_awb', filters),
        getSummary: (dateRange) => getTransactionSummaryBySubmenu('blink_awb', dateRange),
        getDrillDown: (filters) => getSubmenuDrillDown('blink_awb', filters),
        export: (filters, mask) => exportSubmenuTransactionLogs('blink_awb', filters, mask)
    }
};

// Helper function to get submenu API
export function getSubmenuAPI(submenuCode) {
    return SUBMENU_APIS[submenuCode] || null;
}

// Example API payload structures
export const API_PAYLOAD_EXAMPLES = {
    // Input payload for filtering logs
    filterPayload: {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
        transactionType: "invoice", // optional
        action: "create", // optional
        status: "approved", // optional
        userId: "uuid", // optional
        limit: 50,
        offset: 0
    },

    // Response payload for logs
    logsResponse: {
        success: true,
        data: [
            {
                id: "uuid",
                transaction_id: "INV-001",
                reference_number: "INV-001",
                transaction_type: "invoice",
                action: "create",
                module: "finance",
                submenu_context: "blink_invoices",
                amount: 1000000,
                currency: "IDR",
                partner_name: "PT. Example Corp",
                account_name: "Accounts Receivable",
                status: "draft",
                payment_method: "transfer",
                user_email: "user@example.com",
                timezone: "Asia/Jakarta",
                created_at: "2024-01-15T10:30:00Z",
                description: "Invoice created for PT. Example Corp"
            }
        ],
        count: 150
    },

    // Response payload for summary
    summaryResponse: {
        success: true,
        data: {
            totalTransactions: 150,
            totalAmount: 150000000,
            byType: { "invoice": 100, "payment": 50 },
            byAction: { "create": 120, "update": 20, "approve": 10 },
            byModule: { "finance": 150 },
            bySubmenu: { "blink_invoices": 100, "blink_ar": 50 },
            byStatus: { "draft": 50, "approved": 80, "paid": 20 },
            byCurrency: { "IDR": 150000000 },
            timeRange: { startDate: "2024-01-01", endDate: "2024-01-31" }
        }
    },

    // Response payload for drill-down
    drillDownResponse: {
        success: true,
        data: {
            byAction: {
                "create": { count: 120, amount: 120000000 },
                "update": { count: 20, amount: 20000000 },
                "approve": { count: 10, amount: 10000000 }
            },
            byStatus: {
                "draft": { count: 50, amount: 50000000 },
                "approved": { count: 80, amount: 80000000 },
                "paid": { count: 20, amount: 20000000 }
            },
            byUser: {
                "user1@example.com": { count: 80, amount: 80000000 },
                "user2@example.com": { count: 70, amount: 70000000 }
            },
            byTimeRange: {
                "2024-01-15": { count: 30, amount: 30000000 },
                "2024-01-16": { count: 25, amount: 25000000 }
            },
            totalAmount: 150000000,
            transactionCount: 150
        }
    }
};