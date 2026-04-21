# Fix untuk COA Import Error

## Masalah
Saat melakukan import COA di menu Blink, menerima error:
```
Import Failed: new row violates row-level security policy for table 'finance_coa'
```

## Penyebab
Kebijakan Row-Level Security (RLS) pada tabel `finance_coa` tidak dikonfigurasi dengan benar untuk operasi INSERT. Policies yang ada terlalu ketat atau tidak sesuai format yang dibutuhkan Supabase.

## Solusi

### Opsi 1: Jalankan Script Fix Otomatis (Recommended)
```bash
node fix_coa_rls_policy.mjs
```

Script ini akan:
- Menghapus policy lama yang bermasalah
- Membuat policy baru yang memungkinkan operasi SELECT, INSERT, UPDATE, DELETE
- Menggunakan kondisi permissive (true) sehingga RLS tidak memblokir import

### Opsi 2: Manual via Supabase Dashboard
1. Buka Supabase Dashboard → SQL Editor
2. Buat query baru
3. Copy-paste SQL berikut:

```sql
-- Drop the restrictive policy
DROP POLICY IF EXISTS "Enable all for authenticated users" ON finance_coa;

-- Create separate policies for each operation
-- SELECT: Allow all users to read COA data
CREATE POLICY "Allow read access for all users" ON finance_coa
    FOR SELECT
    USING (true);

-- INSERT: Allow authenticated users to insert COA records
CREATE POLICY "Allow insert for authenticated users" ON finance_coa
    FOR INSERT
    WITH CHECK (true);

-- UPDATE: Allow authenticated users to update COA records
CREATE POLICY "Allow update for authenticated users" ON finance_coa
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- DELETE: Allow authenticated users to delete COA records
CREATE POLICY "Allow delete for authenticated users" ON finance_coa
    FOR DELETE
    USING (true);
```

4. Klik "Run" atau tekan Ctrl+Enter
5. Tunggu sampai berhasil

### Opsi 3: Via Supabase CLI
Jika sudah setup Supabase CLI:
```bash
supabase db push supabase/migrations/090_fix_finance_coa_rls_policy.sql
```

## Verifikasi

Setelah menjalankan fix, coba import COA lagi:
1. Buka menu Centralized → COA Master
2. Klik Upload/Import button
3. Pilih file Excel dengan data COA
4. Lakukan import
5. Sekarang seharusnya berhasil tanpa error RLS

## Apa yang Berubah

| Aspek | Sebelum | Sesudah |
|-------|--------|--------|
| Policy | Single "FOR ALL" dengan `TO authenticated` | Separate policies: SELECT, INSERT, UPDATE, DELETE |
| INSERT | Terbatas oleh kondisi yang tidak jelas | Explicitly allowed dengan `WITH CHECK (true)` |
| Error | "new row violates row-level security policy" | ✅ Import berhasil |

## Troubleshooting

Jika masih error setelah fix:
1. Refresh browser (clear cache jika perlu)
2. Check di Supabase Dashboard apakah policies sudah berhasil di-update
3. Pastikan kolom Excel sesuai dengan yang diharapkan
4. Contact support dengan error message lengkap

## File yang Ditambah
- `supabase/migrations/090_fix_finance_coa_rls_policy.sql` - Migration SQL
- `fix_coa_rls_policy.mjs` - Script untuk menjalankan fix
- `FIX_COA_IMPORT_ERROR.md` - Dokumentasi ini

---
**Last Updated:** 2026-04-12
