# Analisa Role Management Issues

## 🔴 Masalah yang Dilaporkan

1. **Gagal menambah item role/penugasan** - Selalu gagal saat menambah role baru
2. **Pilihan role tidak muncul** - Dropdown role kosong saat mengubah role user

---

## 📊 Root Cause Analysis

### ⚠️ Masalah #1: Gagal Menambah Role (RolePermissions.jsx)

**Lokasi:** [src/pages/Admin/RolePermissions.jsx](src/pages/Admin/RolePermissions.jsx#L340-L360)

**Kode Bermasalah:**
```javascript
const addRole = async () => {
    // ... validation ...
    try {
        const rows = Object.keys(newPerms).map(menuCode => ({
            role_id: id,
            role_label: trimmed,
            menu_code: menuCode,
            ...DEFAULT_PERMS(),
            updated_at: new Date().toISOString()
        }));
        const { error } = await supabase
            .from('role_permissions')
            .upsert(rows, { onConflict: 'role_id,menu_code', ignoreDuplicates: false });
        if (error) throw error;
        setNotification({ type: 'success', message: `Role "${trimmed}" berhasil ditambahkan & disimpan!` });
    } catch (err) {
        // ❌ BUG: Menampilkan success meski error!
        setNotification({ type: 'success', message: `Role "${trimmed}" ditambahkan (belum tersimpan ke DB — klik Simpan).` });
        console.warn('addRole DB error:', err.message);
    }
};
```

**Masalah:**
- ❌ Error notification menampilkan "success" meski terjadi error
- ❌ Error message hanya di console, user tidak tahu apa masalahnya
- ❌ Tidak ada informasi yang jelas tentang penyebab kegagalan
- ⚠️ Mungkin RLS policy tidak mengizinkan INSERT atau UPDATE
- ⚠️ Possible constraint violation atau data type mismatch

**Penyebab Kemungkinan:**
1. **RLS Policy terlalu restrictive** - role_permissions table RLS policy mungkin tidak mengizinkan authenticated user untuk INSERT
2. **Batch insert error** - Jika ada constraint violation pada salah satu row, seluruh batch gagal
3. **Missing required fields** - Ada field yang required tapi tidak dikirim

---

### ⚠️ Masalah #2: Role Tidak Muncul di Dropdown

**Lokasi 1:** [src/pages/Admin/UserManagement.jsx](src/pages/Admin/UserManagement.jsx#L52-L94)

**Kode Bermasalah:**
```javascript
const loadRoles = async () => {
    try {
        const { data, error } = await supabase
            .from('role_permissions')
            .select('role_id, role_label')
            .order('role_id')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('Could not load roles:', error.message);
            // ❌ Fallback ke hardcoded roles — user tidak tahu apa masalahnya
            setAvailableRoles([
                { id: 'super_admin', label: 'Super Admin' },
                { id: 'direksi', label: 'Direksi' },
                // ... hardcoded roles ...
            ]);
            return;
        }

        // ❌ ISSUE: Query akan return MULTIPLE rows per role_id
        // Karena ada multiple menu_code per role_id di tabel
        const roleMap = new Map();
        roleMap.set('super_admin', 'Super Admin');
        
        (data || []).forEach(d => {
            if (!roleMap.has(d.role_id)) {
                const label = d.role_label?.trim() || d.role_id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                roleMap.set(d.role_id, label);
            }
        });

        const roles = Array.from(roleMap, ([id, label]) => ({ id, label })).sort(...);
        setAvailableRoles(roles);
    } catch (err) {
        console.warn('loadRoles error:', err.message);
    }
};
```

**Masalah:**
- ❌ Query SELECT akan return multiple rows per role_id (1 row per menu_code per role)
- ❌ Jika query gagal, fallback ke hardcoded roles tanpa notifikasi error
- ❌ Tidak ada error message yang jelas untuk debugging
- ⚠️ RLS policy mungkin membatasi SELECT untuk role tertentu
- ⚠️ `order('role_id')` dan `order('created_at')` mungkin tidak bekerja seperti yang diharapkan

**Lokasi 2:** [src/pages/Admin/UserPermissionAssignment.jsx](src/pages/Admin/UserPermissionAssignment.jsx#L68-L85)

**Kode Serupa dengan Masalah yang Sama**

---

### 🎯 Root Cause yang Paling Mungkin

#### **1. RLS (Row Level Security) Policy Terlalu Restrictive**

**File:** [supabase/migrations/20260128_fix_role_permissions_rls.sql](supabase/migrations/20260128_fix_role_permissions_rls.sql)

**RLS Policy Saat Ini:**
```sql
-- Policy 1: Allow authenticated users to SELECT
CREATE POLICY "Allow authenticated users to read role permissions" ON role_permissions
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy 2: Allow super admin to INSERT
CREATE POLICY "Allow super admin to insert role permissions" ON role_permissions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.user_level = 'super_admin'
        )
    );

-- Policy 3: Allow super admin to UPDATE
-- ... similar ...

-- Policy 4: Allow super admin to DELETE
-- ... similar ...
```

**Masalah:**
- ❌ SELECT policy menggunakan `auth.role() = 'authenticated'` tapi user tidak login via Supabase Auth
- ❌ INSERT/UPDATE/DELETE memerlukan user di tabel `users` dengan `user_level = 'super_admin'`
- ❌ Tabel `role_permissions` tidak ada kolom `user_id` atau ownership
- ❌ Policies referencing `users` table mungkin tidak cocok dengan auth context

#### **2. Query Tidak Optimal**

Query `select('role_id, role_label')` dari `role_permissions` table akan return:
```
| role_id | role_label | menu_code    |
|---------|------------|--------------|
| direksi | Direksi    | bridge_dash  |
| direksi | Direksi    | bridge_ata   |  ← Duplikat role_id
| direksi | Direksi    | bridge_inv   |  ← Duplikat role_id
| chief   | Chief      | bridge_dash  |
| chief   | Chief      | bridge_ata   |  ← Duplikat role_id
```

Sementara query hanya select 'role_id, role_label', Supabase tetap return semua rows.

**Solusi:** Gunakan `.distinct()` atau `GROUP BY` atau query langsung dari distinct role_id.

#### **3. Error Handling Tidak Jelas**

Ketika ada error:
- Error di-log ke console (developer tools)
- User tidak tahu apa masalahnya
- Fallback behavior tidak konsisten

---

## 🔧 Solusi yang Direkomendasikan

### **1. Perbaiki RLS Policies**

Ubah RLS policies menjadi lebih permissive untuk development, atau gunakan service role:

```sql
-- Option A: Allow public/authenticated access (for development)
DROP POLICY IF EXISTS "Allow authenticated users to read role permissions" ON role_permissions;
CREATE POLICY "Allow all to read role permissions" ON role_permissions
    FOR SELECT USING (true);

-- Option B: Use Supabase anon/service role (recommended)
-- Remove RLS policies yang require users table lookup
```

### **2. Optimasi Query loadRoles()**

```javascript
// ❌ Current (returns multiple rows per role)
const { data, error } = await supabase
    .from('role_permissions')
    .select('role_id, role_label');

// ✅ Better: Use DISTINCT or raw SQL
const { data, error } = await supabase.from('role_permissions')
    .select('role_id, role_label', { count: 'exact' })
    .order('role_id');
    
// Atau gunakan raw SQL untuk DISTINCT:
// SELECT DISTINCT ON (role_id) role_id, role_label FROM role_permissions ORDER BY role_id;
```

### **3. Perbaiki Error Handling**

```javascript
// ✅ Proper error handling
catch (err) {
    console.error('loadRoles error:', err);
    setNotification({ 
        type: 'error', 
        message: `Gagal memuat role: ${err.message}. Gunakan role default.` 
    });
    // Fallback ke default roles
    setAvailableRoles(DEFAULT_ROLES);
}
```

### **4. Fix addRole() Error Message**

```javascript
// ✅ Proper error handling
catch (err) {
    console.error('addRole DB error:', err);
    setNotification({ 
        type: 'error', 
        message: `Gagal menyimpan role: ${err.message}` 
    });
}
```

### **5. Database Configuration Check**

Pastikan:
- [ ] `role_permissions` table ada dan ter-seed dengan data default
- [ ] RLS policies tidak blocking SELECT/INSERT/UPDATE
- [ ] User yang login memiliki akses ke `role_permissions` table
- [ ] Kolom `created_at` dan `updated_at` ada di tabel

---

## 📋 Checklist Debugging

- [ ] Buka browser DevTools → Console tab
- [ ] Cek apakah ada error message saat membuka Manajemen Role atau Penugasan Role
- [ ] Coba buat role baru, lihat console error apa yang muncul
- [ ] Cek Supabase SQL Editor → run query: `SELECT COUNT(*) FROM role_permissions;`
- [ ] Pastikan ada data di `role_permissions` untuk default roles
- [ ] Cek RLS policies di Supabase dashboard → Security → Policies

---

## 📌 Next Steps

1. **Immediate Fix:** Update RLS policies untuk allow public/authenticated access
2. **Query Optimization:** Gunakan DISTINCT atau GROUP BY untuk loadRoles()
3. **Error Handling:** Perbaiki notification system untuk menampilkan error yang sebenarnya
4. **Testing:** Test create role, edit user role, verify dropdown muncul
5. **Documentation:** Update error messages untuk user-friendly

