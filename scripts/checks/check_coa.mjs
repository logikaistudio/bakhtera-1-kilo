import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = {};
fs.readFileSync('.env','utf-8').split('\n').forEach(line => { const [k,v] = line.split('='); if (k && v) env[k.trim()] = v.trim(); });
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const { data, error } = await supabase.from('finance_coa').select('id,code,name,type').in('code', ['1-03-001','4-01-001']);
console.log({ error, data });
