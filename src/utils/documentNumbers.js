/**
 * Blink Document Number Generator
 * Standardized numbering format for all Blink documents
 * 
 * Format:
 * - Quotation: BFWYYMM-XXXX
 * - SO: BFWYYMM-SO-XXXX (follows quotation number)
 * - Invoice: INV-BFWYYMM-XXXX (follows quotation number)
 * - PO: PO-BFWYYMM-XXXX
 */

import { supabase } from '../lib/supabase';
import { normalizeBlinkNumberPrefix } from './blinkNumberPrefix';

/**
 * Get current YYMM format
 * @returns {string} e.g., "2601" for January 2026
 */
export const getYYMM = () => {
    const date = new Date();
    const yy = date.getFullYear().toString().substr(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yy}${mm}`;
};

/**
 * Generate Quotation Number
 * Format: BFWYYMM-XXXX
 * @returns {Promise<string>} Generated quotation number
 */
export const generateQuotationNumber = async () => {
    const yymm = getYYMM();
    const prefix = `BFW${yymm}`;

    try {
        // Get the latest quotation number for this month
        const { data, error } = await supabase
            .from('blink_quotations')
            .select('quotation_number')
            .like('quotation_number', `${prefix}%`)
            .order('quotation_number', { ascending: false })
            .limit(1);

        if (error) throw error;

        let nextNumber = 1;
        if (data && data.length > 0) {
            // Extract the sequence number from the last quotation
            const lastNumber = data[0].quotation_number;
            const match = lastNumber.match(/-(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating quotation number:', error);
        // Fallback using timestamp
        return `${prefix}-${String(Date.now()).slice(-4)}`;
    }
};

/**
 * Generate Sales Quotation Number
 * Format: SQT-BFWYYMM-XXXX
 * @returns {Promise<string>} Generated sales quotation number
 */
export const generateSalesQuotationNumber = async () => {
    const yymm = getYYMM();
    const prefix = `SQT-BFW${yymm}`;

    try {
        // Get the latest sales quotation number for this month
        const { data, error } = await supabase
            .from('blink_sales_quotations')
            .select('quotation_number')
            .like('quotation_number', `${prefix}%`)
            .order('quotation_number', { ascending: false })
            .limit(1);

        if (error) throw error;

        let nextNumber = 1;
        if (data && data.length > 0) {
            // Extract the sequence number from the last quotation
            const lastNumber = data[0].quotation_number;
            const match = lastNumber.match(/-(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating sales quotation number:', error);
        // Fallback using timestamp
        return `${prefix}-${String(Date.now()).slice(-4)}`;
    }
};

/**
 * Generate SO Number from Quotation Number
 * Format: BFWYYMM-SO-XXXX (based on quotation number)
 * @param {string} quotationNumber - The base quotation number
 * @returns {string} SO number
 */
export const generateSONumber = (quotationNumber) => {
    if (!quotationNumber) {
        const yymm = getYYMM();
        return `BFW${yymm}-SO-0001`;
    }

    // Insert -SO- before the sequence number
    // BFW2601-0001 -> BFW2601-SO-0001
    const normalizedNumber = normalizeBlinkNumberPrefix(quotationNumber);
    const parts = normalizedNumber.split('-');
    if (parts.length >= 2) {
        return `${parts[0]}-SO-${parts[1]}`;
    }

    return `${normalizedNumber}-SO`;
};

/**
 * Generate Invoice Number from Quotation Number
 * Format: INV-BFWYYMM-XXXX (based on quotation number)
 * @param {string} quotationNumber - The base quotation number
 * @returns {string} Invoice number
 */
/**
 * Generate Invoice Number from Quotation Number (Async & Unique)
 * Format: INV-BFWYYMM-XXXX[-N]
 * Checks DB for existing invoice numbers to avoid duplicates
 * @param {string} quotationNumber - The base quotation number
 * @returns {Promise<string>} Invoice number
 */
export const generateInvoiceNumber = async (quotationNumber) => {
    let baseNumber;
    if (!quotationNumber) {
        const yymm = getYYMM();
        baseNumber = `INV-BFW${yymm}-0001`;
    } else {
        baseNumber = `INV-${normalizeBlinkNumberPrefix(quotationNumber)}`;
    }

    try {
        // Check if this invoice number already exists
        const { data, error } = await supabase
            .from('blink_invoices')
            .select('invoice_number')
            .like('invoice_number', `${baseNumber}%`)
            .order('invoice_number', { ascending: false });

        if (error) throw error;

        // If no matches, return base number
        if (!data || data.length === 0) {
            return baseNumber;
        }

        // Check specifically for exact match
        const exactMatch = data.find(d => d.invoice_number === baseNumber);
        if (!exactMatch) return baseNumber; // Base number available

        // If exact match exists, find the next available suffix
        // Patterns: BASE, BASE-1, BASE-2...
        let maxSuffix = 0;
        data.forEach(row => {
            const num = row.invoice_number;
            if (num === baseNumber) return;

            const suffixPart = num.replace(baseNumber + '-', '');
            const suffixInt = parseInt(suffixPart);
            if (!isNaN(suffixInt) && suffixInt > maxSuffix) {
                maxSuffix = suffixInt;
            }
        });

        return `${baseNumber}-${maxSuffix + 1}`;

    } catch (error) {
        console.error('Error generating unique invoice number:', error);
        // Fallback: append timestamp to ensure uniqueness in case of DB error
        return `${baseNumber}-${String(Date.now()).slice(-4)}`;
    }
};

/**
 * Generate Bridge Invoice Number from Quotation/Pengajuan Number (Async & Unique)
 * Format: BRG-{quotationNumber} or BRG-INV-YYMM-XXXX when no quotationNumber
 * Checks `bridge_invoices` for existing invoice numbers to avoid duplicates
 */
export const generateBridgeInvoiceNumber = async (quotationNumber) => {
    let baseNumber;
    if (!quotationNumber) {
        const yymm = getYYMM();
        baseNumber = `BRG-INV-${yymm}-0001`;
    } else {
        baseNumber = `BRG-${quotationNumber}`;
    }

    try {
        const { data, error } = await supabase
            .from('bridge_invoices')
            .select('invoice_number')
            .like('invoice_number', `${baseNumber}%`)
            .order('invoice_number', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            return baseNumber;
        }

        const exactMatch = data.find(d => d.invoice_number === baseNumber);
        if (!exactMatch) return baseNumber;

        let maxSuffix = 0;
        data.forEach(row => {
            const num = row.invoice_number;
            if (num === baseNumber) return;

            const suffixPart = num.replace(baseNumber + '-', '');
            const suffixInt = parseInt(suffixPart);
            if (!isNaN(suffixInt) && suffixInt > maxSuffix) {
                maxSuffix = suffixInt;
            }
        });

        return `${baseNumber}-${maxSuffix + 1}`;

    } catch (error) {
        console.error('Error generating bridge invoice number:', error);
        return `${baseNumber}-${String(Date.now()).slice(-4)}`;
    }
};

/**
 * Generate Additional (Versioned) Invoice Number
 * @param {string} sourceInvoiceNumber - Base invoice number
 * @param {string} tableName - DB table name ('blink_invoices' or 'bridge_invoices')
 * @returns {Promise<string>} e.g. "INV-BFW2607-0001-v1", "INV-BFW2607-0001-v2"
 */
export const generateAdditionalInvoiceNumber = async (sourceInvoiceNumber, tableName = 'blink_invoices') => {
    if (!sourceInvoiceNumber) return '';

    // Strip existing version suffix if any (e.g., -v1, -v2, v1, etc.)
    const sourceNumber = tableName === 'blink_invoices'
        ? normalizeBlinkNumberPrefix(sourceInvoiceNumber)
        : sourceInvoiceNumber;
    const rootBase = sourceNumber.replace(/[-_]?v\d+$/i, '');

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('invoice_number')
            .like('invoice_number', `${rootBase}%`);

        if (error) throw error;

        let maxVersion = 0;
        if (data && data.length > 0) {
            data.forEach(row => {
                const num = row.invoice_number || '';
                const escapedRoot = rootBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`^${escapedRoot}[-_]?v(\\d+)$`, 'i');
                const match = num.match(regex);
                if (match) {
                    const ver = parseInt(match[1], 10);
                    if (!isNaN(ver) && ver > maxVersion) {
                        maxVersion = ver;
                    }
                }
            });
        }

        return `${rootBase}-v${maxVersion + 1}`;
    } catch (error) {
        console.error('Error generating additional invoice number:', error);
        return `${rootBase}-v1`;
    }
};


const generatePONumberWithCode = async (code) => {
    const yymm = getYYMM();
    const prefix = `PO-${code}${yymm}`;

    try {
        // Get the latest PO number for this month
        const { data, error } = await supabase
            .from('blink_purchase_orders')
            .select('po_number')
            .like('po_number', `${prefix}%`)
            .order('po_number', { ascending: false })
            .limit(1);

        if (error) throw error;

        let nextNumber = 1;
        if (data && data.length > 0) {
            // Extract the sequence number from the last PO
            const lastNumber = data[0].po_number;
            const match = lastNumber.match(/-(\d+)$/);
            if (match) {
                nextNumber = parseInt(match[1]) + 1;
            }
        }

        return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
    } catch (error) {
        console.error('Error generating PO number:', error);
        // Fallback using timestamp
        return `${prefix}-${String(Date.now()).slice(-4)}`;
    }
};

// Keep the legacy prefix for Bridge purchase orders.
export const generatePONumber = () => generatePONumberWithCode('BLK');
/** Generate a Blink PO number in the PO-BFWYYMM-XXXX format. */
export const generateBlinkPONumber = () => generatePONumberWithCode('BFW');

/**
 * Generate AP Number
 * Format: AP-YYMM-XXXXXX
 * @returns {string} AP number
 */
export const generateAPNumber = () => {
    const yymm = getYYMM();
    const uniqueStr = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    return `AP-${yymm}-${uniqueStr}`;
};

/**
 * Generate AR Number
 * Format: AR-YYMM-XXXXXX
 * @returns {string} AR number
 */
export const generateARNumber = () => {
    const yymm = getYYMM();
    const uniqueStr = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    return `AR-${yymm}-${uniqueStr}`;
};

/**
 * Generate Payment Number
 * Format: PAY-IN-YYMM-XXXXXX (incoming) or PAY-OUT-YYMM-XXXXXX (outgoing)
 * @param {string} type - 'in' or 'out'
 * @returns {string} Payment number
 */
export const generatePaymentNumber = (type = 'in') => {
    const yymm = getYYMM();
    const suffix = type === 'out' ? 'OUT' : 'IN';
    const uniqueStr = `${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`;
    return `PAY-${suffix}-${yymm}-${uniqueStr}`;
};
