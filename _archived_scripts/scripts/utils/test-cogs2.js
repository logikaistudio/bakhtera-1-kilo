const https = require('https');
const fs = require('fs');
const d = fs.readFileSync('.env', 'utf-8');
const url = d.match(/VITE_SUPABASE_URL=(.*)/)[1];
const key = d.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];
https.get(url + '/rest/v1/blink_invoices?select=cogs_items&limit=5', {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log('COGS ITEMS:', body));
});
