#!/bin/bash

# Migration script using curl to bypass Supabase client cache issues
# This script migrates data from big_ar_transactions to blink_ar_transactions

echo "🔄 Starting curl-based migration..."

SUPABASE_URL="${VITE_SUPABASE_URL}"
SUPABASE_KEY="${VITE_SUPABASE_ANON_KEY}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
  echo "❌ Environment variables not set"
  exit 1
fi

echo "📊 Fetching AR data..."

# Fetch AR data
AR_RESPONSE=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/big_ar_transactions?select=*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if [ $? -ne 0 ]; then
  echo "❌ Failed to fetch AR data"
  exit 1
fi

echo "📊 Processing AR data..."

# Parse JSON and insert each record
echo "$AR_RESPONSE" | jq -c '.[]' | while read -r record; do
  echo "Processing record: $record"

  # Extract fields
  INVOICE_ID=$(echo "$record" | jq -r '.invoice_id // empty')
  INVOICE_NUMBER=$(echo "$record" | jq -r '.invoice_number // empty')
  AR_NUMBER=$(echo "$record" | jq -r '.ar_number // empty')
  CLIENT_ID=$(echo "$record" | jq -r '.client_id // empty')
  CUSTOMER_NAME=$(echo "$record" | jq -r '.customer_name // "Unknown"')
  TRANSACTION_DATE=$(echo "$record" | jq -r '.transaction_date')
  DUE_DATE=$(echo "$record" | jq -r '.due_date')
  ORIGINAL_AMOUNT=$(echo "$record" | jq -r '.original_amount')
  PAID_AMOUNT=$(echo "$record" | jq -r '.paid_amount // 0')
  OUTSTANDING_AMOUNT=$(echo "$record" | jq -r ".outstanding_amount // ($ORIGINAL_AMOUNT - $PAID_AMOUNT)")
  CURRENCY=$(echo "$record" | jq -r '.currency // "IDR"')
  EXCHANGE_RATE=$(echo "$record" | jq -r '.exchange_rate // 1')
  STATUS=$(echo "$record" | jq -r '.status // "outstanding"')
  NOTES=$(echo "$record" | jq -r '.notes // "Migrated from big_ar_transactions"')

  # Generate AR number if empty
  if [ -z "$AR_NUMBER" ]; then
    ID=$(echo "$record" | jq -r '.id')
    AR_NUMBER="AR-${ID:0:6}"
  fi

  # Create JSON payload
  JSON_PAYLOAD=$(cat <<EOF
{
  "invoice_id": "$INVOICE_ID",
  "invoice_number": "$INVOICE_NUMBER",
  "ar_number": "$AR_NUMBER",
  "customer_id": "$CLIENT_ID",
  "customer_name": "$CUSTOMER_NAME",
  "transaction_date": "$TRANSACTION_DATE",
  "due_date": "$DUE_DATE",
  "original_amount": $ORIGINAL_AMOUNT,
  "paid_amount": $PAID_AMOUNT,
  "outstanding_amount": $OUTSTANDING_AMOUNT,
  "currency": "$CURRENCY",
  "exchange_rate": $EXCHANGE_RATE,
  "status": "$STATUS",
  "notes": "$NOTES"
}
EOF
)

  echo "Inserting: $JSON_PAYLOAD"

  # Insert record
  INSERT_RESPONSE=$(curl -s -X POST \
    "${SUPABASE_URL}/rest/v1/blink_ar_transactions" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

  if [ $? -eq 0 ]; then
    echo "✅ Successfully inserted AR record"
  else
    echo "❌ Insert failed: $INSERT_RESPONSE"
  fi

done

echo "🎉 AR Migration completed!"

# Check AP data
echo "📊 Checking AP data..."
AP_RESPONSE=$(curl -s -X GET \
  "${SUPABASE_URL}/rest/v1/big_ap_transactions?select=*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if [ $? -eq 0 ] && [ "$AP_RESPONSE" != "[]" ]; then
  echo "📊 Processing AP data..."

  echo "$AP_RESPONSE" | jq -c '.[]' | while read -r record; do
    echo "Processing AP record: $record"

    # Similar processing for AP records...
    PO_ID=$(echo "$record" | jq -r '.po_id // empty')
    PO_NUMBER=$(echo "$record" | jq -r '.po_number // empty')
    AP_NUMBER=$(echo "$record" | jq -r '.ap_number // empty')
    VENDOR_ID=$(echo "$record" | jq -r '.vendor_id // empty')
    VENDOR_NAME=$(echo "$record" | jq -r '.vendor_name // "Unknown Vendor"')
    BILL_DATE=$(echo "$record" | jq -r '.bill_date // empty')
    TRANSACTION_DATE=$(echo "$record" | jq -r '.transaction_date')
    DUE_DATE=$(echo "$record" | jq -r '.due_date')
    ORIGINAL_AMOUNT=$(echo "$record" | jq -r '.original_amount')
    PAID_AMOUNT=$(echo "$record" | jq -r '.paid_amount // 0')
    OUTSTANDING_AMOUNT=$(echo "$record" | jq -r ".outstanding_amount // ($ORIGINAL_AMOUNT - $PAID_AMOUNT)")
    CURRENCY=$(echo "$record" | jq -r '.currency // "IDR"')
    EXCHANGE_RATE=$(echo "$record" | jq -r '.exchange_rate // 1')
    STATUS=$(echo "$record" | jq -r '.status // "outstanding"')
    NOTES=$(echo "$record" | jq -r '.notes // "Migrated from big_ap_transactions"')

    if [ -z "$AP_NUMBER" ]; then
      ID=$(echo "$record" | jq -r '.id')
      AP_NUMBER="AP-${ID:0:6}"
    fi

    if [ -z "$BILL_DATE" ]; then
      BILL_DATE="$TRANSACTION_DATE"
    fi

    JSON_PAYLOAD=$(cat <<EOF
{
  "po_id": "$PO_ID",
  "po_number": "$PO_NUMBER",
  "ap_number": "$AP_NUMBER",
  "vendor_id": "$VENDOR_ID",
  "vendor_name": "$VENDOR_NAME",
  "bill_date": "$BILL_DATE",
  "due_date": "$DUE_DATE",
  "original_amount": $ORIGINAL_AMOUNT,
  "paid_amount": $PAID_AMOUNT,
  "outstanding_amount": $OUTSTANDING_AMOUNT,
  "currency": "$CURRENCY",
  "exchange_rate": $EXCHANGE_RATE,
  "status": "$STATUS",
  "notes": "$NOTES"
}
EOF
)

    echo "Inserting AP: $JSON_PAYLOAD"

    INSERT_RESPONSE=$(curl -s -X POST \
      "${SUPABASE_URL}/rest/v1/blink_ap_transactions" \
      -H "apikey: ${SUPABASE_KEY}" \
      -H "Authorization: Bearer ${SUPABASE_KEY}" \
      -H "Content-Type: application/json" \
      -d "$JSON_PAYLOAD")

    if [ $? -eq 0 ]; then
      echo "✅ Successfully inserted AP record"
    else
      echo "❌ AP Insert failed: $INSERT_RESPONSE"
    fi

  done
else
  echo "ℹ️ No AP data to migrate"
fi

echo "🎉 Migration completed!"
echo "📋 Next steps:"
echo "   1. Check Blink AR/AP pages to verify data appears"
echo "   2. Test new approvals create transactions in Blink tables"
echo "   3. Run financial reports to ensure transactions are included"