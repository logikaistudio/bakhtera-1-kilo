const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkMay() {
    console.log("Checking May 2026 journal entries for INCOME (4-00-000-0-1-00) and EXTRA SALES DISCOUNT...");
    
    const { data: journals, error } = await supabase
        .from('blink_journal_entries')
        .select(`
            id, created_at, reference_type, reference_id, description,
            debit, credit,
            finance_coa!inner ( code, name )
        `)
        .gte('created_at', '2026-05-01')
        .lte('created_at', '2026-05-31');
        
    if (error) {
        console.error("Error fetching journals:", error);
        return;
    }
    
    const incomeJournals = journals.filter(j => j.finance_coa.code === '4-00-000-0-1-00');
    const discountJournals = journals.filter(j => j.finance_coa.name.toLowerCase().includes('discount') || j.finance_coa.name.toLowerCase().includes('diskon'));
    
    console.log(`\n=== INCOME (4-00-000-0-1-00) [${incomeJournals.length} entries] ===`);
    for (const j of incomeJournals) {
        console.log(`${j.created_at} | ${j.reference_type} : ${j.reference_id} | ${j.description} | Cr: ${j.credit}`);
    }

    console.log(`\n=== DISCOUNT ACCOUNTS [${discountJournals.length} entries] ===`);
    for (const j of discountJournals) {
        console.log(`${j.created_at} | ${j.reference_type} : ${j.reference_id} | ${j.finance_coa.name} | ${j.description} | Dr: ${j.debit} | Cr: ${j.credit}`);
    }
    
    // Check specific invoices
    const refIds = [...new Set([...incomeJournals, ...discountJournals].filter(j => j.reference_type === 'ar' || j.reference_type === 'blink_invoice').map(j => j.reference_id))];
    
    if (refIds.length > 0) {
        console.log("\n=== Related Invoices ===");
        const { data: invoices } = await supabase
            .from('blink_invoices')
            .select('id, invoice_number, discount_amount, invoice_items, created_at')
            .in('id', refIds);
            
        for (const inv of (invoices || [])) {
            console.log(`\nInvoice: ${inv.invoice_number} (ID: ${inv.id})`);
            console.log(`Discount Amount: ${inv.discount_amount}`);
            console.log(`Items:`, JSON.stringify(inv.invoice_items, null, 2));
        }
    }
}

checkMay();
