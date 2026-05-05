
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReferences() {
    console.log('Checking foreign key constraints referencing freight_quotations...');

    const { data, error } = await supabase
        .rpc('exec_sql', {
            sql: `
                SELECT
                    tc.table_schema, 
                    tc.constraint_name, 
                    tc.table_name, 
                    kcu.column_name, 
                    ccu.table_schema AS foreign_table_schema,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM 
                    information_schema.table_constraints AS tc 
                    JOIN information_schema.key_column_usage AS kcu
                      ON tc.constraint_name = kcu.constraint_name
                      AND tc.table_schema = kcu.table_schema
                    JOIN information_schema.constraint_column_usage AS ccu
                      ON ccu.constraint_name = tc.constraint_name
                      AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name='freight_quotations';
            `
        });

    if (error) {
        console.error('RPC exec_sql failed:', error.message);
        console.log('Falling back to checking likely tables for columns named quotation_id...');

        const tables = ['freight_customs', 'warehouse_inventory', 'goods_movements', 'freight_invoices', 'freight_purchases', 'freight_shipments'];

        for (const table of tables) {
            const { data, error } = await supabase.from(table).select('id').limit(1);
            if (!error) {
                console.log(`Table '${table}' exists. It MIGHT reference quotations.`);
            }
        }
    } else {
        console.log('References found:', JSON.stringify(data, null, 2));
    }
}

checkReferences();
