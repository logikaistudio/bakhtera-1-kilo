const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, 'src', 'components', 'Blink', 'InvoiceProfitSummary.jsx');
const destPath = path.join(__dirname, 'src', 'components', 'Bridge', 'InvoiceProfitSummary.jsx');

if (fs.existsSync(srcPath)) {
    let content = fs.readFileSync(srcPath, 'utf8');
    
    // Replace blink to bridge
    content = content.replace(/blink_purchase_orders/g, 'bridge_pos');
    content = content.replace(/blink_ap_transactions/g, 'bridge_ap_transactions');
    content = content.replace(/blink_invoices/g, 'bridge_invoices');
    content = content.replace(/blink_quotations/g, 'freight_pengajuan'); // not sure if it uses this
    
    // Also rename any specific text
    content = content.replace(/Blink/g, 'Bridge');
    
    fs.writeFileSync(destPath, content);
    console.log('Successfully copied and updated InvoiceProfitSummary.jsx');
} else {
    console.error('Source file not found!');
}
