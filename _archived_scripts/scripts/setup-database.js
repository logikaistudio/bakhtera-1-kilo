/**
 * Setup & Seed Script - Bakhtera-1 Database
 * Memverifikasi struktur dan mengisi data awal Supabase
 * Run: node scripts/setup-database.js
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';
const s = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── All menu codes for Bridge/Blink/Big ───────────────────────────────
const ALL_MENUS = [
    // Bridge
    { menu_code: 'bridge_dashboard', menu_name: 'Dashboard Bridge', category: 'Bridge', order_index: 10 },
    { menu_code: 'bridge_pengajuan', menu_name: 'Pengajuan', category: 'Bridge', order_index: 11 },
    { menu_code: 'bridge_ata_carnet', menu_name: 'ATA Carnet', category: 'Bridge', order_index: 12 },
    { menu_code: 'bridge_inventory', menu_name: 'Inventaris Gudang', category: 'Bridge', order_index: 13 },
    { menu_code: 'bridge_outbound', menu_name: 'Laporan Barang Keluar', category: 'Bridge', order_index: 14 },
    { menu_code: 'bridge_movement', menu_name: 'Pergerakan Barang', category: 'Bridge', order_index: 15 },
    { menu_code: 'bridge_delivery', menu_name: 'Delivery Notes', category: 'Bridge', order_index: 16 },
    { menu_code: 'bridge_approval', menu_name: 'Approval Manager', category: 'Bridge', order_index: 17 },
    { menu_code: 'bridge_activity', menu_name: 'Activity Logger', category: 'Bridge', order_index: 18 },
    { menu_code: 'bridge_finance', menu_name: 'Keuangan Bridge', category: 'Bridge', order_index: 19 },
    { menu_code: 'bridge_coa', menu_name: 'Kode Akun', category: 'Bridge', order_index: 20 },
    { menu_code: 'bridge_partners', menu_name: 'Mitra Bisnis', category: 'Bridge', order_index: 21 },
    { menu_code: 'bridge_bc_master', menu_name: 'BC Master', category: 'Bridge', order_index: 22 },
    { menu_code: 'bridge_item_master', menu_name: 'Item Master', category: 'Bridge', order_index: 23 },
    { menu_code: 'bridge_hs_master', menu_name: 'HS Master', category: 'Bridge', order_index: 24 },
    { menu_code: 'bridge_pabean', menu_name: 'Pabean Dashboard', category: 'Bridge', order_index: 25 },
    { menu_code: 'bridge_barang_masuk', menu_name: 'Pabean - Barang Masuk', category: 'Bridge', order_index: 26 },
    { menu_code: 'bridge_barang_keluar', menu_name: 'Pabean - Barang Keluar', category: 'Bridge', order_index: 27 },
    { menu_code: 'bridge_barang_reject', menu_name: 'Pabean - Barang Reject', category: 'Bridge', order_index: 28 },
    { menu_code: 'bridge_pabean_movement', menu_name: 'Pabean - Pergerakan', category: 'Bridge', order_index: 29 },
    { menu_code: 'bridge_settings', menu_name: 'Pengaturan Modul', category: 'Bridge', order_index: 30 },

    // Blink
    { menu_code: 'blink_dashboard', menu_name: 'Dashboard Blink', category: 'Blink', order_index: 40 },
    { menu_code: 'blink_quotations', menu_name: 'Quotation', category: 'Blink', order_index: 41 },
    { menu_code: 'blink_shipments', menu_name: 'Shipment', category: 'Blink', order_index: 42 },
    { menu_code: 'blink_flow_monitor', menu_name: 'Flow Monitor', category: 'Blink', order_index: 43 },
    { menu_code: 'blink_sales', menu_name: 'Sales Achievement', category: 'Blink', order_index: 44 },
    { menu_code: 'blink_tracking', menu_name: 'Tracking & Monitoring', category: 'Blink', order_index: 45 },
    { menu_code: 'blink_awb', menu_name: 'AWB Management', category: 'Blink', order_index: 46 },
    { menu_code: 'blink_bl', menu_name: 'BL Management', category: 'Blink', order_index: 47 },
    { menu_code: 'blink_invoices', menu_name: 'Invoice', category: 'Blink', order_index: 48 },
    { menu_code: 'blink_purchase_order', menu_name: 'Purchase Order', category: 'Blink', order_index: 49 },
    { menu_code: 'blink_journal', menu_name: 'Jurnal Umum', category: 'Blink', order_index: 50 },
    { menu_code: 'blink_ledger', menu_name: 'Buku Besar', category: 'Blink', order_index: 51 },
    { menu_code: 'blink_trial_balance', menu_name: 'Trial Balance', category: 'Blink', order_index: 52 },
    { menu_code: 'blink_ar', menu_name: 'Piutang (AR)', category: 'Blink', order_index: 53 },
    { menu_code: 'blink_ap', menu_name: 'Hutang (AP)', category: 'Blink', order_index: 54 },
    { menu_code: 'blink_pnl', menu_name: 'Laba Rugi', category: 'Blink', order_index: 55 },
    { menu_code: 'blink_balance_sheet', menu_name: 'Neraca', category: 'Blink', order_index: 56 },
    { menu_code: 'blink_selling_buying', menu_name: 'Selling vs Buying', category: 'Blink', order_index: 57 },
    { menu_code: 'blink_routes', menu_name: 'Master Rute', category: 'Blink', order_index: 58 },
    { menu_code: 'blink_partners', menu_name: 'Mitra Bisnis', category: 'Blink', order_index: 59 },
    { menu_code: 'blink_settings', menu_name: 'Pengaturan Modul', category: 'Blink', order_index: 60 },

    // Big
    { menu_code: 'big_dashboard', menu_name: 'Dashboard BIG', category: 'Big', order_index: 70 },
    { menu_code: 'big_events', menu_name: 'Event Management', category: 'Big', order_index: 71 },
    { menu_code: 'big_costs', menu_name: 'Event Costs', category: 'Big', order_index: 72 },
    { menu_code: 'big_quotations', menu_name: 'Quotation', category: 'Big', order_index: 73 },
    { menu_code: 'big_invoices', menu_name: 'Invoice', category: 'Big', order_index: 74 },
    { menu_code: 'big_ar', menu_name: 'Piutang (AR)', category: 'Big', order_index: 75 },
    { menu_code: 'big_settings', menu_name: 'Pengaturan Modul', category: 'Big', order_index: 76 },
];

// ─── Default roles ─────────────────────────────────────────────────────
const DEFAULT_ROLES = ['direksi', 'chief', 'manager', 'staff', 'viewer'];

// ─── Default permissions per role ──────────────────────────────────────
const ROLE_DEFAULTS = {
    direksi: { can_access: true, can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: true },
    chief: { can_access: true, can_view: true, can_create: false, can_edit: true, can_delete: false, can_approve: true },
    manager: { can_access: true, can_view: true, can_create: true, can_edit: true, can_delete: false, can_approve: false },
    staff: { can_access: true, can_view: true, can_create: true, can_edit: false, can_delete: false, can_approve: false },
    viewer: { can_access: true, can_view: true, can_create: false, can_edit: false, can_delete: false, can_approve: false },
};

const ROLE_LABELS = {
    direksi: 'Direksi',
    chief: 'Chief',
    manager: 'Manager',
    staff: 'Staff',
    viewer: 'Viewer',
};

async function checkTable(tableName) {
    const { count, error } = await s.from(tableName).select('*', { count: 'exact', head: true });
    if (error) return { exists: false, error: error.message, count: 0 };
    return { exists: true, count };
}

async function seedMenuRegistry() {
    console.log('\n📋 Seeding menu_registry...');

    // Get existing menu codes
    const { data: existing } = await s.from('menu_registry').select('menu_code');
    const existingCodes = new Set(existing?.map(m => m.menu_code) || []);

    const toInsert = ALL_MENUS.filter(m => !existingCodes.has(m.menu_code));

    if (toInsert.length === 0) {
        console.log('   ✅ Semua menu sudah ada di menu_registry');
        return;
    }

    const { error } = await s.from('menu_registry').insert(toInsert);
    if (error) {
        console.log('   ⚠️  Error inserting menus:', error.message);
    } else {
        console.log(`   ✅ Menambahkan ${toInsert.length} menu baru ke menu_registry`);
    }
}

async function seedRolePermissions() {
    console.log('\n🛡️  Seeding role_permissions...');

    // Check if already seeded
    const { count } = await s.from('role_permissions').select('*', { count: 'exact', head: true });

    if (count > 0) {
        console.log(`   ✅ role_permissions sudah berisi ${count} rows`);
        return;
    }

    // Build permission rows
    const rows = [];
    for (const roleId of DEFAULT_ROLES) {
        const perms = ROLE_DEFAULTS[roleId];
        for (const menu of ALL_MENUS) {
            rows.push({
                role_id: roleId,
                role_label: ROLE_LABELS[roleId],
                menu_code: menu.menu_code,
                ...perms,
                updated_at: new Date().toISOString()
            });
        }
    }

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await s.from('role_permissions').upsert(batch, { onConflict: 'role_id,menu_code' });
        if (error) {
            console.log(`   ⚠️  Batch error:`, error.message);
        } else {
            inserted += batch.length;
        }
    }
    console.log(`   ✅ Inserted ${inserted} role permission rows`);
}

async function ensureSuperAdmin() {
    console.log('\n👤 Memastikan user superadmin...');

    const { data: existing } = await s.from('users').select('id,username,user_level,is_active').eq('username', 'superadmin').maybeSingle();

    if (existing) {
        console.log(`   ✅ User superadmin sudah ada (ID: ${existing.id})`);
        console.log(`      Level: ${existing.user_level} | Aktif: ${existing.is_active}`);
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const { data, error } = await s.from('users').insert({
        username: 'superadmin',
        password_hash: passwordHash,
        full_name: 'Super Administrator',
        email: 'superadmin@bakhtera.com',
        user_level: 'super_admin',
        portal_access: true,
        is_active: true,
        requires_password_change: false
    }).select().single();

    if (error) {
        console.log('   ⚠️  Error:', error.message);
    } else {
        console.log(`   ✅ User superadmin dibuat (ID: ${data.id})`);
    }
}

async function main() {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   Bakhtera-1 Database Setup & Seed    ║');
    console.log('╚═══════════════════════════════════════╝');
    console.log('\n🔍 Verifikasi tabel...\n');

    const tables = [
        'users',
        'user_sessions',
        'role_permissions',
        'user_menu_permissions',
        'user_audit_log',
        'menu_registry'
    ];

    let allGood = true;
    for (const t of tables) {
        const result = await checkTable(t);
        if (result.exists) {
            console.log(`   ✅ ${t.padEnd(25)} rows: ${result.count ?? 0}`);
        } else {
            console.log(`   ❌ ${t.padEnd(25)} TIDAK ADA — ${result.error}`);
            allGood = false;
        }
    }

    if (!allGood) {
        console.log('\n⚠️  Beberapa tabel belum ada. Jalankan SQL di Supabase SQL Editor:');
        console.log('   File: scripts/create-role-permissions-table.sql');
    }

    // Seed data
    await seedMenuRegistry();
    await seedRolePermissions();
    await ensureSuperAdmin();

    console.log('\n\n📊 Verifikasi akhir...');
    for (const t of tables) {
        const result = await checkTable(t);
        const status = result.exists ? '✅' : '❌';
        console.log(`   ${status} ${t.padEnd(25)} rows: ${result.count ?? 0}`);
    }

    console.log('\n╔══════════════════════════════════════════╗');
    console.log('║  Setup selesai!                          ║');
    console.log('║  Login: superadmin / password123         ║');
    console.log('╚══════════════════════════════════════════╝\n');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
