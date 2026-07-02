import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabasePublishableKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseKey = supabaseAnonKey || supabasePublishableKey;
const supabaseKeySource = import.meta.env.VITE_SUPABASE_ANON_KEY
    ? 'VITE_SUPABASE_ANON_KEY'
    : import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
        : import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
            ? 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
            : 'none';

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase environment variables!');
    console.error('VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing');
    console.error('VITE_SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', import.meta.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
    console.error('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:', import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? '✓ Set' : '✗ Missing');
}

if (supabasePublishableKey && !supabaseAnonKey) {
    console.warn('⚠️ Using publishable key fallback. For database operations, prefer anon key.');
}

// Create Supabase client
const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
    db: {
        schema: 'public'
    }
});

const ISOLATED_TABLES = new Set([
    'blink_sales_quotations',
    'blink_quotations',
    'blink_shipments',
    'blink_bl_documents',
    'blink_approval_history'
]);

const SHARED_TRANSACTION_TABLES = new Set([
    'blink_invoices',
    'blink_purchase_orders',
    'blink_payments',
    'blink_ar_transactions',
    'blink_ap_transactions',
    'blink_journal_entries'
]);

const getDivision = () => {
    if (typeof window !== 'undefined' && window.location && window.location.pathname) {
        return window.location.pathname.startsWith('/bxpo') ? 'bxpo' : 'blink';
    }
    return 'blink';
};

// Intercept client.from to inject division partitioning
const originalFrom = client.from;
client.from = function (relation) {
    const builder = originalFrom.call(this, relation);
    const isIsolated = ISOLATED_TABLES.has(relation);
    const isShared = SHARED_TRANSACTION_TABLES.has(relation);

    if (!isIsolated && !isShared) {
        return builder;
    }

    const division = getDivision();

    return new Proxy(builder, {
        get(target, prop, receiver) {
            const originalVal = Reflect.get(target, prop, receiver);

            if (typeof originalVal === 'function') {
                return function (...args) {
                    if (prop === 'insert' || prop === 'upsert') {
                        let values = args[0];
                        if (Array.isArray(values)) {
                            args[0] = values.map(v => ({ ...v, division }));
                        } else if (typeof values === 'object' && values !== null) {
                            args[0] = { ...values, division };
                        }
                    }

                    let result = originalVal.apply(target, args);

                    if (isIsolated && (prop === 'select' || prop === 'update' || prop === 'delete')) {
                        result = result.eq('division', division);
                    }

                    return result;
                };
            }

            return originalVal;
        }
    });
};

export const supabase = client;


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
        keySource: supabaseKeySource,
        configured: !!(supabaseUrl && supabaseKey),
        client: supabase
    };
};

console.log('📦 Supabase client module loaded');
console.log('🔗 Project URL:', supabaseUrl);
console.log('🔑 API Key configured:', supabaseKey ? '✓ Yes' : '✗ No');
console.log('🧭 Supabase key source:', supabaseKeySource);
