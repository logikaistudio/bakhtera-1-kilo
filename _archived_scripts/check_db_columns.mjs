import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fsxdykjcajasmgybqdua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable() {
    console.log('=== Checking blink_sales_quotations columns ===');
    const { data, error } = await supabase
        .from('blink_sales_quotations')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]).sort().join(', '));
        console.log('\ncost_items exists:', 'cost_items' in data[0]);
        console.log('service_items exists:', 'service_items' in data[0]);
        console.log('\nTotal columns:', Object.keys(data[0]).length);
    } else {
        // Try an insert probe - select with no data to get column info
        console.log('No rows found. Table exists but is empty or no access.');
        // Check via RPC or direct metadata approach
        const { data: d2, error: e2 } = await supabase
            .from('blink_sales_quotations')
            .select('id, cost_items, service_items, status')
            .limit(1);
        if (e2) {
            console.error('Column probe error:', e2.message);
            if (e2.message.includes('cost_items')) {
                console.log('\n❌ COLUMN cost_items DOES NOT EXIST in blink_sales_quotations!');
                console.log('👉 Please run this SQL in Supabase SQL Editor:');
                console.log('ALTER TABLE public.blink_sales_quotations ADD COLUMN IF NOT EXISTS cost_items JSONB DEFAULT \'[]\'::jsonb;');
            }
        } else {
            console.log('\n✅ cost_items column EXISTS');
            console.log('Data:', d2);
        }
    }
}

async function checkAllTables() {
    console.log('\n=== Checking all relevant tables ===');
    const tables = [
        'blink_sales_quotations',
        'blink_quotations',
        'blink_shipments',
    ];

    for (const table of tables) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .limit(1);

        if (error) {
            console.log(`\n${table}: ERROR - ${error.message}`);
        } else {
            if (data && data.length > 0) {
                const cols = Object.keys(data[0]);
                const hasCostItems = cols.includes('cost_items');
                const hasServiceItems = cols.includes('service_items');
                console.log(`\n${table}:`);
                console.log(`  - cost_items: ${hasCostItems ? '✅' : '❌'}`);
                console.log(`  - service_items: ${hasServiceItems ? '✅' : '❌'}`);
                console.log(`  - status: ${cols.includes('status') ? '✅' : '❌'}`);
                console.log(`  - Total cols: ${cols.length}`);
            } else {
                console.log(`\n${table}: empty (exists but no rows)`);
                // Probe specific columns
                const { error: e2 } = await supabase
                    .from(table)
                    .select('cost_items')
                    .limit(1);
                if (e2 && e2.message.includes('cost_items')) {
                    console.log(`  - cost_items: ❌ MISSING`);
                } else {
                    console.log(`  - cost_items: ✅ (exists)`);
                }
            }
        }
    }
}

checkTable().then(() => checkAllTables()).catch(console.error);
