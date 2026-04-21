const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkTables() {
  console.log('Checking available tables...\n');

  // Check if big_ar_transactions exists
  try {
    const { data: bigAr, error: bigArErr } = await supabase.from('big_ar_transactions').select('count').limit(1);
    if (!bigArErr) {
      console.log('✅ big_ar_transactions exists');
    } else {
      console.log('❌ big_ar_transactions error:', bigArErr.message);
    }
  } catch (e) {
    console.log('❌ big_ar_transactions does not exist');
  }

  // Check invoices
  try {
    const { data: invoices, error: invErr } = await supabase.from('blink_invoices').select('id, status, total_amount').limit(5);
    if (!invErr) {
      console.log('✅ blink_invoices exists');
      console.log('Sample records:', invoices?.length || 0);
      if (invoices && invoices.length > 0) {
        console.log('Statuses:', invoices.map(i => i.status).join(', '));
      }
    } else {
      console.log('❌ blink_invoices error:', invErr.message);
    }
  } catch (e) {
    console.log('❌ blink_invoices error:', e.message);
  }

  // Check POs
  try {
    const { data: pos, error: poErr } = await supabase.from('blink_purchase_orders').select('id, status, total_amount').limit(5);
    if (!poErr) {
      console.log('✅ blink_purchase_orders exists');
      console.log('Sample records:', pos?.length || 0);
      if (pos && pos.length > 0) {
        console.log('Statuses:', pos.map(p => p.status).join(', '));
      }
    } else {
      console.log('❌ blink_purchase_orders error:', poErr.message);
    }
  } catch (e) {
    console.log('❌ blink_purchase_orders error:', e.message);
  }
}

checkTables().catch(console.error);