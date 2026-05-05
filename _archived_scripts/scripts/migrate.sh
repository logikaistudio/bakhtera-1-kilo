#!/bin/bash

# =====================================================
# Bakhtera-1 Database Migration Script
# =====================================================
# This script helps you run the migration on Supabase

echo "🚀 Bakhtera-1 Database Migration"
echo "=================================="
echo ""

# Check if migration file exists
MIGRATION_FILE="supabase/migrations/001_initial_schema.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found"
echo ""
echo "📋 MANUAL MIGRATION STEPS:"
echo ""
echo "1. Open Supabase SQL Editor:"
echo "   https://supabase.com/dashboard/project/nkyoszmtyrpdwfjxggmb/sql/new"
echo ""
echo "2. Copy the SQL migration file:"
echo "   Location: $MIGRATION_FILE"
echo ""
echo "3. In the SQL Editor:"
echo "   - Click 'New Query'"
echo "   - Paste the entire SQL content"
echo "   - Click 'Run' or press Ctrl+Enter"
echo ""
echo "4. Verify tables created:"
echo "   - Go to Table Editor"
echo "   - You should see 21 tables starting with 'freight_'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📄 Opening migration file for you to copy..."
echo ""

# Try to open the file in default editor or display it
if command -v code &> /dev/null; then
    echo "Opening in VS Code..."
    code "$MIGRATION_FILE"
elif command -v cat &> /dev/null; then
    echo "Displaying file contents:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    cat "$MIGRATION_FILE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
fi

echo ""
echo "✨ After running the migration in Supabase Dashboard,"
echo "   run this verification query:"
echo ""
echo "SELECT table_name FROM information_schema.tables"
echo "WHERE table_schema = 'public' AND table_name LIKE 'freight_%'"
echo "ORDER BY table_name;"
echo ""
echo "Expected: 20 tables"
echo ""
