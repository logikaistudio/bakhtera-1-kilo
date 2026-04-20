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
import { generateAPNumber, generateARNumber } from './documentNumbers';

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

export async function journalEntriesHasColumn(columnName) {
    if (!columnName) return false;

    const normalizeError = (err) => String(err?.message || err?.details || err || '').toLowerCase();
    const isMissingColumn = (err) => {
        const msg = normalizeError(err);
        return msg.includes(`column \"${columnName}\"`) || msg.includes(`column ${columnName}`) || msg.includes(`could not find the '${columnName}'`);
    };

    const attempts = [
        async () => {
            const { data, error } = await supabase
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_schema', 'public')
                .eq('table_name', 'blink_journal_entries')
                .eq('column_name', columnName)
                .limit(1);
            if (error) throw error;
            return Array.isArray(data) && data.length > 0;
        },
        async () => {
            const { error } = await supabase
                .from('blink_journal_entries')
                .select(columnName)
                .limit(1);
            if (error) throw error;
            return true;
        }
    ];

    for (const attempt of attempts) {
        try {
            return await attempt();
        } catch (err) {
            if (isMissingColumn(err)) {
                return false;
            }
            // Column might exist but access is restricted — treat as 'unknown', not an error
            console.debug('[Journal] Column detection probe returned error (non-critical):', err?.message || err?.code);
        }
    }

    return false;
}

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

    // 2. Type + name ilike (Best Text Match)
    if (type && nameHint) {
        const hint = nameHint.toLowerCase().trim();
        // Check active accounts of exactly this type
        const typeCandidates = list.filter(c => c.type === type && c.is_active !== false);
        // Sort candidates from longest to shortest name to avoid matching generic short words first
        typeCandidates.sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
        
        // Find best match by direct inclusion
        let bestMatch = null;
        for (const can of typeCandidates) {
            if (can.name) {
                const canName = can.name.toLowerCase().trim();
                // Bidirectional check (at least 3 characters to avoid meaningless short matches):
                // 1. Does the COA Name contain the Invoice Description (e.g. "Handling" -> "Handling Charges")
                // 2. Does the Invoice Description contain the COA Name (e.g. "Ocean freight jkt vietnam" -> "Ocean Freight")
                // Also handles slashes (e.g. "Trucking / Darat" -> "Trucking")
                const parts = canName.split('/').map(p => p.trim());
                const isMatch = parts.some(p => p.length >= 3 && (p.includes(hint) || hint.includes(p)));
                
                if (hint.length >= 3 && canName.length >= 3 && isMatch) {
                    bestMatch = can;
                    break; // Take the first best matching
                }
            }
        }
        if (bestMatch) return bestMatch;

        // Fallback to Fuzzy / Typo matching (e.g., "Hanling" -> "Handling")
        function levenshtein(s1, s2) {
            if (!s1 || !s2) return 99;
            if (s1.length === 0) return s2.length;
            if (s2.length === 0) return s1.length;
            let v0 = new Array(s2.length + 1).fill(0).map((_, i) => i);
            let v1 = new Array(s2.length + 1).fill(0);
            for (let i = 0; i < s1.length; i++) {
                v1[0] = i + 1;
                for (let j = 0; j < s2.length; j++) {
                    let cost = (s1[i] === s2[j]) ? 0 : 1;
                    v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
                }
                for (let j = 0; j < v0.length; j++) v0[j] = v1[j];
            }
            return v1[s2.length];
        }

        const hintWords = hint.split(/\s+/).filter(w => w.length >= 4); // only check typos for words >= 4 chars
        let bestDistance = Infinity;

        for (const can of typeCandidates) {
            if (!can.name) continue;
            const canName = can.name.toLowerCase().trim();
            const canWords = canName.split(/\s+|\//).map(w => w.trim()).filter(w => w.length >= 4);

            for (const hw of hintWords) {
                for (const cw of canWords) {
                    const dist = levenshtein(hw, cw);
                    const maxLen = Math.max(hw.length, cw.length);
                    // Match if 1 error max or 2 errors on very long words, ignoring exact length mismatch
                    if (dist <= 2 && dist < maxLen / 2) {
                        if (dist < bestDistance) {
                            bestDistance = dist;
                            bestMatch = can;
                        }
                    }
                }
            }
        }

        if (bestMatch) return bestMatch;
    }

    // 3. Code prefix match (Fallback to general group account if name not matched)
    for (const prefix of prefixes) {
        const candidates = list.filter(c => c.code?.startsWith(prefix) && c.is_active !== false);
        if (candidates.length > 0) {
            candidates.sort((a, b) => {
                if (type) {
                    const aMatch = a.type === type ? 0 : 1;
                    const bMatch = b.type === type ? 0 : 1;
                    if (aMatch !== bMatch) return aMatch - bMatch;
                }
                return a.code.localeCompare(b.code);
            });
            return candidates[0]; // Returns first account in that group (e.g., 4-01-100)
        }
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
        codes: ['1200', '1-03-001', '1-03-100', '1-04-001'],
        prefixes: ['12', '1-03', '1-04'],
        type: 'ASSET',
        nameHint: 'piutang'
    }) || { code: '1200', name: 'Piutang Usaha', id: null, type: 'ASSET' };
}

/** Revenue / Pendapatan — REVENUE, code 4 */
export async function resolveRevenueAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['4100', '4000', '4-01-001', '4-01-100', '4-01-301'],
        prefixes: ['4-01', '4-00', '4'],
        type: 'REVENUE',
        nameHint: 'pendapatan'
    }) || { code: '4100', name: 'Pendapatan Jasa', id: null, type: 'REVENUE' };
}

/**
 * Kas / Bank — ASSET, code 1-01
 *
 * Priority resolution order:
 *  1. If selectedBank is provided AND it has coa_id → use that exact COA (100% accurate)
 *  2. If selectedBank has coa_code → match by exact code in COA list
 *  3. If selectedBank has bank_name → fuzzy search in COA list by name
 *  4. Generic fallback: first ASSET account with code starting 1-01
 *
 * @param {Object[]} coaList       Pre-fetched COA list
 * @param {Object}   [selectedBank] The bank account object chosen by user in AR/AP form
 */
export async function resolveBankAccount(coaList, selectedBank = null) {
    // Strategy 1: Direct COA ID from bank mapping (most accurate)
    if (selectedBank?.coa_id) {
        const exact = coaList.find(c => c.id === selectedBank.coa_id && c.is_active !== false);
        if (exact) return exact;
    }

    // Strategy 2: Exact COA code stored on the bank record
    if (selectedBank?.coa_code) {
        const byCode = coaList.find(c => c.code === selectedBank.coa_code && c.is_active !== false);
        if (byCode) return byCode;
    }

    // Strategy 3: Search by bank name in COA names (e.g. 'BCA' → 'Bank BCA IDR')
    if (selectedBank?.bank_name) {
        const hint = selectedBank.bank_name.toLowerCase().trim();
        const byName = coaList.find(c =>
            c.is_active !== false &&
            c.type === 'ASSET' &&
            c.code?.startsWith('1-0') &&
            c.name?.toLowerCase().includes(hint)
        );
        if (byName) return byName;
    }

    // Strategy 4: Fuzzy generic fallback (no bank pre-selected)
    return resolveCOA({
        coaList,
        codes: ['1-01-101', '1-01-001', '1-01-100'],
        prefixes: ['1-01', '1-02'],
        type: 'ASSET',
        nameHint: 'bank'
    }) || { code: '1-01-101', name: 'Kas/Bank', id: null, type: 'ASSET' };
}

/** Hutang Usaha (AP) — LIABILITY, code 2 */
export async function resolveAPAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['2000', '2100', '2-01-001', '2-01-100'],
        prefixes: ['2-01', '2'],
        type: 'LIABILITY',
        nameHint: 'hutang'
    }) || { code: '2000', name: 'Hutang Usaha', id: null, type: 'LIABILITY' };
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
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    try {
        const { data } = await supabase
            .from('blink_journal_entries')
            .select('entry_number')
            .like('entry_number', `${jePrefix}%`)
            .order('entry_number', { ascending: false })
            .limit(1);
        const last = data?.[0]?.entry_number;
        // The lastSeq part stops at the first dash since we split by '-' 
        const lastSeq = last ? parseInt(last.replace(jePrefix, '').split('-')[0]) || 0 : 0;
        return `${jePrefix}${String(lastSeq + 1).padStart(4, '0')}-${randomStr}`;
    } catch {
        return `${jePrefix}${Date.now().toString().slice(-6)}-${randomStr}`;
    }
}

/**
 * Build a standard journal entry row object.
 */
export function getPeriodFromDate(date) {
    const parsed = date ? new Date(date) : new Date();
    if (Number.isNaN(parsed.getTime())) {
        return { periodMonth: null, periodYear: null };
    }
    return {
        periodMonth: parsed.getUTCMonth() + 1,
        periodYear: parsed.getUTCFullYear()
    };
}

export function roundToTwo(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

export function buildJERow({
    entryNumber, suffix = '', date, entryType, refType, refId, refNumber,
    coa, accountCodeFallback, accountNameFallback,
    debit = 0, credit = 0,
    currency = 'IDR', exchangeRate = 1,
    description, batchId, source = 'auto',
    partyName, partyId,
    journalType = 'auto',
    cashDirection = 'other',
    periodMonth,
    periodYear,
    foreignAmount,
    foreignCurrency = 'IDR',
    reversalOfBatchId = null,
    isKBITransaction = false
}) {
    const period = getPeriodFromDate(date);
    const computedForeignAmount = typeof foreignAmount === 'number'
        ? foreignAmount
        : currency && currency.toUpperCase() !== 'IDR'
            ? roundToTwo(debit + credit)
            : null;
    const resolvedJournalType = journalType || (source === 'manual' ? 'general' : 'auto');

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
        foreign_amount: computedForeignAmount,
        foreign_currency: foreignCurrency || currency,
        journal_type: resolvedJournalType,
        cash_direction: cashDirection,
        period_month: periodMonth ?? period.periodMonth,
        period_year: periodYear ?? period.periodYear,
        reversal_of_batch_id: reversalOfBatchId,
        is_kbi_transaction: Boolean(isKBITransaction),
        description,
        batch_id: batchId,
        source,
        coa_id: coa?.id || null,
        party_name: partyName || null,
        party_id: partyId ? String(partyId) : null
    };
}

export function resolveKBIAccount(coaList) {
    return resolveCOA({
        coaList,
        codes: ['1-01-101', '1-01-102', '1-01-103'],
        prefixes: ['1-01'],
        type: 'ASSET',
        nameHint: 'KBI'
    }) || { code: '1-01-101', name: 'KBI Account', id: null, type: 'ASSET' };
}

export function convertCurrency(amount, fromCurrency, toCurrency = 'IDR', exchangeRate = 1) {
    if (!amount || fromCurrency === toCurrency) return Number(amount) || 0;
    if (!exchangeRate || exchangeRate === 0) {
        throw new Error('Missing exchange rate for currency conversion');
    }
    return roundToTwo(Number(amount) * Number(exchangeRate));
}

export async function createGeneralJournal({ entries, description, batchId, periodMonth, periodYear, createdBy }) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return { success: false, skipped: true, reason: 'no_entries' };
    }
    const jeNum = await generateJENumber('GEN');
    const rows = entries.map((entry, index) => buildJERow({
        entryNumber: jeNum,
        suffix: `-G${String(index + 1).padStart(2, '0')}`,
        date: entry.date || new Date().toISOString().split('T')[0],
        entryType: entry.entryType || 'adjustment',
        refType: entry.refType || 'manual',
        refId: entry.refId || null,
        refNumber: entry.refNumber || null,
        coa: entry.coa,
        accountCodeFallback: entry.accountCodeFallback,
        accountNameFallback: entry.accountNameFallback,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        currency: entry.currency || 'IDR',
        exchangeRate: entry.exchangeRate || 1,
        description: entry.description || description,
        batchId,
        source: 'manual',
        journalType: 'general',
        cashDirection: entry.cashDirection || 'other',
        periodMonth,
        periodYear,
        foreignAmount: entry.foreignAmount,
        foreignCurrency: entry.foreignCurrency || entry.currency || 'IDR',
        reversalOfBatchId: null,
        isKBITransaction: entry.isKBITransaction || false,
        partyName: entry.partyName,
        partyId: entry.partyId
    }));
    return insertJournalEntries(rows);
}

export async function createReversalJournal({ originalBatchId, entries, description, batchId, periodMonth, periodYear, reversedBy }) {
    if (!originalBatchId || !Array.isArray(entries) || entries.length === 0) {
        return { success: false, skipped: true, reason: 'invalid_reversal' };
    }
    const jeNum = await generateJENumber('REV');
    const rows = entries.map((entry, index) => buildJERow({
        entryNumber: jeNum,
        suffix: `-R${String(index + 1).padStart(2, '0')}`,
        date: entry.date || new Date().toISOString().split('T')[0],
        entryType: entry.entryType || 'adjustment',
        refType: entry.refType || 'manual',
        refId: entry.refId || null,
        refNumber: entry.refNumber || null,
        coa: entry.coa,
        accountCodeFallback: entry.accountCodeFallback,
        accountNameFallback: entry.accountNameFallback,
        debit: entry.debit || 0,
        credit: entry.credit || 0,
        currency: entry.currency || 'IDR',
        exchangeRate: entry.exchangeRate || 1,
        description: entry.description || description,
        batchId,
        source: 'manual',
        journalType: 'reversal',
        cashDirection: entry.cashDirection || 'other',
        periodMonth,
        periodYear,
        foreignAmount: entry.foreignAmount,
        foreignCurrency: entry.foreignCurrency || entry.currency || 'IDR',
        reversalOfBatchId: originalBatchId,
        isKBITransaction: entry.isKBITransaction || false,
        partyName: entry.partyName,
        partyId: entry.partyId
    }));
    return insertJournalEntries(rows);
}

export async function createNoteJournal({ note, referenceType, referenceId, refNumber, date, batchId, periodMonth, periodYear, createdBy }) {
    if (!note) {
        return { success: false, skipped: true, reason: 'missing_note' };
    }
    const jeNum = await generateJENumber('NOTE');
    const row = buildJERow({
        entryNumber: jeNum,
        suffix: '-N',
        date: date || new Date().toISOString().split('T')[0],
        entryType: 'note',
        refType: referenceType || 'audit_note',
        refId: referenceId || null,
        refNumber: refNumber || null,
        coa: null,
        accountCodeFallback: '999-999',
        accountNameFallback: note,
        debit: 0,
        credit: 0,
        currency: 'IDR',
        exchangeRate: 1,
        description: note,
        batchId,
        source: 'manual',
        journalType: 'note',
        cashDirection: 'other',
        periodMonth,
        periodYear,
        foreignAmount: null,
        foreignCurrency: 'IDR',
        reversalOfBatchId: null,
        isKBITransaction: false,
        partyName: createdBy,
        partyId: createdBy ? String(createdBy) : null
    });
    return insertJournalEntries([row]);
}

/**
 * Strip unsupported columns from rows when the Supabase schema is older than the app schema.
 */
function sanitizeRowsForColumns(rows, columnsToRemove) {
    return rows.map(row => {
        const sanitized = { ...row };
        columnsToRemove.forEach(col => delete sanitized[col]);
        return sanitized;
    });
}

function extractMissingColumnsFromError(errorMessage) {
    const missing = new Set();
    if (!errorMessage) return missing;

    const schemaMatch = [...errorMessage.matchAll(/Could not find the '([^']+)' column of 'blink_journal_entries' in the schema cache/gi)];
    schemaMatch.forEach(m => missing.add(m[1]));

    const columnMatch = [...errorMessage.matchAll(/column "([^"]+)" of relation .* does not exist/gi)];
    columnMatch.forEach(m => missing.add(m[1]));

    const genericMatch = [...errorMessage.matchAll(/column "([^"]+)" does not exist/gi)];
    genericMatch.forEach(m => missing.add(m[1]));

    return missing;
}

/**
 * Insert journal entries and retry if the target schema doesn't support optional fields.
 */
export async function insertJournalEntries(rows) {
    let currentRows = rows;
    const removedColumns = new Set();
    let attempt = 0;

    while (attempt < 20) {
        attempt += 1;
        try {
            const { data, error } = await supabase.from('blink_journal_entries').insert(currentRows);
            if (!error) {
                console.log(`[Journal] ${currentRows.length} entries created on attempt ${attempt}`);
                return { success: true, data };
            }

            const message = String(error.message || error.details || error.hint || '');
            console.error(`[Journal] Insert attempt ${attempt} failed:`, message);

            const missingColumns = Array.from(extractMissingColumnsFromError(message))
                .filter(col => !removedColumns.has(col));

            if (!missingColumns.length) {
                return { success: false, error };
            }

            missingColumns.forEach(col => removedColumns.add(col));
            currentRows = sanitizeRowsForColumns(currentRows, missingColumns);
            console.warn(`[Journal] Retrying insert without unsupported columns: ${missingColumns.join(', ')}`);
            continue;
        } catch (err) {
            console.error('[Journal] Exception during insert:', err);
            return { success: false, error: err };
        }
    }

    return { success: false, error: new Error('Journal insert failed after multiple retries') };
}

export async function journalExists({ refType, refId, entryType, refNumber } = {}) {
    if (!refType || !refId) return false;
    try {
        const refTypes = Array.isArray(refType) ? refType : [refType];
        let query = supabase
            .from('blink_journal_entries')
            .select('id', { count: 'exact', head: true })
            .in('reference_type', refTypes)
            .eq('reference_id', String(refId));

        if (entryType) query = query.eq('entry_type', entryType);
        if (refNumber) query = query.eq('reference_number', refNumber);

        const { count, error } = await query;
        if (error) {
            console.warn('[Journal] Exists check error:', error);
            return false;
        }
        return (count || 0) > 0;
    } catch (err) {
        console.warn('[Journal] Exists check exception:', err);
        return false;
    }
}

// ── High-Level Journal Creators ───────────────────────────────────────────────

/**
 * Create journal entries for a new Invoice (AR + Revenue).
 * Dr Piutang Usaha / Cr Pendapatan Jasa
 */
export async function createInvoiceJournal({ invoice, coaList: providedCOA }) {
    if (!invoice || !invoice.id) {
        return { success: false, skipped: true, reason: 'invalid_invoice' };
    }
    if (invoice.status === 'draft') {
        return { success: true, skipped: true, reason: 'draft_invoice' };
    }
    const exists = await journalExists({ refType: ['ar', 'blink_invoice'], refId: invoice.id, entryType: 'invoice', refNumber: invoice.invoice_number });
    if (exists) {
        return { success: true, skipped: true, reason: 'duplicate_invoice_journal' };
    }

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
    invoice, paymentAmount, paymentDate, paymentNumber, selectedBank, coaList: providedCOA,
    arCOAId, bankCOAId
}) {
    if (!invoice || !invoice.id) return { success: false, reason: 'invalid_invoice' };
    if (!paymentAmount || paymentAmount <= 0) return { success: false, reason: 'amount_zero' };

    const exists = await journalExists({ refType: 'ar_payment', refId: invoice.id, refNumber: paymentNumber, entryType: 'payment' });
    if (exists) {
        return { success: true, skipped: true, reason: 'duplicate_ar_payment_journal' };
    }
    const coaList = providedCOA || await getAllCOA();
    
    let bankCOA = bankCOAId ? coaList.find(c => c.id === bankCOAId) : null;
    if (!bankCOA) bankCOA = await resolveBankAccount(coaList, selectedBank);

    let arCOA = arCOAId ? coaList.find(c => c.id === arCOAId) : null;
    if (!arCOA) arCOA = await resolveARAccount(coaList);

    const batchId = generateUUID();
    const jeNum = await generateJENumber('PAY-IN');
    const exRate = invoice.currency !== 'IDR' ? (invoice.exchange_rate || 16000) : 1;
    const note = invoice.currency !== 'IDR' ? ` (Rate: ${exRate.toLocaleString('id-ID')})` : '';
    const bankLabel = selectedBank
        ? `${selectedBank.bank_name} ${selectedBank.account_number ? '- ' + selectedBank.account_number : ''}`
        : 'Kas/Bank';
    const desc = `Payment ${bankLabel} for ${invoice.invoice_number} - ${invoice.customer_name}${note}`;

    return insertJournalEntries([
        buildJERow({
            entryNumber: jeNum, suffix: '-D',
            date: paymentDate,
            entryType: 'payment', refType: 'ar_payment',
            refId: invoice.id, refNumber: paymentNumber,
            coa: bankCOA,
            accountCodeFallback: selectedBank?.coa_code || '1-01-001',
            accountNameFallback: bankLabel,
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
    if (!invoice || !invoice.id) {
        return { success: false, skipped: true, reason: 'invalid_invoice' };
    }
    const exists = await journalExists({ refType: 'invoice', refId: invoice.id, entryType: 'cogs' });
    if (exists) {
        return { success: true, skipped: true, reason: 'duplicate_cogs_journal' };
    }
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
    ap, paymentAmount, paymentDate, paymentNumber, selectedBank, coaList: providedCOA,
    apCOAId, bankCOAId
}) {
    if (!ap || !ap.id || !paymentNumber) {
        return { success: false, skipped: true, reason: 'invalid_payment' };
    }
    const exists = await journalExists({ refType: 'ap_payment', refId: ap.id, refNumber: paymentNumber, entryType: 'bill_payment' });
    if (exists) {
        return { success: true, skipped: true, reason: 'duplicate_ap_payment_journal' };
    }
    const coaList = providedCOA || await getAllCOA();
    
    let bankCOA = bankCOAId ? coaList.find(c => c.id === bankCOAId) : null;
    if (!bankCOA) bankCOA = await resolveBankAccount(coaList, selectedBank);

    let apCOA = apCOAId ? coaList.find(c => c.id === apCOAId) : null;
    if (!apCOA) apCOA = await resolveAPAccount(coaList);
    const batchId = generateUUID();
    const jeNum = await generateJENumber('PAY-OUT');
    const exRate = ap.currency !== 'IDR' ? (ap.exchange_rate || 16000) : 1;
    const note = ap.currency !== 'IDR' ? ` (Rate: ${exRate.toLocaleString('id-ID')})` : '';
    const bankLabel = selectedBank
        ? `${selectedBank.bank_name} ${selectedBank.account_number ? '- ' + selectedBank.account_number : ''}`
        : 'Kas/Bank';
    const desc = `Payment via ${bankLabel} for ${ap.po_number || ap.ap_number} to ${ap.vendor_name}${note}`;

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
            accountCodeFallback: selectedBank?.coa_code || '1-01-001',
            accountNameFallback: bankLabel,
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
    if (!po || !po.id) {
        return { success: false, skipped: true, reason: 'invalid_po' };
    }
    const exists = await journalExists({ refType: 'po', refId: po.id, entryType: 'purchase_order' });
    if (exists) {
        return { success: true, skipped: true, reason: 'duplicate_po_journal' };
    }
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

export async function ensureBlinkARTransaction(invoice) {
    if (!invoice || !invoice.id) return { success: false, skipped: true, reason: 'invalid_invoice' };

    const { data: existing, error: existingError } = await supabase
        .from('blink_ar_transactions')
        .select('id')
        .eq('invoice_id', invoice.id)
        .maybeSingle();

    if (existingError && !/no rows|null/.test(String(existingError.message || '').toLowerCase())) {
        throw existingError;
    }
    if (existing) return { success: true, skipped: true, reason: 'existing' };

    const originalAmount = Number(invoice.total_amount || invoice.subtotal || 0);
    const paidAmount = Number(invoice.paid_amount || 0);
    const outstandingAmount = Number(invoice.outstanding_amount ?? Math.max(0, originalAmount - paidAmount));
    const transactionDate = invoice.invoice_date || new Date().toISOString().split('T')[0];
    const dueDate = invoice.due_date || transactionDate;

    const row = {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || null,
        ar_number: invoice.ar_number || generateARNumber(),
        customer_id: invoice.customer_id || null,
        customer_name: invoice.customer_name || 'Unknown',
        transaction_date: transactionDate,
        due_date: dueDate,
        original_amount: originalAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        currency: invoice.currency || 'IDR',
        exchange_rate: invoice.exchange_rate || 1,
        status: outstandingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'outstanding',
        notes: `Migrated from invoice ${invoice.invoice_number || invoice.id}`
    };

    const { error } = await supabase.from('blink_ar_transactions').insert([row]);
    return { success: !error, error, row };
}

export async function ensureBlinkAPTransaction(po) {
    if (!po || !po.id) return { success: false, skipped: true, reason: 'invalid_po' };

    const { data: existing, error: existingError } = await supabase
        .from('blink_ap_transactions')
        .select('id')
        .eq('po_id', po.id)
        .maybeSingle();

    if (existingError && !/no rows|null/.test(String(existingError.message || '').toLowerCase())) {
        throw existingError;
    }
    if (existing) return { success: true, skipped: true, reason: 'existing' };

    const originalAmount = Number(po.total_amount || 0);
    const paidAmount = Number(po.paid_amount || 0);
    const outstandingAmount = Number(po.outstanding_amount ?? Math.max(0, originalAmount - paidAmount));
    const billDate = po.po_date || new Date().toISOString().split('T')[0];
    let dueDate = billDate;
    if (po.payment_terms) {
        const m = String(po.payment_terms).match(/\d+/);
        if (m) {
            const daysToAdd = Number(m[0]) || 30;
            const date = new Date(billDate);
            date.setDate(date.getDate() + daysToAdd);
            dueDate = date.toISOString().split('T')[0];
        }
    }

    const row = {
        ap_number: po.ap_number || generateAPNumber(),
        po_id: po.id,
        po_number: po.po_number || null,
        vendor_id: po.vendor_id || null,
        vendor_name: po.vendor_name || 'Unknown Vendor',
        bill_date: billDate,
        due_date: dueDate,
        original_amount: originalAmount,
        paid_amount: paidAmount,
        outstanding_amount: outstandingAmount,
        currency: po.currency || 'IDR',
        exchange_rate: po.exchange_rate || 1,
        status: outstandingAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'outstanding',
        notes: `Migrated from PO ${po.po_number || po.id}`
    };

    const { error } = await supabase.from('blink_ap_transactions').insert([row]);
    return { success: !error, error, row };
}

export async function migrateBlinkFinancialRecords() {
    const [{ data: invoiceData, error: invoiceError }, { data: poData, error: poError }, { data: journalData, error: journalError }] = await Promise.all([
        supabase.from('blink_invoices').select('*').neq('status', 'draft').neq('status', 'cancelled'),
        supabase.from('blink_purchase_orders').select('*').in('status', ['approved', 'received', 'paid']),
        supabase.from('blink_journal_entries').select('reference_id,reference_type')
    ]);

    if (invoiceError) throw invoiceError;
    if (poError) throw poError;
    if (journalError) throw journalError;

    const existingJournalKeys = new Set((journalData || []).map(j => `${j.reference_type}:${j.reference_id}`));
    const coaList = await getAllCOA();
    let migratedInvoices = 0;
    let migratedPOs = 0;

    for (const invoice of invoiceData || []) {
        const journalKeyAR = `ar:${invoice.id}`;
        const journalKeyInvoice = `blink_invoice:${invoice.id}`;
        if (existingJournalKeys.has(journalKeyAR) || existingJournalKeys.has(journalKeyInvoice)) continue;

        await ensureBlinkARTransaction(invoice);
        await createInvoiceJournal({ invoice, coaList });
        const cogsAmount = Number(invoice.cogs_subtotal || invoice.cogs_amount || 0);
        if (cogsAmount > 0) {
            await createCOGSJournal({ invoice, cogsAmount, coaList });
        }
        migratedInvoices++;
    }

    for (const po of poData || []) {
        const journalKey = `po:${po.id}`;
        if (existingJournalKeys.has(journalKey)) continue;

        await ensureBlinkAPTransaction(po);
        await createPOApprovalJournal({ po, coaList });
        migratedPOs++;
    }

    return { migratedInvoices, migratedPOs };
}
