const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') }); // try .env instead
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  console.log('Fetching COA List...');
  const { data: coaList } = await supabase.from('finance_coa').select('*');
  const defaultRev = coaList.find(c => c.code === '4-01-001') || coaList.find(c => c.code.startsWith('4-01'));
  const defaultCOGS = coaList.find(c => c.code === '5-01-001') || coaList.find(c => c.code.startsWith('5-01'));

  console.log('Default Rev:', defaultRev?.code, defaultRev?.name);
  console.log('Default COGS:', defaultCOGS?.code, defaultCOGS?.name);

  // Fetch blink invoices with their items
  const { data: invoices } = await supabase
    .from('blink_invoices')
    .select('id, invoice_number, discount_amount, invoice_items, cogs_items');

  // Fetch journal entries for these invoices
  const { data: journals } = await supabase
    .from('blink_journal_entries')
    .select('*')
    .in('entry_type', ['invoice', 'cogs']);

  let toUpdate = [];

  for (let inv of invoices || []) {
    const invJournals = journals.filter(j => j.reference_id === inv.id);
    if (!invJournals.length) continue;

    const items = Array.isArray(inv.invoice_items) ? inv.invoice_items : [];
    const revEntries = invJournals.filter(j => j.entry_type === 'invoice' && j.credit > 0);
    
    // Process Revenue Items
    for (let re of revEntries) {
        if (re.account_code.startsWith('2')) continue; // Tax
        
        let expectedCOAId = null;
        let expectedCOA = null;

        // Try to match by description first
        let matchedItem = items.find(i => re.description.includes(i.item_name || i.description || 'XXXX'));
        
        // If not matched by description, try amount
        if (!matchedItem) {
             matchedItem = items.find(i => Math.abs(parseFloat(i.amount) - re.credit) < 0.1);
        }

        if (matchedItem) {
             expectedCOAId = matchedItem.coa_id;
        }

        if (expectedCOAId) {
             expectedCOA = coaList.find(c => c.id === expectedCOAId);
        }

        const isDiscountJournal = re.description.toLowerCase().includes('discount') || re.description.toLowerCase().includes('diskon');
        if (isDiscountJournal && inv.discount_amount > 0) continue;

        let expectedCode = expectedCOA ? expectedCOA.code : defaultRev?.code;
        let expectedName = expectedCOA ? expectedCOA.name : defaultRev?.name;

        if (re.account_code !== expectedCode && expectedCode) {
            console.log(`Mismatch Rev: ${inv.invoice_number} | Cur: ${re.account_code} ${re.account_name} | Exp: ${expectedCode} ${expectedName} | Amt: ${re.credit}`);
            toUpdate.push({
                id: re.id,
                account_code: expectedCode,
                account_name: expectedName,
                coa_id: expectedCOA ? expectedCOA.id : (defaultRev?.id || null)
            });
        }
    }

    const cogsItems = Array.isArray(inv.cogs_items) ? inv.cogs_items : [];
    const cogsEntries = invJournals.filter(j => j.entry_type === 'cogs' && j.debit > 0);

    for (let ce of cogsEntries) {
        let expectedCOAId = null;
        let expectedCOA = null;

        let matchedItem = cogsItems.find(i => ce.description.includes(i.item_name || i.description || 'XXXX'));
        if (!matchedItem) {
             matchedItem = cogsItems.find(i => Math.abs(parseFloat(i.amount) - ce.debit) < 0.1);
        }

        if (matchedItem) {
             expectedCOAId = matchedItem.coa_id;
        }

        if (expectedCOAId) {
             expectedCOA = coaList.find(c => c.id === expectedCOAId);
        }

        let expectedCode = expectedCOA ? expectedCOA.code : defaultCOGS?.code;
        let expectedName = expectedCOA ? expectedCOA.name : defaultCOGS?.name;

        if (ce.account_code !== expectedCode && expectedCode) {
            console.log(`Mismatch COGS: ${inv.invoice_number} | Cur: ${ce.account_code} ${ce.account_name} | Exp: ${expectedCode} ${expectedName} | Amt: ${ce.debit}`);
            toUpdate.push({
                id: ce.id,
                account_code: expectedCode,
                account_name: expectedName,
                coa_id: expectedCOA ? expectedCOA.id : (defaultCOGS?.id || null)
            });
        }
    }
  }

  console.log(`Found ${toUpdate.length} entries to fix.`);
  
  // Apply updates
  if (toUpdate.length > 0) {
      console.log('Applying fixes to blink_journal_entries...');
      for (let chunk = 0; chunk < toUpdate.length; chunk += 50) {
          const slice = toUpdate.slice(chunk, chunk + 50);
          for (let row of slice) {
              await supabase.from('blink_journal_entries').update({
                  account_code: row.account_code,
                  account_name: row.account_name,
                  coa_id: row.coa_id
              }).eq('id', row.id);
          }
          console.log(`Updated ${chunk + slice.length}/${toUpdate.length}`);
      }
      console.log('Done fixing blink_journal_entries.');
  }

  // --- Do the same for BRIDGE ---
  console.log('\n--- Checking Bridge Invoices ---');
  const { data: bInvoices } = await supabase
    .from('bridge_invoices')
    .select('id, invoice_number, discount_amount, invoice_items, cogs_items');

  const { data: bJournals } = await supabase
    .from('bridge_journal_entries')
    .select('*')
    .in('entry_type', ['invoice', 'cogs']);

  let bToUpdate = [];

  for (let inv of bInvoices || []) {
    const invJournals = bJournals.filter(j => j.reference_id === inv.id);
    if (!invJournals.length) continue;

    const items = Array.isArray(inv.invoice_items) ? inv.invoice_items : [];
    const revEntries = invJournals.filter(j => j.entry_type === 'invoice' && j.credit > 0);
    
    // Process Revenue Items
    for (let re of revEntries) {
        if (re.account_code.startsWith('2')) continue; // Tax
        
        let expectedCOAId = null;
        let expectedCOA = null;

        let matchedItem = items.find(i => re.description.includes(i.item_name || i.description || 'XXXX'));
        if (!matchedItem) {
             matchedItem = items.find(i => Math.abs(parseFloat(i.amount) - re.credit) < 0.1);
        }

        if (matchedItem) {
             expectedCOAId = matchedItem.coa_id;
        }

        if (expectedCOAId) {
             expectedCOA = coaList.find(c => c.id === expectedCOAId);
        }

        const isDiscountJournal = re.description.toLowerCase().includes('discount') || re.description.toLowerCase().includes('diskon');
        if (isDiscountJournal && inv.discount_amount > 0) continue;

        let expectedCode = expectedCOA ? expectedCOA.code : defaultRev?.code;
        let expectedName = expectedCOA ? expectedCOA.name : defaultRev?.name;

        if (re.account_code !== expectedCode && expectedCode) {
            console.log(`Bridge Mismatch Rev: ${inv.invoice_number} | Cur: ${re.account_code} ${re.account_name} | Exp: ${expectedCode} ${expectedName} | Amt: ${re.credit}`);
            bToUpdate.push({
                id: re.id,
                account_code: expectedCode,
                account_name: expectedName,
                coa_id: expectedCOA ? expectedCOA.id : (defaultRev?.id || null)
            });
        }
    }

    const cogsItems = Array.isArray(inv.cogs_items) ? inv.cogs_items : [];
    const cogsEntries = invJournals.filter(j => j.entry_type === 'cogs' && j.debit > 0);

    for (let ce of cogsEntries) {
        let expectedCOAId = null;
        let expectedCOA = null;

        let matchedItem = cogsItems.find(i => ce.description.includes(i.item_name || i.description || 'XXXX'));
        if (!matchedItem) {
             matchedItem = cogsItems.find(i => Math.abs(parseFloat(i.amount) - ce.debit) < 0.1);
        }

        if (matchedItem) {
             expectedCOAId = matchedItem.coa_id;
        }

        if (expectedCOAId) {
             expectedCOA = coaList.find(c => c.id === expectedCOAId);
        }

        let expectedCode = expectedCOA ? expectedCOA.code : defaultCOGS?.code;
        let expectedName = expectedCOA ? expectedCOA.name : defaultCOGS?.name;

        if (ce.account_code !== expectedCode && expectedCode) {
            console.log(`Bridge Mismatch COGS: ${inv.invoice_number} | Cur: ${ce.account_code} ${ce.account_name} | Exp: ${expectedCode} ${expectedName} | Amt: ${ce.debit}`);
            bToUpdate.push({
                id: ce.id,
                account_code: expectedCode,
                account_name: expectedName,
                coa_id: expectedCOA ? expectedCOA.id : (defaultCOGS?.id || null)
            });
        }
    }
  }

  console.log(`Found ${bToUpdate.length} entries to fix in Bridge.`);
  
  // Apply updates
  if (bToUpdate.length > 0) {
      console.log('Applying fixes to bridge_journal_entries...');
      for (let chunk = 0; chunk < bToUpdate.length; chunk += 50) {
          const slice = bToUpdate.slice(chunk, chunk + 50);
          for (let row of slice) {
              await supabase.from('bridge_journal_entries').update({
                  account_code: row.account_code,
                  account_name: row.account_name,
                  coa_id: row.coa_id
              }).eq('id', row.id);
          }
          console.log(`Updated ${chunk + slice.length}/${bToUpdate.length}`);
      }
      console.log('Done fixing bridge_journal_entries.');
  }

}

run().catch(console.error);
