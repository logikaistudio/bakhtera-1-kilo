import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  console.log('Querying blink_sales_quotations for job_number SQT-BLK2606-0004...');
  const { data: qData, error: qError } = await supabase
    .from('blink_sales_quotations')
    .select('*')
    .or('job_number.eq.SQT-BLK2606-0004,quotation_number.eq.SQT-BLK2606-0004');
    
  if (qError) {
    console.error('Error fetching quotation:', qError);
  } else {
    console.log('Quotation Data:', JSON.stringify(qData, null, 2));
  }

  if (qData && qData.length > 0) {
    const q = qData[0];
    const qId = q.id;
    console.log(`\nQuerying blink_shipments for sales_quotation_id: ${qId} or job_number: ${q.job_number}...`);
    
    const { data: sData, error: sError } = await supabase
      .from('blink_shipments')
      .select('*')
      .or(`sales_quotation_id.eq.${qId},job_number.eq.${q.job_number}`);

    if (sError) {
      console.error('Error fetching shipments:', sError);
    } else {
      console.log('Shipments Data:', JSON.stringify(sData, null, 2));
    }
  }
}

run();
