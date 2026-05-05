import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function fetchTrialBalance() {
    const today = new Date();
    const dateRange = {
        start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0]
    };
    console.log('dateRange:', dateRange);

    const { data: accounts, error: coaError } = await supabase
        .from('finance_coa')
        .select('*')
        .order('code', { ascending: true });
    
    if (coaError) throw coaError;

    const [r1, r2] = await Promise.all([
        supabase.from('blink_journal_entries')
            .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
            .not('coa_id', 'is', null)
            .lte('entry_date', dateRange.end),
        supabase.from('blink_journal_entries')
            .select('id, coa_id, account_code, debit, credit, entry_date, currency, exchange_rate')
            .is('coa_id', null)
            .lte('entry_date', dateRange.end)
    ]);

    const combined = [...(r1.data || []), ...(r2.data || [])];
    const uniqueMap = new Map();
    combined.forEach(r => {
        if (!uniqueMap.has(r.id)) {
            uniqueMap.set(r.id, r);
        } else {
            const existing = uniqueMap.get(r.id);
            if (!existing.coa_id && r.coa_id) {
                uniqueMap.set(r.id, r);
            }
        }
    });
    const entries = Array.from(uniqueMap.values());
    console.log('Entries length:', entries.length);

    const accMap = {};
    const accCodeMap = {};
    const accNameMap = {};

    accounts.forEach(acc => {
        accMap[acc.id] = {
            ...acc,
            opening: 0,
            debitPeriod: 0,
            creditPeriod: 0,
            closing: 0
        };
        if (acc.code) accCodeMap[acc.code] = acc.id;
        if (acc.name) accNameMap[acc.name.toLowerCase().trim()] = acc.id;
    });

    const toIDR = (value, currency, exchangeRate) => {
        if (!value) return 0;
        if (currency && currency !== 'IDR' && exchangeRate > 1) {
            return value * exchangeRate;
        }
        return value;
    };

    entries.forEach(e => {
        let targetId = e.coa_id || accCodeMap[e.account_code];
        if (!targetId && e.account_name) {
            targetId = accNameMap[e.account_name.toLowerCase().trim()];
        }
        if (!targetId) {
            targetId = `unclassified_${e.account_code || 'unknown'}`;
            if (!accMap[targetId]) {
                accMap[targetId] = {
                    id: targetId,
                    code: e.account_code || 'UNMAPPED',
                    name: (e.account_name || 'Unknown Account') + ' (Unmapped)',
                    type: 'ASSET',
                    opening: 0,
                    debitPeriod: 0,
                    creditPeriod: 0,
                    closing: 0
                };
            }
        }

        const acc = accMap[targetId];
        if (!acc) return;

        const debit = toIDR(e.debit, e.currency, e.exchange_rate);
        const credit = toIDR(e.credit, e.currency, e.exchange_rate);

        if (e.entry_date < dateRange.start) {
            const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
            if (isNormalCredit) {
                acc.opening += (credit - debit);
            } else {
                acc.opening += (debit - credit);
            }
        } else {
            acc.debitPeriod += debit;
            acc.creditPeriod += credit;
        }
    });

    const processed = Object.values(accMap)
        .map(acc => {
            const isNormalCredit = ['LIABILITY', 'EQUITY', 'REVENUE'].includes(acc.type);
            if (isNormalCredit) {
                acc.closing = acc.opening + acc.creditPeriod - acc.debitPeriod;
            } else {
                acc.closing = acc.opening + acc.debitPeriod - acc.creditPeriod;
            }
            return acc;
        })
        .filter(acc => acc.opening !== 0 || acc.debitPeriod !== 0 || acc.creditPeriod !== 0)
        .sort((a, b) => a.code.localeCompare(b.code));

    console.log('Processed length:', processed.length);
    console.log('Sample processed:', processed.slice(0, 3));
}

fetchTrialBalance();
