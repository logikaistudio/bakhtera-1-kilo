# Transaction Report Queries - Per Submenu Examples

## Overview
This document provides example SQL queries and API calls for generating transaction reports filtered by submenu context.

## Database Queries

### 1. Invoice Submenu Reports

#### Daily Invoice Summary
```sql
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_invoices,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
    AVG(amount) as avg_invoice_amount
FROM blink_transaction_logs
WHERE submenu_context = 'blink_invoices'
    AND created_at >= '2024-01-01'
    AND created_at < '2024-02-01'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### Invoice Status Distribution
```sql
SELECT
    status,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    ROUND(AVG(amount), 2) as avg_amount
FROM blink_transaction_logs
WHERE submenu_context = 'blink_invoices'
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status
ORDER BY count DESC;
```

#### Top Invoice Creators
```sql
SELECT
    user_email,
    COUNT(*) as invoices_created,
    SUM(amount) as total_amount_created,
    MAX(created_at) as last_activity
FROM blink_transaction_logs
WHERE submenu_context = 'blink_invoices'
    AND action = 'create'
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_email
ORDER BY invoices_created DESC
LIMIT 10;
```

### 2. Purchase Order Submenu Reports

#### PO Approval Timeline
```sql
SELECT
    transaction_id,
    reference_number,
    created_at as created_date,
    MIN(CASE WHEN action = 'approve' THEN created_at END) as approved_date,
    EXTRACT(EPOCH FROM
        MIN(CASE WHEN action = 'approve' THEN created_at END) - created_at
    )/86400 as approval_days
FROM blink_transaction_logs
WHERE submenu_context = 'blink_purchase_order'
    AND created_at >= '2024-01-01'
GROUP BY transaction_id, reference_number, created_at
HAVING MIN(CASE WHEN action = 'approve' THEN created_at END) IS NOT NULL
ORDER BY approval_days DESC;
```

#### Vendor Performance
```sql
SELECT
    partner_name,
    COUNT(*) as po_count,
    SUM(amount) as total_value,
    AVG(amount) as avg_po_value,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_pos
FROM blink_transaction_logs
WHERE submenu_context = 'blink_purchase_order'
    AND action = 'create'
    AND created_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY partner_name
ORDER BY total_value DESC;
```

### 3. Accounts Receivable Submenu Reports

#### AR Aging Analysis
```sql
WITH ar_transactions AS (
    SELECT
        transaction_id,
        reference_number,
        partner_name,
        amount,
        currency,
        created_at,
        ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY created_at DESC) as rn
    FROM blink_transaction_logs
    WHERE submenu_context = 'blink_ar'
        AND action = 'create'
)
SELECT
    CASE
        WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 30 THEN '0-30 days'
        WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 60 THEN '31-60 days'
        WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 90 THEN '61-90 days'
        ELSE '90+ days'
    END as aging_bucket,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM ar_transactions
WHERE rn = 1
GROUP BY aging_bucket
ORDER BY
    CASE aging_bucket
        WHEN '0-30 days' THEN 1
        WHEN '31-60 days' THEN 2
        WHEN '61-90 days' THEN 3
        ELSE 4
    END;
```

#### Payment Method Analysis
```sql
SELECT
    payment_method,
    COUNT(*) as payment_count,
    SUM(amount) as total_paid,
    ROUND(AVG(amount), 2) as avg_payment_amount
FROM blink_transaction_logs
WHERE submenu_context = 'blink_ar'
    AND action = 'pay'
    AND status = 'completed'
    AND created_at >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY payment_method
ORDER BY total_paid DESC;
```

### 4. Journal Entry Submenu Reports

#### Journal Posting Summary
```sql
SELECT
    DATE(created_at) as posting_date,
    COUNT(*) as journals_posted,
    SUM(amount) as total_debit_credit,
    COUNT(DISTINCT user_email) as active_users
FROM blink_transaction_logs
WHERE submenu_context = 'blink_journal'
    AND action = 'create'
    AND status = 'posted'
GROUP BY DATE(created_at)
ORDER BY posting_date DESC
LIMIT 30;
```

#### Account Usage in Journals
```sql
SELECT
    account_name,
    COUNT(*) as journal_entries,
    SUM(amount) as total_amount,
    AVG(amount) as avg_entry_amount
FROM blink_transaction_logs
WHERE submenu_context = 'blink_journal'
    AND action = 'create'
    AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY account_name
ORDER BY journal_entries DESC
LIMIT 20;
```

### 5. Cross-Submenu Reports

#### User Activity Across Submenus
```sql
SELECT
    user_email,
    submenu_context,
    COUNT(*) as actions_count,
    SUM(amount) as total_amount_involved,
    MAX(created_at) as last_activity
FROM blink_transaction_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY user_email, submenu_context
ORDER BY user_email, actions_count DESC;
```

#### Transaction Volume Trends
```sql
SELECT
    DATE(created_at) as date,
    submenu_context,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    COUNT(DISTINCT user_email) as unique_users
FROM blink_transaction_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), submenu_context
ORDER BY date DESC, submenu_context;
```

## API Query Examples

### JavaScript API Calls

#### Get Invoice Summary
```javascript
import { getTransactionSummary } from './transactionLogService';

const invoiceSummary = await getTransactionSummary({
    startDate: '2024-01-01',
    endDate: '2024-01-31'
});

// Filter for invoice submenu
const invoiceData = {
    totalInvoices: invoiceSummary.data.bySubmenu['blink_invoices'] || 0,
    totalAmount: invoiceSummary.data.byCurrency['IDR'] || 0, // Assuming IDR
    byStatus: {}, // Would need additional query
    byAction: invoiceSummary.data.byAction
};
```

#### Get Submenu Drill-down
```javascript
import { getSubmenuDrillDown } from './transactionReportAPI';

const invoiceDrillDown = await getSubmenuDrillDown('blink_invoices', {
    startDate: '2024-01-01',
    endDate: '2024-01-31'
});

console.log('Invoice Analysis:', {
    totalAmount: invoiceDrillDown.data.totalAmount,
    byAction: invoiceDrillDown.data.byAction,
    byStatus: invoiceDrillDown.data.byStatus,
    byUser: invoiceDrillDown.data.byUser,
    byTimeRange: invoiceDrillDown.data.byTimeRange
});
```

#### Export Submenu Data
```javascript
import { exportSubmenuTransactionLogs } from './transactionReportAPI';

const exportResult = await exportSubmenuTransactionLogs('blink_invoices', {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    status: 'approved'
}, true); // maskSensitive = true

if (exportResult.success) {
    // Download CSV
    const blob = new Blob([exportResult.data], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportResult.filename;
    a.click();
}
```

### React Component Examples

#### Invoice Dashboard Widget
```jsx
import React, { useState, useEffect } from 'react';
import { getSubmenuDrillDown } from '../services/transactionReportAPI';

const InvoiceDashboard = () => {
    const [invoiceStats, setInvoiceStats] = useState(null);

    useEffect(() => {
        const loadInvoiceStats = async () => {
            const result = await getSubmenuDrillDown('blink_invoices', {
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString()
            });

            if (result.success) {
                setInvoiceStats(result.data);
            }
        };

        loadInvoiceStats();
    }, []);

    if (!invoiceStats) return <div>Loading...</div>;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-dark-surface p-4 rounded-xl">
                <h3 className="text-lg font-semibold text-white">Total Invoices</h3>
                <p className="text-2xl text-accent-blue">{invoiceStats.transactionCount}</p>
            </div>

            <div className="bg-dark-surface p-4 rounded-xl">
                <h3 className="text-lg font-semibold text-white">Total Amount</h3>
                <p className="text-2xl text-green-400">
                    {new Intl.NumberFormat('id-ID', {
                        style: 'currency',
                        currency: 'IDR'
                    }).format(invoiceStats.totalAmount)}
                </p>
            </div>

            <div className="bg-dark-surface p-4 rounded-xl">
                <h3 className="text-lg font-semibold text-white">Approved This Month</h3>
                <p className="text-2xl text-yellow-400">
                    {invoiceStats.byStatus['approved']?.count || 0}
                </p>
            </div>
        </div>
    );
};

export default InvoiceDashboard;
```

#### AR Aging Report Component
```jsx
import React, { useState, useEffect } from 'react';

const ARAgingReport = () => {
    const [agingData, setAgingData] = useState([]);

    useEffect(() => {
        const loadARAging = async () => {
            // This would be a custom query or API endpoint
            const result = await supabase.rpc('get_ar_aging_report', {
                start_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
                end_date: new Date().toISOString()
            });

            setAgingData(result.data || []);
        };

        loadARAging();
    }, []);

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">AR Aging Analysis</h2>

            <div className="bg-dark-surface rounded-xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-dark-bg">
                        <tr>
                            <th className="px-4 py-2 text-left text-silver-dark">Aging Bucket</th>
                            <th className="px-4 py-2 text-right text-silver-dark">Count</th>
                            <th className="px-4 py-2 text-right text-silver-dark">Amount</th>
                            <th className="px-4 py-2 text-right text-silver-dark">Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agingData.map((bucket, index) => (
                            <tr key={index} className="border-t border-dark-border">
                                <td className="px-4 py-2 text-white">{bucket.aging_bucket}</td>
                                <td className="px-4 py-2 text-right text-white">{bucket.transaction_count}</td>
                                <td className="px-4 py-2 text-right text-green-400">
                                    {new Intl.NumberFormat('id-ID', {
                                        style: 'currency',
                                        currency: 'IDR'
                                    }).format(bucket.total_amount)}
                                </td>
                                <td className="px-4 py-2 text-right text-silver-dark">
                                    {((bucket.total_amount / agingData.reduce((sum, b) => sum + b.total_amount, 0)) * 100).toFixed(1)}%
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ARAgingReport;
```

## Stored Procedures

### AR Aging Report Function
```sql
CREATE OR REPLACE FUNCTION get_ar_aging_report(start_date TIMESTAMPTZ, end_date TIMESTAMPTZ)
RETURNS TABLE (
    aging_bucket TEXT,
    transaction_count BIGINT,
    total_amount DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH ar_base AS (
        SELECT
            transaction_id,
            amount,
            created_at,
            ROW_NUMBER() OVER (PARTITION BY transaction_id ORDER BY created_at DESC) as rn
        FROM blink_transaction_logs
        WHERE submenu_context = 'blink_ar'
            AND action = 'create'
            AND created_at BETWEEN start_date AND end_date
    ),
    ar_aging AS (
        SELECT
            CASE
                WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 30 THEN '0-30 days'
                WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 60 THEN '31-60 days'
                WHEN EXTRACT(EPOCH FROM (CURRENT_DATE - DATE(created_at)))/86400 <= 90 THEN '61-90 days'
                ELSE '90+ days'
            END as aging_bucket,
            amount
        FROM ar_base
        WHERE rn = 1
    )
    SELECT
        a.aging_bucket,
        COUNT(*)::BIGINT as transaction_count,
        COALESCE(SUM(a.amount), 0)::DECIMAL as total_amount
    FROM ar_aging a
    GROUP BY a.aging_bucket
    ORDER BY
        CASE a.aging_bucket
            WHEN '0-30 days' THEN 1
            WHEN '31-60 days' THEN 2
            WHEN '61-90 days' THEN 3
            ELSE 4
        END;
END;
$$ LANGUAGE plpgsql;
```

### User Activity Summary Function
```sql
CREATE OR REPLACE FUNCTION get_user_activity_summary(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    user_email TEXT,
    submenu_context TEXT,
    actions_count BIGINT,
    total_amount DECIMAL,
    last_activity TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.user_email,
        l.submenu_context,
        COUNT(*)::BIGINT as actions_count,
        COALESCE(SUM(l.amount), 0)::DECIMAL as total_amount,
        MAX(l.created_at) as last_activity
    FROM blink_transaction_logs l
    WHERE l.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
    GROUP BY l.user_email, l.submenu_context
    ORDER BY l.user_email, actions_count DESC;
END;
$$ LANGUAGE plpgsql;
```

## Performance Optimization

### Query Optimization Tips

1. **Use appropriate indexes**:
   ```sql
   CREATE INDEX CONCURRENTLY idx_logs_submenu_date ON blink_transaction_logs(submenu_context, DATE(created_at));
   CREATE INDEX CONCURRENTLY idx_logs_user_submenu ON blink_transaction_logs(user_email, submenu_context);
   ```

2. **Partition large tables** by date:
   ```sql
   CREATE TABLE blink_transaction_logs_y2024 PARTITION OF blink_transaction_logs
       FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
   ```

3. **Use materialized views** for complex aggregations:
   ```sql
   CREATE MATERIALIZED VIEW mv_daily_submenu_summary AS
   SELECT
       DATE(created_at) as date,
       submenu_context,
       COUNT(*) as transaction_count,
       SUM(amount) as total_amount
   FROM blink_transaction_logs
   GROUP BY DATE(created_at), submenu_context;
   ```

4. **Cache frequently accessed summaries** using Redis or application cache.

## Report Scheduling

### Automated Daily Reports
```javascript
// Daily report scheduler
const scheduleDailyReports = () => {
    cron.schedule('0 6 * * *', async () => { // 6 AM daily
        const submenus = ['blink_invoices', 'blink_purchase_order', 'blink_ar', 'blink_ap'];

        for (const submenu of submenus) {
            const summary = await getSubmenuDrillDown(submenu, {
                startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
                endDate: new Date().toISOString()
            });

            // Send email report or save to database
            await sendDailyReport(submenu, summary.data);
        }
    });
};
```

This comprehensive query reference provides the foundation for building detailed, submenu-specific transaction reports with proper filtering, aggregation, and performance optimization.