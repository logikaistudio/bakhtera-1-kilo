import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    try {
        console.log('Fetching approved quotations that are not superseded...');
        const { data: qData, error: qErr } = await supabase
            .from('blink_quotations')
            .select('*')
            .eq('status', 'approved')
            .eq('is_superseded', false);

        if (qErr) throw qErr;

        console.log(`Found ${qData.length} stuck quotations.`);

        for (const data of qData) {
            console.log(`Processing ${data.job_number || data.quotation_number}...`);

            // Generate basic SO number
            const dateStr = new Date(data.created_at).toISOString();
            const yearObj = new Date(dateStr);
            const yy = String(yearObj.getFullYear()).slice(-2);
            const mm = String(yearObj.getMonth() + 1).padStart(2, '0');
            const random = Math.floor(1000 + Math.random() * 9000);
            const soNumber = `BLK${yy}${mm}-SO-${random}`;

            const coreData = {
                job_number: data.job_number,
                so_number: soNumber,
                quotation_id: data.id,
                customer: data.customer_name || '',
                sales_person: data.sales_person || '',
                quotation_type: data.quotation_type || 'RG',
                quotation_date: data.quotation_date,
                origin: data.origin,
                destination: data.destination,
                service_type: data.service_type,
                cargo_type: data.cargo_type,
                weight: data.weight,
                volume: data.volume,
                commodity: data.commodity,
                quoted_amount: data.total_amount || 0,
                currency: data.currency || 'USD',
                status: 'pending',
                created_from: 'sales_order',
                service_items: data.service_items || [],
                selling_items: data.service_items || [],
                notes: data.notes || '',
                gross_weight: data.gross_weight || null,
                net_weight: data.net_weight || null,
                measure: data.measure || null,
            };

            console.log('Inserting shipment...', coreData.so_number);
            const { error: insertErr } = await supabase.from('blink_shipments').insert([coreData]);
            if (insertErr) {
                console.error('Failed to insert shipment!', insertErr);
                continue;
            }

            console.log('Updating quotation status...');
            const { error: updErr } = await supabase.from('blink_quotations').update({ status: 'converted' }).eq('id', data.id);
            if (updErr) {
                console.error('Failed to update quotation!', updErr);
            } else {
                console.log(`Successfully converted ${data.job_number} to ${soNumber}`);
            }
        }

    } catch (e) {
        console.error(e);
    }
}
run();
