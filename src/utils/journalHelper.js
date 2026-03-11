/**
 * journalHelper.js — Centralized double-entry journal creation utility
 *
 * This module provides a single source of truth for resolving COA accounts
 * and creating journal entries across Invoice, AR, AP, COGS, and PO modules.
 *
 * COA account type mapping (based on standard Indonesian freight COA structure):
 *   ASSET       → code starts with 1 (Kas, Bank, Piutang, dll)
 *   LIABILITY   → code starts with 2 (Hutang Usaha, dll)
 *   EQUITY      → code starts with 3 (Modal, dll)
 *   REVENUE     → code starts with 4 (Pendapatan Jasa, dll)
 *   COGS        → code starts with 5 (HPP / COGS, dll)
 *   EXPENSE     → code starts with 6 (Beban Operasional, dll)
 *   OTHER_INCOME  → code starts with 7
 *   OTHER_EXPENSE → code starts with 8
 */

import { supabase } from '../lib/supabase';

// ── COA Cache (in-memory, refreshed per session) ─────────────────────────────
let _coaCache = null;
let _coaCacheTime = 0;
const COA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ── Utility: Safe UUID ────────────────────────────────────────────────────────
export function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function getAllCOA() {
    const now = Date.now();
    if (_coaCache && now - _coaCacheTime < COA_CACHE_TTL) return _coaCache;
    const { data, error } = await supabase
        .from('finance_coa')
        .select('id, code, name, type, is_active')
        .order('code', { ascending: true });
    if (error) throw error;
    _coaCache = data || [];
    _coaCacheTime = now;
    return _coaCache;
}

export function clearCOACache() { _coaCache = null; }

/**
 * Resolve a COA account by multiple strategies (in order of priority):
 *  1. Exact code match
 *  2. Code prefix match (`startsWith`)
 *  3. Type + name ilike (fallback)
 *
 * @param {Object} opts
 * @param {string[]} opts.codes        Exact codes to try (e.g. ['1-01-101'])
 * @param {string[]} opts.prefixes     Code prefixes to try (e.g. ['1-01', '1-02'])
 * @param {string}   opts.type         COA type ('ASSET', 'LIABILITY', etc.)
 * @param {string}   opts.nameHint     Partial name for ilike fallback
 * @param {Object[]} [opts.coaList]    Pre-fetched list (skip DB call if provided)
 */
export async function resolveCOA({ codes = [], prefixes = [], type, nameHint, coaList } = {}) {
    const list = coaList || await getAllCOA();

    // 1. Exact code match
    for (const code of codes) {
        const found = list.find(c => c.code === code && c.is_active !== false);
        if (found) return found;
    }

    // 2. Code prefix match (active accounts only)
    for (const prefix of prefixes) {
        const candidates = list.filter(c => c.code?.startsWith(prefix) && c.is_active !== false);
        // Prefer the most specific (deepest) level — least dashes
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (type) {
                    // Prefer matching type
                    const aMatch = a.type === type ? 0 : 1;
                    const bMatch = b.type === type ? 0 : 1;
                    if (aMatch !== bMatch) return aMatch - bMatch;
                }
                return a.code.localeCompare(b.code);
            });
            return candidates[0];
        }
    }

    // 3. Type + name ilike fallback
    if (type && nameHint) {
        const hint = nameHint.toLowerCase();
        const found = list.find(c =>
            c.type === type &&
            c.name?.toLowerCase().includes(hint) &&
            c.is_active !== false
        );
        if (found) return found;
    }

    // 4. Type only fallback (first active account of that type)
    if (type) {
        const found = list.find(c => c.type === type && c.is_active !== false);
        if (found) return found;
    }

    return null;
}

// ── Standard Account Resolvers ────────────────────────────────────────────────

/** Piutang Usaha (AR) — ASSET, code 1-03 / 1-04 */
export async function resolveARAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['1-03-001', '1-03-100', '1-04-001'],
        prefixes: ['1-03', '1-04'],
        type: 'ASSET',
        nameHint: 'piutang'
    }) || { code: '1-03-001', name: 'Piutang Usaha', id: null, type: 'ASSET' };
}

/** Revenue / Pendapatan — REVENUE, code 4 */
export async function resolveRevenueAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['4-01-001', '4-01-100', '4-01-301'],
        prefixes: ['4-01', '4-00', '4'],
        type: 'REVENUE',
        nameHint: 'pendapatan'
    }) || { code: '4-01-001', name: 'Pendapatan Jasa', id: null, type: 'REVENUE' };
}

/** Kas / Bank — ASSET, code 1-01 */
export async function resolveBankAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['1-01-101', '1-01-001', '1-01-100'],
        prefixes: ['1-01', '1-02'],
        type: 'ASSET',
        nameHint: 'bank'
    }) || { code: '1-01-101', name: 'Bank BCA', id: null, type: 'ASSET' };
}

/** Hutang Usaha (AP) — LIABILITY, code 2 */
export async function resolveAPAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['2-01-001', '2-01-100'],
        prefixes: ['2-01', '2'],
        type: 'LIABILITY',
        nameHint: 'hutang'
    }) || { code: '2-01-001', name: 'Hutang Usaha', id: null, type: 'LIABILITY' };
}

/** HPP / COGS — COGS, code 5 */
export async function resolveCOGSAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['5-01-001', '5-01-100'],
        prefixes: ['5-01', '5'],
        type: 'COGS',
        nameHint: 'hpp'
    }) || { code: '5-01-001', name: 'HPP - Ocean Freight', id: null, type: 'COGS' };
}

// ── Journal Entry Builder ─────────────────────────────────────────────────────

/**
 * Generate a unique journal entry number.
 * Format: JE-{PREFIX}-{YYMM}-{SEQ}
 */
export async function generateJENumber(prefix = 'TXN') {
    const now = new Date();
    const yymm = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const jePrefix = `JE-${prefix}-${yymm}-`;
    try {
        const { data } = await supabase
            .from('blink_journal_entries')
            .select('entry_number')
            .like('entry_number', `${jePrefix}%`)
            .order('entry_number', { ascending: false })
            .limit(1);
        const last = data?.[0]?.entry_number;
        const lastSeq = last ? parseInt(last.replace(jePrefix, '').split('-')[0]) || 0 : 0;
        return `${jePrefix}${String(lastSeq + 1).padStart(4, '0')}`;
    } catch {
        return `${jePrefix}${Date.now().toString().slice(-6)}`;
    }
}

/**
 * Build a standard journal entry row object.
 */
export function buildJERow({
    entryNumber, suffix = '', date, entryType, refType, refId, refNumber,
    coa, accountCodeFallback, accountNameFallback,
    debit = 0, credit = 0,
    currency = 'IDR', exchangeRate = 1,
    description, batchId, source = 'auto',
    partyName, partyId
}) {
    return {
        entry_number: `${entryNumber}${suffix}`,
        entry_date: date,
        entry_type: entryType,
        reference_type: refType,
        reference_id: refId || null,
        reference_number: refNumber || null,
        account_code: coa?.code || accountCodeFallback,
        account_name: coa?.name || accountNameFallback,
        debit,
        credit,
        currency,
        exchange_rate: exchangeRate,
        description,
        batch_id: batchId,
        source,
        coa_id: coa?.id || null,
        party_name: partyName || null,
        party_id: partyId ? String(partyId) : null
    };
}

/**
 * Insert journal entries and silently log errors (non-blocking).
 */
export async function insertJournalEntries(rows) {
    try {
        const { error } = await supabase.from('blink_journal_entries').insert(rows);
        if (error) {
            console.error('[Journal] Insert error:', error);
            return { success: false, error };
        }
        console.log(`[Journal] ${rows.length} entries created`);
        return { success: true };
    } catch (err) {
        console.error('[Journal] Exception:', err);
        return { success: false, error: err };
    }
}

// ── High-Level Journal Creators ───────────────────────────────────────────────

/**
 * Create journal entries for a new Invoice (AR + Revenue).
 * Dr Piutang Usaha / Cr Pendapatan Jasa
 */
export async function createInvoiceJournal({ invoice, coaList: providedCOA }) {
    const coaList = providedCOA || await getAllCOA();
    const [arCOA, defaultRevCOA] = await Promise.all([
        resolveARAccount(coaList),
        resolveRevenueAccount(coaList)
    ]);

    // Resolve Optional Tax/Discount Accounts
    let taxCOA = null, discountCOA = null;
    if (invoice.tax_amount > 0) {
        taxCOA = await resolveCOA({ coaList, prefixes: ['2'], type: 'LIABILITY', nameHint: 'pajak' }) || 
                 await resolveCOA({ coaList, prefixes: ['2'], type: 'LIABILITY' });
    }
    if (invoice.discount_amount > 0) {
        discountCOA = await resolveCOA({ coaList, prefixes: ['4', '5'], nameHint: 'diskon' }) || defaultRevCOA; 
    }

    const batchId = generateUUID();
    const jeNum = await generateJENumber('INV');
    const exRate = invoice.currency !== 'IDR' ? (invoice.exchange_rate || 16000) : 1;
    const note = invoice.currency !== 'IDR' ? ` (Rate: ${exRate.toLocaleString('id-ID')})` : '';
    const desc = `Invoice ${invoice.invoice_number} - ${invoice.customer_name}${note}`;

    const rows = [];

    // 1. Debit AR (Total amount to be paid)
    rows.push(buildJERow({
        entryNumber: jeNum, suffix: '-D',
        date: invoice.invoice_date,
        entryType: 'invoice', refType: 'ar',
        refId: invoice.id, refNumber: invoice.invoice_number,
        coa: arCOA,
        debit: invoice.total_amount, credit: 0,
        currency: invoice.currency, exchangeRate: exRate,
        description: desc, batchId, source: 'auto',
        partyName: invoice.customer_name, partyId: invoice.customer_id
    }));

    // 2. Debit Discount (if any)
    if (invoice.discount_amount > 0) {
        rows.push(buildJERow({
            entryNumber: jeNum, suffix: '-D-DISC',
            date: invoice.invoice_date,
            entryType: 'invoice', refType: 'ar',
            refId: invoice.id, refNumber: invoice.invoice_number,
            coa: discountCOA,
            debit: invoice.discount_amount, credit: 0,
            currency: invoice.currency, exchangeRate: exRate,
            description: `Discount - ${desc}`, batchId, source: 'auto',
            partyName: invoice.customer_name, partyId: invoice.customer_id
        }));
    }

    // 3. Credit Revenue (Detailed per item)
    const items = Array.isArray(invoice.invoice_items) ? invoice.invoice_items : [];
    if (items.length > 0) {
        let itemIdx = 0;
        for (const item of items) {
            const amount = parseFloat(item.amount) || 0;
            if (amount <= 0) continue;
            itemIdx++;

            let itemCOA = null;
            if (item.coa_id) itemCOA = coaList.find(c => c.id === item.coa_id) || null;
            if (!itemCOA) {
                itemCOA = await resolveCOA({
                    coaList,
                    prefixes: ['4'],
                    type: 'REVENUE',
                    nameHint: item.description || item.item_name
                }) || defaultRevCOA;
            }

            rows.push(buildJERow({
                entryNumber: jeNum, suffix: `-C${String(itemIdx).padStart(2, '0')}`,
                date: invoice.invoice_date,
                entryType: 'invoice', refType: 'ar',
                refId: invoice.id, refNumber: invoice.invoice_number,
                coa: itemCOA,
                debit: 0, credit: amount,
                currency: invoice.currency, exchangeRate: exRate,
                description: `${item.description || item.item_name || 'Income'} - ${desc}`, 
                batchId, source: 'auto',
                partyName: invoice.customer_name, partyId: invoice.customer_id
            }));
        }
    } else {
        // Fallback Revenue (if no items recorded)
        rows.push(buildJERow({
            entryNumber: jeNum, suffix: '-C01',
            date: invoice.invoice_date,
            entryType: 'invoice', refType: 'ar',
            refId: invoice.id, refNumber: invoice.invoice_number,
            coa: defaultRevCOA,
            debit: 0, credit: invoice.subtotal || invoice.total_amount,
            currency: invoice.currency, exchangeRate: exRate,
            description: desc, batchId, source: 'auto',
            partyName: invoice.customer_name, partyId: invoice.customer_id
        }));
    }

    // 4. Credit Tax (if any)
    if (invoice.tax_amount > 0) {
        rows.push(buildJERow({
            entryNumber: jeNum, suffix: '-C-TAX',
            date: invoice.invoice_date,
            entryType: 'invoice', refType: 'ar',
            refId: invoice.id, refNumber: invoice.invoice_number,
            coa: taxCOA,
            debit: 0, credit: invoice.tax_amount,
            currency: invoice.currency, exchangeRate: exRate,
            description: `Tax/VAT - ${desc}`, batchId, source: 'auto',
            partyName: invoice.customer_name, partyId: invoice.customer_id
        }));
    }

    return insertJournalEntries(rows);
}

/**
 * Create journal entries for AR Payment received.
 * Dr Kas/Bank / Cr Piutang Usaha
 */
export async function createARPaymentJournal({
    invoice, paymentAmount, paymentDate, paymentNumber, selectedBank, coaList: providedCOA
}) {
    const coaList = providedCOA || await getAllCOA();
    const [bankCOA, arCOA] = await Promise.all([
        resolveBankAccount(coaList),
        resolveARAccount(coaList)
    ]);
    const batchId = generateUUID();
    const jeNum = await generateJENumber('PAY-IN');
    const exRate = invoice.currency !== 'IDR' ? (invoice.exchange_rate || 16000) : 1;
    const note = invoice.currency !== 'IDR' ? ` (Rate: ${exRate.toLocaleString('id-ID')})` : '';
    const desc = `Payment received for ${invoice.invoice_number} from ${invoice.customer_name}${note}`;

    return insertJournalEntries([
        buildJERow({
            entryNumber: jeNum, suffix: '-D',
            date: paymentDate,
            entryType: 'payment', refType: 'ar_payment',
            refId: invoice.id, refNumber: paymentNumber,
            coa: bankCOA,
            accountNameFallback: selectedBank ? selectedBank.bank_name : 'Kas/Bank',
            debit: paymentAmount, credit: 0,
            currency: invoice.currency, exchangeRate: exRate,
            description: desc, batchId,
            partyName: invoice.customer_name, partyId: invoice.customer_id
        }),
        buildJERow({
            entryNumber: jeNum, suffix: '-C',
            date: paymentDate,
            entryType: 'payment', refType: 'ar_payment',
            refId: invoice.id, refNumber: paymentNumber,
            coa: arCOA,
            debit: 0, credit: paymentAmount,
            currency: invoice.currency, exchangeRate: exRate,
            description: desc, batchId,
            partyName: invoice.customer_name, partyId: invoice.customer_id
        })
    ]);
}

/**
 * Create journal entries for COGS recognition (when invoice is created).
 * Dr HPP (COGS) / Cr Persediaan / Biaya Langsung
 * Note: Only creates if cogsAmount > 0
 */
export async function createCOGSJournal({ invoice, cogsAmount, coaList: providedCOA }) {
    if (!cogsAmount || cogsAmount <= 0) return { success: true, skipped: true };
    const coaList = providedCOA || await getAllCOA();
    const defaultCOGS = await resolveCOGSAccount(coaList);
    const defaultCost = await resolveCOA({
        coaList,
        prefixes: ['5-02', '5'],
        type: 'COGS',
        nameHint: 'biaya'
    }) || defaultCOGS;

    const batchId = generateUUID();
    const jeNum = await generateJENumber('COGS');
    const exRate = invoice.currency !== 'IDR' ? (invoice.exchange_rate || 16000) : 1;
    const desc = `COGS - ${invoice.invoice_number} - ${invoice.customer_name}`;

    const rows = [];
    const items = Array.isArray(invoice.cogs_items) ? invoice.cogs_items : [];

    // 1. Debit COGS (Detailed per item)
    if (items.length > 0) {
        let itemIdx = 0;
        for (const item of items) {
            const amount = parseFloat(item.amount) || 0;
            if (amount <= 0) continue;
            itemIdx++;

            let itemCOA = null;
            if (item.coa_id) itemCOA = coaList.find(c => c.id === item.coa_id) || null;
            if (!itemCOA) {
                itemCOA = await resolveCOA({
                    coaList,
                    prefixes: ['5', '6'],
                    type: 'COGS',
                    nameHint: item.description || item.item_name
                }) || defaultCOGS;
            }

            rows.push(buildJERow({
                entryNumber: jeNum, suffix: `-D${String(itemIdx).padStart(2, '0')}`,
                date: invoice.invoice_date,
                entryType: 'cogs', refType: 'invoice',
                refId: invoice.id, refNumber: invoice.invoice_number,
                coa: itemCOA,
                debit: amount, credit: 0,
                currency: invoice.currency, exchangeRate: exRate,
                description: `${item.description || item.item_name || 'HPP'} - ${desc}`,
                batchId
            }));
        }
    } else {
        // Fallback Debit COGS (lump sum)
        rows.push(buildJERow({
            entryNumber: jeNum, suffix: '-D01',
            date: invoice.invoice_date,
            entryType: 'cogs', refType: 'invoice',
            refId: invoice.id, refNumber: invoice.invoice_number,
            coa: defaultCOGS,
            debit: cogsAmount, credit: 0,
            currency: invoice.currency, exchangeRate: exRate,
            description: desc, batchId
        }));
    }

    // 2. Credit Cost/Inventory (Lump Sum)
    rows.push(buildJERow({
        entryNumber: jeNum, suffix: '-C',
        date: invoice.invoice_date,
        entryType: 'cogs', refType: 'invoice',
        refId: invoice.id, refNumber: invoice.invoice_number,
        coa: defaultCost,
        debit: 0, credit: cogsAmount,
        currency: invoice.currency, exchangeRate: exRate,
        description: desc, batchId
    }));

    return insertJournalEntries(rows);
}

/**
 * Create journal entries for AP Payment sent.
 * Dr Hutang Usaha / Cr Kas/Bank
 */
export async function createAPPaymentJournal({
    ap, paymentAmount, paymentDate, paymentNumber, selectedBank, coaList: providedCOA
}) {
    const coaList = providedCOA || await getAllCOA();
    const [apCOA, bankCOA] = await Promise.all([
        resolveAPAccount(coaList),
        resolveBankAccount(coaList)
    ]);
    const batchId = generateUUID();
    const jeNum = await generateJENumber('PAY-OUT');
    const exRate = ap.currency !== 'IDR' ? (ap.exchange_rate || 16000) : 1;
    const note = ap.currency !== 'IDR' ? ` (Rate: ${exRate.toLocaleString('id-ID')})` : '';
    const desc = `Payment for ${ap.po_number || ap.ap_number} to ${ap.vendor_name}${note}`;

    return insertJournalEntries([
        buildJERow({
            entryNumber: jeNum, suffix: '-D',
            date: paymentDate,
            entryType: 'bill_payment', refType: 'ap_payment',
            refId: ap.id, refNumber: paymentNumber,
            coa: apCOA,
            debit: paymentAmount, credit: 0,
            currency: ap.currency, exchangeRate: exRate,
            description: desc, batchId,
            partyName: ap.vendor_name, partyId: ap.vendor_id
        }),
        buildJERow({
            entryNumber: jeNum, suffix: '-C',
            date: paymentDate,
            entryType: 'bill_payment', refType: 'ap_payment',
            refId: ap.id, refNumber: paymentNumber,
            coa: bankCOA,
            accountNameFallback: selectedBank ? selectedBank.bank_name : 'Kas/Bank',
            debit: 0, credit: paymentAmount,
            currency: ap.currency, exchangeRate: exRate,
            description: desc, batchId,
            partyName: ap.vendor_name, partyId: ap.vendor_id
        })
    ]);
}

/**
 * Create journal entries for PO approval (Expense + AP).
 * Dr Beban/COGS / Cr Hutang Usaha
 */
export async function createPOApprovalJournal({ po, coaList: providedCOA }) {
    const coaList = providedCOA || await getAllCOA();
    const [apCOA] = await Promise.all([resolveAPAccount(coaList)]);
    const batchId = generateUUID();
    const jeNum = await generateJENumber('PO');
    const exRate = po.currency !== 'IDR' ? (po.exchange_rate || 16000) : 1;
    const desc = `PO Approved: ${po.po_number} - ${po.vendor_name}`;

    // Build per-item debit entries + one lump AP credit
    const rows = [];
    const items = Array.isArray(po.po_items) ? po.po_items : [];

    if (items.length > 0) {
        let itemIdx = 0;
        for (const item of items) {
            const amount = parseFloat(item.amount) || 0;
            if (amount <= 0) continue;
            itemIdx++;

            // Resolve item COA (from item.coa_id or default COGS/Expense)
            let itemCOA = null;
            if (item.coa_id) {
                itemCOA = coaList.find(c => c.id === item.coa_id) || null;
            }
            if (!itemCOA) {
                itemCOA = await resolveCOA({
                    coaList,
                    prefixes: ['5', '6'],
                    type: 'COGS',
                    nameHint: item.item_name || item.description
                });
            }

            rows.push(buildJERow({
                entryNumber: jeNum, suffix: `-D${String(itemIdx).padStart(2, '0')}`,
                date: po.po_date || new Date().toISOString().split('T')[0],
                entryType: 'purchase_order', refType: 'po',
                refId: po.id, refNumber: po.po_number,
                coa: itemCOA,
                debit: amount, credit: 0,
                currency: po.currency, exchangeRate: exRate,
                description: `${item.item_name || item.description || 'Item'} - ${desc}`,
                batchId, partyName: po.vendor_name, partyId: po.vendor_id
            }));
        }
    } else {
        // Fallback: single debit entry for total
        const expCOA = await resolveCOA({ coaList, prefixes: ['5', '6'], type: 'COGS' });
        rows.push(buildJERow({
            entryNumber: jeNum, suffix: '-D01',
            date: po.po_date || new Date().toISOString().split('T')[0],
            entryType: 'purchase_order', refType: 'po',
            refId: po.id, refNumber: po.po_number,
            coa: expCOA,
            debit: po.total_amount, credit: 0,
            currency: po.currency, exchangeRate: exRate,
            description: desc, batchId,
            partyName: po.vendor_name, partyId: po.vendor_id
        }));
    }

    // AP Credit (single row for total)
    rows.push(buildJERow({
        entryNumber: jeNum, suffix: '-C',
        date: po.po_date || new Date().toISOString().split('T')[0],
        entryType: 'purchase_order', refType: 'po',
        refId: po.id, refNumber: po.po_number,
        coa: apCOA,
        debit: 0, credit: po.total_amount,
        currency: po.currency, exchangeRate: exRate,
        description: desc, batchId,
        partyName: po.vendor_name, partyId: po.vendor_id
    }));

    return insertJournalEntries(rows);
}
