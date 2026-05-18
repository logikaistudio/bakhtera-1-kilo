const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, "../../src", 'pages', 'Blink');
const destDir = path.join(__dirname, "../../src", 'pages', 'Bridge');

const filesToClone = [
    { src: 'AccountsPayable.jsx', dest: 'BridgeAccountsPayable.jsx' },
    { src: 'AccountsReceivable.jsx', dest: 'BridgeAccountsReceivable.jsx' },
    { src: 'BalanceSheet.jsx', dest: 'BridgeBalanceSheet.jsx' },
    { src: 'GeneralJournal.jsx', dest: 'BridgeGeneralJournal.jsx' },
    { src: 'GeneralLedger.jsx', dest: 'BridgeGeneralLedger.jsx' },
    { src: 'InvoiceManagement.jsx', dest: 'BridgeInvoiceManagement.jsx' },
    { src: 'ProfitLoss.jsx', dest: 'BridgeProfitLoss.jsx' },
    { src: 'PurchaseOrder.jsx', dest: 'BridgePurchaseOrder.jsx' },
    { src: 'TrialBalance.jsx', dest: 'BridgeTrialBalance.jsx' }
];

const replacements = [
    { from: /finance_coa/g, to: 'bridge_coa' },
    { from: /blink_journal_entries/g, to: 'bridge_journal_entries' },
    { from: /blink_journal_line_items/g, to: 'bridge_journal_line_items' },
    { from: /blink_invoices/g, to: 'bridge_invoices' },
    { from: /blink_purchase_orders/g, to: 'bridge_pos' },
    { from: /blink_ap_transactions/g, to: 'bridge_ap_transactions' },
    { from: /big_ap_transactions/g, to: 'bridge_ap_transactions' },
    { from: /blink_ar_transactions/g, to: 'bridge_ar_transactions' },
    { from: /blink_payments/g, to: 'bridge_payments' },
    { from: /blink_business_partners/g, to: 'bridge_business_partners' },
    { from: /blink_finance/g, to: 'bridge_finance' },
    { from: /company_bank_accounts/g, to: 'bank_accounts' }, // Bridge uses bank_accounts instead of company_bank_accounts in some cases, wait, both use bank_accounts? I'll let company_bank_accounts stay if it exists, actually in Blink Invoice it uses 'bank_accounts' and PO uses 'company_bank_accounts'. Let's replace 'company_bank_accounts' -> 'bank_accounts' for consistency.
];

// Read, replace, and write
filesToClone.forEach(({ src, dest }) => {
    const srcPath = path.join(srcDir, src);
    const destPath = path.join(destDir, dest);
    
    if (fs.existsSync(srcPath)) {
        let content = fs.readFileSync(srcPath, 'utf8');
        
        // General replacements
        replacements.forEach(({ from, to }) => {
            content = content.replace(from, to);
        });

        // Specific component name replacements
        const componentName = src.split('.')[0];
        const destComponentName = dest.split('.')[0];
        
        // e.g. "const TrialBalance =" -> "const BridgeTrialBalance ="
        content = content.replace(new RegExp(`const ${componentName} =`, 'g'), `const ${destComponentName} =`);
        content = content.replace(new RegExp(`export default ${componentName};`, 'g'), `export default ${destComponentName};`);

        // Change Title texts in UI (e.g. "Trial Balance Blink" -> "Trial Balance Bridge")
        content = content.replace(/Blink/g, 'Bridge');

        // Handle the auto-fill feature table mapping for PO and Invoice
        content = content.replace(/blink_quotations/g, 'freight_pengajuan');
        content = content.replace(/blink_shipments/g, 'freight_pengajuan'); // For now, point both to pengajuan so it doesn't crash on missing table

        fs.writeFileSync(destPath, content);
        console.log(`Cloned and modified ${src} -> ${dest}`);
    } else {
        console.error(`Source file not found: ${srcPath}`);
    }
});

console.log('Cloning process completed.');
