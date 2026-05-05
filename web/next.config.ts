import type { NextConfig } from "next";
import { resolveBackendOrigin } from "./src/lib/backendOrigin";

/**
 * Same-origin `/api/*` → Node API when `BACKEND_PROXY_ORIGIN` or `NEXT_PUBLIC_API_BASE_URL`
 * is set for this project (see `src/lib/backendOrigin.ts`).
 *
 * On Vercel, set one of those for **Production** and **Preview**, then **redeploy** so
 * build-time rewrites and serverless routes see the values.
 */
const backendOrigin = resolveBackendOrigin();

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  /**
   * Do not use global middleware to strip every trailing `/` — that can cause
   * ERR_TOO_MANY_REDIRECTS (308) on Vercel when combined with the platform
   * canonicalizing URLs. A single 307 (permanent: false) for the admin entry
   * is enough for API/proxy links that use `/admin/`.
   */
  async redirects() {
    return [{ source: "/admin/", destination: "/admin", permanent: false }];
  },
  async rewrites() {
    if (!backendOrigin) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
