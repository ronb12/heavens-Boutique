#!/usr/bin/env node
/**
 * End-to-end check: POST /api/admin/upload with a 1×1 PNG.
 *
 * Requires (same as API runtime):
 *   DATABASE_URL, JWT_SECRET — to mint a Bearer for a real admin row
 * Optional:
 *   API_BASE_URL — default https://heavens-boutique.vercel.app/api
 *
 * Storage: HTTP 200 when the deployment has Vercel Blob (`BLOB_READ_WRITE_TOKEN`) or Cloudinary env.
 *
 * Usage (from backend/, with .env loaded):
 *   export $(grep -v '^#' .env | xargs)  # or: set -a; source .env; set +a
 *   node scripts/test-admin-upload.mjs
 */
import { neon } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const BASE = (process.env.API_BASE_URL || 'https://heavens-boutique.vercel.app/api').replace(/\/$/, '');

async function main() {
  if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL — cannot resolve admin user or mint matching JWT.');
    process.exit(2);
  }

  const sql = neon(DATABASE_URL);
  const rows = await sql`SELECT id FROM users WHERE role = ${'admin'} LIMIT 1`;
  const adminId = rows[0]?.id;
  if (!adminId) {
    console.error('No user with role=admin in database.');
    process.exit(2);
  }

  const token = jwt.sign({ sub: adminId, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
  const url = `${BASE}/admin/upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64: TINY_PNG_B64 }),
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  console.log('POST', url);
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(json, null, 2));

  if (res.status === 200 && json.url) {
    console.log('\nOK — upload returned a URL (admin image upload path works end-to-end).');
    process.exit(0);
  }

  if (res.status === 503 && String(json.error || '').includes('not configured')) {
    console.log('\nPartial OK — auth and validation passed on server, but Blob/Cloudinary env is missing on that deployment.');
    process.exit(3);
  }

  if (res.status === 401 || res.status === 403) {
    console.error('\nFail — JWT/role mismatch. Use JWT_SECRET that matches the API deployment.');
    process.exit(1);
  }

  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
