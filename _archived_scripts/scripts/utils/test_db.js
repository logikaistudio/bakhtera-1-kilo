const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('blink_approval_history').select('*').limit(1);
  if (error) console.log('TABLE DOES NOT EXIST:', error.message);
  else console.log('TABLE EXISTS!');
}
run();
