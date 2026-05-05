import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
);

async function cleanData() {
    console.log('Cleaning finance_coa records with whitespace issues...');
    const { data: coa, error } = await supabase.from('finance_coa').select('id, code, name');
    if (error) { console.error(error); return; }

    const dirty = coa.filter(c => c.code !== c.code?.trim() || c.name !== c.name?.trim());
    for (const c of dirty) {
        console.log(`Fixing [${c.code}] -> [${c.code?.trim()}]`);
        await supabase.from('finance_coa').update({ 
            code: c.code?.trim(), 
            name: c.name?.trim() 
        }).eq('id', c.id);
    }
    
    // Also clean any journal entries referencing the old dirty code?
    console.log('Cleaning blink_journal_entries...');
    const { data: je } = await supabase.from('blink_journal_entries').select('id, account_code, account_name');
    const dirtyJe = (je || []).filter(e => e.account_code?.trim() !== e.account_code || e.account_name?.trim() !== e.account_name);
    for (const e of dirtyJe) {
        await supabase.from('blink_journal_entries').update({
            account_code: e.account_code?.trim(),
            account_name: e.account_name?.trim()
        }).eq('id', e.id);
    }
    console.log('Done!');
}

cleanData();
