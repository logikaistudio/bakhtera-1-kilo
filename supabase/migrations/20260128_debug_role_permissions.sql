-- Debug and Clean role_permissions table
-- Run this in Supabase SQL Editor to verify and clean duplicate data

-- 1. Check current roles in role_permissions
SELECT 'Current Roles in role_permissions:' as info;
SELECT DISTINCT role_id, role_label, COUNT(*) as menu_count
FROM role_permissions
GROUP BY role_id, role_label
ORDER BY role_id;

-- 2. Check for inconsistent role_label for same role_id
SELECT 'Roles with inconsistent labels (if any):' as info;
SELECT role_id, 
       COUNT(DISTINCT role_label) as label_count,
       array_agg(DISTINCT role_label) as labels
FROM role_permissions
GROUP BY role_id
HAVING COUNT(DISTINCT role_label) > 1
ORDER BY role_id;

-- 3. If you found inconsistencies, standardize role_label
-- This will update all entries for each role to use the first (oldest) label
UPDATE role_permissions rp
SET role_label = (
    SELECT role_label 
    FROM role_permissions 
    WHERE role_id = rp.role_id 
    ORDER BY created_at ASC 
    LIMIT 1
)
WHERE role_id IN (
    SELECT role_id
    FROM role_permissions
    GROUP BY role_id
    HAVING COUNT(DISTINCT role_label) > 1
);

-- 4. Verify the fix
SELECT 'After standardization:' as info;
SELECT role_id, role_label, COUNT(*) as menu_count
FROM role_permissions
GROUP BY role_id, role_label
ORDER BY role_id;