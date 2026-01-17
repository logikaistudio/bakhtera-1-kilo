# Migration Guide: Add Storage Location to Mutation Logs

## Overview
This migration adds two new columns to the `freight_mutation_logs` table:
- `mutation_location`: Dropdown for mutation location (warehouse, pameran, outbound)
- `storage_location`: Text field for storage location

## How to Apply Migration

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Create a new query and paste the following SQL:

```sql
-- Add storage location columns to freight_mutation_logs table
-- These columns are needed for tracking mutation and storage locations

ALTER TABLE freight_mutation_logs 
ADD COLUMN IF NOT EXISTS mutation_location TEXT CHECK (mutation_location IN ('warehouse', 'pameran', 'outbound')),
ADD COLUMN IF NOT EXISTS storage_location TEXT;

-- Add comment
COMMENT ON COLUMN freight_mutation_logs.mutation_location IS 'Mutation location (Lokasi Mutasi): warehouse, pameran, or outbound';
COMMENT ON COLUMN freight_mutation_logs.storage_location IS 'Storage location (Lokasi Penyimpanan)';

-- Set default mutation_location based on destination for existing records
UPDATE freight_mutation_logs 
SET mutation_location = CASE 
    WHEN LOWER(destination) = 'warehouse' OR LOWER(destination) = 'gudang' THEN 'warehouse'
    WHEN LOWER(destination) LIKE '%pameran%' THEN 'pameran'
    ELSE 'outbound'
END
WHERE mutation_location IS NULL;
```

4. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have Supabase CLI configured:

```bash
# First, link your project if not already linked
npx supabase link --project-ref YOUR_PROJECT_REF

# Then push the migration
npx supabase db push
```

## Verification

After running the migration, verify by executing:

```sql
-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'freight_mutation_logs' 
  AND column_name IN ('mutation_location', 'storage_location');
```

You should see both columns listed.

## Changes Made in Code

1. **Database Migration** (`044_add_storage_location_to_mutation.sql`):
   - Added `mutation_location` column with CHECK constraint
   - Added `storage_location` column
   - Set default values for existing records

2. **GoodsMovement.jsx**:
   - Added "Lokasi Mutasi" dropdown column to modal table
   - Added "Lokasi Penyimpanan" text input column to modal table
   - Updated `handleRemutation` to save these values

3. **DataContext.jsx**:
   - Updated `addMutationLog` to insert new fields
   - Updated data mapping to include new fields when loading from database

## Usage

In the Mutation Detail Modal:
- **Lokasi Mutasi**: Select from dropdown (Warehouse, Pameran, Outbound)
- **Lokasi Penyimpanan**: Enter storage location as text

These fields will be saved when creating or updating mutation logs.
