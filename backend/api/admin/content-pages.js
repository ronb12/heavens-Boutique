import { getDb } from '../../lib/db.js';
import { requireAdmin } from '../../lib/auth.js';
import { json, readJson, handleCors } from '../../lib/http.js';

function slugify(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    const auth = await requireAdmin(req);
    if (auth.error) return json(res, auth.status, { error: auth.error });

    const sql = getDb();
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT id, slug, title, body, excerpt, kind, published, published_at, created_at, updated_at
        FROM content_pages
        ORDER BY updated_at DESC
        LIMIT 200
      `;
      return json(res, 200, {
        items: rows.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          body: r.body,
          excerpt: r.excerpt,
          kind: r.kind,
          published: r.published,
          publishedAt: r.published_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      });
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      let slug = slugify(body.slug || body.title);
      if (!slug) return json(res, 400, { error: 'slug or title required' });
      const title = String(body.title || '').trim().slice(0, 300);
      if (!title) return json(res, 400, { error: 'title required' });
      const kind = body.kind === 'blog' ? 'blog' : 'page';
      const published = Boolean(body.published);
      const bodyText = body.body != null ? String(body.body) : '';
      const excerpt = body.excerpt != null ? String(body.excerpt).slice(0, 500) : null;

      const dup = await sql`SELECT id FROM content_pages WHERE slug = ${slug} LIMIT 1`;
      if (dup[0]) return json(res, 409, { error: 'Slug already in use' });

      const ins = await sql`
        INSERT INTO content_pages (slug, title, body, excerpt, kind, published, published_at)
        VALUES (
          ${slug},
          ${title},
          ${bodyText},
          ${excerpt},
          ${kind},
          ${published},
          ${published ? new Date() : null}
        )
        RETURNING id
      `;
      return json(res, 201, { id: ins[0].id, slug });
    }

    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const id = String(body.id || '').trim();
      if (!id) return json(res, 400, { error: 'id required' });

      const rows = await sql`SELECT * FROM content_pages WHERE id = ${id} LIMIT 1`;
      const existing = rows[0];
      if (!existing) return json(res, 404, { error: 'Not found' });

      let slug = existing.slug;
      if (body.slug != null) {
        slug = slugify(body.slug);
        if (!slug) return json(res, 400, { error: 'invalid slug' });
        const clash = await sql`
          SELECT id FROM content_pages WHERE slug = ${slug} AND id <> ${id} LIMIT 1
        `;
        if (clash[0]) return json(res, 409, { error: 'Slug already in use' });
      }

      const title = body.title != null ? String(body.title).trim().slice(0, 300) : existing.title;
      const bodyText = body.body != null ? String(body.body) : existing.body;
      const excerpt = body.excerpt !== undefined ? (body.excerpt ? String(body.excerpt).slice(0, 500) : null) : existing.excerpt;
      const kind = body.kind === 'blog' ? 'blog' : body.kind === 'page' ? 'page' : existing.kind;
      const published =
        body.published !== undefined ? Boolean(body.published) : existing.published;

      let publishedAt = existing.published_at;
      if (body.published !== undefined) {
        if (published && !existing.published_at) publishedAt = new Date();
        if (!published) publishedAt = null;
      }

      await sql`
        UPDATE content_pages SET
          slug = ${slug},
          title = ${title},
          body = ${bodyText},
          excerpt = ${excerpt},
          kind = ${kind},
          published = ${published},
          published_at = ${publishedAt},
          updated_at = now()
        WHERE id = ${id}
      `;
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const id = url.searchParams.get('id');
      if (!id) return json(res, 400, { error: 'id query required' });
      await sql`DELETE FROM content_pages WHERE id = ${id}`;
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('DATABASE_URL')) {
      return json(res, 500, { error: 'Server misconfigured: database URL missing.' });
    }
    const missingRelation =
      e?.code === '42P01' || /relation ["']?content_pages["']? does not exist/i.test(msg);
    if (missingRelation) {
      return json(res, 500, {
        error: 'Database missing content_pages table. Run migration 018_gift_cards_content_pages.sql.',
      });
    }
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
