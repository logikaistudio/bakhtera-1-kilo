import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Paste credentials directly (karena script ini jalan di luar Vite)
const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3MTAzMTYsImV4cCI6MjA4MjI4NjMxNn0.qeCz78VNVEcnjUXgBywdxF9Ju1eZzlRPJa_Ff-_33XQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function seedSuperAdmin() {
    console.log('🚀 Bakhtera-1 — Seed Superadmin User');
    console.log('=====================================');

    const username = 'superadmin';
    const password = 'password123';
    const fullName = 'Super Administrator';
    const userLevel = 'super_admin';

    // Hash password using bcrypt
    console.log('🔐 Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    console.log('✅ Password hashed');

    // Check if user already exists
    console.log(`🔍 Checking if user "${username}" already exists...`);
    const { data: existing, error: selectErr } = await supabase
        .from('users')
        .select('id, username, user_level')
        .eq('username', username)
        .maybeSingle();

    if (selectErr) {
        console.error('❌ Error checking existing user:', selectErr.message);
        console.error('Detail:', JSON.stringify(selectErr, null, 2));
        process.exit(1);
    }

    if (existing) {
        console.log(`⚠️  User "${username}" sudah ada (ID: ${existing.id})`);
        console.log('🔄 Memperbarui password dan level user...');

        const { error: updateErr } = await supabase
            .from('users')
            .update({
                password_hash: passwordHash,
                user_level: userLevel,
                is_active: true,
                portal_access: true,
                requires_password_change: false,
                full_name: fullName
            })
            .eq('username', username);

        if (updateErr) {
            console.error('❌ Error updating user:', updateErr.message);
            process.exit(1);
        }

        console.log('✅ User berhasil diperbarui!');
    } else {
        console.log(`➕ Membuat user baru "${username}"...`);

        const { data: newUser, error: insertErr } = await supabase
            .from('users')
            .insert({
                username: username,
                password_hash: passwordHash,
                full_name: fullName,
                email: 'superadmin@bakhtera.com',
                user_level: userLevel,
                portal_access: true,
                is_active: true,
                requires_password_change: false
            })
            .select()
            .single();

        if (insertErr) {
            console.error('❌ Error creating user:', insertErr.message);
            console.error('Detail:', JSON.stringify(insertErr, null, 2));
            process.exit(1);
        }

        console.log('✅ User berhasil dibuat!');
        console.log('   ID:', newUser.id);
    }

    console.log('\n📋 Kredensial Login:');
    console.log('   Username : superadmin');
    console.log('   Password : password123');
    console.log('   Level    : super_admin (full access)');
    console.log('\n🎉 Selesai! Silakan login ke aplikasi.');
}

seedSuperAdmin().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
