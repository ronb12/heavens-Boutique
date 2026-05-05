import { resolveBackendOrigin } from "@/lib/backendOrigin";

/**
 * Absolute origin for server-side `fetch` (RSC, route handlers). The browser uses same-origin `/api/*`
 * with Next.js rewrites; Node has no relative URL base unless we supply it.
 *
 * Uses `BACKEND_PROXY_ORIGIN` or derives from `NEXT_PUBLIC_API_BASE_URL` (see `backendOrigin.ts`).
 */
export function getServerSideApiBaseUrl(): string {
  const backend = resolveBackendOrigin();
  if (backend) return backend;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (site) return site;

  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://127.0.0.1:3000";
}
