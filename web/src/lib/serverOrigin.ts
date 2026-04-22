/**
 * Absolute origin for server-side `fetch` (RSC, route handlers). The browser uses same-origin `/api/*`
 * with Next.js rewrites; Node has no relative URL base unless we supply it.
 *
 * Prefer `BACKEND_PROXY_ORIGIN` so SSR hits the API deployment directly when the web app proxies `/api`.
 */
export function getServerSideApiBaseUrl(): string {
  const backend = process.env.BACKEND_PROXY_ORIGIN?.trim().replace(/\/+$/, "");
  if (backend) return backend;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (site) return site;

  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://127.0.0.1:3000";
}
