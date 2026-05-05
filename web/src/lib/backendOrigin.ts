/**
 * Resolve the deployed Node API **origin** (scheme + host, no path, no trailing slash).
 * Used by `next.config` rewrites, `/api` proxy routes, and SSR server fetches.
 */
export function resolveBackendOrigin(): string {
  const backend = process.env.BACKEND_PROXY_ORIGIN?.trim().replace(/\/+$/, "");
  if (backend) return backend;

  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!pub) return "";
  if (pub.toLowerCase().endsWith("/api")) return pub.slice(0, -4);
  return pub;
}

/** True when either env var supplies a usable API origin. */
export function hasConfiguredApiOrigin(): boolean {
  return Boolean(resolveBackendOrigin());
}

/**
 * Base URL for upstream fetches: `https://api-host/api` (no trailing slash).
 * Prefer this over duplicating BACKEND_PROXY vs NEXT_PUBLIC logic.
 */
export function resolveUpstreamApiBase(): string | null {
  const o = resolveBackendOrigin();
  if (o) return `${o.replace(/\/+$/, "")}/api`;
  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  return pub || null;
}
