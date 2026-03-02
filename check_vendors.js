import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPartners() {
    const { data, error } = await supabase
        .from('blink_business_partners')
        .select('id, partner_name, is_vendor, partner_type');

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Partners:', data);
    }
}
checkPartners();
