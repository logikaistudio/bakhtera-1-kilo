# Cleanup Orphaned Pabean Data - Script Automation

## Quick Start

```bash
# 1. Navigate to scripts folder
cd scripts

# 2. Install dependencies (first time only)
npm install

# 3. Run cleanup script
npm run cleanup
```

## What This Script Does

1. **Identifies orphaned data** - Finds Pabean records where pengajuan no longer exists
2. **Shows summary** - Displays what will be deleted
3. **Deletes orphaned data** - Removes from:
   - `freight_inbound`
   - `freight_outbound`
   - `freight_reject`
   - `freight_warehouse`
4. **Reports results** - Shows how many records were cleaned up

## Output Example

```
╔════════════════════════════════════════════════════════╗
║     CLEANUP ORPHANED PABEAN DATA - AUTOMATED SCRIPT   ║
╚════════════════════════════════════════════════════════╝

🔍 STEP 1: Identifying orphaned data...
  Checking freight_inbound...
  Found 2 orphaned inbound records
  Checking freight_outbound...
  Found 0 orphaned outbound records
  Checking freight_reject...
  Found 0 orphaned reject records
  Checking freight_warehouse...
  Found 3 orphaned warehouse records

📊 Summary:
  Total orphaned records found: 5
    - Inbound: 2
    - Outbound: 0
    - Reject: 0
    - Warehouse: 3

📋 Orphaned Inbound Records:
    - BC-786STGH (Pengajuan: 1234567890)
    - BC2024 (Pengajuan: 9876543210)

📦 Orphaned Warehouse Records:
    - test1 (BC: BC-786STGH)
    - item2 (BC: BC2024)
    - barang3 (BC: BC2024)

🗑️  STEP 2: Deleting orphaned data...
  Deleting 2 orphaned inbound records...
  ✅ Deleted 2 inbound records
  Deleting 3 orphaned warehouse records...
  ✅ Deleted 3 warehouse records

╔════════════════════════════════════════════════════════╗
║                   CLEANUP COMPLETE                     ║
╚════════════════════════════════════════════════════════╝

✅ Successfully deleted 5 orphaned records!

💡 Tip: Refresh your application to see the updated data.
```

## Troubleshooting

### Error: Supabase credentials not found

```bash
# Make sure .env file exists in project root with:
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Error: Cannot find module '@supabase/supabase-js'

```bash
# Install dependencies
cd scripts
npm install
```

### No orphaned data found

```
✅ No orphaned data found! Database is clean.
```

This is good! It means your database is already clean.

## Safety

- Script only deletes records where parent pengajuan doesn't exist
- No data is deleted without verification
- Uses same Supabase credentials as your app
- Can be run multiple times safely (idempotent)

## When to Run

- After manually deleting pengajuan from database
- When Pabean data shows entries that don't exist in Bridge
- As part of regular database maintenance
- Before production deployment for data cleanup
