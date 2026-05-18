const fs = require('fs');
const filepath = 'scripts/fixes/fix_historical_journals.cjs';
let content = fs.readFileSync(filepath, 'utf8');

// Replace multiline console.log with a single line or backticks
content = content.replace(/console\.log\('\n--- Checking Bridge Invoices ---\'\);/g, "console.log('\\n--- Checking Bridge Invoices ---');");

fs.writeFileSync(filepath, content);
