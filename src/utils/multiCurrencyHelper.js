/**
 * Multi-Currency Helper Functions
 * Handles currency separation & aggregation for AR/AP reporting
 */

import { formatCurrency, getCurrencySymbol } from './currencyFormatter';

/**
 * Get summary broken down by currency
 * @param {Array} transactions - Array of AR/AP transactions with: original_amount, currency, exchange_rate
 * @param {string} amountField - Field name to sum (default: 'original_amount')
 * @returns {Object} { IDR: { amount, formatted }, USD: { amount, formatted }, total: {...} }
 */
export const getCurrencySummary = (transactions = [], amountField = 'original_amount') => {
    const summary = {
        IDR: { amount: 0, formatted: '0', currency: 'IDR' },
        USD: { amount: 0, formatted: '0', currency: 'USD' }
    };

    transactions.forEach(tx => {
        const currency = tx.currency || 'IDR';
        const amount = tx[amountField] || 0;

        if (currency === 'IDR') {
            summary.IDR.amount += parseFloat(amount) || 0;
        } else if (currency === 'USD') {
            summary.USD.amount += parseFloat(amount) || 0;
        }
    });

    // Format amounts
    summary.IDR.formatted = formatCurrency(summary.IDR.amount);
    summary.USD.formatted = formatCurrency(summary.USD.amount);

    return summary;
};

/**
 * Get aging summary broken down by currency
 * @param {Array} transactions - Array of AR/AP transactions with: aging_bucket, outstanding_amount, currency
 * @returns {Object} { 
 *   '0-30': { IDR: amount, USD: amount, total: amount }, 
 *   '31-60': {...}, 
 *   '61-90': {...}, 
 *   '90+': {...} 
 * }
 */
export const getAgingByCurrency = (transactions = []) => {
    const agingBuckets = ['0-30', '31-60', '61-90', '90+'];
    const result = {};

    agingBuckets.forEach(bucket => {
        result[bucket] = { IDR: 0, USD: 0 };
    });

    transactions.forEach(tx => {
        const bucket = tx.aging_bucket || '0-30';
        const currency = tx.currency || 'IDR';
        const amount = tx.outstanding_amount || 0;

        if (result[bucket]) {
            if (currency === 'IDR') {
                result[bucket].IDR += parseFloat(amount) || 0;
            } else if (currency === 'USD') {
                result[bucket].USD += parseFloat(amount) || 0;
            }
        }
    });

    return result;
};

/**
 * Get count of transactions by currency
 * @param {Array} transactions - Array of transactions
 * @returns {Object} { IDR: count, USD: count }
 */
export const getTransactionCountByCurrency = (transactions = []) => {
    return transactions.reduce(
        (acc, tx) => {
            const currency = tx.currency || 'IDR';
            acc[currency] = (acc[currency] || 0) + 1;
            return acc;
        },
        { IDR: 0, USD: 0 }
    );
};

/**
 * Get count by status & currency
 * @param {Array} transactions - Array of transactions
 * @param {string} status - Status to filter
 * @returns {Object} { IDR: count, USD: count }
 */
export const getCountByStatusAndCurrency = (transactions = [], status) => {
    return transactions
        .filter(tx => tx.status === status)
        .reduce(
            (acc, tx) => {
                const currency = tx.currency || 'IDR';
                acc[currency] = (acc[currency] || 0) + 1;
                return acc;
            },
            { IDR: 0, USD: 0 }
        );
};

/**
 * Convert amount to IDR using exchange rate
 * @param {number} amount - Amount to convert
 * @param {string} currency - Source currency
 * @param {number} exchangeRate - Exchange rate (USD to IDR)
 * @returns {number} Amount in IDR
 */
export const convertToIDR = (amount, currency = 'IDR', exchangeRate = 16000) => {
    if (!amount || currency === 'IDR') return amount || 0;
    if (currency === 'USD') return (amount * exchangeRate) || 0;
    return 0;
};

/**
 * Get average exchange rate from transactions
 * @param {Array} transactions - Array of transactions with exchange_rate field
 * @returns {number} Average exchange rate
 */
export const getAverageExchangeRate = (transactions = []) => {
    const usdTransactions = transactions.filter(tx => tx.currency === 'USD' && tx.exchange_rate);
    if (usdTransactions.length === 0) return 16000; // Default rate

    const total = usdTransactions.reduce((sum, tx) => sum + (tx.exchange_rate || 0), 0);
    return Math.round(total / usdTransactions.length);
};

/**
 * Format currency summary with symbols
 * @param {Object} summary - From getCurrencySummary()
 * @returns {Object} { IDR: 'Rp 1.000.000', USD: '$ 1.000.000' }
 */
export const formatCurrencySummary = (summary) => {
    return {
        IDR: `${getCurrencySymbol('IDR')} ${summary.IDR.formatted}`,
        USD: `${getCurrencySymbol('USD')} ${summary.USD.formatted}`
    };
};
