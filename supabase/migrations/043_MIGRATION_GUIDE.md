# Migration 043: Update Mutation Destination Options

## 📋 Overview
This migration updates the documentation and indexing for the `destination` field in the `freight_mutation_logs` table to support three mutation location options.

## 🎯 Purpose
Document and support the new mutation location dropdown feature in Bridge - Inventaris Gudang modal, which allows users to select destination locations when performing mutations.

## 🔄 Changes Made

### 1. Documentation Updates
- Added comprehensive comment to `destination` column explaining the three supported values
- Added comment to `origin` column for completeness
- Updated table comment to reflect the enhanced mutation tracking

### 2. Performance Optimization
- Added index `idx_mutation_destination` for faster filtering by destination location

## 📊 Supported Destination Values

| Value | Description | Use Case |
|-------|-------------|----------|
| `Gudang` | Warehouse | Items returning to warehouse from exhibition |
| `Pameran` | Exhibition | Items being sent to exhibition/display area |
| `Keluar TPB` | Leaving Bonded Zone | Items permanently leaving the bonded warehouse |

## 💾 Database Schema Impact

### Before
```sql
destination TEXT  -- No documentation or specific validation
```

### After
```sql
destination TEXT  -- Documented with three supported values
-- Index: idx_mutation_destination for better query performance
-- Comment: 'Mutation destination location: Gudang (warehouse), Pameran (exhibition), or Keluar TPB (leaving bonded zone)'
```

## 🚀 How to Execute

### Option 1: Supabase Dashboard SQL Editor
1. Navigate to your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `043_update_mutation_destination_options.sql`
4. Click "Run"

### Option 2: Supabase CLI (if installed)
```bash
supabase db push
```

## ✅ Verification

After running the migration, verify:

```sql
-- Check column comments
SELECT 
    column_name, 
    col_description('freight_mutation_logs'::regclass, ordinal_position) as column_comment
FROM information_schema.columns
WHERE table_name = 'freight_mutation_logs' 
AND column_name IN ('destination', 'origin');

-- Check index exists
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'freight_mutation_logs' 
AND indexname = 'idx_mutation_destination';
```

## 📝 Related Files
- Frontend: `/src/pages/Bridge/WarehouseInventory.jsx`
- Migration: `/supabase/migrations/043_update_mutation_destination_options.sql`

## 🔗 Dependencies
- Requires: `001_initial_schema.sql` (freight_mutation_logs table)
- Requires: `040_add_mutation_columns.sql` (additional columns)

## ⚠️ Notes
- **Non-breaking change**: This migration only adds comments and indexes
- **Backward compatible**: Existing data is not affected
- **No data migration needed**: The `destination` field already exists as TEXT type
- The three location values are enforced at the application level in the UI dropdown

## 📅 Migration History
- Created: 2026-01-12
- Purpose: Support mutation location selection feature
- Type: Schema documentation + performance optimization

---

**Status**: ✅ Ready to execute  
**Breaking Changes**: None  
**Data Migration Required**: No
