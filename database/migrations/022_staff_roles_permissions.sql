-- Staff accounts: role=staff + granular JSON permissions.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'admin', 'staff'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN users.staff_permissions IS 'When role=staff: permission flags (orders, products, …). Ignored for admin.';
COMMENT ON COLUMN users.staff_active IS 'When role=staff: false deactivates admin/staff login without deleting the user.';
