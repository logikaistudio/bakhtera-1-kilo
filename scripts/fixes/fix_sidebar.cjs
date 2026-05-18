const fs = require('fs');
const path = require('path');

const sidebarPath = path.join(__dirname, '../../src', 'components', 'Layout', 'Sidebar.jsx');

if (fs.existsSync(sidebarPath)) {
    let content = fs.readFileSync(sidebarPath, 'utf8');

    // Remove from Persetujuan
    content = content.replace(
        /\{\s*path:\s*'\/bridge\/master\/settings',\s*label:\s*'Pengaturan Modul',\s*menuCode:\s*'bridge_settings'\s*\},?\n/g,
        ''
    );

    // Add to Master Data
    const masterDataTarget = `\{ path: '/bridge/code-of-account', label: 'Code of Account', menuCode: 'bridge_coa' \},`;
    const masterDataReplacement = `{ path: '/bridge/code-of-account', label: 'Code of Account', menuCode: 'bridge_coa' },\n                { path: '/bridge/master/settings', label: 'Pengaturan Modul', menuCode: 'bridge_settings' },`;
    
    content = content.replace(masterDataTarget, masterDataReplacement);

    fs.writeFileSync(sidebarPath, content);
    console.log('Sidebar.jsx updated successfully.');
} else {
    console.log('Sidebar.jsx not found!');
}
