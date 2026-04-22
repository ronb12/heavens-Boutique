import { getDb } from '../lib/db.js';
import { json, handleCors } from '../lib/http.js';

/**
 * GET /api/pages — public CMS.
 * ?slug=about — single published page/post
 * no slug — lists published pages + blog posts (titles/slugs only)
 */
export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const sql = getDb();
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const slug = url.searchParams.get('slug');

    if (slug) {
      const rows = await sql`
        SELECT id, slug, title, body, excerpt, kind, published_at, updated_at
        FROM content_pages
        WHERE slug = ${String(slug).trim().toLowerCase()}
          AND published = true
        LIMIT 1
      `;
      const p = rows[0];
      if (!p) return json(res, 404, { error: 'Not found' });
      return json(res, 200, {
        page: {
          id: p.id,
          slug: p.slug,
          title: p.title,
          body: p.body,
          excerpt: p.excerpt,
          kind: p.kind,
          publishedAt: p.published_at,
          updatedAt: p.updated_at,
        },
      });
    }

    const pages = await sql`
      SELECT slug, title, excerpt, kind, published_at
      FROM content_pages
      WHERE published = true AND kind = 'page'
      ORDER BY title ASC
    `;
    const posts = await sql`
      SELECT slug, title, excerpt, kind, published_at
      FROM content_pages
      WHERE published = true AND kind = 'blog'
      ORDER BY published_at DESC NULLS LAST
      LIMIT 50
    `;

    return json(res, 200, {
      pages: pages.map((r) => ({
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        publishedAt: r.published_at,
      })),
      posts: posts.map((r) => ({
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        publishedAt: r.published_at,
      })),
    });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: 'Request failed' });
  }
}
