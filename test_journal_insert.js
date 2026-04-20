import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('blink_journal_entries').select('*').limit(1);
  if (error) {
    console.error("Select error:", error);
  } else {
    console.log("Journal structure successful.", Object.keys(data[0] || {}).join(', '));
  }
}
check();
