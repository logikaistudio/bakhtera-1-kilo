import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
    'https://fsxdykjcajasmgybqdua.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw'
);

const newPassword = 's@l3s2026';

async function run() {
    console.log('Generating bcrypt hash for:', newPassword);
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPassword, salt);
    console.log('Hash generated:', hash);

    console.log('\nUpdating sales1 and sales2 passwords in database...');
    
    // Update sales2
    const { data: data2, error: error2 } = await supabase
        .from('users')
        .update({ 
            password_hash: hash,
            requires_password_change: true 
        })
        .eq('username', 'sales2')
        .select('username, requires_password_change');

    if (error2) {
        console.error('Error updating sales2:', error2.message);
    } else {
        console.log('Successfully updated sales2:', data2);
    }

    // Update sales1
    const { data: data1, error: error1 } = await supabase
        .from('users')
        .update({ 
            password_hash: hash,
            requires_password_change: true 
        })
        .eq('username', 'sales1')
        .select('username, requires_password_change');

    if (error1) {
        console.error('Error updating sales1:', error1.message);
    } else {
        console.log('Successfully updated sales1:', data1);
    }
}

run().catch(console.error);
