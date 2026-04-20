import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Import journal helper functions
async function getAllCOA() {
  const { data, error } = await supabase
    .from('finance_coa')
    .select('*')
    .order('code');

  if (error) throw error;
  return data || [];
}

async function createInvoiceJournal({ invoice, coaList }) {
  console.log(`Creating journal for invoice ${invoice.invoice_number}`);

  // Simplified version - just create basic AR and Revenue entries
  const batchId = Date.now().toString();
  const jeNum = `JE-INV-${Date.now()}`;

  const arAccount = coaList.find(c => c.type === 'ASSET' && c.name.toLowerCase().includes('piutang')) || coaList.find(c => c.type === 'ASSET');
  const revAccount = coaList.find(c => c.type === 'REVENUE') || coaList.find(c => c.name.toLowerCase().includes('pendapatan'));

  if (!arAccount || !revAccount) {
    console.log('Missing AR or Revenue accounts');
    return;
  }

  const entries = [
    {
      entry_number: `${jeNum}-D`,
      entry_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
      entry_type: 'invoice',
      reference_type: 'ar',
      reference_id: invoice.id,
      reference_number: invoice.invoice_number,
      account_code: arAccount.code,
      account_name: arAccount.name,
      debit: invoice.total_amount,
      credit: 0,
      currency: invoice.currency || 'IDR',
      exchange_rate: invoice.exchange_rate || 1,
      description: `Invoice ${invoice.invoice_number} - ${invoice.customer_name}`,
      batch_id: batchId,
      coa_id: arAccount.id
    },
    {
      entry_number: `${jeNum}-C`,
      entry_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
      entry_type: 'invoice',
      reference_type: 'ar',
      reference_id: invoice.id,
      reference_number: invoice.invoice_number,
      account_code: revAccount.code,
      account_name: revAccount.name,
      debit: 0,
      credit: invoice.total_amount,
      currency: invoice.currency || 'IDR',
      exchange_rate: invoice.exchange_rate || 1,
      description: `Revenue ${invoice.invoice_number} - ${invoice.customer_name}`,
      batch_id: batchId,
      coa_id: revAccount.id
    }
  ];

  const { error } = await supabase.from('blink_journal_entries').insert(entries);
  if (error) {
    console.log('Error creating journal:', error);
  } else {
    console.log(`Journal created for invoice ${invoice.invoice_number}`);
  }
}

async function backfillJournals() {
  console.log('🔄 Backfilling journal entries for existing invoices...\n');

  try {
    const coaList = await getAllCOA();
    console.log(`Loaded ${coaList?.length || 0} COA entries`);

    const { data: invoices, error } = await supabase
      .from('blink_invoices')
      .select('*')
      .neq('status', 'draft')
      .neq('status', 'cancelled');

    if (error) throw error;
    console.log(`Found ${invoices?.length || 0} invoices to process`);

    for (const invoice of invoices || []) {
      // Check if journal already exists
      const { data: existing } = await supabase
        .from('blink_journal_entries')
        .select('id')
        .eq('reference_id', invoice.id)
        .eq('reference_type', 'ar')
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Journal already exists for invoice ${invoice.invoice_number}, skipping`);
        continue;
      }

      await createInvoiceJournal({ invoice, coaList });
    }

    console.log('🎉 Journal backfill completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

backfillJournals();