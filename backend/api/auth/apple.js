import { getDb } from '../../lib/db.js';
import { signToken } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';
import { verifyAppleIdentityToken, syntheticEmailFromSub } from '../../lib/appleIdToken.js';
import { notifyAllAdmins } from '../../lib/adminNotify.js';

const AUDIENCE =
  process.env.APPLE_IOS_BUNDLE_ID || process.env.APPLE_CLIENT_ID || 'com.heavensboutique.app';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  try {
    const sql = getDb();
    const body = await readJson(req);
    const identityToken = String(body.identityToken || '').trim();
    const rawNonce = body.nonce != null ? String(body.nonce) : '';
    const fullNameFromClient = body.fullName ? String(body.fullName).trim() : null;

    if (!identityToken) {
      return json(res, 400, { error: 'identityToken required' });
    }

    let payload;
    try {
      payload = await verifyAppleIdentityToken(identityToken, {
        audience: AUDIENCE,
        rawNonce: rawNonce || undefined,
      });
    } catch (e) {
      console.error('apple token verify', e);
      return json(res, 401, { error: 'Invalid Apple identity token' });
    }

    const sub = payload.sub;
    if (!sub) {
      return json(res, 401, { error: 'Invalid Apple identity token' });
    }

    const emailFromToken = payload.email
      ? String(payload.email).trim().toLowerCase()
      : null;

    const adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const byApple = await sql`
      SELECT id, email, full_name, role, loyalty_points, apple_sub
      FROM users WHERE apple_sub = ${sub} LIMIT 1
    `;
    let user = byApple[0];

    if (user) {
      let role = user.role;
      const em = String(user.email || '').toLowerCase();
      if (adminEmails.includes(em) && role !== 'admin') {
        const promoted = await sql`
          UPDATE users SET role = 'admin', updated_at = now()
          WHERE id = ${user.id}
          RETURNING role
        `;
        role = promoted[0]?.role ?? 'admin';
      }
      const token = signToken({ sub: user.id, role });
      return json(res, 200, {
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role,
          loyaltyPoints: user.loyalty_points,
        },
      });
    }

    if (emailFromToken) {
      const byEmail = await sql`
        SELECT id, email, full_name, role, loyalty_points, apple_sub
        FROM users WHERE email = ${emailFromToken} LIMIT 1
      `;
      const row = byEmail[0];
      if (row) {
        if (row.apple_sub && row.apple_sub !== sub) {
          return json(res, 409, {
            error: 'This email is already linked to a different Apple ID.',
          });
        }
        const updated = await sql`
          UPDATE users
          SET apple_sub = ${sub},
              full_name = COALESCE(full_name, ${fullNameFromClient}),
              updated_at = now()
          WHERE id = ${row.id}
          RETURNING id, email, full_name, role, loyalty_points
        `;
        user = updated[0];
        let role = user.role;
        const em = String(user.email || '').toLowerCase();
        if (adminEmails.includes(em) && role !== 'admin') {
          const promoted = await sql`
            UPDATE users SET role = 'admin', updated_at = now()
            WHERE id = ${user.id}
            RETURNING role
          `;
          role = promoted[0]?.role ?? 'admin';
        }
        const token = signToken({ sub: user.id, role });
        return json(res, 200, {
          token,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.full_name,
            role,
            loyaltyPoints: user.loyalty_points,
          },
        });
      }
    }

    const email = emailFromToken || syntheticEmailFromSub(sub);
    const role =
      emailFromToken && adminEmails.includes(emailFromToken) ? 'admin' : 'customer';

    try {
      const inserted = await sql`
        INSERT INTO users (email, password_hash, full_name, role, apple_sub)
        VALUES (${email}, NULL, ${fullNameFromClient}, ${role}, ${sub})
        RETURNING id, email, full_name, role, loyalty_points
      `;
      user = inserted[0];
    } catch (e) {
      if (e.code === '23505') {
        return json(res, 409, {
          error: 'Unable to create account — try signing in with email.',
        });
      }
      throw e;
    }

    const token = signToken({ sub: user.id, role: user.role });

    if (user.role === 'customer') {
      try {
        const label = [fullNameFromClient, email].filter(Boolean).join(' · ') || email;
        await notifyAllAdmins(sql, {
          title: 'New customer signup',
          body: `${label} (Apple)`,
          data: { kind: 'new_signup', userId: String(user.id) },
        });
      } catch (e) {
        console.error('admin signup notify', e);
      }
    }

    return json(res, 201, {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        loyaltyPoints: user.loyalty_points,
      },
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Apple sign-in failed' });
  }
}
