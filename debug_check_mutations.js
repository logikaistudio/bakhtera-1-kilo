
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMutations() {
    const { data, error } = await supabase
        .from('freight_mutation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching mutations:', error);
        return;
    }

    console.log('Last 5 Mutation Logs:');
    data.forEach(log => {
        console.log('ID:', log.id);
        console.log('  Item:', log.item_name || log.itemName); // Handle potential camelCase mismatch if any
        console.log('  TotalStock (DB):', log.total_stock || log.totalStock);
        console.log('  MutatedQty (DB):', log.mutated_qty || log.mutatedQty);
        console.log('  RemainingStock (DB):', log.remaining_stock || log.remainingStock);
        console.log('  Origin:', log.origin);
        console.log('  Destination:', log.destination);
        console.log('---------------------------');
    });
}

checkMutations();
