import Stripe from 'stripe';
import { getStripeSecretKey } from './stripeCredentials.js';

/**
 * Ensure a Stripe Customer exists for a user, storing `users.stripe_customer_id`.
 * @param {import('@neondatabase/serverless').NeonQueryFunction} sql
 * @param {{ userId: string }} opts
 */
export async function ensureStripeCustomer(sql, { userId }) {
  const rows = await sql`SELECT id, email, stripe_customer_id FROM users WHERE id = ${userId} LIMIT 1`;
  const u = rows[0];
  if (!u) throw new Error('User not found');
  if (u.stripe_customer_id) return String(u.stripe_customer_id);

  const sk = await getStripeSecretKey(sql);
  if (!sk) throw new Error('Stripe not configured');
  const stripe = new Stripe(sk);

  const customer = await stripe.customers.create({
    email: u.email || undefined,
    metadata: { userId: String(userId) },
  });

  try {
    await sql`UPDATE users SET stripe_customer_id = ${customer.id}, updated_at = now() WHERE id = ${userId}`;
  } catch (e) {
    // allow continuation even if db write fails; customer exists in Stripe
    console.error('ensureStripeCustomer update', e);
  }
  return customer.id;
}

