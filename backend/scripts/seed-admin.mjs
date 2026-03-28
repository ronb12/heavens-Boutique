#!/usr/bin/env node
/**
 * Upsert admin user (bcrypt hash matches backend/lib/auth.js — 10 rounds).
 * Usage:
 *   DATABASE_URL="postgresql://..." node scripts/seed-admin.mjs
 * Optional: ADMIN_EMAIL ADMIN_PASSWORD (defaults below for local bootstrap).
 */
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const email = (process.env.ADMIN_EMAIL || 'heavenbowie0913@gmail.com').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || 'password1234';

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const passwordHash = await bcrypt.hash(password, 10);

await sql`
  INSERT INTO users (email, password_hash, full_name, role)
  VALUES (${email}, ${passwordHash}, ${"Heaven's Boutique"}, ${'admin'})
  ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    updated_at = now()
`;

console.log(`Admin ready: ${email}`);
