#!/usr/bin/env node

/**
 * Sample Data Generator for Sales Revenue Dashboard
 * Generates 3 months of sample data for testing charts
 */

import { createClient } from '@supabase/supabase-js';

// Get from environment or use defaults
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_GhpLPJQyE7IIlmFStBqKVQ_aKcbgleV';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sample data configuration
const SALES_PERSONS = ['John Doe', 'Jane Smith', 'Mike Johnson'];
const CUSTOMERS = ['PT. ABC Indonesia', 'PT. XYZ Trading', 'CV. Makmur Jaya', 'PT. Global Logistics', 'UD. Sejahtera'];
const SERVICES = ['FCL', 'LCL', 'Air Freight', 'Express'];
const ROUTES = [
    { origin: 'Jakarta', destination: 'Singapore' },
    { origin: 'Surabaya', destination: 'Hong Kong' },
    { origin: 'Jakarta', destination: 'Shanghai' },
    { origin: 'Semarang', destination: 'Tokyo' }
];

// Generate data for last 3 months
async function generateSampleData() {
    console.log('🚀 Starting sample data generation...');

    const today = new Date();
    const quotations = [];
    const shipments = [];

    // Generate data for 3 months (October, November, December)
    for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const monthName = monthDate.toLocaleString('id-ID', { month: 'long' });

        console.log(`\n📅 Generating data for ${monthName} ${monthDate.getFullYear()}...`);

        // Generate 8-12 quotations per month
        const quotationCount = 8 + Math.floor(Math.random() * 5);

        for (let i = 0; i < quotationCount; i++) {
            const isRegular = Math.random() > 0.3; // 70% regular, 30% operation
            const quotationType = isRegular ? 'RG' : 'OP';
            const salesPerson = SALES_PERSONS[Math.floor(Math.random() * SALES_PERSONS.length)];
            const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
            const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
            const service = SERVICES[Math.floor(Math.random() * SERVICES.length)];

            // Random date within the month
            const day = 1 + Math.floor(Math.random() * 28);
            const createdDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);

            // Random amount between 10M - 100M IDR or 1K - 10K USD
            const currency = Math.random() > 0.5 ? 'IDR' : 'USD';
            const amount = currency === 'IDR'
                ? 10000000 + Math.floor(Math.random() * 90000000)
                : 1000 + Math.floor(Math.random() * 9000);

            const jobNumber = `${quotationType}-${monthDate.getFullYear()}${String(monthDate.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`;

            // 70% conversion rate
            const isConverted = Math.random() > 0.3;

            // Calculate valid_until (30 days from quotation date)
            const validUntil = new Date(createdDate);
            validUntil.setDate(validUntil.getDate() + 30);

            const quotation = {
                job_number: jobNumber,
                quotation_type: quotationType,
                sales_person: salesPerson,
                customer_name: customer,
                origin: route.origin,
                destination: route.destination,
                service_type: service,
                total_amount: amount,
                currency: currency,
                status: isConverted ? 'converted' : 'pending',
                quotation_date: createdDate.toISOString().split('T')[0], // YYYY-MM-DD format
                valid_until: validUntil.toISOString().split('T')[0], // YYYY-MM-DD format
                created_at: createdDate.toISOString()
            };

            quotations.push(quotation);

            // If converted, create shipment
            if (isConverted) {
                // Shipment date 1-3 days after quotation
                const shipmentDate = new Date(createdDate);
                shipmentDate.setDate(shipmentDate.getDate() + 1 + Math.floor(Math.random() * 3));

                // 80% of shipments are delivered/completed (paid)
                const isPaid = Math.random() > 0.2;
                const shipmentStatus = isPaid ? (Math.random() > 0.5 ? 'delivered' : 'completed') : 'in_transit';

                // Payment date 7-30 days after shipment for paid ones
                let updatedDate = new Date(shipmentDate);
                if (isPaid) {
                    updatedDate.setDate(updatedDate.getDate() + 7 + Math.floor(Math.random() * 24));
                }

                const shipment = {
                    job_number: jobNumber,
                    quotation_type: quotationType,
                    sales_person: salesPerson,
                    customer: customer,
                    origin: route.origin,
                    destination: route.destination,
                    service_type: service,
                    quoted_amount: amount,
                    currency: currency,
                    status: shipmentStatus,
                    created_at: shipmentDate.toISOString(),
                    updated_at: updatedDate.toISOString()
                };

                shipments.push(shipment);
            }
        }
    }

    console.log(`\n✅ Generated ${quotations.length} quotations`);
    console.log(`✅ Generated ${shipments.length} shipments`);

    // Insert into Supabase
    console.log('\n📤 Inserting quotations into Supabase...');
    const { data: quotData, error: quotError } = await supabase
        .from('blink_quotations')
        .insert(quotations);

    if (quotError) {
        console.error('❌ Error inserting quotations:', quotError);
        return;
    }

    console.log('✅ Quotations inserted successfully!');

    console.log('\n📤 Inserting shipments into Supabase...');
    const { data: shipData, error: shipError } = await supabase
        .from('blink_shipments')
        .insert(shipments);

    if (shipError) {
        console.error('❌ Error inserting shipments:', shipError);
        return;
    }

    console.log('✅ Shipments inserted successfully!');

    // Summary statistics
    console.log('\n📊 Summary:');
    console.log('─'.repeat(50));

    const regularQuots = quotations.filter(q => q.quotation_type === 'RG');
    const operationQuots = quotations.filter(q => q.quotation_type === 'OP');
    const convertedQuots = quotations.filter(q => q.status === 'converted');
    const paidShipments = shipments.filter(s => s.status === 'delivered' || s.status === 'completed');

    console.log(`Total Quotations: ${quotations.length}`);
    console.log(`  - Regular (RG): ${regularQuots.length}`);
    console.log(`  - Operation (OP): ${operationQuots.length}`);
    console.log(`  - Converted: ${convertedQuots.length} (${((convertedQuots.length / quotations.length) * 100).toFixed(1)}%)`);
    console.log(`\nTotal Shipments: ${shipments.length}`);
    console.log(`  - Paid (delivered/completed): ${paidShipments.length} (${((paidShipments.length / shipments.length) * 100).toFixed(1)}%)`);

    const totalRevenue = paidShipments.reduce((sum, s) => {
        const amount = s.currency === 'USD' ? s.quoted_amount * 15000 : s.quoted_amount;
        return sum + amount;
    }, 0);

    const regularRevenue = paidShipments
        .filter(s => s.quotation_type === 'RG')
        .reduce((sum, s) => {
            const amount = s.currency === 'USD' ? s.quoted_amount * 15000 : s.quoted_amount;
            return sum + amount;
        }, 0);

    const operationRevenue = paidShipments
        .filter(s => s.quotation_type === 'OP')
        .reduce((sum, s) => {
            const amount = s.currency === 'USD' ? s.quoted_amount * 15000 : s.quoted_amount;
            return sum + amount;
        }, 0);

    console.log(`\nTotal Revenue: Rp ${totalRevenue.toLocaleString('id-ID')}`);
    console.log(`  - Regular: Rp ${regularRevenue.toLocaleString('id-ID')} (${((regularRevenue / totalRevenue) * 100).toFixed(1)}%)`);
    console.log(`  - Operation: Rp ${operationRevenue.toLocaleString('id-ID')} (${((operationRevenue / totalRevenue) * 100).toFixed(1)}%)`);

    console.log('\n🎉 Sample data generation complete!');
    console.log('📊 Refresh your Sales & Revenue page to see the charts populated!');
}

// Run the generator
generateSampleData().catch(console.error);
