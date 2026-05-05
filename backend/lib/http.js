import { AsyncLocalStorage } from 'node:async_hooks';

const httpRequestAsyncLocalStorage = new AsyncLocalStorage();

/** Wrap the Vercel handler so `json()` can resolve `Access-Control-Allow-Origin` from `Origin`. */
export function withCorsContext(handler) {
  return function corsWrapped(req, res, ...rest) {
    return httpRequestAsyncLocalStorage.run(req, () => handler(req, res, ...rest));
  };
}

function currentHttpRequest() {
  return httpRequestAsyncLocalStorage.getStore();
}

/** Prefer ALS (withCorsContext); fall back to Node's response.req when ALS didn't run (credentialed CORS needs a concrete Origin echo). */
function getReqForCors(res) {
  return currentHttpRequest() ?? res?.req ?? null;
}

const DEFAULT_CORS_ORIGINS = [
  'https://heavens-boutique-web-steel.vercel.app',
  'https://heavens-boutique.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/** Vercel deployments under this project slug (preview + prod hostnames). Set `CORS_ORIGINS` for custom domains. */
const VERCEL_HEAVENS_ORIGIN_RE = /^https:\/\/heavens-boutique[a-z0-9-]*\.vercel\.app$/i;

export function resolveCorsOrigin(req) {
  const fromList = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const single = process.env.CORS_ORIGIN?.trim();
  const allow = new Set([...DEFAULT_CORS_ORIGINS, ...fromList]);
  if (single && single !== '*') allow.add(single);

  const origin =
    req?.headers?.origin ??
    req?.headers?.Origin ??
    (typeof req?.headers?.get === 'function' ? req.headers.get('origin') : null);

  if (single === '*') return '*';

  // Browser sends Origin — echo it when allowed (required for Authorization header; * is invalid).
  if (origin) {
    if (allow.has(origin)) return origin;
    if (VERCEL_HEAVENS_ORIGIN_RE.test(origin)) return origin;
  }

  // Non-browser callers with no Origin header only
  if (single && single !== '*' && !origin) return single;

  return '*';
}

/** @param {Record<string, string | number | undefined | null>} [extraHeaders] */
export function json(res, status, body, extraHeaders) {
  const req = getReqForCors(res);
  const allowOrigin = resolveCorsOrigin(req);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (allowOrigin !== '*') res.setHeader('Vary', 'Origin');
  if (extraHeaders && typeof extraHeaders === 'object') {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v != null && v !== '') res.setHeader(k, String(v));
    }
  }
  res.end(JSON.stringify(body));
}

/** @param {{ maxChars?: number }} [opts] — default 2MB; image upload uses a higher cap (still bounded by Vercel ~4.5MB body). */
export function readJson(req, opts = {}) {
  const maxChars = opts.maxChars ?? 2_000_000;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > maxChars) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    const allowOrigin = resolveCorsOrigin(req);
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (allowOrigin !== '*') res.setHeader('Vary', 'Origin');
    res.end();
    return true;
  }
  return false;
}
