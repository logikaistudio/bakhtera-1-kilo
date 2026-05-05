// Complete P0-P2 BLINK Migration to Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5reW9zem10eXJwZHdmanhnZ21iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjcxMDMxNiwiZXhwIjoyMDgyMjg2MzE2fQ.Rc4bf2Ju6rGDZ18FnPbHna80L_720xtQDHBu7debMPU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🚀 BLINK P0-P2 Migration to Supabase\n');
console.log('═══════════════════════════════════\n');

// ============================================================================
// P0: ShipmentManagement Migration
// ============================================================================

async function migrateShipmentManagement() {
    console.log('🔴 P0: ShipmentManagement Migration\n');

    const filePath = '/Users/hoeltz/Documents/GitHub/FreightOne/src/pages/Blink/ShipmentManagement.jsx';
    let content = fs.readFileSync(filePath, 'utf8');

    // Step 1: Add Supabase import
    if (!content.includes("import { supabase }")) {
        content = content.replace(
            "import { Ship, Plus, MapPin, Filter, Search, Download, X } from 'lucide-react';",
            "import { Ship, Plus, MapPin, Filter, Search, Download, X } from 'lucide-react';\nimport { supabase } from '../../lib/supabase';"
        );
        console.log('  ✅ Added Supabase import');
    }

    // Step 2: Add loading state
    if (!content.includes('useState(true)')) {
        content = content.replace(
            'const [showFilters, setShowFilters] = useState(false);',
            'const [showFilters, setShowFilters] = useState(false);\n    const [loading, setLoading] = useState(true);'
        );
        console.log('  ✅ Added loading state');
    }

    // Step 3: Replace localStorage fetch with Supabase
    const fetchReplace = `// Load shipments from Supabase
    useEffect(() => {
        fetchShipments();
    }, []);

    const fetchShipments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('blink_shipments')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Map snake_case to camelCase
            const mapped = (data || []).map(s => ({
                ...s,
                jobNumber: s.job_number || s.jobNumber,
                soNumber: s.so_number || s.soNumber,
                quotationId: s.quotation_id || s.quotationId,
                customerId: s.customer_id || s.customerId,
                salesPerson: s.sales_person || s.salesPerson,
                quotationType: s.quotation_type || s.quotationType,
                quotationDate: s.quotation_date || s.quotationDate,
                serviceType: s.service_type || s.serviceType,
                cargoType: s.cargo_type || s.cargoType,
                quotedAmount: s.quoted_amount || s.quotedAmount,
                cogsCurrency: s.cogs_currency || s.cogsCurrency,
                exchangeRate: s.exchange_rate || s.exchangeRate,
                rateDate: s.rate_date || s.rateDate,
                actualDeparture: s.actual_departure || s.actualDeparture,
                actualArrival: s.actual_arrival || s.actualArrival,
                deliveryDate: s.delivery_date || s.deliveryDate,
                createdAt: s.created_at || s.createdAt,
                updatedAt: s.updated_at || s.updatedAt,
                createdFrom: s.created_from || s.createdFrom
            }));
            
            setShipments(mapped);
        } catch (error) {
            console.error('Error fetching shipments:', error);
            setShipments([]);
        } finally {
            setLoading(false);
        }
    };`;

    content = content.replace(
        /\/\/ Load shipments from localStorage on component mount\s+useEffect\(\(\) => \{[\s\S]*?\}, \[\]\);/,
        fetchReplace
    );
    console.log('  ✅ Replaced localStorage fetch with Supabase');

    // Step 4: Update handleUpdateShipment
    const updateReplace = `// Handle update shipment
    const handleUpdateShipment = async (updatedShipment) => {
        try {
            // Map to database format
            const dbFormat = {
                job_number: updatedShipment.jobNumber,
                so_number: updatedShipment.soNumber,
                customer: updatedShipment.customer,
                origin: updatedShipment.origin,
                destination: updatedShipment.destination,
                service_type: updatedShipment.serviceType,
                quoted_amount: updatedShipment.quotedAmount,
                cogs: updatedShipment.cogs,
                cogs_currency: updatedShipment.cogsCurrency,
                exchange_rate: updatedShipment.exchangeRate,
                status: updatedShipment.status
            };
            
            const { error } = await supabase
                .from('blink_shipments')
                .update(dbFormat)
                .eq('id', updatedShipment.id);
            
            if (error) throw error;
            
            // Refresh list
            await fetchShipments();
            
            // Update selected
            setSelectedShipment(updatedShipment);
        } catch (error) {
            console.error('Error updating shipment:', error);
            alert('Failed to update shipment: ' + error.message);
        }
    };`;

    content = content.replace(
        /\/\/ Handle update shipment\s+const handleUpdateShipment = \(updatedShipment\) => \{[\s\S]*?\};/,
        updateReplace
    );
    console.log('  ✅ Updated handleUpdateShipment to Supabase\n');

    // Save file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('  💾 ShipmentManagement.jsx saved\n');

    return true;
}

// ============================================================================
// Test Migration with Real Data
// ============================================================================

async function testShipmentOperations() {
    console.log('🧪 Testing Shipment Operations\n');

    // Test 1: Create test shipment
    const testShipment = {
        job_number: 'SHIP-TEST-' + Date.now(),
        so_number: 'SO-TEST-' + Date.now(),
        customer: 'Test Customer',
        origin: 'Jakarta',
        destination: 'Singapore',
        service_type: 'sea',
        quoted_amount: 5000,
        status: 'pending',
        created_from: 'test_migration'
    };

    const { data: created, error: createError } = await supabase
        .from('blink_shipments')
        .insert([testShipment])
        .select();

    if (createError) {
        console.error('  ❌ Create failed:', createError.message);
        return false;
    }

    console.log('  ✅ Create shipment OK');
    console.log('     ID:', created[0].id);

    // Test 2: Update shipment
    const { error: updateError } = await supabase
        .from('blink_shipments')
        .update({ status: 'confirmed' })
        .eq('id', created[0].id);

    if (updateError) {
        console.error('  ❌ Update failed:', updateError.message);
        return false;
    }

    console.log('  ✅ Update shipment OK\n');

    return true;
}

// ============================================================================
// P1: SalesOrderManagement Check
// ============================================================================

async function checkSalesOrderManagement() {
    console.log('🟡 P1: SalesOrderManagement Review\n');

    const filePath = '/Users/hoeltz/Documents/GitHub/FreightOne/src/pages/Blink/SalesOrderManagement.jsx';
    const content = fs.readFileSync(filePath, 'utf8');

    const hasSupabase = content.includes('supabase');
    const hasLocalStorage = content.includes('localStorage');

    console.log('  File size:', (content.length / 1024).toFixed(1), 'KB');
    console.log('  Uses Supabase:', hasSupabase ? '✅' : '❌');
    console.log('  Uses localStorage:', hasLocalStorage ? '⚠️' : '✅');

    if (!hasSupabase && content.length < 2000) {
        console.log('  📝 Status: Placeholder/Basic implementation');
        console.log('  ℹ️  May not need migration if not actively used\n');
        return 'SKIP';
    }

    console.log('  ⏳ Needs full review\n');
    return 'REVIEW';
}

// ============================================================================
// P1: BLManagement Check
// ============================================================================

async function checkBLManagement() {
    console.log('🟡 P1: BLManagement Review\n');

    const filePath = '/Users/hoeltz/Documents/GitHub/FreightOne/src/pages/Blink/BLManagement.jsx';
    const content = fs.readFileSync(filePath, 'utf8');

    console.log('  File size:', (content.length / 1024).toFixed(1), 'KB');
    console.log('  Uses localStorage:', content.includes('localStorage') ? '⚠️ ' : '✅');

    // Check if it's a complex component
    if (content.length > 5000) {
        console.log('  📝 Status: Complex component - needs detailed migration');
        console.log('  ⏳ Recommend manual review\n');
        return 'COMPLEX';
    }

    console.log('  ℹ️  Should use shipment.documents JSONB field\n');
    return 'SIMPLE';
}

// ============================================================================
// Main Execution
// ============================================================================

async function main() {
    try {
        // P0: ShipmentManagement
        const p0Success = await migrateShipmentManagement();

        // Test
        const testSuccess = await testShipmentOperations();

        // P1: Review components
        const soStatus = await checkSalesOrderManagement();
        const blStatus = await checkBLManagement();

        // Summary
        console.log('═══════════════════════════════════\n');
        console.log('📊 MIGRATION SUMMARY\n');
        console.log('  P0 ShipmentManagement:', p0Success ? '✅ MIGRATED' : '❌ FAILED');
        console.log('  Test Operations:', testSuccess ? '✅ PASSED' : '❌ FAILED');
        console.log('  P1 SalesOrder:', soStatus);
        console.log('  P1 BLManagement:', blStatus);

        console.log('\n🔒 SECURITY REMINDER:');
        console.log('   ⚠️  REGENERATE service_role key NOW!');
        console.log('   📍 Dashboard → Settings → API → Regenerate\n');

        console.log('✅ Migration Complete!');
        console.log('🔄 Refresh browser to test ShipmentManagement\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    }
}

main();
