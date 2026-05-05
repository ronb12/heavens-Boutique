/**
 * Job titles the store owner can assign when adding staff. Keep in sync with web + iOS pickers
 * (list is also returned from GET /admin/staff as `titleOptions`).
 */
export const STAFF_TITLE_OPTIONS = [
  'Sales associate',
  'Stylist',
  'Assistant manager',
  'Store manager',
  'Visual merchandising',
  'Customer service',
  'Operations & inventory',
  'Other',
];

const set = new Set(STAFF_TITLE_OPTIONS);

/**
 * @param {unknown} raw
 * @returns {{ value: string | null } | { error: string }}
 */
export function normalizeStaffTitleInput(raw) {
  if (raw == null) return { value: null };
  const t = String(raw).trim();
  if (!t) return { value: null };
  if (!set.has(t)) return { error: 'Invalid staff title' };
  return { value: t };
}
