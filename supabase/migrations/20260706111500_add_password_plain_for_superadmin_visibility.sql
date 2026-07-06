-- Add plain password column for operational visibility in superadmin user management.
-- NOTE: This is intentionally plaintext per product requirement.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS password_plain TEXT;

COMMENT ON COLUMN public.users.password_plain IS
'Plaintext active password shown in superadmin UI by business request (no email server flow).';
