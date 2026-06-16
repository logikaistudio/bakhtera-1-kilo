import { createClient } from '@supabase/supabase-js';

const liveUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const liveKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';

const localUrl = 'https://fsxdykjcajasmgybqdua.supabase.co';
const localKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';

const liveClient = createClient(liveUrl, liveKey);
const localClient = createClient(localUrl, localKey);

const tables = [
  'freight_quotations',
  'freight_customers',
  'freight_members',
  'blink_shipments',
  'blink_invoices',
  'locations'
];

async function checkCounts() {
  console.log('--- DATABASE COUNT COMPARISON ---');
  for (const table of tables) {
    try {
      const { count: liveCount, error: liveErr } = await liveClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      const { count: localCount, error: localErr } = await localClient
        .from(table)
        .select('*', { count: 'exact', head: true });

      console.log(`Table: ${table}`);
      console.log(`  Live (nkyos...):  ${liveErr ? 'ERROR: ' + liveErr.message : liveCount}`);
      console.log(`  Local (fsxdy...): ${localErr ? 'ERROR: ' + localErr.message : localCount}`);
    } catch (e) {
      console.log(`Table: ${table} - Exception: ${e.message}`);
    }
  }
}

checkCounts();
