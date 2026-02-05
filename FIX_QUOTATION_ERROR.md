# Fix Quotation Submit Error

## Problem
Error saat submit quotation: "Could not find the 'customer_contact_name' column of 'blink_quotations' in the schema cache"

## Root Cause
Tabel `blink_quotations` tidak memiliki kolom-kolom berikut yang dibutuhkan oleh form:
- `customer_contact_name`
- `customer_email`
- `customer_phone`
- `incoterm`
- `payment_terms`
- `package_type`
- `quantity`
- `gross_weight`
- `net_weight`
- `measure`
- `terms_and_conditions`

## Solution
Jalankan migration untuk menambahkan kolom-kolom tersebut.

## How to Run Migration

### Option 1: Via Supabase Dashboard (RECOMMENDED)
1. Buka Supabase Dashboard: https://nkyoszmtyrpdwfjxggmb.supabase.co
2. Login dengan akun Anda
3. Klik menu **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy dan paste isi file: `supabase/migrations/051_add_quotation_contact_fields.sql`
6. Klik **Run** atau tekan `Ctrl+Enter`
7. Pastikan muncul pesan sukses

### Option 2: Via Supabase CLI (if installed)
```bash
supabase db push
```

### Option 3: Manual SQL Execution
Jika Anda memiliki akses langsung ke PostgreSQL database, jalankan SQL berikut:

```sql
ALTER TABLE blink_quotations
ADD COLUMN IF NOT EXISTS customer_contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS incoterm VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(255),
ADD COLUMN IF NOT EXISTS package_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS quantity DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS gross_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS net_weight DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS measure DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
```

## Verification
Setelah migration berhasil, coba submit quotation lagi. Error seharusnya sudah hilang.

## Files Modified
- Created: `supabase/migrations/051_add_quotation_contact_fields.sql`
- Created: `run_quotation_migration.mjs` (helper script)
- Created: `FIX_QUOTATION_ERROR.md` (this file)
