/**
 * Diagnosa Lengkap: Database Supabase + Role Permissions
 * Periksa semua tabel terkait autentikasi dan akses
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fullDiagnosis() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   DIAGNOSA LENGKAP DATABASE SUPABASE                    ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ═══ TEST 1: Koneksi Supabase ═══
    console.log('━━━ TEST 1: Koneksi Supabase ━━━');
    try {
        const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        if (error) {
            console.log(`  🔴 GAGAL terhubung ke Supabase: ${error.message}`);
            console.log('  💡 Kemungkinan database masih dalam status PAUSED');
            return;
        }
        console.log('  ✅ Koneksi ke Supabase berhasil\n');
    } catch (e) {
        console.log(`  🔴 Error koneksi: ${e.message}`);
        return;
    }

    // ═══ TEST 2: Cek semua tabel yang dibutuhkan ═══
    console.log('━━━ TEST 2: Cek Tabel Database ━━━');
    const tables = ['users', 'role_permissions', 'user_menu_permissions', 'menu_registry', 'user_sessions', 'user_audit_log'];
    for (const table of tables) {
        try {
            const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
            if (error) {
                console.log(`  🔴 ${table}: ERROR - ${error.message}`);
            } else {
                console.log(`  ✅ ${table}: ${count} rows`);
            }
        } catch (e) {
            console.log(`  🔴 ${table}: ${e.message}`);
        }
    }

    // ═══ TEST 3: Semua User ═══
    console.log('\n━━━ TEST 3: Daftar User ━━━');
    const { data: users, error: usrErr } = await supabase
        .from('users')
        .select('id, username, full_name, user_level, is_active, portal_access')
        .order('created_at');

    if (usrErr) {
        console.log(`  🔴 Error: ${usrErr.message}`);
        return;
    }

    console.log(`  Total: ${users.length} user\n`);
    console.log('  ┌─────────────────────┬──────────────────────┬──────────┬─────────┐');
    console.log('  │ Username            │ User Level (Role)    │ Aktif    │ Portal  │');
    console.log('  ├─────────────────────┼──────────────────────┼──────────┼─────────┤');
    for (const u of users) {
        console.log(`  │ ${(u.username || '').padEnd(19)} │ ${(u.user_level || 'NULL').padEnd(20)} │ ${u.is_active ? '  ✅    ' : '  ❌    '} │ ${u.portal_access ? '  ✅   ' : '  ❌   '} │`);
    }
    console.log('  └─────────────────────┴──────────────────────┴──────────┴─────────┘');

    // ═══ TEST 4: Semua Role di role_permissions ═══
    console.log('\n━━━ TEST 4: Role yang ada di role_permissions ━━━');
    const { data: allRolePerms, error: rpErr } = await supabase
        .from('role_permissions')
        .select('*');

    if (rpErr) {
        console.log(`  🔴 Error: ${rpErr.message}`);
    } else {
        // Group by role_id
        const roleMap = {};
        allRolePerms.forEach(rp => {
            if (!roleMap[rp.role_id]) {
                roleMap[rp.role_id] = { label: rp.role_label, total: 0, granted: [] };
            }
            roleMap[rp.role_id].total++;
            if (rp.can_access) {
                roleMap[rp.role_id].granted.push(rp.menu_code);
            }
        });

        for (const [roleId, info] of Object.entries(roleMap).sort((a, b) => a[0].localeCompare(b[0]))) {
            console.log(`\n  🏷️  Role: "${roleId}" (Label: ${info.label || '-'})`);
            console.log(`     Total entries: ${info.total} | Menu dgn akses: ${info.granted.length}`);
            if (info.granted.length > 0) {
                console.log(`     ✅ Menu accessible:`);
                info.granted.forEach(m => console.log(`        - ${m}`));
            } else {
                console.log(`     ⚠️  TIDAK ADA MENU YANG BISA DIAKSES!`);
            }
        }
    }

    // ═══ TEST 5: Cek ketidaksesuaian user_level vs role_permissions ═══
    console.log('\n\n━━━ TEST 5: Validasi user_level vs role_permissions ━━━');
    const roleIdsInDB = new Set(Object.keys(allRolePerms ? allRolePerms.reduce((acc, rp) => { acc[rp.role_id] = true; return acc; }, {}) : {}));
    const SYSTEM_ROLES = new Set(['super_admin', 'admin']);

    let problemCount = 0;
    for (const u of users) {
        if (SYSTEM_ROLES.has(u.user_level)) {
            console.log(`  ✅ ${u.username} → ${u.user_level} (system role, selalu punya akses penuh)`);
            continue;
        }
        if (!roleIdsInDB.has(u.user_level)) {
            console.log(`  🔴 ${u.username} → user_level="${u.user_level}" TIDAK DITEMUKAN di role_permissions!`);
            problemCount++;
        } else {
            // Count how many menus accessible for this role
            const rolePerms = allRolePerms.filter(rp => rp.role_id === u.user_level && rp.can_access);
            if (rolePerms.length === 0) {
                console.log(`  ⚠️  ${u.username} → role="${u.user_level}" ada tapi 0 menu accessible`);
                problemCount++;
            } else {
                console.log(`  ✅ ${u.username} → role="${u.user_level}" → ${rolePerms.length} menu accessible`);
            }
        }
    }

    // ═══ TEST 6: Cek menu_registry vs APP_MENUS ═══
    console.log('\n━━━ TEST 6: Menu Registry Completeness ━━━');
    const { data: menuReg } = await supabase.from('menu_registry').select('menu_code, menu_name');

    // List all expected menu codes from the app
    const EXPECTED_MENUS = [
        'bridge_dashboard', 'bridge_pengajuan', 'bridge_ata_carnet', 'bridge_asset_inventory',
        'bridge_inventory', 'bridge_outbound', 'bridge_movement', 'bridge_delivery',
        'bridge_finance', 'bridge_coa', 'bridge_partners', 'bridge_bc_master',
        'bridge_item_master', 'bridge_hs_master', 'bridge_approval', 'bridge_activity',
        'bridge_settings', 'bridge_pabean', 'bridge_barang_masuk', 'bridge_barang_keluar',
        'bridge_barang_reject', 'bridge_pabean_movement',
        'blink_dashboard', 'blink_sales_quotations', 'blink_flow_monitor', 'blink_sales',
        'blink_quotations', 'blink_shipments', 'blink_bl', 'blink_tracking', 'blink_awb',
        'blink_approval', 'blink_selling_buying', 'blink_invoices', 'blink_purchase_order',
        'blink_ar', 'blink_ap', 'blink_journal', 'blink_ledger', 'blink_trial_balance',
        'blink_pnl', 'blink_balance_sheet', 'blink_coa', 'blink_partners', 'blink_settings',
        'big_dashboard', 'big_quotations', 'big_events', 'big_costs',
        'big_invoices', 'big_ar', 'big_settings',
        'blink_routes',
    ];

    const regCodes = new Set((menuReg || []).map(m => m.menu_code));
    const missingInRegistry = EXPECTED_MENUS.filter(code => !regCodes.has(code));

    if (missingInRegistry.length > 0) {
        console.log(`  ⚠️  ${missingInRegistry.length} menu TIDAK ADA di menu_registry:`);
        missingInRegistry.forEach(m => console.log(`     - ${m}`));
    } else {
        console.log(`  ✅ Semua ${EXPECTED_MENUS.length} menu ada di menu_registry`);
    }

    // Cek menu di registry yang tidak ada di expected
    const extraInRegistry = [...regCodes].filter(code => !EXPECTED_MENUS.includes(code));
    if (extraInRegistry.length > 0) {
        console.log(`  ℹ️  ${extraInRegistry.length} menu tambahan di registry: ${extraInRegistry.join(', ')}`);
    }

    // ═══ TEST 7: role_permissions completeness per role ═══
    console.log('\n━━━ TEST 7: Kelengkapan role_permissions per role ━━━');
    const roles = [...new Set(allRolePerms.map(rp => rp.role_id))];
    for (const roleId of roles) {
        const roleMenus = new Set(allRolePerms.filter(rp => rp.role_id === roleId).map(rp => rp.menu_code));
        const missing = EXPECTED_MENUS.filter(code => !roleMenus.has(code));
        if (missing.length > 0) {
            console.log(`  ⚠️  Role "${roleId}": ${missing.length} menu belum terdaftar`);
            missing.forEach(m => console.log(`     - ${m}`));
        } else {
            console.log(`  ✅ Role "${roleId}": semua menu terdaftar (${roleMenus.size} entries)`);
        }
    }

    // ═══ TEST 8: user_menu_permissions (data lama yang mungkin konflip) ═══
    console.log('\n━━━ TEST 8: user_menu_permissions (data legacy) ━━━');
    const { data: ump } = await supabase.from('user_menu_permissions').select('*');
    if (!ump || ump.length === 0) {
        console.log('  ✅ Tabel user_menu_permissions kosong (tidak ada data lama yang konflik)');
    } else {
        console.log(`  ⚠️  ${ump.length} entri ditemukan di user_menu_permissions`);
        console.log('  ℹ️  Data ini TIDAK lagi digunakan setelah fix sebelumnya');
        console.log('  ℹ️  Tapi sebaiknya dibersihkan untuk menghindari kebingungan');

        // Group by user
        const umpByUser = {};
        ump.forEach(p => {
            if (!umpByUser[p.user_id]) umpByUser[p.user_id] = [];
            umpByUser[p.user_id].push(p);
        });

        for (const [userId, perms] of Object.entries(umpByUser)) {
            const user = users.find(u => u.id === userId);
            const granted = perms.filter(p => p.can_access).length;
            const denied = perms.filter(p => !p.can_access).length;
            console.log(`     ${(user?.username || userId).padEnd(20)} → ${granted} granted, ${denied} denied`);
        }
    }

    // ═══ RINGKASAN ═══
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   RINGKASAN & REKOMENDASI                               ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    if (problemCount > 0) {
        console.log(`\n  🔴 ${problemCount} masalah ditemukan!`);
    }

    if (missingInRegistry.length > 0) {
        console.log('\n  📋 TINDAKAN: Jalankan "Sync DB" di halaman Manajemen Role & Akses');
        console.log('     untuk menambahkan menu yang hilang ke database.');
    }

    const rolesWithNoMenus = roles.filter(r => {
        const granted = allRolePerms.filter(rp => rp.role_id === r && rp.can_access);
        return granted.length === 0;
    });
    if (rolesWithNoMenus.length > 0) {
        console.log(`\n  ⚠️  Role tanpa akses menu: ${rolesWithNoMenus.join(', ')}`);
        console.log('     → Buka Manajemen Role & Akses dan atur permission untuk role ini');
    }

    if (ump && ump.length > 0) {
        console.log('\n  📋 OPSIONAL: Bersihkan data legacy user_menu_permissions');
    }
}

fullDiagnosis().catch(console.error);
