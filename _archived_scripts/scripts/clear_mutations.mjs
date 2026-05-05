// Script untuk hapus semua data mutasi dari Supabase
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearMutationLogs() {
    console.log('🔄 Connecting to Supabase...');

    // 1. Count existing data
    const { count: before } = await supabase
        .from('freight_mutation_logs')
        .select('*', { count: 'exact', head: true });

    console.log(`📊 Data mutasi sebelum: ${before || 0} records`);

    // 2. Delete all
    const { error } = await supabase
        .from('freight_mutation_logs')
        .delete()
        .neq('id', ''); // Delete all where id is not empty (all records)

    if (error) {
        console.error('❌ Error deleting:', error.message);
        return;
    }

    // 3. Verify
    const { count: after } = await supabase
        .from('freight_mutation_logs')
        .select('*', { count: 'exact', head: true });

    console.log(`✅ Data mutasi setelah: ${after || 0} records`);
    console.log('🎉 Semua data mutasi berhasil dihapus!');
}

clearMutationLogs().catch(console.error);
