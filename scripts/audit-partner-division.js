#!/usr/bin/env node
/**
 * AUDIT SCRIPT: Partner Division Integrity Check
 * ================================================
 * Menganalisis tabel blink_business_partners untuk menemukan mitra yang
 * owner_division-nya mungkin salah akibat autoFixLegacyBxpoPartners.
 *
 * MODE:
 *   node scripts/audit-partner-division.js          → dry-run (analisis saja)
 *   node scripts/audit-partner-division.js --fix    → rollback mitra ke divisi yang benar
 *
 * LOGIKA DETEKSI:
 *   Jika sebuah mitra memiliki owner_division='bxpo' TAPI direferensikan di
 *   tabel transaksi BLINK (blink_quotations atau blink_sales_quotations),
 *   maka kemungkinan besar mitra itu seharusnya owner_division='blink'.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// ── Config ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = 'https://fsxdykjcajasmgybqdua.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';
const DRY_RUN = !process.argv.includes('--fix');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ────────────────────────────────────────────────────────────────────
const log = (msg) => console.log(msg);
const sep = () => log('─'.repeat(70));

async function fetchAllPartners() {
    log('📥 Mengambil semua mitra dari blink_business_partners...');
    const { data, error } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, partner_code, owner_division, is_shared, is_customer, status, created_at')
        .order('owner_division');
    if (error) throw new Error('Gagal fetch partners: ' + error.message);
    log(`   ✅ Total ditemukan: ${data.length} mitra\n`);
    return data;
}

async function fetchBlinkReferencedIds() {
    log('🔗 Mengambil ID mitra yang direferensikan di transaksi BLINK...');
    const [q1, q2] = await Promise.all([
        supabase.from('blink_quotations').select('partner_id').not('partner_id', 'is', null),
        supabase.from('blink_sales_quotations').select('partner_id').not('partner_id', 'is', null),
    ]);
    if (q1.error) throw new Error('Gagal fetch blink_quotations: ' + q1.error.message);
    if (q2.error) throw new Error('Gagal fetch blink_sales_quotations: ' + q2.error.message);

    const ids = new Set([
        ...(q1.data || []).map(r => r.partner_id),
        ...(q2.data || []).map(r => r.partner_id),
    ]);
    log(`   ✅ Ditemukan ${ids.size} ID unik yang direferensikan di transaksi Blink\n`);
    return ids;
}

async function rollbackPartners(ids) {
    if (!ids.length) return 0;
    const CHUNK = 50;
    let total = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const { error } = await supabase
            .from('blink_business_partners')
            .update({ owner_division: 'blink', updated_at: new Date().toISOString() })
            .in('id', chunk);
        if (error) throw new Error('Gagal rollback: ' + error.message);
        total += chunk.length;
        log(`   ✔ Rollback batch ${Math.ceil((i + 1) / CHUNK)}: ${chunk.length} mitra`);
    }
    return total;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
    sep();
    log('🔍 AUDIT PARTNER DIVISION INTEGRITY');
    log(`   Mode: ${DRY_RUN ? '📋 DRY-RUN (analisis saja, tidak ada perubahan)' : '⚡ FIX MODE (akan melakukan rollback)'}`);
    sep();
    log('');

    // 1. Ambil semua data
    const allPartners = await fetchAllPartners();
    const blinkReferencedIds = await fetchBlinkReferencedIds();

    // 2. Kategorikan
    const blinkPartners     = allPartners.filter(p => p.owner_division === 'blink');
    const bxpoPartners      = allPartners.filter(p => p.owner_division === 'bxpo');
    const sharedPartners    = allPartners.filter(p => p.is_shared === true);
    const nullDivision      = allPartners.filter(p => !p.owner_division);

    // 3. Identifikasi mitra BXPO yang seharusnya BLINK
    const suspiciousBxpo = bxpoPartners.filter(p => blinkReferencedIds.has(p.id));

    // 4. Identifikasi mitra BXPO yang TIDAK ada di referensi manapun
    const orphanBxpo = bxpoPartners.filter(p => !blinkReferencedIds.has(p.id));

    // ── Laporan ──────────────────────────────────────────────────────────────
    sep();
    log('📊 RINGKASAN DATA');
    sep();
    log(`   Total mitra              : ${allPartners.length}`);
    log(`   ├─ owner_division=blink  : ${blinkPartners.length}`);
    log(`   ├─ owner_division=bxpo   : ${bxpoPartners.length}`);
    log(`   ├─ is_shared=true        : ${sharedPartners.length}`);
    log(`   └─ owner_division=NULL   : ${nullDivision.length}`);
    log('');

    sep();
    log(`⚠️  MITRA BXPO YANG DICURIGAI SALAH DIVISI (direferensikan di transaksi Blink)`);
    sep();
    log(`   Jumlah: ${suspiciousBxpo.length}`);
    log('');

    if (suspiciousBxpo.length > 0) {
        suspiciousBxpo.forEach((p, i) => {
            log(`   ${String(i + 1).padStart(3)}. [${p.id}]`);
            log(`        Nama    : ${p.partner_name}`);
            log(`        Kode    : ${p.partner_code || '-'}`);
            log(`        Status  : ${p.status}`);
            log(`        Dibuat  : ${p.created_at?.split('T')[0] || '-'}`);
            log('');
        });
    } else {
        log('   ✅ Tidak ada mitra BXPO yang direferensikan di transaksi Blink.\n');
    }

    sep();
    log(`📋 MITRA BXPO YANG TIDAK ADA DI REFERENSI MANAPUN (kemungkinan legitimate BXPO)`);
    sep();
    log(`   Jumlah: ${orphanBxpo.length}`);
    log('');

    if (orphanBxpo.length > 0) {
        orphanBxpo.forEach((p, i) => {
            log(`   ${String(i + 1).padStart(3)}. [${p.id}]`);
            log(`        Nama    : ${p.partner_name}`);
            log(`        Kode    : ${p.partner_code || '-'}`);
            log(`        Customer: ${p.is_customer ? 'Ya' : 'Tidak'}`);
            log(`        Status  : ${p.status}`);
            log(`        Dibuat  : ${p.created_at?.split('T')[0] || '-'}`);
            log('');
        });
    }

    if (nullDivision.length > 0) {
        sep();
        log(`⚠️  MITRA TANPA owner_division (NULL) — perlu diassign manual`);
        sep();
        nullDivision.forEach((p, i) => {
            log(`   ${String(i + 1).padStart(3)}. [${p.id}] ${p.partner_name} (${p.partner_code || '-'})`);
        });
        log('');
    }

    // ── Simpan laporan JSON ───────────────────────────────────────────────────
    const reportPath = path.join(process.cwd(), 'scripts', 'audit-report.json');
    const report = {
        generated_at: new Date().toISOString(),
        summary: {
            total: allPartners.length,
            blink: blinkPartners.length,
            bxpo: bxpoPartners.length,
            shared: sharedPartners.length,
            null_division: nullDivision.length,
            suspicious_bxpo: suspiciousBxpo.length,
            orphan_bxpo: orphanBxpo.length,
        },
        suspicious_bxpo_partners: suspiciousBxpo,
        orphan_bxpo_partners: orphanBxpo,
        null_division_partners: nullDivision,
    };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    log(`\n💾 Laporan lengkap disimpan: scripts/audit-report.json`);

    // ── Eksekusi rollback ─────────────────────────────────────────────────────
    if (!DRY_RUN) {
        if (suspiciousBxpo.length === 0) {
            log('\n✅ Tidak ada yang perlu di-rollback.');
        } else {
            sep();
            log(`⚡ Memulai rollback ${suspiciousBxpo.length} mitra → owner_division='blink'...`);
            const ids = suspiciousBxpo.map(p => p.id);
            const count = await rollbackPartners(ids);
            log(`\n✅ Rollback selesai: ${count} mitra berhasil dikembalikan ke divisi Blink.`);
        }
    } else {
        sep();
        log(`📋 DRY-RUN selesai. Tidak ada perubahan dilakukan.`);
        if (suspiciousBxpo.length > 0) {
            log(`   → Jalankan dengan --fix untuk rollback ${suspiciousBxpo.length} mitra ke Blink:`);
            log(`     node scripts/audit-partner-division.js --fix`);
        }
    }

    sep();
    log('✅ Audit selesai.\n');
}

main().catch(err => {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
});
