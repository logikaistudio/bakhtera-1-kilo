import { supabase } from '../lib/supabase';

const INVOICE_REF_TYPES = new Set(['ar', 'invoice', 'ar_payment', 'ar_reversal']);
const PO_REF_TYPES = new Set(['po', 'ap_reversal']);
const AP_REF_TYPES = new Set(['ap_payment']);
const PAYMENT_REF_TYPES = new Set(['payment']);
const TRANSACTIONAL_ENTRY_TYPES = new Set(['invoice', 'payment', 'bill_payment', 'purchase_order', 'cogs']);

const cache = new Map();
const CACHE_TTL_MS = 30 * 1000;

const getCacheKey = (division) => `blink-active-refs:${division || 'all'}`;

const toIdSet = (rows) => new Set((rows || []).map((row) => String(row.id)));

const fetchActiveReferenceSets = async (division) => {
    const [invRes, poRes, arRes, apRes, paymentRes] = await Promise.all([
        supabase
            .from('blink_invoices')
            .select('id')
            .eq('division', division)
            .neq('status', 'cancelled'),
        supabase
            .from('blink_purchase_orders')
            .select('id')
            .eq('division', division)
            .neq('status', 'cancelled'),
        supabase
            .from('blink_ar_transactions')
            .select('id'),
        supabase
            .from('blink_ap_transactions')
            .select('id'),
        supabase
            .from('blink_payments')
            .select('id'),
    ]);

    if (invRes.error) throw invRes.error;
    if (poRes.error) throw poRes.error;
    if (arRes.error) throw arRes.error;
    if (apRes.error) throw apRes.error;
    if (paymentRes.error) throw paymentRes.error;

    return {
        activeInvoiceIds: toIdSet(invRes.data),
        activePOIds: toIdSet(poRes.data),
        activeARIds: toIdSet(arRes.data),
        activeAPIds: toIdSet(apRes.data),
        activePaymentIds: toIdSet(paymentRes.data),
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
