const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length === 2) env[parts[0].trim()] = parts[1].trim();
});

const url = env.VITE_SUPABASE_URL + '/rest/v1/blink_journal_entries?entry_type=eq.invoice&reference_number=eq.INV-BLK2603-0008';

fetch(url, { headers: { 'apikey': env.VITE_SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + env.VITE_SUPABASE_ANON_KEY } })
  .then(r => r.json())
  .then(console.log);
