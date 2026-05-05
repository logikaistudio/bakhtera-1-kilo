const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkColumns() {
  console.log('Checking big_ar_transactions schema...');

  try {
    const { data, error } = await supabase
      .from('big_ar_transactions')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample data:', JSON.stringify(data[0], null, 2));
    } else {
      console.log('No data in table, but table exists');
      // Try to get column info from information_schema
      const { data: columns, error: colError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type')
        .eq('table_name', 'big_ar_transactions')
        .eq('table_schema', 'public');

      if (!colError && columns) {
        console.log('Columns from information_schema:');
        columns.forEach(col => {
          console.log(`  ${col.column_name}: ${col.data_type}`);
        });
      }
    }
  } catch (e) {
    console.error('Exception:', e.message);
  }
}

checkColumns().catch(console.error);