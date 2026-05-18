// Script: check_coa_id.cjs
// Mengecek apakah semua master COA sudah punya COA id (kolom id tidak null)
// Jalankan: node scripts/checks/check_coa_id.cjs

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  // Hitung total COA
  const { count: totalCount, error: countError } = await supabase
    .from('finance_coa')
    .select('id', { count: 'exact', head: true });

  const { data, error } = await supabase
    .from('finance_coa')
    .select('id, code, name')
    .is('id', null);

  if (error || countError) {
    console.error('Error querying finance_coa:', error || countError);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log(`✅ Semua master COA sudah punya COA id. Total: ${totalCount}`);
  } else {
    console.log('❌ Ada COA tanpa id:');
    data.forEach(row => {
      console.log(`- code: ${row.code}, name: ${row.name}`);
    });
    console.log(`Total tanpa id: ${data.length} dari ${totalCount}`);
  }
}

main();
