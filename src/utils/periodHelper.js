import { supabase } from '../lib/supabase';

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

export async function getPeriodByYearMonth(year, month) {
    const { data, error } = await supabase
        .from('finance_periods')
        .select('*')
        .eq('year', year)
        .eq('month', month)
        .limit(1)
        .single();

    if (error) {
        console.warn('[Period] Could not load period:', error.message);
        return null;
    }
    return data;
}

export async function createPeriod({ year, month, status = 'open', closedBy = null }) {
    const { data, error } = await supabase
        .from('finance_periods')
        .insert([{ year, month, status, closed_by: closedBy }])
        .select()
        .single();

    if (error) {
        console.error('[Period] Create failed:', error);
        return null;
    }
    return data;
}

export async function closePeriod(year, month, closedBy) {
    const { data, error } = await supabase
        .from('finance_periods')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_by: closedBy })
        .eq('year', year)
        .eq('month', month)
        .select()
        .single();

    if (error) {
        console.error('[Period] Close failed:', error);
        return null;
    }
    return data;
}

export async function isPeriodClosed(year, month) {
    const period = await getPeriodByYearMonth(year, month);
    return period && period.status === 'closed';
}

export async function ensurePeriodIsOpen(date) {
    const { periodMonth, periodYear } = getPeriodFromDate(date);
    if (!periodMonth || !periodYear) {
        throw new Error('Invalid journal date for period validation');
    }
    const period = await getPeriodByYearMonth(periodYear, periodMonth);
    if (period?.status === 'closed') {
        throw new Error(`Journal period ${periodYear}-${String(periodMonth).padStart(2, '0')} is closed`);
    }
    return true;
}
