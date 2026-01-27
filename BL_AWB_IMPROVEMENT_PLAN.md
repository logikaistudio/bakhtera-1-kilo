# BL/AWB Document Improvement Plan

## Overview
Tujuan dari rencana ini adalah meningkatkan kualitas output dokumen Bill of Lading (BL) dan Air Waybill (AWB) agar sesuai dengan standar industri (seperti referensi foto fisik) dan mengintegrasikannya dengan Master Data Customer/Vendor yang sudah ada.

## Phase 1: Database Schema Enhancement
Untuk menghasilkan dokumen yang lengkap, kita perlu menambahkan kolom khusus pada tabel `blink_shipments` untuk menyimpan detail "statis" dokumen. Data ini akan di-copy dari Master Data saat pembuatan, namun bisa diedit manual per dokumen tanpa mengubah Master Data.

### New Columns for `blink_shipments`
**Parties (Pihak Terkait)**
- `bl_shipper_name` (Text) - Nama Shipper (Auto-fill dari Customer/Vendor)
- `bl_shipper_address` (Text Area) - Alamat lengkap Shipper untuk cetak
- `bl_consignee_name` (Text) - Nama Consignee
- `bl_consignee_address` (Text Area) - Alamat lengkap Consignee
- `bl_notify_party_name` (Text) - Pihak yang diberitahu (Notify Party)
- `bl_notify_party_address` (Text Area) - Alamat Notify Party

**Routing & References**
- `bl_export_references` (Text) - Referensi Eksportir / Invoice No
- `bl_forwarding_agent_ref` (Text) - Referensi Forwarder
- `bl_point_of_origin` (Text) - Tempat asal barang
- `bl_pre_carriage_by` (Text) - Transportasi awal (Truck/Feeder)
- `bl_place_of_receipt` (Text) - Tempat penerimaan barang
- `bl_place_of_delivery` (Text) - Tempat penyerahan akhir
- `bl_loading_pier` (Text) - Terminal/Pier muat

**Cargo Particulars**
- `bl_marks_numbers` (Text Area) - Marks & Numbers pada kemasan
- `bl_description_packages` (Text Area) - Deskripsi detail barang
- `bl_gross_weight_text` (Text) - Berat kotor (dengan satuan)
- `bl_measurement_text` (Text) - Volume (dengan satuan)
- `bl_total_packages_text` (Text) - Jumlah paket dalam huruf (e.g. "ONE PALLET ONLY")

**Footer Details**
- `bl_freight_payable_at` (Text) - Tempat pembayaran freight
- `bl_number_of_originals` (Text) - Jumlah BL Original (e.g. "KOOS", "THREE")
- `bl_issued_place` (Text) - Tempat issue BL (e.g. "JAKARTA")
- `bl_issued_date` (Date) - Tanggal issue

## Phase 2: Logic Integration (Auto-Fill)
Mengembangkan logika auto-fill saat user membuat Shipment atau saat membuka menu Edit BL pertama kali:

1.  **Export Job**:
    *   `bl_shipper` ← Mengambil Data Customer
    *   `bl_consignee` ← Mengambil Data Consignee (Input Manual / Master Mitra Luar Negeri)
2.  **Import Job**:
    *   `bl_shipper` ← Mengambil Data Vendor/Agent Luar
    *   `bl_consignee` ← Mengambil Data Customer
3.  **Address Parsing**: Menggabungkan field `address`, `city`, `country` dari Master Data menjadi format multi-line yang rapi untuk kolom address BL.

## Phase 3: UI Enhancement (BL Editor)
Update `BLManagement.jsx` dengan "Document Editor Modal" yang lebih komprehensif.

**Layout Editor Modal:**
*   **Tab 1: Header Info**: BL No, References, Dates.
*   **Tab 2: Parties**: Form input Shipper, Consignee, Notify Party (Nama & Alamat Text Area).
*   **Tab 3: Routing**: Port details, Vessel, Pre-carriage, Final Destination.
*   **Tab 4: Cargo**: Description, Marks & Numbers, Weight/Volume.
*   **Preview Button**: Tombol untuk melihat preview cetak langsung.

## Phase 4: Print Engine (CSS/HTML Refactor)
Menulis ulang fungsi `generateBLPrintHTML` di `src/utils/printUtils.js`.

**Technical Approach:**
*   Menggunakan **CSS Grid** / **Table Layout** untuk mereplikasi struktur kotak-kotak (Box Layout) standar form BL.
*   Membuat class CSS `.bl-box` dengan border hitam tipis untuk setiap segmen.
*   Mengatur font menggunakan `Courier New` atau `Arial Narrow` ukuran 9-10pt untuk kepadatan informasi yang mirip dokumen asli.
*   **Footer**: Menambahkan area tanda tangan Shipper dan Carrier sesuai foto.

## Action Plan Sequence
1.  **Migration**: Jalankan script SQL untuk menambah kolom di database.
2.  **Backend Logic**: Update query fetch di `BLManagement.jsx` agar mengambil kolom baru.
3.  **UI Update**: Update form modal untuk menampung input baru.
4.  **Print Update**: Implementasi layout cetak baru sesuai foto.
