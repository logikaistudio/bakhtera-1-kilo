# 🔄 Migrasi ke Business Partner Model

## Ringkasan Perubahan

Sistem **Customer** dan **Vendor** yang terpisah telah digabung menjadi satu entitas **"Mitra Bisnis" (Business Partner)** untuk portal **BLINK**. Ini memudahkan pengelolaan data karena satu perusahaan bisa memiliki multiple roles (Customer, Vendor, Agent, Transporter).

---

## 📋 Apa yang Berubah?

### 1. Database (Supabase)
- ✅ **Tabel Baru**: `blink_business_partners`
  - Support multi-role (is_customer, is_vendor, is_agent, is_transporter, is_consignee, is_shipper)
  - Auto-generate partner_code (format: BP-YYMM-XXXX)
  - Full contact, address, banking info

- ✅ **Foreign Keys Baru** di tabel existing:
  - `blink_quotations.partner_id`
  - `blink_shipments.partner_id` (customer/bill-to)
  - `blink_shipments.vendor_partner_id`
  - `blink_shipments.shipper_partner_id`
  - `blink_shipments.consignee_partner_id`
  - `blink_invoices.partner_id`

- ✅ **Backward Compatibility Views**:
  - `blink_customers_legacy`: Filter partners dengan is_customer=true
  - `blink_vendors_legacy`: Filter partners dengan is_vendor=true

### 2. Frontend (React)
- ✅ **Komponen Baru**:
  - `/src/pages/Blink/PartnerManagement.jsx` - UI pengelolaan mitra
  - `/src/components/Common/PartnerPicker.jsx` - Dropdown universal untuk pilih partner

- ✅ **Routing** (`App.jsx`):
  - Route baru: `/blink/master/partners` → `<PartnerManagement />`

- ✅ **Sidebar** (`Sidebar.jsx`):
  - Menu baru di Blink → Master Data → "Mitra Bisnis"

### 3. Vendor/Customer Management Centralized TETAP ADA
- ⚠️ Menu `/vendors` dan `/customers` di "Fungsi Terpusat" **TIDAK DIHAPUS**
- Alasan: Portal lain (Bridge, Pabean, BIG) mungkin masih menggunakan
- Untuk Blink: Gunakan menu "Mitra Bisnis" yang baru

---

## 🚀 Cara Menjalankan Migration

### Step 1: Jalankan SQL Migrations di Supabase Dashboard

Buka **Supabase Dashboard → SQL Editor** lalu run file berikut secara berurutan:

#### File 1: `supabase/migrations/007_create_business_partners.sql`
```bash
# Copy isi file ini dan paste ke Supabase SQL Editor, lalu run
```

#### File 2: `supabase/migrations/008_update_foreign_keys_to_partners.sql`
```bash
# Copy isi file ini dan paste ke Supabase SQL Editor, lalu run
```

### Step 2: Verifikasi Database
Setelah migration berhasil, cek di Supabase:
```sql
-- Lihat struktur tabel
SELECT * FROM blink_business_partners LIMIT 1;

-- Cek apakah kolom baru sudah ada
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'blink_quotations' AND column_name = 'partner_id';
```

### Step 3: Migrasi Data (Opsional)
Jika Anda sudah punya data customer/vendor lama:
```sql
-- Contoh: Migrasi dari tabel customer lama (jika ada)
INSERT INTO blink_business_partners (
    partner_name, email, phone, address_line1, city, country,
    is_customer, status
)
SELECT 
    customer_name, email, phone, address, city, country,
    true, 'active'
FROM old_customers_table;

-- Update foreign key di quotations
UPDATE blink_quotations q
SET partner_id = (
    SELECT id FROM blink_business_partners 
    WHERE partner_name = q.customer_name LIMIT 1
);
```

---

## 🎯 Cara Menggunakan Fitur Baru

### 1. Tambah Mitra Baru
1. Buka menu **Blink → Master Data → Mitra Bisnis**
2. Klik **"Tambah Mitra Baru"**
3. Isi data: Nama, Contact Person, Email, Phone, Address
4. **Pilih Role** (bisa lebih dari 1):
   - ✅ **Customer**: Bisa ditagih Invoice
   - ✅ **Vendor**: Bisa terima PO
   - ✅ **Agent**: Partner agent luar/dalam negeri
   - ✅ **Transporter**: Trucking/Airline/Shipping Line
5. Isi Payment Terms, Credit Limit, Bank Info (opsional)
6. **Simpan**

### 2. Filter Mitra by Role
- Di halaman Partner Management, gunakan dropdown filter (atas kanan):
  - Semua Role
  - Customer
  - Vendor
  - Agent
  - Transporter

### 3. Gunakan di Form Quotation/Shipment/Invoice
Nanti (akan diupdate):
- Form Quotation: Field "Customer" → diganti dengan **PartnerPicker** (roleFilter="customer")
- Form Shipment: Field "Vendor" → diganti dengan **PartnerPicker** (roleFilter="vendor")
- Form BL/AWB: 
  - Field "Shipper" → **PartnerPicker** (roleFilter="all") + Manual text input
  - Field "Consignee" → **PartnerPicker** (roleFilter="all") + Manual text input

---

## ⚠️ Breaking Changes & Mitigasi

### Tidak Ada Breaking Changes (Backward Compatible!)
- Tabel lama (`blink_customers`, `blink_vendors`) **tidak dihapus**
- Kolom lama (`customer_id`, `vendor_id`) **masih ada**, hanya ditambah kolom baru
- Views legacy tersedia untuk kompatibilitas

### Next Steps (Update Bertahap)
Nanti kita perlu update form-form berikut untuk menggunakan `partner_id` instead of `customer_id`:
- [ ] QuotationManagement.jsx → Ganti customer picker dengan PartnerPicker
- [ ] ShipmentManagement.jsx → Ganti customer/vendor picker dengan PartnerPicker
- [ ] InvoiceManagement.jsx → Ganti customer picker dengan PartnerPicker
- [ ] BLManagement.jsx & AWBManagement.jsx → Tambah "Load from Partner" button

---

## 📊 Benefit Migrasi Ini

1. **Tidak Duplikat Data**: PT XYZ yang jadi Customer dan Vendor sekaligus hanya 1 record
2. **Mudah Tracking Hutang-Piutang**: Net balance bisa dilihat langsung
3. **Fleksibel untuk Dokumen**: Shipper/Consignee bisa dipilih dari database mitra tanpa ketik ulang
4. **Scalable**: Mudah tambah role baru di masa depan (e.g. is_forwarder, is_customs_broker)

---

## 🐛 Troubleshooting

### Error: "relation blink_business_partners does not exist"
→ Migration belum dijalankan. Run file `007_create_business_partners.sql` di Supabase SQL Editor

### Partner Code tidak auto-generate
→ Cek apakah trigger `trigger_generate_partner_code` sudah terinstall:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_generate_partner_code';
```

### Filter by role tidak bekerja
→ Pastikan field `is_customer`, `is_vendor`, dll sudah dicentang saat create partner

---

## 📞 Support
Jika ada issue, check log di:
- Browser Console (F12)
- Supabase Dashboard → Logs

---

**Status**: ✅ Migration Ready (Belum dijalankan di DB Production)
**Tanggal**: 2026-01-26
**Author**: Antigravity AI Assistant
