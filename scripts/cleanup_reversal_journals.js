/**
 * cleanup_reversal_journals.js
 * 
 * Script untuk membersihkan reversal journal yang salah dari database.
 * 
 * Entri yang dihapus:
 *   - entry_type = 'reversal'
 *   - reference_type IN ('ar_reversal', 'ap_reversal')
 * 
 * Cara pakai:
 *   node scripts/cleanup_reversal_journals.js
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
// CATATAN: Ganti dengan SERVICE_ROLE key dari Supabase Dashboard > Settings > API
// JANGAN gunakan anon key karena RLS akan memblokir DELETE
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'PASTE_SERVICE_ROLE_KEY_HERE';

if (SUPABASE_SERVICE_KEY === 'PASTE_SERVICE_ROLE_KEY_HERE') {
    console.error('❌ Set environment variable SUPABASE_SERVICE_KEY terlebih dahulu!');
    console.error('   export SUPABASE_SERVICE_KEY="eyJ..."');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

async function main() {
    console.log('🔍 AUDIT: Mengecek reversal journal yang perlu dihapus...\n');

    // ── Langkah 1: Audit ──────────────────────────────────────────────
    const { data: auditData, error: auditErr } = await supabase
        .from('blink_journal_entries')
        .select('id, entry_number, entry_date, reference_type, reference_number, account_code, account_name, debit, credit, description, batch_id')
        .eq('entry_type', 'reversal')
        .in('reference_type', ['ar_reversal', 'ap_reversal'])
        .order('entry_date', { ascending: false });

    if (auditErr) {
        console.error('❌ Gagal audit:', auditErr.message);
        process.exit(1);
    }

    if (!auditData || auditData.length === 0) {
        console.log('✅ Tidak ada reversal journal yang perlu dihapus. Database sudah bersih!');
        process.exit(0);
    }

    // Ringkasan
    const arReversals = auditData.filter(r => r.reference_type === 'ar_reversal');
    const apReversals = auditData.filter(r => r.reference_type === 'ap_reversal');
    const totalDebit = auditData.reduce((s, r) => s + (r.debit || 0), 0);
    const totalCredit = auditData.reduce((s, r) => s + (r.credit || 0), 0);
    const batchIds = [...new Set(auditData.map(r => r.batch_id))];

    console.log('📊 RINGKASAN DATA YANG AKAN DIHAPUS:');
    console.log('─'.repeat(60));
    console.log(`   Total Entri     : ${auditData.length}`);
    console.log(`   AR Reversal     : ${arReversals.length} entri`);
    console.log(`   AP Reversal     : ${apReversals.length} entri`);
    console.log(`   Batch Unik      : ${batchIds.length}`);
    console.log(`   Total Debit     : ${totalDebit.toLocaleString('id-ID')}`);
    console.log(`   Total Credit    : ${totalCredit.toLocaleString('id-ID')}`);
    console.log('─'.repeat(60));

    console.log('\n📋 DETAIL ENTRI:');
    auditData.forEach((r, i) => {
        const amount = r.debit > 0 ? `Dr ${r.debit.toLocaleString('id-ID')}` : `Cr ${r.credit.toLocaleString('id-ID')}`;
        console.log(`   [${i+1}] ${r.entry_date} | ${r.reference_type} | ${r.account_code} - ${r.account_name} | ${amount}`);
    });

    // ── Langkah 2: Konfirmasi & Delete ───────────────────────────────
    console.log('\n🗑️  MENGHAPUS semua reversal journal yang salah...');

    const { error: deleteErr } = await supabase
        .from('blink_journal_entries')
        .delete()
        .eq('entry_type', 'reversal')
        .in('reference_type', ['ar_reversal', 'ap_reversal']);

    if (deleteErr) {
        console.error('❌ Gagal hapus:', deleteErr.message);
        process.exit(1);
    }

    console.log(`✅ BERHASIL menghapus ${auditData.length} entri reversal journal yang salah.`);

    // ── Langkah 3: Verifikasi ─────────────────────────────────────────
    const { data: checkData } = await supabase
        .from('blink_journal_entries')
        .select('id', { count: 'exact', head: true })
        .eq('entry_type', 'reversal')
        .in('reference_type', ['ar_reversal', 'ap_reversal']);

    console.log(`\n🔎 Verifikasi: Sisa reversal journal = ${checkData?.length ?? 0} (harusnya 0)`);
    console.log('\n✅ Cleansing selesai! Silakan refresh Trial Balance di Vercel.');
}

main().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});
