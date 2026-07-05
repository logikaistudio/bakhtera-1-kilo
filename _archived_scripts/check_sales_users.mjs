import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://fsxdykjcajasmgybqdua.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzeGR5a2pjYWphc21neWJxZHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4MjQxMzUsImV4cCI6MjA5MTQwMDEzNX0.eS0bcexDs9iTVbwcBf56k3xulvcsrQKgePmn-RmEkRw'
);

async function checkSalesUsers() {
    console.log('=== Checking users table for sales1, sales2 ===\n');

    // Get all users (look for sales-related ones)
    const { data: users, error } = await supabase
        .from('users')
        .select('id, username, full_name, user_level, is_active, portal_access, requires_password_change, last_login, created_at')
        .or('username.ilike.%sales%,user_level.ilike.%sales%')
        .order('username');

    if (error) {
        console.error('Error fetching users:', error.message);
        return;
    }

    if (!users || users.length === 0) {
        console.log('❌ No users with "sales" in username or user_level found!');
        console.log('\nFetching ALL users to see what exists...\n');

        const { data: allUsers, error: allErr } = await supabase
            .from('users')
            .select('id, username, full_name, user_level, is_active, portal_access')
            .order('username');

        if (allErr) {
            console.error('Error:', allErr.message);
        } else {
            console.table(allUsers?.map(u => ({
                username: u.username,
                full_name: u.full_name,
                user_level: u.user_level,
                is_active: u.is_active,
                portal_access: u.portal_access
            })));
        }
        return;
    }

    console.log(`Found ${users.length} user(s):\n`);
    users.forEach(u => {
        console.log(`---`);
        console.log(`Username    : ${u.username}`);
        console.log(`Full name   : ${u.full_name}`);
        console.log(`User level  : ${u.user_level}`);
        console.log(`Is active   : ${u.is_active}`);
        console.log(`Portal access: ${u.portal_access}`);
        console.log(`Req. pwd chg: ${u.requires_password_change}`);
        console.log(`Last login  : ${u.last_login}`);

        if (!u.is_active) {
            console.log('⚠️  PROBLEM: is_active = false → LOGIN BLOCKED');
        }
        if (!u.portal_access) {
            console.log('⚠️  PROBLEM: portal_access = false → LOGIN BLOCKED');
        }
        if (u.is_active && u.portal_access) {
            console.log('✅ Account flags OK');
        }
    });

    // Check role_permissions for their roles
    const roles = [...new Set(users.map(u => u.user_level))];
    console.log(`\n=== Checking role_permissions for roles: ${roles.join(', ')} ===\n`);

    for (const role of roles) {
        const { data: perms, error: permErr } = await supabase
            .from('role_permissions')
            .select('menu_code, can_access, can_view, can_create')
            .eq('role_id', role)
            .eq('can_access', true);

        if (permErr) {
            console.error(`Error fetching permissions for ${role}:`, permErr.message);
        } else {
            console.log(`Role "${role}": ${perms?.length || 0} accessible menus`);
            if (perms && perms.length > 0) {
                console.log('Accessible menus:', perms.map(p => p.menu_code).join(', '));
            } else {
                console.log('⚠️  NO ACCESSIBLE MENUS - user will see empty sidebar!');
            }
        }
    }

    // Also check if user_sessions table exists and has stale sessions
    console.log('\n=== Checking for stale/expired sessions ===\n');
    const { data: sessions, error: sessErr } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at')
        .in('user_id', users.map(u => u.id));

    if (sessErr) {
        console.error('Sessions error:', sessErr.message);
    } else {
        console.log(`Found ${sessions?.length || 0} sessions for these users`);
        sessions?.forEach(s => {
            const expired = new Date(s.expires_at) < new Date();
            console.log(`  User ${s.user_id}: expires ${s.expires_at} ${expired ? '⚠️ EXPIRED' : '✅ valid'}`);
        });
    }
}

checkSalesUsers().catch(console.error);
