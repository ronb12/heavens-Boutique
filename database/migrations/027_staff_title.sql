-- Optional job title for staff (chosen by store owner when inviting or editing).

ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_title TEXT;
COMMENT ON COLUMN users.staff_title IS 'When role=staff: display job title. Null for legacy or unset.';
