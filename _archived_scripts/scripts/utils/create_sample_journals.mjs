// Script to check invoices and create sample journal data
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('=== FreightOne Data Check ===\n');

// Check invoices
console.log('1. Checking invoices...');
const { data: invoices, error: invError } = await supabase
    .from('blink_invoices')
    .select('id, invoice_number, customer_name, total_amount, status')
    .order('created_at', { ascending: false })
    .limit(10);

if (invError) {
    console.log('Error checking invoices:', invError.message);
} else {
    console.log(`Found ${invoices?.length || 0} invoices`);
    if (invoices && invoices.length > 0) {
        invoices.forEach(inv => {
            console.log(`  - ${inv.invoice_number} | ${inv.customer_name} | ${inv.total_amount} | ${inv.status}`);
        });
    }
}

// Check freight_invoices
console.log('\n2. Checking freight_invoices...');
const { data: freightInv } = await supabase
    .from('freight_invoices')
    .select('id, invoice_number, customer_name, total_amount, status')
    .order('created_at', { ascending: false })
    .limit(10);

console.log(`Found ${freightInv?.length || 0} freight invoices`);
if (freightInv && freightInv.length > 0) {
    freightInv.forEach(inv => {
        console.log(`  - ${inv.invoice_number} | ${inv.customer_name} | ${inv.total_amount} | ${inv.status}`);
    });
}

// Check COA
console.log('\n3. Checking Chart of Accounts...');
const { data: coa } = await supabase
    .from('finance_coa')
    .select('id, code, name, category')
    .order('code')
    .limit(20);

console.log(`Found ${coa?.length || 0} COA entries`);
if (coa && coa.length > 0) {
    coa.forEach(c => {
        console.log(`  ${c.code} | ${c.name} | ${c.category}`);
    });
}

// If no data, create sample journal entries for demo
console.log('\n4. Creating sample journal entries for demo...\n');

const sampleEntries = [
    // Entry 1: Invoice from customer (AR + Revenue)
    {
        group: 'Invoice INV-2601-001',
        entries: [
            {
                entry_number: 'JE-2601-0001-D',
                entry_date: '2026-01-06',
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_number: 'AR-INV-2601-001',
                account_code: '120-001',
                account_name: 'Piutang Usaha',
                debit: 15000000,
                credit: 0,
                currency: 'IDR',
                description: 'Invoice INV-2601-001 - PT Logistik Nusantara',
                batch_id: crypto.randomUUID(),
                source: 'auto',
                party_name: 'PT Logistik Nusantara'
            },
            {
                entry_number: 'JE-2601-0001-C',
                entry_date: '2026-01-06',
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_number: 'AR-INV-2601-001',
                account_code: '400-001',
                account_name: 'Pendapatan Jasa Freight',
                debit: 0,
                credit: 15000000,
                currency: 'IDR',
                description: 'Invoice INV-2601-001 - PT Logistik Nusantara',
                source: 'auto',
                party_name: 'PT Logistik Nusantara'
            }
        ]
    },
    // Entry 2: Another invoice
    {
        group: 'Invoice INV-2601-002',
        entries: [
            {
                entry_number: 'JE-2601-0002-D',
                entry_date: '2026-01-05',
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_number: 'AR-INV-2601-002',
                account_code: '120-001',
                account_name: 'Piutang Usaha',
                debit: 8500000,
                credit: 0,
                currency: 'IDR',
                description: 'Invoice INV-2601-002 - CV Ekspedisi Mandiri',
                batch_id: crypto.randomUUID(),
                source: 'auto',
                party_name: 'CV Ekspedisi Mandiri'
            },
            {
                entry_number: 'JE-2601-0002-C',
                entry_date: '2026-01-05',
                entry_type: 'invoice',
                reference_type: 'ar',
                reference_number: 'AR-INV-2601-002',
                account_code: '400-001',
                account_name: 'Pendapatan Jasa Freight',
                debit: 0,
                credit: 8500000,
                currency: 'IDR',
                description: 'Invoice INV-2601-002 - CV Ekspedisi Mandiri',
                source: 'auto',
                party_name: 'CV Ekspedisi Mandiri'
            }
        ]
    },
    // Entry 3: Payment received from customer
    {
        group: 'Payment for INV-2601-002',
        entries: [
            {
                entry_number: 'JE-2601-0003-D',
                entry_date: '2026-01-06',
                entry_type: 'payment',
                reference_type: 'ar_payment',
                reference_number: 'PAY-2601-001',
                account_code: '110-001',
                account_name: 'Kas Bank BCA',
                debit: 8500000,
                credit: 0,
                currency: 'IDR',
                description: 'Pembayaran Invoice INV-2601-002 - CV Ekspedisi Mandiri',
                batch_id: crypto.randomUUID(),
                source: 'auto',
                party_name: 'CV Ekspedisi Mandiri'
            },
            {
                entry_number: 'JE-2601-0003-C',
                entry_date: '2026-01-06',
                entry_type: 'payment',
                reference_type: 'ar_payment',
                reference_number: 'PAY-2601-001',
                account_code: '120-001',
                account_name: 'Piutang Usaha',
                debit: 0,
                credit: 8500000,
                currency: 'IDR',
                description: 'Pembayaran Invoice INV-2601-002 - CV Ekspedisi Mandiri',
                source: 'auto',
                party_name: 'CV Ekspedisi Mandiri'
            }
        ]
    },
    // Entry 4: PO/AP - Purchase from vendor
    {
        group: 'PO-2601-001',
        entries: [
            {
                entry_number: 'JE-2601-0004-D',
                entry_date: '2026-01-04',
                entry_type: 'po',
                reference_type: 'ap',
                reference_number: 'AP-PO-2601-001',
                account_code: '500-001',
                account_name: 'Beban Trucking',
                debit: 5000000,
                credit: 0,
                currency: 'IDR',
                description: 'PO-2601-001 - Trucking Service dari PT Angkutan Prima',
                batch_id: crypto.randomUUID(),
                source: 'auto',
                party_name: 'PT Angkutan Prima'
            },
            {
                entry_number: 'JE-2601-0004-C',
                entry_date: '2026-01-04',
                entry_type: 'po',
                reference_type: 'ap',
                reference_number: 'AP-PO-2601-001',
                account_code: '210-001',
                account_name: 'Hutang Usaha',
                debit: 0,
                credit: 5000000,
                currency: 'IDR',
                description: 'PO-2601-001 - Trucking Service dari PT Angkutan Prima',
                source: 'auto',
                party_name: 'PT Angkutan Prima'
            }
        ]
    },
    // Entry 5: Manual adjustment
    {
        group: 'Manual Adjustment',
        entries: [
            {
                entry_number: 'JE-2601-0005-D',
                entry_date: '2026-01-03',
                entry_type: 'adjustment',
                reference_type: 'manual',
                reference_number: null,
                account_code: '500-002',
                account_name: 'Beban Administrasi',
                debit: 750000,
                credit: 0,
                currency: 'IDR',
                description: 'Biaya ATK dan perlengkapan kantor bulan Januari',
                batch_id: crypto.randomUUID(),
                source: 'manual',
                party_name: null
            },
            {
                entry_number: 'JE-2601-0005-C',
                entry_date: '2026-01-03',
                entry_type: 'adjustment',
                reference_type: 'manual',
                reference_number: null,
                account_code: '110-001',
                account_name: 'Kas Kecil',
                debit: 0,
                credit: 750000,
                currency: 'IDR',
                description: 'Biaya ATK dan perlengkapan kantor bulan Januari',
                source: 'manual',
                party_name: null
            }
        ]
    }
];

let totalInserted = 0;

for (const group of sampleEntries) {
    console.log(`Creating entries for: ${group.group}`);
    const batchId = crypto.randomUUID();

    for (const entry of group.entries) {
        // Check if already exists
        const { data: existing } = await supabase
            .from('blink_journal_entries')
            .select('id')
            .eq('entry_number', entry.entry_number)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`  - ${entry.entry_number} already exists, skipping`);
            continue;
        }

        const { error } = await supabase
            .from('blink_journal_entries')
            .insert({
                ...entry,
                batch_id: entry.batch_id || batchId
            });

        if (error) {
            console.log(`  ✗ Failed ${entry.entry_number}:`, error.message);
        } else {
            console.log(`  ✓ Created ${entry.entry_number}`);
            totalInserted++;
        }
    }
}

console.log(`\n=== Done! Created ${totalInserted} journal entries ===`);
console.log('Please refresh Jurnal Umum page to see the data.');
