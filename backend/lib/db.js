import { neon } from '@neondatabase/serverless';

let cached;

/** @returns {import('@neondatabase/serverless').NeonQueryFunction<boolean, boolean>} */
export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. In Vercel → heavens-boutique (API) → Settings → Environment Variables, add DATABASE_URL (Neon postgres connection string) for Production and Preview, then redeploy.',
    );
  }
  if (!cached) {
    cached = neon(process.env.DATABASE_URL);
  }
  return cached;
}
