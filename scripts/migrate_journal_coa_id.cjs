// Script: migrate_journal_coa_id.cjs
// Mengisi coa_id pada blink_journal_entries yang masih null, berdasarkan account_code
// Jalankan: node scripts/migrate_journal_coa_id.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Ambil mapping account_code -> id dari finance_coa
  const { data: coaList, error: coaError } = await supabase
    .from('finance_coa')
    .select('id, code');
  if (coaError) {
    console.error('Error fetching COA:', coaError);
    process.exit(1);
  }
  const codeToId = {};
  coaList.forEach(c => { if (c.code && c.id) codeToId[c.code] = c.id; });

  // Ambil jurnal yang coa_id masih null dan account_code tidak null
  const { data: journals, error: jError } = await supabase
    .from('blink_journal_entries')
    .select('id, account_code')
    .is('coa_id', null)
    .not('account_code', 'is', null);
  if (jError) {
    console.error('Error fetching journal entries:', jError);
    process.exit(1);
  }

  let updated = 0;
  for (const j of journals) {
    const coaId = codeToId[j.account_code];
    if (coaId) {
      const { error: updError } = await supabase
        .from('blink_journal_entries')
        .update({ coa_id: coaId })
        .eq('id', j.id);
      if (!updError) updated++;
      else console.error(`Gagal update jurnal id ${j.id}:`, updError);
    } else {
      console.warn(`Tidak ditemukan COA id untuk account_code: ${j.account_code}`);
    }
  }
  console.log(`Selesai. Total jurnal yang berhasil diupdate coa_id: ${updated}`);
}

main();
