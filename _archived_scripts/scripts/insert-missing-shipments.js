#!/usr/bin/env node
/**
 * Insert missing shipments for existing quotations
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nkyoszmtyrpdwfjxggmb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_GhpLPJQyE7IIlmFStBqKVQ_aKcbgleV';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function insertMissingShipments() {
    console.log('🔍 Finding quotations without shipments...\n');

    // Get all converted quotations
    const { data: quotations, error: quotError } = await supabase
        .from('blink_quotations')
        .select('*')
        .eq('status', 'converted');

    if (quotError) {
        console.error('❌ Error:', quotError);
        return;
    }

    console.log(`Found ${quotations.length} converted quotations`);

    // Get existing shipments
    const { data: existingShipments } = await supabase
        .from('blink_shipments')
        .select('job_number');

    const existingJobNumbers = new Set(existingShipments?.map(s => s.job_number) || []);

    // Find quotations without shipments
    const quotationsWithoutShipments = quotations.filter(q => !existingJobNumbers.has(q.job_number));

    console.log(`${quotationsWithoutShipments.length} quotations need shipments\n`);

    if (quotationsWithoutShipments.length === 0) {
        console.log('✅ All quotations already have shipments!');
        return;
    }

    // Create shipments
    const shipments = quotationsWithoutShipments.map(q => {
        const quotDate = new Date(q.created_at);
        const shipmentDate = new Date(quotDate);
        shipmentDate.setDate(shipmentDate.getDate() + 2); // 2 days after quotation

        // 80% paid, 20% in transit
        const isPaid = Math.random() > 0.2;
        const status = isPaid ? (Math.random() > 0.5 ? 'delivered' : 'completed') : 'in_transit';

        // Payment date 10-30 days after shipment
        const updatedDate = new Date(shipmentDate);
        if (isPaid) {
            updatedDate.setDate(updatedDate.getDate() + 10 + Math.floor(Math.random() * 21));
        }

        return {
            job_number: q.job_number,
            quotation_type: q.quotation_type,
            sales_person: q.sales_person,
            customer: q.customer_name,
            origin: q.origin,
            destination: q.destination,
            service_type: q.service_type,
            quoted_amount: q.total_amount,
            currency: q.currency,
            status: status,
            created_at: shipmentDate.toISOString(),
            updated_at: updatedDate.toISOString()
        };
    });

    console.log('📤 Inserting shipments...');
    const { data, error } = await supabase
        .from('blink_shipments')
        .insert(shipments);

    if (error) {
        console.error('❌ Error:', error);
        return;
    }

    console.log(`✅ Successfully inserted ${shipments.length} shipments!`);

    // Calculate revenue
    const paidShipments = shipments.filter(s => s.status === 'delivered' || s.status === 'completed');
    const revenue = paidShipments.reduce((sum, s) => {
        const amount = s.currency === 'USD' ? s.quoted_amount * 15000 : s.quoted_amount;
        return sum + amount;
    }, 0);

    console.log(`\n💰 Revenue from new shipments: Rp ${revenue.toLocaleString('id-ID')}`);
    console.log(`   - Paid: ${paidShipments.length}`);
    console.log(`   - In Transit: ${shipments.length - paidShipments.length}`);
}

insertMissingShipments().catch(console.error);
