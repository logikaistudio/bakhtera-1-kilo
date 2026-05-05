// Script untuk reset status mutasi pada freight_quotations
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetMutationStatus() {
    console.log('🔄 Fetching quotations to clean...');

    // Fetch all quotations that have packages
    const { data: quotations, error } = await supabase
        .from('freight_quotations')
        .select('id, packages')
        .not('packages', 'is', null);

    if (error) {
        console.error('❌ Error fetching quotations:', error.message);
        return;
    }

    console.log(`📦 Scanning ${quotations.length} quotations...`);
    let updatedCount = 0;

    for (const q of quotations) {
        let isModified = false;

        // Deep copy packages to avoid mutation issues
        const packages = JSON.parse(JSON.stringify(q.packages));

        (packages || []).forEach(pkg => {
            (pkg.items || []).forEach(item => {
                // Check if any mutation fields exist and remove them
                if (item.mutationStatus || item.totalMutated || item.lastMutationDate || item.lastMutationQty) {
                    delete item.mutationStatus;
                    delete item.totalMutated;
                    delete item.lastMutationDate;
                    delete item.lastMutationQty;
                    isModified = true;
                }
            });
        });

        if (isModified) {
            // Update the quotation in DB
            const { error: updateError } = await supabase
                .from('freight_quotations')
                .update({ packages: packages })
                .eq('id', q.id);

            if (updateError) {
                console.error(`❌ Failed to update quotation ${q.id}:`, updateError.message);
            } else {
                console.log(`✅ Cleaned mutation tags from quotation ${q.id}`);
                updatedCount++;
            }
        }
    }

    console.log(`🎉 Finished! Reset mutation status for ${updatedCount} quotations.`);

    // Also verifying mutation logs are clear
    const { count } = await supabase.from('freight_mutation_logs').select('*', { count: 'exact', head: true });
    if (count > 0) {
        console.log(`⚠️ Note: There are still ${count} records in freight_mutation_logs.`);
        console.log('Use clear_mutations.mjs to clear them if needed.');
    } else {
        console.log('✅ freight_mutation_logs is empty.');
    }
}

resetMutationStatus().catch(console.error);
