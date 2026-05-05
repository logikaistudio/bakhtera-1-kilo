import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function simulateFrontendQuery() {
  const today = new Date();
  const dateRange = {
      start: new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0],
      end: today.toISOString().split('T')[0]
  };
  
  console.log('Date range:', dateRange);
  
  // 1. Fetch COA
  const { data: accounts, error: coaError } = await supabase
      .from('finance_coa')
      .select('*')
      .order('code', { ascending: true });
      
  console.log('COA accounts:', accounts?.length);
  if (coaError) console.log('COA Error:', coaError);
  
  // 2. Fetch Journal Entries - exact duplicate of TrialBalance.jsx
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
  
  console.log('\nEntries with coa_id:', r1.data?.length);
  console.log('Entries without coa_id:', r2.data?.length);
  console.log('Error r1:', r1.error?.message);
  console.log('Error r2:', r2.error?.message);
  
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
  console.log('\nTotal unique entries:', entries.length);
  
  // 3. Calculate balances (same logic as frontend)
  const accMap = {};
  const accCodeMap = {};
  
  accounts.forEach(acc => {
      accMap[acc.id] = {
          ...acc,
          opening: 0,
          debitPeriod: 0,
          creditPeriod: 0,
          closing: 0
      };
      if (acc.code) accCodeMap[acc.code] = acc.id;
  });
  
  entries.forEach(e => {
      let targetId = e.coa_id || accCodeMap[e.account_code];
      if (!targetId) return;
      
      const acc = accMap[targetId];
      if (!acc) return;
      
      const debit = e.debit || 0;
      const credit = e.credit || 0;
      
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
  
  // 4. Filter and calculate closing
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
      .filter(acc => acc.opening !== 0 || acc.debitPeriod !== 0 || acc.creditPeriod !== 0);
  
  console.log('\nProcessed accounts with activity:', processed.length);
  console.log('Sample:', processed.slice(0, 3).map(a => ({
      code: a.code,
      name: a.name,
      opening: a.opening,
      debit: a.debitPeriod,
      credit: a.creditPeriod,
      closing: a.closing
  })));
}
simulateFrontendQuery();