// Script: validate_journal_migration.cjs
// Validasi hasil migrasi coa_id pada blink_journal_entries
// Jalankan: node scripts/validate_journal_migration.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  try {
    console.log('Validating blink_journal_entries...');

    const { count: nullCount } = await supabase
      .from('blink_journal_entries')
      .select('id', { count: 'exact', head: true })
      .is('coa_id', null);

    const { count: filledCount } = await supabase
      .from('blink_journal_entries')
      .select('id', { count: 'exact', head: true })
      .not('coa_id', 'is', null);

    const { count: totalCount } = await supabase
      .from('blink_journal_entries')
      .select('id', { count: 'exact', head: true });

    console.log(`Total journal entries: ${totalCount}`);
    console.log(`Entries with coa_id: ${filledCount}`);
    console.log(`Entries without coa_id: ${nullCount}`);

    // Summary for COA 5-02-100-0-1-00 (DISCOUNT : AIR EXPORT)
    const coaCode = '5-02-100-0-1-00';
    const { data: coaMatches } = await supabase
      .from('finance_coa')
      .select('id, code, name')
      .eq('code', coaCode)
      .limit(1);

    if (!coaMatches || coaMatches.length === 0) {
      console.warn(`COA ${coaCode} not found in finance_coa`);
    } else {
      const coaId = coaMatches[0].id;
      const { data: entries } = await supabase
        .from('blink_journal_entries')
        .select('id, entry_date, account_code, debit, credit, coa_id, description, reference_type, reference_id')
        .eq('coa_id', coaId)
        .order('entry_date', { ascending: false })
        .limit(10);

      // also sum debit/credit for this coa
      const { data: sums } = await supabase
        .from('blink_journal_entries')
        .select('debit,credit', { head: false })
        .eq('coa_id', coaId);

      let totalDebit = 0, totalCredit = 0;
      (sums || []).forEach(r => { totalDebit += Number(r.debit || 0); totalCredit += Number(r.credit || 0); });

      console.log(`\nCOA ${coaCode} (${coaMatches[0].name}) - totals:`);
      console.log(`  Entries (sample up to 10): ${entries ? entries.length : 0}`);
      console.log(`  Total Debit: ${totalDebit.toLocaleString('id-ID')}`);
      console.log(`  Total Credit: ${totalCredit.toLocaleString('id-ID')}`);

      if (entries && entries.length > 0) {
        console.log('\nSample entries:');
        entries.forEach(e => {
          console.log(`- id:${e.id} date:${e.entry_date} acc_code:${e.account_code} Dr:${e.debit} Cr:${e.credit} ref:${e.reference_type}:${e.reference_id} desc:${(e.description||'').slice(0,80)}`);
        });
      }
    }

    // Show few orphaned journal entries (no coa_id) with account_code present
    const { data: orphans } = await supabase
      .from('blink_journal_entries')
      .select('id, entry_date, account_code, debit, credit, description, reference_type, reference_id')
      .is('coa_id', null)
      .not('account_code', 'is', null)
      .limit(10);

    console.log('\nSample orphan journal entries (coa_id IS NULL):');
    if (!orphans || orphans.length === 0) console.log('  none');
    else {
      orphans.forEach(o => console.log(`- id:${o.id} date:${o.entry_date} acc_code:${o.account_code} Dr:${o.debit} Cr:${o.credit} ref:${o.reference_type}:${o.reference_id} desc:${(o.description||'').slice(0,80)}`));
    }

    console.log('\nValidation complete.');
  } catch (err) {
    console.error('Validation error:', err);
    process.exit(1);
  }
}

main();
