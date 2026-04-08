import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let { data, error } = await supabase.from('finance_journals').select('id');
    console.log(`finance_journals: ${data?.length || 0}`);
    
    let { data: fje } = await supabase.from('finance_journal_entries').select('id');
    console.log(`finance_journal_entries: ${fje?.length || 0}`);
    
    let { data: finv } = await supabase.from('finance_invoices').select('id');
    console.log(`finance_invoices: ${finv?.length || 0}`);
    
    let { data: bq } = await supabase.from('freight_quotations').select('id');
    console.log(`freight_quotations: ${bq?.length || 0}`);
}
check().catch(console.error);
