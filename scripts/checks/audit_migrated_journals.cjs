// Script: audit_migrated_journals.cjs
// Buat CSV audit untuk jurnal dengan account_code yang telah dipetakan ke coa_id
// Jalankan: node scripts/checks/audit_migrated_journals.cjs

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function main() {
  console.log('Building audit report for migrated journals...');

  const { data: coaList, error: coaErr } = await supabase
    .from('finance_coa')
    .select('id, code, name');
  if (coaErr) {
    console.error('Error fetching COA list:', coaErr);
    process.exit(1);
  }
  const codeToId = {};
  const idToCode = {};
  coaList.forEach(c => { if (c.code) { codeToId[c.code] = c.id; idToCode[c.id] = c.code; } });

  const { data: journals, error: jErr } = await supabase
    .from('blink_journal_entries')
    .select('id, entry_date, account_code, coa_id, debit, credit, description, reference_type, reference_id, created_at, updated_at')
    .not('account_code', 'is', null);
  if (jErr) {
    console.error('Error fetching journal entries:', jErr);
    process.exit(1);
  }

  const outPath = path.join(__dirname, '../../docs/artifacts', 'migrated_journals_audit.csv');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const header = ['id','entry_date','account_code','mapped_coa_id','coa_id','mapped_match','debit','credit','reference_type','reference_id','description','created_at','updated_at'];
  const lines = [header.join(',')];

  (journals || []).forEach(j => {
    const mappedId = codeToId[j.account_code] || '';
    const mappedMatch = mappedId && j.coa_id && mappedId === j.coa_id ? 'true' : 'false';
    const row = [
      csvEscape(j.id),
      csvEscape(j.entry_date),
      csvEscape(j.account_code),
      csvEscape(mappedId),
      csvEscape(j.coa_id),
      csvEscape(mappedMatch),
      csvEscape(j.debit),
      csvEscape(j.credit),
      csvEscape(j.reference_type),
      csvEscape(j.reference_id),
      csvEscape(j.description),
      csvEscape(j.created_at),
      csvEscape(j.updated_at)
    ];
    lines.push(row.join(','));
  });

  fs.writeFileSync(outPath, lines.join('\n'));
  console.log('Audit CSV written to', outPath);
  console.log('Total rows:', journals ? journals.length : 0);
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
