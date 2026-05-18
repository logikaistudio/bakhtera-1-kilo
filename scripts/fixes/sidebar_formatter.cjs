const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, 'src', 'components', 'Layout', 'Sidebar.jsx');

if (fs.existsSync(sidebarPath)) {
    let content = fs.readFileSync(sidebarPath, 'utf8');

    // 1. Replace Bridge Operasional & Persetujuan
    const bridgeOldOperasional = `        // Operasional Category
        {
            type: 'category', label: '📦 Operasional', items: [
                { path: '/bridge/ata-carnet', label: 'ATA Carnet', menuCode: 'bridge_ata_carnet' },
                { path: '/bridge/asset-inventory', label: 'Asset Inventory', menuCode: 'bridge_asset_inventory' },
                { path: '/bridge/pengajuan', label: 'Pengajuan', menuCode: 'bridge_pengajuan' },
                { path: '/bridge/inventory', label: 'Inventaris Gudang', menuCode: 'bridge_inventory' },
                { path: '/bridge/outbound-inventory', label: 'Laporan Barang Keluar', menuCode: 'bridge_outbound' },
                { path: '/bridge/goods-movement', label: 'Pergerakan Barang', menuCode: 'bridge_movement' },
                { path: '/bridge/delivery-notes', label: 'Surat Jalan', menuCode: 'bridge_delivery' },
            ]
        },`;

    const bridgeNewOperasional = `        // Operasional Category
        {
            type: 'category', label: '📦 Operasional', items: [
                { type: 'divider', label: '🔔 Persetujuan & Log' },
                { path: '/bridge/approvals', label: 'Approval Manager', menuCode: 'bridge_approval', showBadge: true, indent: true },
                { path: '/bridge/logger', label: 'Activity Logger', menuCode: 'bridge_activity', indent: true },
                
                { type: 'divider', label: '📄 Dokumen' },
                { path: '/bridge/pengajuan', label: 'Pengajuan', menuCode: 'bridge_pengajuan', indent: true },
                { path: '/bridge/ata-carnet', label: 'ATA Carnet', menuCode: 'bridge_ata_carnet', indent: true },
                
                { type: 'divider', label: '📦 Inventory' },
                { path: '/bridge/asset-inventory', label: 'Asset Inventory', menuCode: 'bridge_asset_inventory', indent: true },
                { path: '/bridge/inventory', label: 'Inventaris Gudang', menuCode: 'bridge_inventory', indent: true },
                { path: '/bridge/outbound-inventory', label: 'Laporan Barang Keluar', menuCode: 'bridge_outbound', indent: true },
                { path: '/bridge/goods-movement', label: 'Pergerakan Barang', menuCode: 'bridge_movement', indent: true },
                { path: '/bridge/delivery-notes', label: 'Surat Jalan', menuCode: 'bridge_delivery', indent: true },
            ]
        },`;

    content = content.replace(bridgeOldOperasional, bridgeNewOperasional);

    // Remove Persetujuan Category from Bridge
    const bridgeOldPersetujuan = `        // Persetujuan & Log Category
        {
            type: 'category', label: '🔔 Persetujuan & Log', items: [
                { path: '/bridge/approvals', label: 'Approval Manager', menuCode: 'bridge_approval', showBadge: true },
                { path: '/bridge/logger', label: 'Activity Logger', menuCode: 'bridge_activity' },
                            ]
        },`;
    content = content.replace(bridgeOldPersetujuan, '');


    // 2. Replace Bridge Master Data
    const bridgeOldMasterData = `        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/bridge/master/partners', label: 'Mitra Bisnis', menuCode: 'bridge_partners' },
                { path: '/bridge/bc-master', label: 'Master Kode BC', menuCode: 'bridge_bc_master' },
                { path: '/bridge/hs-master', label: 'Master Kode HS', menuCode: 'bridge_hs_master' },
                { path: '/bridge/item-master', label: 'Master Kode Barang', menuCode: 'bridge_item_master' },
                { path: '/bridge/code-of-account', label: 'Code of Account', menuCode: 'bridge_coa' },
                { path: '/bridge/master/settings', label: 'Pengaturan Modul', menuCode: 'bridge_settings' },
            ]
        },`;

    const bridgeNewMasterData = `        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { type: 'divider', label: '👥 Relasi' },
                { path: '/bridge/master/partners', label: 'Mitra Bisnis', menuCode: 'bridge_partners', indent: true },
                { type: 'divider', label: '📦 Komoditas' },
                { path: '/bridge/bc-master', label: 'Master Kode BC', menuCode: 'bridge_bc_master', indent: true },
                { path: '/bridge/hs-master', label: 'Master Kode HS', menuCode: 'bridge_hs_master', indent: true },
                { path: '/bridge/item-master', label: 'Master Kode Barang', menuCode: 'bridge_item_master', indent: true },
                { type: 'divider', label: '⚙️ Sistem' },
                { path: '/bridge/code-of-account', label: 'Code of Account', menuCode: 'bridge_coa', indent: true },
                { path: '/bridge/master/settings', label: 'Pengaturan Modul', menuCode: 'bridge_settings', indent: true },
            ]
        },`;

    content = content.replace(bridgeOldMasterData, bridgeNewMasterData);


    // 3. Replace Big Sales & Operations & Master Data
    const bigOldSales = `        // Sales Category
        {
            type: 'category', label: '📋 Sales', items: [
                { path: '/big/sales/quotations', label: 'Quotations', menuCode: 'big_quotations' },
            ]
        },`;

    const bigNewSales = `        // Sales Category
        {
            type: 'category', label: '📋 Sales', items: [
                { type: 'divider', label: '💼 Transaksi' },
                { path: '/big/sales/quotations', label: 'Quotations', menuCode: 'big_quotations', indent: true },
            ]
        },`;

    content = content.replace(bigOldSales, bigNewSales);


    const bigOldOperations = `        // Operations Category
        {
            type: 'category', label: '⚙️ Operations', items: [
                { path: '/big/operations/events', label: 'Event Management', menuCode: 'big_events' },
                { path: '/big/operations/costs', label: 'Event Costs', menuCode: 'big_costs' },
            ]
        },`;

    const bigNewOperations = `        // Operations Category
        {
            type: 'category', label: '⚙️ Operations', items: [
                { type: 'divider', label: '🎯 Event' },
                { path: '/big/operations/events', label: 'Event Management', menuCode: 'big_events', indent: true },
                { path: '/big/operations/costs', label: 'Event Costs', menuCode: 'big_costs', indent: true },
            ]
        },`;

    content = content.replace(bigOldOperations, bigNewOperations);


    const bigOldMasterData = `        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { path: '/big/master/settings', label: 'Pengaturan Modul', menuCode: 'big_settings' },
            ]
        },`;

    const bigNewMasterData = `        // Master Data Category
        {
            type: 'category', label: '⚙️ Master Data', items: [
                { type: 'divider', label: '⚙️ Sistem' },
                { path: '/big/master/settings', label: 'Pengaturan Modul', menuCode: 'big_settings', indent: true },
            ]
        },`;

    content = content.replace(bigOldMasterData, bigNewMasterData);


    fs.writeFileSync(sidebarPath, content);
    console.log('Sidebar.jsx fully formatted.');
}
