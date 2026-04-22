import { getDb } from '../lib/db.js';
import { json, readJson, handleCors } from '../lib/http.js';
import { optionalUser } from '../lib/auth.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const auth = optionalUser(req);
  try {
    const body = await readJson(req);
    const event = String(body.event || '').trim();
    const props = body.props && typeof body.props === 'object' ? body.props : {};
    const path = body.path != null ? String(body.path).slice(0, 500) : null;

    if (!event) return json(res, 400, { error: 'event is required' });

    // Always log (useful even without DB table).
    console.log('web_event', {
      event,
      userId: auth.userId || null,
      path,
      props,
    });

    // Optional DB persistence if a table exists.
    try {
      const sql = getDb();
      await sql`
        INSERT INTO web_events (user_id, event, path, props)
        VALUES (${auth.userId || null}, ${event}, ${path}, ${JSON.stringify(props)}::jsonb)
      `;
    } catch (e) {
      if (e?.code !== '42P01') console.error('web_events insert', e);
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}

