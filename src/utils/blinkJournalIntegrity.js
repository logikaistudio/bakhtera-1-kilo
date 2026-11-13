import { supabase } from '../lib/supabase';

const INVOICE_REF_TYPES = new Set(['ar', 'invoice', 'blink_invoice', 'ar_payment', 'ar_reversal']);
const PO_REF_TYPES = new Set(['po', 'ap_reversal']);
const AP_REF_TYPES = new Set(['ap_payment']);
const PAYMENT_REF_TYPES = new Set(['payment']);
const TRANSACTIONAL_ENTRY_TYPES = new Set(['invoice', 'payment', 'bill_payment', 'purchase_order', 'cogs']);
const PAGE_SIZE = 500;

const cache = new Map();
const CACHE_TTL_MS = 30 * 1000;

const getCacheKey = (division) => `blink-active-refs:${division || 'all'}`;

const toIdSet = (rows) => new Set((rows || []).map((row) => String(row.id)));

export const fetchAllBlinkRows = async (buildQuery) => {
    const rows = [];
    let offset = 0;

    while (true) {
        const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;

        const page = data || [];
        rows.push(...page);
        if (page.length < PAGE_SIZE) return rows;

        offset += PAGE_SIZE;
    }
};

export const fetchBlinkJournalEntries = ({ division, startDate, endDate }) => fetchAllBlinkRows(() => {
    let query = supabase
        .from('blink_journal_entries')
        .select('id, entry_number, reference_number, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate, reference_type, reference_id, source, entry_type, journal_type, description')
        .eq('division', division);

    if (startDate) query = query.gte('entry_date', startDate);
    if (endDate) query = query.lte('entry_date', endDate);

    return query.order('entry_date', { ascending: true }).order('id', { ascending: true });
});

const fetchActiveReferenceSets = async (division) => {
    const [invRes, poRes, arRes, apRes, paymentRes] = await Promise.all([
        fetchAllBlinkRows(() => supabase
            .from('blink_invoices')
            .select('id')
            .eq('division', division)
            .neq('status', 'cancelled')
            .order('id', { ascending: true })),
        fetchAllBlinkRows(() => supabase
            .from('blink_purchase_orders')
            .select('id')
            .eq('division', division)
            .neq('status', 'cancelled')
            .order('id', { ascending: true })),
        fetchAllBlinkRows(() => supabase
            .from('blink_ar_transactions')
            .select('id')
            .order('id', { ascending: true })),
        fetchAllBlinkRows(() => supabase
            .from('blink_ap_transactions')
            .select('id')
            .order('id', { ascending: true })),
        fetchAllBlinkRows(() => supabase
            .from('blink_payments')
            .select('id')
            .order('id', { ascending: true })),
    ]);

    return {
        activeInvoiceIds: toIdSet(invRes),
        activePOIds: toIdSet(poRes),
        activeARIds: toIdSet(arRes),
        activeAPIds: toIdSet(apRes),
        activePaymentIds: toIdSet(paymentRes),
    };
};

export const getActiveBlinkReferenceSets = async (division, { forceRefresh = false } = {}) => {
    const key = getCacheKey(division);
    const now = Date.now();
    const cached = cache.get(key);

    if (!forceRefresh && cached && now - cached.timestamp < CACHE_TTL_MS) {
        return cached.value;
    }

    const value = await fetchActiveReferenceSets(division);
    cache.set(key, { timestamp: now, value });
    return value;
};

export const isActiveBlinkJournalEntry = (entry, refSets) => {
    const refType = entry?.reference_type;
    const refId = entry?.reference_id != null ? String(entry.reference_id) : null;
    const source = entry?.source;
    const entryType = entry?.entry_type;
    const isManualByIntent =
        source === 'manual' ||
        entryType === 'adjustment' ||
        refType === 'manual' ||
        refType === 'adjustment';

    // Explicit manual journals are intentionally not tied to transaction references.
    if (isManualByIntent) {
        return true;
    }

    // Non-manual journals must have valid transaction references.
    if (!refType || !refId) {
        return false;
    }

    if (INVOICE_REF_TYPES.has(refType)) return refSets.activeInvoiceIds.has(refId);
    if (PO_REF_TYPES.has(refType)) return refSets.activePOIds.has(refId);
    if (AP_REF_TYPES.has(refType)) return refSets.activeAPIds.has(refId) || refSets.activeARIds.has(refId);
    if (PAYMENT_REF_TYPES.has(refType)) return refSets.activePaymentIds.has(refId);

    // Unknown reference type in non-manual journal is treated as orphan.
    if (source === 'auto' || TRANSACTIONAL_ENTRY_TYPES.has(entryType) || !isManualByIntent) {
        return false;
    }

    return false;
};

export const filterActiveBlinkJournalEntries = async (entries, division, options = {}) => {
    const rows = Array.isArray(entries) ? entries : [];
    if (rows.length === 0) return rows;

    const refSets = await getActiveBlinkReferenceSets(division, options);
    return rows.filter((entry) => isActiveBlinkJournalEntry(entry, refSets));
};

export const clearBlinkReferenceCache = (division) => {
    if (division) {
        cache.delete(getCacheKey(division));
        return;
    }
    cache.clear();
};
