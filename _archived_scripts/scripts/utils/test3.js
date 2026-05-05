import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://nkyoszmtyrpdwfjxggmb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ');
supabase.from('blink_shipments').select('*').limit(1).then(res => console.log(Object.keys(res.data[0])));
