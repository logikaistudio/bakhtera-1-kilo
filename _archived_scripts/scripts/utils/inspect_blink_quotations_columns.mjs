/**
 * Inspect blink_quotations columns in Supabase using information_schema
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let supabaseUrl = 'https://izitupvgxmhyiqahymcj.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml6aXR1cHZneG1oeWlxYWh5bWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQzNDkxMjEsImV4cCI6MjA0OTkyNTEyMX0.sI39Nh0YJ1iW1S0KZ2UUiNq8cNaFrzCnY0Xa9ILWEss';

try {
  const envPath = join(__dirname, '.env');
  const envContent = readFileSync(envPath, 'utf8');
  const envVars = {};
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
  if (envVars.VITE_SUPABASE_URL) supabaseUrl = envVars.VITE_SUPABASE_URL;
  if (envVars.SUPABASE_SERVICE_ROLE_KEY) supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
  if (envVars.VITE_SUPABASE_ANON_KEY) supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;
} catch (e) {}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Inspecting blink_quotations columns...');

  const sql = `
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'blink_quotations'
    ORDER BY ordinal_position;
  `;

  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Error running SQL:', error);
    process.exit(1);
  }

  console.log('Columns:', data);
}

inspect();
