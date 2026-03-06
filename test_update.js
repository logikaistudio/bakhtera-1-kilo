import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        const { data: qData, error: qErr } = await supabase
            .from('blink_shipments')
            .select('id')
            .limit(1);

        if (qErr) {
            console.error('Fetch err', qErr);
            return;
        }
        if (!qData || !qData.length) return;

        const id = qData[0].id;

        const dbFormat = {
            status: 'manager_approval',
            weight: null,
            cbm: null,
            dimensions: null,
            container_type: null,
            bl_number: null,
            awb_number: null,
            voyage: null,
            flight_number: null,
            shipper_name: null,
            shipper: null,
            delivery_date: null,
            eta: null,
            etd: null,
            mawb: null,
            hawb: null,
            hbl: null,
            mbl: null,
            consignee_name: null,
            bl_date: null,
            vessel_name: null,
            container_number: null,
        };

        console.log('Testing update with dbFormat');
        const { error } = await supabase
            .from('blink_shipments')
            .update(dbFormat)
            .eq('id', id);

        if (error) {
            console.error('Update err:', error);
        } else {
            console.log('Success update');
        }
    } catch (e) {
        console.error(e);
    }
}
run();
