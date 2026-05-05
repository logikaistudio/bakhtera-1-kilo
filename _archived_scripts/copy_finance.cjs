const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'pages', 'Bridge');
const destDir = path.join(__dirname, 'src', 'pages', 'Big', 'Finance');

const filesToCopy = [
    'BridgeInvoiceManagement.jsx',
    'BridgePurchaseOrder.jsx',
    'BridgeAccountsReceivable.jsx',
    'BridgeAccountsPayable.jsx',
    'BridgeGeneralJournal.jsx',
    'BridgeGeneralLedger.jsx',
    'BridgeTrialBalance.jsx',
    'BridgeProfitLoss.jsx',
    'BridgeBalanceSheet.jsx'
];

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const destFileName = file.replace('Bridge', 'Big');
    const destPath = path.join(destDir, destFileName);

    let content = fs.readFileSync(srcPath, 'utf8');
    
    // Replace table names
    content = content.replace(/bridge_/g, 'big_');
    
    // Replace Component Names and Labels
    content = content.replace(/Bridge/g, 'Big');
    
    // Replace menu codes
    content = content.replace(/big_finance/g, 'big_finance'); 
    
    // Note: The previous replacement made `bridge_finance` -> `big_finance`. 
    // Is that what we want? Yes, we used menuCode="big_finance" in App.jsx and Sidebar.jsx

    fs.writeFileSync(destPath, content);
    console.log(`Copied and modified ${file} -> ${destFileName}`);
});
