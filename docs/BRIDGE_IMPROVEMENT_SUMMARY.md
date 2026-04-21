# Bridge Module Improvement Summary

## Overview
Updated the Bridge Module's **Pengajuan Management** to utilize the new centralized **Bridge Business Partners** system for Customer and Shipper selection.

## Changes
### 1. Data Context Integration
- Updated `src/pages/Bridge/PengajuanManagement.jsx` to consume `bridgeBusinessPartners` from `useData()` context.
- This ensures the dropdowns are populated with data from the dedicated `bridge_business_partners` table rather than the legacy `freight_vendors` or `freight_customers`.

### 2. UI Updates in Pengajuan Management
- **Customer Dropdown (Pemilik Barang)**:
  - Now filters `bridgeBusinessPartners` by `is_customer`.
  - Uses `partner_name` for display and value.
- **Shipper Dropdown**:
  - Now filters `bridgeBusinessPartners` by `is_shipper` OR `is_vendor`.
  - This provides a more comprehensive list for inbound/outbound scenarios where shippers might be registered as vendors.

## Benefits
- **Centralized Management**: Partners are managed in one place (Bridge Business Partners) with specific roles (Customer, Vendor, Shipper, Consignee).
- **Consistency**: Ensures that the data used in applications matches the master data definitions.
- **Flexibility**: Partners can have multiple roles (e.g., a company can be both a Vendor and a Shipper), simplifying selection.

## Verification
- Navigate to **Bridge -> Manajemen Pengajuan**.
- Click **Buat Pengajuan Baru**.
- Check the **Pemilik Barang** dropdown: It should list partners marked as "Customer".
- Check the **Shipper** dropdown: It should list partners marked as "Shipper" or "Vendor".
