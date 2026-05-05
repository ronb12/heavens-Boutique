import { getDb } from '../../../lib/db.js';
import { requireUser, requireStoreAccess, PERM } from '../../../lib/auth.js';
import { json, handleCors, withCorsContext } from '../../../lib/http.js';

async function handler(req, res) {
  if (handleCors(req, res)) return;
  const conversationId = req.query?.id;
  if (!conversationId) return json(res, 400, { error: 'Missing conversation id' });

  const sql = getDb();

  try {
    if (req.method !== 'DELETE') {
      return json(res, 405, { error: 'Method not allowed' });
    }

    const auth = requireUser(req);
    if (auth.error) return json(res, auth.status, { error: auth.error });

    const teamGate = await requireStoreAccess(req, PERM.CUSTOMERS);
    const isTeam = !teamGate.error;

    const conv = await sql`SELECT id, user_id FROM conversations WHERE id = ${conversationId} LIMIT 1`;
    const c = conv[0];
    if (!c) return json(res, 404, { error: 'Not found' });
    if (c.user_id !== auth.userId && !isTeam) {
      return json(res, 403, { error: 'Forbidden' });
    }

    await sql`DELETE FROM conversations WHERE id = ${conversationId}`;
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
export default withCorsContext(handler);
