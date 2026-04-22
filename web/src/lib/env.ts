/**
 * Public API base URL (browser + server). Example: `https://your-api.vercel.app/api` (no trailing slash).
 *
 * **Prefer leaving this unset** in production: `apiFetch` then uses same-origin `/api`, and your Next.js
 * project should set **`BACKEND_PROXY_ORIGIN`** so `next.config.ts` rewrites `/api/*` to the API deployment.
 * That avoids browser → API cross-origin requests (no CORS surface, cookies behave predictably).
 *
 * If you set `NEXT_PUBLIC_API_BASE_URL`, it still applies on the **server** (SSR). In the **browser**, `apiFetch`
 * uses same-origin `/api/...` so Next.js rewrites avoid CORS; unset `NEXT_PUBLIC_API_BASE_URL` if you only need SSR to hit the API directly.
 */
export function getApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

/** Server/build: set when `next.config` will proxy `/api` to `BACKEND_PROXY_ORIGIN`. */
export function hasBackendProxyOrigin(): boolean {
  return Boolean(process.env.BACKEND_PROXY_ORIGIN?.trim());
}

