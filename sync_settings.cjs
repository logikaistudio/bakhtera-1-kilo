const fs = require('fs');
const path = require('path');

const blinkFile = path.join(__dirname, 'src', 'pages', 'Blink', 'CompanySettings.jsx');
const bridgeFile = path.join(__dirname, 'src', 'pages', 'Bridge', 'CompanySettings.jsx');
const bigFile = path.join(__dirname, 'src', 'pages', 'Big', 'CompanySettings.jsx');

const blinkContent = fs.readFileSync(blinkFile, 'utf8');

// --- Bridge Version ---
let bridgeContent = blinkContent;
bridgeContent = bridgeContent.replace(/BlinkCompanySettings/g, 'BridgeCompanySettings');
bridgeContent = bridgeContent.replace(/Pengaturan Perusahaan \(Blink\)/g, 'Pengaturan Perusahaan (Bridge)');
bridgeContent = bridgeContent.replace(/MODULE = 'blink'/g, "MODULE = 'bridge'");
bridgeContent = bridgeContent.replace(/canEdit\('blink_settings'\)/g, "canEdit('bridge_settings')");
bridgeContent = bridgeContent.replace(/canCreate\('blink_settings'\)/g, "canCreate('bridge_settings')");
bridgeContent = bridgeContent.replace(/canDelete\('blink_settings'\)/g, "canDelete('bridge_settings')");
bridgeContent = bridgeContent.replace(/finance_coa/g, 'bridge_coa');

// Replace context destructuring variables if needed
// The context exposes companySettings, bankAccounts. Let's see how Blink uses it.
// Blink uses:
// companySettings, // Blink Settings (default)
// bankAccounts, // Blink Bank Accounts (default)
// We need to change these to bridgeSettings, bridgeBankAccounts for Bridge!
bridgeContent = bridgeContent.replace(/companySettings,/g, 'bridgeSettings,');
bridgeContent = bridgeContent.replace(/bankAccounts,/g, 'bridgeBankAccounts,');
bridgeContent = bridgeContent.replace(/companySettings/g, 'bridgeSettings');
bridgeContent = bridgeContent.replace(/bankAccounts/g, 'bridgeBankAccounts');

// --- Big Version ---
let bigContent = blinkContent;
bigContent = bigContent.replace(/BlinkCompanySettings/g, 'BigCompanySettings');
bigContent = bigContent.replace(/Pengaturan Perusahaan \(Blink\)/g, 'Pengaturan Perusahaan (Big)');
bigContent = bigContent.replace(/MODULE = 'blink'/g, "MODULE = 'big'");
bigContent = bigContent.replace(/canEdit\('blink_settings'\)/g, "canEdit('big_settings')");
bigContent = bigContent.replace(/canCreate\('blink_settings'\)/g, "canCreate('big_settings')");
bigContent = bigContent.replace(/canDelete\('blink_settings'\)/g, "canDelete('big_settings')");
bigContent = bigContent.replace(/finance_coa/g, 'big_coa');

// Change context variables
bigContent = bigContent.replace(/companySettings,/g, 'bigSettings,');
bigContent = bigContent.replace(/bankAccounts,/g, 'bigBankAccounts,');
bigContent = bigContent.replace(/companySettings/g, 'bigSettings');
bigContent = bigContent.replace(/bankAccounts/g, 'bigBankAccounts');

// Change colors for Big (blue -> orange)
bigContent = bigContent.replace(/text-blue-600/g, 'text-orange-600');
bigContent = bigContent.replace(/focus:ring-blue-500/g, 'focus:ring-orange-500');
bigContent = bigContent.replace(/focus:border-blue-500/g, 'focus:border-orange-500');
bigContent = bigContent.replace(/hover:bg-blue-50/g, 'hover:bg-orange-50');
bigContent = bigContent.replace(/bg-blue-600/g, 'bg-orange-600'); // if any

fs.writeFileSync(bridgeFile, bridgeContent);
console.log('Updated Bridge Company Settings');
fs.writeFileSync(bigFile, bigContent);
console.log('Updated Big Company Settings');
