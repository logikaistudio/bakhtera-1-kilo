import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing');
    console.error('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', import.meta.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    db: {
        schema: 'public'
    }
});

// Test connection function
export const testSupabaseConnection = async () => {
    try {
        console.log('🔌 Testing Supabase connection...');
        console.log('📍 URL:', supabaseUrl);

        // Try to fetch from a real table to test connection
        const { count, error } = await supabase
            .from('freight_customers')
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.error('❌ Connection test failed:', error);
            return { success: false, error: error.message };
        }

        console.log('✅ Supabase connection successful! Customer count:', count);
        return { success: true, message: `Connected to Supabase (Customers: ${count})` };

        console.log('✅ Supabase connection successful!');
        return { success: true, message: 'Connected to Supabase', data };
    } catch (err) {
        console.error('❌ Supabase connection failed:', err);
        return { success: false, error: err.message };
    }
};

// Export connection status
export const getSupabaseStatus = () => {
    return {
        url: supabaseUrl,
        configured: !!(supabaseUrl && supabaseAnonKey),
        client: supabase
    };
};

console.log('📦 Supabase client module loaded');
console.log('🔗 Project URL:', supabaseUrl);
console.log('🔑 API Key configured:', supabaseAnonKey ? '✓ Yes' : '✗ No');
