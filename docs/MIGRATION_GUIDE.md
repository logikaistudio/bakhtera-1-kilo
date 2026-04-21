# 📚 PENJELASAN: Points yang Perlu Diperhatikan

## ⚠️ PENTING: Database Migration

### Kenapa Harus Run Migration?

**Business Partner Model** memerlukan tabel baru di Supabase. Tanpa menjalankan migration, fitur ini **TIDAK AKAN BERFUNGSI** dan akan muncul error saat:
- Membuka halaman Partner Management
- Menggunakan PartnerPicker di Quotation/BL/AWB
- Import/Export partner

---

## 🚀 Cara Menjalankan Migration (WAJIB)

### Step 1: Buka Supabase Dashboard
1. Login ke https://supabase.com
2. Pilih project Anda: **FreightOne** (atau nama project Anda)
3. Klik menu **SQL Editor** di sidebar kiri

### Step 2: Run Migration File 1
1. Buka file `supabase/migrations/007_create_business_partners.sql` di VS Code
2. **Copy semua isi file** (Ctrl/Cmd + A, lalu Ctrl/Cmd + C)
3. Kembali ke Supabase SQL Editor
4. **Paste** ke editor (Ctrl/Cmd + V)
5. Klik tombol **"RUN"** (pojok kanan bawah)
6. Tunggu sampai muncul **"Success. No rows returned"** atau sejenisnya

### Step 3: Run Migration File 2
1. Buka file `supabase/migrations/008_update_foreign_keys_to_partners.sql`
2. **Copy semua isi file**
3. Kembali ke Supabase SQL Editor
4. **Paste** ke editor (clear editor dulu jika masih ada isi lama)
5. Klik tombol **"RUN"**
6. Tunggu sampai berhasil

### Step 4: Verifikasi Migration Berhasil
Run query berikut di SQL Editor untuk cek:

```sql
-- Cek apakah tabel sudah ada
SELECT COUNT(*) FROM blink_business_partners;

-- Cek struktur tabel
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'blink_business_partners'
ORDER BY ordinal_position;

-- Cek apakah kolom partner_id sudah ada di quotations
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'blink_quotations' AND column_name = 'partner_id';
```

**Expected Result**:
- Query 1: Return `0` (tabel kosong tapi exist)
- Query 2: Return list kolom (partner_name, partner_code, email, dll)
- Query 3: Return `partner_id`

Jika semua query berhasil → **Migration SUCCESS! ✅**

---

## ❌ Apa yang Terjadi Jika TIDAK Run Migration?

### Error yang Mungkin Muncul:

#### 1. **PartnerManagement.jsx** Crash
```
Error: relation "blink_business_partners" does not exist
```
**Penyebab**: Tabel `blink_business_partners` belum dibuat

**Solusi**: Run migration `007_create_business_partners.sql`

---

#### 2. **PartnerPicker** Tidak Load Data
```
Failed to load partners: relation "blink_business_partners" does not exist
```
**Penyebab**: Sama seperti di atas

**Solusi**: Run migration `007_create_business_partners.sql`

---

#### 3. **Quotation Create** Gagal
```
Error: column "partner_id" of relation "blink_quotations" does not exist
```
**Penyebab**: Kolom `partner_id` belum ditambahkan ke tabel `blink_quotations`

**Solusi**: Run migration `008_update_foreign_keys_to_partners.sql`

---

#### 4. **Import Partner** Gagal
```
Failed to insert: duplicate key value violates unique constraint
```
**Penyebab**: 
- Auto-generate partner_code trigger belum terinstall
- Atau partner_code di Excel duplikat

**Solusi**: 
- Run migration `007_create_business_partners.sql` (pastikan trigger terinstall)
- Atau kosongkan kolom partner_code di Excel (biar auto-generate)

---

## 🔍 Troubleshooting Guide

### Problem: "permission denied for table blink_business_partners"

**Penyebab**: Policy Supabase belum di-setup

**Solusi**:
```sql
-- Run di Supabase SQL Editor
ALTER TABLE blink_business_partners ENABLE ROW LEVEL SECURITY;

-- Policy untuk authenticated users
CREATE POLICY "Allow authenticated users to read partners"
ON blink_business_partners FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert partners"
ON blink_business_partners FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update partners"
ON blink_business_partners FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to delete partners"
ON blink_business_partners FOR DELETE
TO authenticated
USING (true);
```

---

### Problem: Partner Code tidak auto-generate

**Penyebab**: Trigger `generate_partner_code` belum aktif

**Cek apakah trigger exist**:
```sql
SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'blink_business_partners'::regclass;
```

**Jika tidak ada, install manual**:
```sql
-- Pastikan function exist
CREATE OR REPLACE FUNCTION generate_partner_code()
RETURNS TRIGGER AS $$
DECLARE
    year_month TEXT;
    next_seq INT;
BEGIN
    IF NEW.partner_code IS NULL OR NEW.partner_code = '' THEN
        year_month := TO_CHAR(NOW(), 'YYMM');
        
        SELECT COALESCE(MAX(CAST(
            SUBSTRING(partner_code FROM 'BP-[0-9]{4}-([0-9]+)') AS INT
        )), 0) + 1 INTO next_seq
        FROM blink_business_partners
        WHERE partner_code LIKE 'BP-' || year_month || '-%';
        
        NEW.partner_code := 'BP-' || year_month || '-' || LPAD(next_seq::TEXT, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_generate_partner_code ON blink_business_partners;
CREATE TRIGGER trigger_generate_partner_code
BEFORE INSERT ON blink_business_partners
FOR EACH ROW
EXECUTE FUNCTION generate_partner_code();
```

---

### Problem: Import Excel error "Invalid currency"

**Penyebab**: Kolom currency di Excel berisi value selain IDR/USD/EUR

**Solusi**: Edit Excel, pastikan kolom currency hanya berisi:
- `IDR` (Rupiah)
- `USD` (Dollar)
- `EUR` (Euro)

---

### Problem: Import Excel error "partner_name is required"

**Penyebab**: Kolom `partner_name` (kolom B di Excel) kosong

**Solusi**: Isi kolom Partner Name (required field)

---

## 💡 Best Practices

### 1. **Backup Database Sebelum Migration**
Meskipun migration ini aman (tidak menghapus data), selalu backup database production:

```bash
# Di Supabase Dashboard → Database → Backup
# Atau gunakan pg_dump (jika punya akses direct)
```

### 2. **Test di Development Environment Dulu**
Jika Anda punya Supabase project terpisah untuk testing, jalankan migration di sana dulu sebelum production.

### 3. **Run Migration di Off-Peak Hours**
Jika database production Anda sudah besar dan ramai, jalankan migration saat user sedikit (e.g., malam hari, weekend).

### 4. **Monitor Error Log Setelah Migration**
Setelah run migration, pantau:
- Supabase Dashboard → Logs
- Browser Console (F12)
- Application error messages

---

## 📊 Impact Assessment

### Tabel yang Terpengaruh:

| Tabel | Perubahan | Impact |
|-------|-----------|--------|
| `blink_business_partners` | **BARU** (created) | Low - tabel baru, tidak ada dependency |
| `blink_quotations` | Tambah kolom `partner_id` | **Low** - kolom nullable, data existing tetap aman |
| `blink_shipments` | Tambah kolom `partner_id`, `shipper_partner_id`, `consignee_partner_id` | **Low** - kolom nullable |
| `blink_invoices` | Tambah kolom `partner_id` | **Low** - kolom nullable |

### Backward Compatibility:
✅ **100% Compatible** - Migration tidak menghapus kolom lama (`customer_id`, `vendor_id`)

Aplikasi lama tetap bisa jalan tanpa perubahan kode.

---

## 🎯 Checklist Setelah Migration

- [ ] Tabel `blink_business_partners` sudah dibuat
- [ ] Trigger auto-generate partner_code berfungsi
- [ ] Kolom `partner_id` sudah ada di `blink_quotations`
- [ ] Bisa buka halaman **Blink → Master Data → Mitra Bisnis** tanpa error
- [ ] Bisa **create partner baru** dan mendapat partner_code otomatis (e.g., BP-2601-0001)
- [ ] PartnerPicker berfungsi di form Quotation
- [ ] Button "Load from Partner" berfungsi di BL/AWB Editor
- [ ] Export Template berfungsi dan download Excel template
- [ ] Import Excel berfungsi dan berhasil insert data ke database

---

## 📞 Need Help?

Jika mengalami error yang tidak tercantum di atas:

1. **Screenshot error message** (atau copy full error text)
2. **Screenshot Supabase SQL Editor** saat run migration
3. **Check browser console** (F12 → Console tab)
4. Contact system administrator dengan informasi di atas

---

**Last Updated**: 2026-01-26  
**Migration Files**: 
- `007_create_business_partners.sql`
- `008_update_foreign_keys_to_partners.sql`
