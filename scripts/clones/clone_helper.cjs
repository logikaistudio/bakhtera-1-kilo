const fs = require('fs');
const path = require('path');

const helperSrc = path.join(__dirname, "../../src", 'utils', 'journalHelper.js');
const helperDest = path.join(__dirname, "../../src", 'utils', 'bridgeJournalHelper.js');
const bridgeDir = path.join(__dirname, "../../src", 'pages', 'Bridge');

// 1. Clone journalHelper.js to bridgeJournalHelper.js
if (fs.existsSync(helperSrc)) {
    let content = fs.readFileSync(helperSrc, 'utf8');
    
    // Replace Blink tables to Bridge tables
    content = content.replace(/blink_journal_entries/g, 'bridge_journal_entries');
    content = content.replace(/blink_journal_line_items/g, 'bridge_journal_line_items');
    content = content.replace(/blink_invoices/g, 'bridge_invoices');
    content = content.replace(/blink_purchase_orders/g, 'bridge_pos');
    content = content.replace(/blink_ap_transactions/g, 'bridge_ap_transactions');
    content = content.replace(/blink_ar_transactions/g, 'bridge_ar_transactions');
    content = content.replace(/finance_coa/g, 'bridge_coa');
    
    // Rename function
    content = content.replace(/migrateBlinkFinancialRecords/g, 'migrateBridgeFinancialRecords');
    
    fs.writeFileSync(helperDest, content);
    console.log('Successfully cloned bridgeJournalHelper.js');
}

// 2. Update imports in src/pages/Bridge/Bridge*.jsx
const files = fs.readdirSync(bridgeDir);
files.forEach(file => {
    if (file.startsWith('Bridge') && file.endsWith('.jsx')) {
        const filePath = path.join(bridgeDir, file);
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        if (content.includes("from '../../utils/journalHelper'")) {
            content = content.replace(/from '\.\.\/\.\.\/utils\/journalHelper'/g, "from '../../utils/bridgeJournalHelper'");
            modified = true;
        }
        
        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`Updated import in ${file}`);
        }
    }
});
