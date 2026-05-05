import { handleCors, json, withCorsContext } from '../../lib/http.js';
import handleUpload from '../../lib/admin/routes/upload.js';
import handleReports from '../../lib/admin/routes/reports.js';
import handleOrdersPost from '../../lib/admin/routes/ordersPost.js';
import handleCustomersIndex from '../../lib/admin/routes/customersIndex.js';
import handleCustomersById from '../../lib/admin/routes/customersById.js';
import handleEasyPost from '../../lib/admin/routes/easypost.js';
import handleAdminReturns from '../../lib/admin/routes/returns.js';
import handleInventoryAudit from './inventory-audit.js';
import handleInventory from './inventory.js';
import handleHomepage from './homepage.js';
import handlePromoAnalytics from './promo-analytics.js';
import handleProductsCsv from './products-csv.js';
import handleProductImports from './product-imports.js';
import handlePurchaseOrders from './purchase-orders.js';
import handleContentPages from './content-pages.js';
import handleGiftCards from './gift-cards.js';
import handlePromos from './promos.js';
import handleStripeSettings from './stripe-settings.js';
import handleEasypostSettings from './easypost-settings.js';
import handleStaff from './staff.js';
import handleAdminStoreSettings from './store-settings.js';

/** First path segment after /api/admin or /admin — used when URL parsing is ambiguous. */
const ADMIN_ROUTE_HEADS = new Set([
  'upload',
  'reports',
  'orders',
  'customers',
  'promos',
  'promo-analytics',
  'products-csv',
  'product-imports',
  'easypost',
  'easypost-settings',
  'returns',
  'inventory',
  'inventory-audit',
  'homepage',
  'purchase-orders',
  'content-pages',
  'gift-cards',
  'stripe-settings',
  'store-settings',
  'staff',
]);

function normalizeSegments(query) {
  const raw = query?.segments ?? query?.slug ?? query?.path;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    return raw.includes('/') ? raw.split('/').filter(Boolean) : [raw];
  }
  return [String(raw)];
}

function pathnameCandidates(req) {
  const out = [];
  const push = (v) => {
    if (typeof v !== 'string' || !v.trim()) return;
    const pathOnly = v.split('?')[0].trim();
    if (pathOnly) out.push(pathOnly);
  };
  push(req.url);
  push(req.headers?.['x-vercel-original-url']);
  push(req.headers?.['x-invoke-path']);
  push(req.headers?.['x-forwarded-uri']);
  return out;
}

/** Catch-all sometimes receives `req.url` relative to the route (e.g. `/upload`), not `/api/admin/upload`. */
function segmentsFromUrl(req) {
  for (let raw of pathnameCandidates(req)) {
    try {
      let pathname = raw.startsWith('http') ? new URL(raw).pathname : raw;
      pathname = decodeURIComponent(pathname);
      if (!pathname.startsWith('/')) pathname = `/${pathname}`;

      // Prefer full admin prefixes (some proxies expose `/admin/...` without `/api`).
      for (const prefix of ['/api/admin/', '/admin/']) {
        if (pathname.startsWith(prefix)) {
          const rest = pathname.slice(prefix.length).replace(/\/+$/, '');
          if (rest) return rest.split('/').filter(Boolean);
          break;
        }
      }

      // Explicit: /api/admin/foo/bar as path segments
      const split = pathname.split('/').filter(Boolean);
      if (split[0] === 'api' && split[1] === 'admin' && split.length > 2) {
        return split.slice(2);
      }

      // Bare single segment (some runtimes): /gift-cards
      const leaf = pathname.replace(/^\/+|\/+$/g, '');
      if (leaf && !leaf.includes('/') && ADMIN_ROUTE_HEADS.has(leaf)) {
        return [leaf];
      }

      // Legacy tail: path starting with known admin route name
      const tail = pathname.replace(/^\/+/, '');
      if (tail) {
        const parts = tail.split('/').filter(Boolean);
        if (parts[0] && ADMIN_ROUTE_HEADS.has(parts[0])) return parts;
      }
    } catch {
      /* try next */
    }
  }
  return [];
}

async function handler(req, res) {
  const fromUrl = segmentsFromUrl(req);
  const segments = fromUrl.length > 0 ? fromUrl : normalizeSegments(req.query || {});
  const head = segments[0];

  if (!head) {
    if (handleCors(req, res)) return;
    return json(res, 404, { error: 'Not found' });
  }

  if (head === 'upload') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleUpload(req, res);
  }
  if (head === 'reports') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleReports(req, res);
  }
  if (head === 'orders') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleOrdersPost(req, res);
  }
  if (head === 'customers') {
    if (segments.length === 1) return handleCustomersIndex(req, res);
    if (segments.length === 2) {
      const prevQuery = { ...(req.query || {}) };
      req.query = { ...prevQuery, id: segments[1] };
      try {
        return await handleCustomersById(req, res);
      } finally {
        req.query = prevQuery;
      }
    }
    if (handleCors(req, res)) return;
    return json(res, 404, { error: 'Not found' });
  }

  if (head === 'easypost') {
    return handleEasyPost(req, res, segments);
  }

  if (head === 'easypost-settings') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleEasypostSettings(req, res);
  }

  if (head === 'stripe-settings') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleStripeSettings(req, res);
  }

  if (head === 'store-settings') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleAdminStoreSettings(req, res);
  }

  if (head === 'promos') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handlePromos(req, res);
  }

  if (head === 'returns') {
    return handleAdminReturns(req, res, segments);
  }

  if (head === 'inventory') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleInventory(req, res);
  }

  if (head === 'inventory-audit') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleInventoryAudit(req, res);
  }

  if (head === 'homepage') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleHomepage(req, res);
  }

  if (head === 'promo-analytics') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handlePromoAnalytics(req, res);
  }

  if (head === 'products-csv') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleProductsCsv(req, res);
  }

  if (head === 'product-imports') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleProductImports(req, res);
  }

  if (head === 'purchase-orders') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handlePurchaseOrders(req, res);
  }

  if (head === 'content-pages') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleContentPages(req, res);
  }

  if (head === 'gift-cards') {
    if (segments.length < 1 || segments.length > 3) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleGiftCards(req, res, segments);
  }

  if (head === 'staff') {
    if (segments.length !== 1) {
      if (handleCors(req, res)) return;
      return json(res, 404, { error: 'Not found' });
    }
    return handleStaff(req, res);
  }

  if (handleCors(req, res)) return;
  return json(res, 404, { error: 'Not found' });
}
export default withCorsContext(handler);
