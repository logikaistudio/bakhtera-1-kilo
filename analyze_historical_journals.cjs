require('dotenv').config({ path: '.env.local' });
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
  const discountCOA = coaList.find(c => c.code === '5-02-100-0-1-00' || c.code.startsWith('4-02')) || { code: 'N/A' };

  console.log('Default Rev:', defaultRev?.code, defaultRev?.name);
  console.log('Default COGS:', defaultCOGS?.code, defaultCOGS?.name);
  console.log('Discount COA:', discountCOA?.code, discountCOA?.name);

  // Fetch blink invoices with their items
  const { data: invoices } = await supabase
    .from('blink_invoices')
    .select('id, invoice_number, discount_amount, invoice_items, cogs_items');

  // Fetch journal entries for these invoices
  const { data: journals } = await supabase
    .from('blink_journal_entries')
    .select('id, reference_id, entry_type, account_code, account_name, description, credit, debit')
    .in('entry_type', ['invoice', 'cogs']);

  let misaligned = [];

  for (let inv of invoices || []) {
    const invJournals = journals.filter(j => j.reference_id === inv.id);
    if (!invJournals.length) continue;

    const items = Array.isArray(inv.invoice_items) ? inv.invoice_items : [];
    
    // Check Revenue
    for (let item of items) {
      if (!item.amount || parseFloat(item.amount) === 0) continue;
      // The old logic searched journals by matching amount or description roughly.
      // But we can just check if there's any journal for this item that is NOT the selected coa_id
      // Or we can just check all credit entries for this invoice (revenue).
    }

    // A simpler check: Find any revenue journal that went to DISCOUNT when invoice discount is 0
    const revEntries = invJournals.filter(j => j.entry_type === 'invoice' && j.credit > 0);
    for (let re of revEntries) {
        // If it's the VAT account, skip
        if (re.account_code.startsWith('2')) continue;

        // Try to find the matching item
        let matchedItem = items.find(i => Math.abs(parseFloat(i.amount) - re.credit) < 0.1 && re.description.includes(i.item_name || i.description));
        let expectedCOAId = matchedItem?.coa_id || null;
        let expectedCOA = expectedCOAId ? coaList.find(c => c.id === expectedCOAId) : null;
        
        let expectedCode = expectedCOA ? expectedCOA.code : defaultRev?.code;

        // Special case for real discount
        if (inv.discount_amount > 0 && Math.abs(re.credit - inv.discount_amount) < 0.1) {
             // wait, discount is debit, not credit
        }

        if (re.account_code !== expectedCode) {
            misaligned.push({
                type: 'REVENUE',
                invoice: inv.invoice_number,
                desc: re.description,
                current_code: re.account_code,
                current_name: re.account_name,
                expected_code: expectedCode,
                expected_name: expectedCOA ? expectedCOA.name : defaultRev?.name,
                amount: re.credit,
                item_name: matchedItem ? (matchedItem.item_name || matchedItem.description) : 'N/A',
                item_coa_id: expectedCOAId,
                journal_id: re.id
            });
        }
    }
  }

  console.log(`Found ${misaligned.length} misaligned revenue entries.`);
  if (misaligned.length > 0) {
      console.log(misaligned.slice(0, 10)); // print first 10
  }
}

run().catch(console.error);
