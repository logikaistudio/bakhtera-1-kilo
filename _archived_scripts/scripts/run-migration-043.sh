#!/bin/bash

# Migration 043: Update Mutation Destination Options
# This script executes the migration SQL directly to Supabase

echo "🚀 Migration 043: Update Mutation Destination Options"
echo "======================================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Read Supabase URL from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}❌ Error: .env file not found${NC}"
    exit 1
fi

if [ -z "$VITE_SUPABASE_URL" ]; then
    echo -e "${RED}❌ Error: VITE_SUPABASE_URL not found in .env${NC}"
    exit 1
fi

echo "📡 Supabase URL: $VITE_SUPABASE_URL"
echo ""

# SQL to execute
SQL=$(cat << 'EOF'
-- Migration 043: Update Mutation Destination Options

-- Add comment to destination column
COMMENT ON COLUMN freight_mutation_logs.destination IS 'Mutation destination location: Gudang (warehouse), Pameran (exhibition), or Keluar TPB (leaving bonded zone)';

-- Add comment to origin column
COMMENT ON COLUMN freight_mutation_logs.origin IS 'Mutation origin location: warehouse, Pameran, or other source';

-- Create index on destination
CREATE INDEX IF NOT EXISTS idx_mutation_destination ON freight_mutation_logs(destination);

-- Update table comment
COMMENT ON TABLE freight_mutation_logs IS 'Pergerakan Barang - Goods movement logs. Tracks mutations between warehouse, Pameran (exhibition), and TPB exit';

-- Verification query
SELECT 
    'Migration 043 executed successfully!' as status,
    COUNT(*) as index_count
FROM pg_indexes 
WHERE tablename = 'freight_mutation_logs' 
AND indexname = 'idx_mutation_destination';
EOF
)

echo "📝 SQL to execute:"
echo "======================================================================="
echo "$SQL"
echo "======================================================================="
echo ""

echo -e "${YELLOW}⚠️  Please execute this SQL manually in Supabase Dashboard:${NC}"
echo ""
echo "1. Go to: $VITE_SUPABASE_URL (Dashboard)"
echo "2. Navigate to: SQL Editor"
echo "3. Copy the SQL above"
echo "4. Paste and click 'Run'"
echo ""
echo "Or copy the migration file directly:"
echo "   File: supabase/migrations/043_update_mutation_destination_options.sql"
echo ""

# Try to open Supabase dashboard automatically (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    DASHBOARD_URL=$(echo "$VITE_SUPABASE_URL" | sed 's/supabase.co.*/supabase.co/')
    echo "🌐 Opening Supabase Dashboard..."
    open "${DASHBOARD_URL}/project/_/sql"
fi

echo ""
echo -e "${GREEN}✅ Migration SQL prepared and ready to execute${NC}"
