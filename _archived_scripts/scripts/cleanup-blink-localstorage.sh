#!/bin/bash
# BLINK Data Cleanup Script
# Removes localStorage data after Supabase migration

echo "🧹 Cleaning up BLINK localStorage data..."

# This script provides the commands to clean up localStorage
# Run in browser console (F12 → Console tab)

cat << 'EOF'

// =============================================================================
// Run this in Browser Console (F12)
// =============================================================================

// 1. Backup existing data (optional)
console.log('📦 Backing up localStorage data...');
const quotationsBackup = localStorage.getItem('blink_quotations');
const shipmentsBackup = localStorage.getItem('blink_shipments');

if (quotationsBackup) {
    console.log('Quotations backup:', quotationsBackup);
    // Copy this if you need to restore
}

if (shipmentsBackup) {
    console.log('Shipments backup:', shipmentsBackup);
    // Copy this if you need to restore
}

// 2. Clear BLINK localStorage
console.log('🗑️ Clearing BLINK localStorage...');
localStorage.removeItem('blink_quotations');
localStorage.removeItem('blink_shipments');
localStorage.removeItem('blink_leads');

// 3. Clear all keys starting with 'blink_'
Object.keys(localStorage)
    .filter(key => key.startsWith('blink_'))
    .forEach(key => {
        console.log('Removing:', key);
        localStorage.removeItem(key);
    });

// 4. Verify cleanup
console.log('✅ Cleanup complete!');
console.log('Remaining localStorage keys:', Object.keys(localStorage));

// 5. Reload page to fetch from Supabase
console.log('🔄 Reloading page to fetch from Supabase...');
setTimeout(() => window.location.reload(), 1000);

EOF

echo ""
echo "✅ Script generated!"
echo "📋 Copy the JavaScript code above and paste in browser console"
echo ""
