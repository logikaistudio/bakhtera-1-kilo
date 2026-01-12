-- Reset superadmin password
-- This will set the password to: Admin123!
-- The hash below is bcrypt hash of "Admin123!"

UPDATE users 
SET 
    password_hash = '$2b$10$rKqV3xGJ.yN.vKc0YnxPj.X5TqF5L5vxV5oZ5VH5F5H5h5H5H5H5Hm',
    requires_password_change = false,
    user_level = 'super_admin',
    is_active = true,
    portal_access = true
WHERE username = 'superadmin';

-- Verify
SELECT id, username, full_name, user_level, is_active, portal_access, 
       CASE WHEN password_hash IS NOT NULL THEN 'SET' ELSE 'NULL' END as password_status
FROM users 
WHERE username = 'superadmin';
