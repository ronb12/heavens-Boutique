import { hasConfiguredApiOrigin } from "@/lib/backendOrigin";

/**
 * Public API base URL (browser + server). Example: `https://your-api.vercel.app/api` (no trailing slash).
 *
 * **Prefer leaving this unset** in production: `apiFetch` then uses same-origin `/api`, and your Next.js
 * project should set **`BACKEND_PROXY_ORIGIN`** so `next.config.ts` rewrites `/api/*` to the API deployment.
 * That avoids browser → API cross-origin requests (no CORS surface, cookies behave predictably).
 *
 * You may set **`NEXT_PUBLIC_API_BASE_URL`** instead of (or as well as) `BACKEND_PROXY_ORIGIN`; both are
 * honored for rewrites, the `/api` proxy, and SSR (see `backendOrigin.ts`).
 */
export function getApiBaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (!v) return "";
  return v.replace(/\/+$/, "");
}

/** True when the API deployment can be resolved from env (either variable). */
export function hasBackendProxyOrigin(): boolean {
  return hasConfiguredApiOrigin();
}

