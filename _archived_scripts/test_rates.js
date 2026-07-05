import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase environment variables are missing!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTable() {
  console.log('Using Supabase URL:', supabaseUrl);
  
  // 1. Check if we can SELECT
  console.log('\n--- 1. Testing SELECT on blink_exchange_rates ---');
  const { data, error } = await supabase
    .from('blink_exchange_rates')
    .select('*');
    
  if (error) {
    console.error('SELECT Error:', error);
  } else {
    console.log('SELECT Success! Data count:', data.length);
    console.log('Data:', data);
  }

  // 2. Testing INSERT
  console.log('\n--- 2. Testing INSERT on blink_exchange_rates ---');
  const testDate = '2026-07-03';
  const { data: insertData, error: insertError } = await supabase
    .from('blink_exchange_rates')
    .insert([
      { rate: 16500.0, effective_date: testDate, created_by: 'TestScript' }
    ])
    .select();

  if (insertError) {
    console.error('INSERT Error:', insertError);
  } else {
    console.log('INSERT Success! Inserted:', insertData);
  }

  // Clean up test insert
  if (!insertError && insertData?.length > 0) {
    console.log('\n--- Cleaning up test INSERT ---');
    const { error: deleteError } = await supabase
      .from('blink_exchange_rates')
      .delete()
      .eq('effective_date', testDate);
    if (deleteError) {
      console.error('Delete Clean Up Error:', deleteError);
    } else {
      console.log('Clean Up Success!');
    }
  }
}

testTable();
