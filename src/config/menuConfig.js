/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MENU CONFIG — Single Source of Truth
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * File ini adalah SATU-SATUNYA sumber kebenaran untuk semua menu code aplikasi.
 *
 * ✅ Digunakan oleh:
 *   - Sidebar.jsx          → untuk render menu + filter akses
 *   - RolePermissions.jsx  → untuk tabel permission management
 *   - App.jsx (ProtectedRoute) → menuCode per route
 *
 * 🔄 Jika menambah/ubah menu:
 *   1. Tambahkan entry di sini (APP_MENUS)
 *   2. Tambahkan route di App.jsx
 *   3. Tambahkan menu item di Sidebar.jsx dengan menuCode yang sama
 *   4. Klik "Sync ke Database" di RolePermissions agar entry baru masuk DB
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * APP_MENUS — daftar lengkap semua menu per modul.
 * Struktur: { code, label, group, path }
 *   - code  : identifier unik, dipakai sebagai menuCode di ProtectedRoute & canAccess()
 *   - label : nama tampilan di RolePermissions UI
 *   - group : nama grup / kategori (untuk header di tabel permission)
 *   - path  : route path (opsional, untuk referensi)
 */
export const APP_MENUS = {
    Bridge: {
        label: 'Bridge',
        color: 'blue',
        menus: [
            // ─── Operasional ───
            { code: 'bridge_dashboard', label: 'Dashboard Bridge', group: 'Operasional', path: '/bridge' },
            { code: 'bridge_pengajuan', label: 'Pengajuan', group: 'Operasional', path: '/bridge/pengajuan' },
            { code: 'bridge_ata_carnet', label: 'ATA Carnet', group: 'Operasional', path: '/bridge/ata-carnet' },
            { code: 'bridge_inventory', label: 'Inventaris Gudang', group: 'Operasional', path: '/bridge/inventory' },
            { code: 'bridge_outbound', label: 'Laporan Barang Keluar', group: 'Operasional', path: '/bridge/outbound-inventory' },
            { code: 'bridge_movement', label: 'Pergerakan Barang', group: 'Operasional', path: '/bridge/goods-movement' },
            { code: 'bridge_delivery', label: 'Surat Jalan', group: 'Operasional', path: '/bridge/delivery-notes' },
            // ─── Finance ───
            { code: 'bridge_finance', label: 'Keuangan (Invoice/PO/AR/AP)', group: 'Finance', path: '/bridge/finance/invoices' },
            { code: 'bridge_coa', label: 'Code of Account', group: 'Finance', path: '/bridge/code-of-account' },
            // ─── Master Data ───
            { code: 'bridge_partners', label: 'Mitra Bisnis', group: 'Master Data', path: '/bridge/master/partners' },
            { code: 'bridge_bc_master', label: 'Master Kode BC', group: 'Master Data', path: '/bridge/bc-master' },
            { code: 'bridge_item_master', label: 'Master Kode Barang', group: 'Master Data', path: '/bridge/item-master' },
            { code: 'bridge_hs_master', label: 'Master Kode HS', group: 'Master Data', path: '/bridge/hs-master' },
            // ─── Persetujuan & Log ───
            { code: 'bridge_approval', label: 'Approval Manager', group: 'Persetujuan & Log', path: '/bridge/approvals' },
            { code: 'bridge_activity', label: 'Activity Logger', group: 'Persetujuan & Log', path: '/bridge/logger' },
            { code: 'bridge_settings', label: 'Pengaturan Modul', group: 'Persetujuan & Log', path: '/bridge/master/settings' },
            // ─── Pabean ───
            { code: 'bridge_pabean', label: 'Pabean — Dashboard', group: 'Pabean', path: '/bridge/pabean' },
            { code: 'bridge_barang_masuk', label: 'Pabean — Barang Masuk', group: 'Pabean', path: '/bridge/pabean/barang-masuk' },
            { code: 'bridge_barang_keluar', label: 'Pabean — Barang Keluar', group: 'Pabean', path: '/bridge/pabean/barang-keluar' },
            { code: 'bridge_barang_reject', label: 'Pabean — Barang Reject', group: 'Pabean', path: '/bridge/pabean/barang-reject' },
            { code: 'bridge_pabean_movement', label: 'Pabean — Barang Mutasi', group: 'Pabean', path: '/bridge/pabean/pergerakan' },
        ],
    },

    Blink: {
        label: 'Blink',
        color: 'cyan',
        menus: [
            // ─── Utama ───
            { code: 'blink_dashboard', label: 'Dashboard Blink', group: 'Utama', path: '/blink' },
            // ─── Sales & Marketing ───
            { code: 'blink_sales_quotations', label: 'Sales Quotation', group: 'Sales & Marketing', path: '/blink/sales-quotations' },
            { code: 'blink_flow_monitor', label: 'Flow Monitor', group: 'Sales & Marketing', path: '/blink/flow-monitor' },
            { code: 'blink_sales', label: 'Sales Achievement', group: 'Sales & Marketing', path: '/blink/sales-achievement' },
            // ─── Operations ───
            { code: 'blink_quotations', label: 'Quotation', group: 'Operations', path: '/blink/operations/quotations' },
            { code: 'blink_shipments', label: 'Shipment Management', group: 'Operations', path: '/blink/shipments' },
            { code: 'blink_bl', label: 'Document BL/AWB', group: 'Operations', path: '/blink/operations/bl' },
            { code: 'blink_tracking', label: 'Tracking & Monitoring', group: 'Operations', path: '/blink/operations/tracking' },
            { code: 'blink_awb', label: 'AWB Management', group: 'Operations', path: '/blink/operations/awb' },
            // ─── Profit & Costing ───
            { code: 'blink_selling_buying', label: 'Selling vs Buying Analysis', group: 'Profit & Costing', path: '/blink/finance/selling-buying' },
            // ─── Finance ───
            { code: 'blink_invoices', label: 'Invoice', group: 'Finance', path: '/blink/finance/invoices' },
            { code: 'blink_purchase_order', label: 'Purchase Order', group: 'Finance', path: '/blink/finance/purchase-orders' },
            { code: 'blink_ar', label: 'Piutang (AR)', group: 'Finance', path: '/blink/finance/ar' },
            { code: 'blink_ap', label: 'Hutang (AP)', group: 'Finance', path: '/blink/finance/ap' },
            { code: 'blink_journal', label: 'Jurnal Umum', group: 'Finance', path: '/blink/finance/general-journal' },
            { code: 'blink_ledger', label: 'Buku Besar', group: 'Finance', path: '/blink/finance/general-ledger' },
            { code: 'blink_trial_balance', label: 'Neraca Saldo', group: 'Finance', path: '/blink/finance/trial-balance' },
            { code: 'blink_pnl', label: 'Laba Rugi', group: 'Finance', path: '/blink/finance/profit-loss' },
            { code: 'blink_balance_sheet', label: 'Neraca', group: 'Finance', path: '/blink/finance/balance-sheet' },
            // ─── Master Data ───
            { code: 'blink_coa', label: 'COA Master', group: 'Master Data', path: '/blink/master/coa' },
            { code: 'blink_routes', label: 'Master Routes', group: 'Master Data', path: '/blink/master/routes' },
            { code: 'blink_partners', label: 'Business Partners', group: 'Master Data', path: '/blink/master/partners' },
            { code: 'blink_settings', label: 'Module Settings', group: 'Master Data', path: '/blink/master/settings' },
            // ─── Approval ───
            { code: 'blink_approval', label: 'Approval Center', group: 'Approval', path: '/blink/approvals' },
        ],
    },

    Big: {
        label: 'BIG',
        color: 'orange',
        menus: [
            // ─── Utama ───
            { code: 'big_dashboard', label: 'Dashboard BIG', group: 'Utama', path: '/big' },
            // ─── Sales ───
            { code: 'big_quotations', label: 'Quotations', group: 'Sales', path: '/big/sales/quotations' },
            // ─── Operations ───
            { code: 'big_events', label: 'Event Management', group: 'Operations', path: '/big/operations/events' },
            { code: 'big_costs', label: 'Event Costs', group: 'Operations', path: '/big/operations/costs' },
            // ─── Finance ───
            { code: 'big_invoices', label: 'Invoice', group: 'Finance', path: '/big/finance/invoices' },
            { code: 'big_ar', label: 'Piutang (AR)', group: 'Finance', path: '/big/finance/ar' },
            // ─── Master Data ───
            { code: 'big_settings', label: 'Pengaturan Modul', group: 'Master Data', path: '/big/master/settings' },
        ],
    },

    // Pusat group removed — vendor/customer/finance/coa/settings each exist within their own portals.
};


/**
 * Helper: ambil flat array semua menu dari semua modul
 * @returns {{ code, label, group, path, module }[]}
 */
export const getAllMenus = () => {
    return Object.entries(APP_MENUS).flatMap(([moduleName, mod]) =>
        mod.menus.map(m => ({ ...m, module: moduleName }))
    );
};

/**
 * Helper: ambil semua unique menu codes
 * @returns {string[]}
 */
export const getAllMenuCodes = () => getAllMenus().map(m => m.code);
