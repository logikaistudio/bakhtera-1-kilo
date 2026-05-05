
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const sql = `
CREATE TABLE IF NOT EXISTS public.freight_hs_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hs_code VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.freight_hs_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.freight_hs_codes FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.freight_hs_codes FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.freight_hs_codes FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.freight_hs_codes FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_hs_codes;
`;

async function run() {
    console.log('Attempting to create table via exec_sql RPC...');

    // Attempt standard names for SQL exec functions
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });

    if (error) {
        console.error('RPC exec_sql failed:', error.message);
        console.log('Trying execute_sql...');
        const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { sql_query: sql });
        if (e2) {
            console.error('RPC execute_sql failed:', e2.message);
            // One last try: create_table function? No, standard is raw sql.
            console.log('Automated migration not possible without RPC function.');
            process.exit(1);
        } else {
            console.log('Success via execute_sql!');
        }
    } else {
        console.log('Success via exec_sql!');
    }
}

run();
