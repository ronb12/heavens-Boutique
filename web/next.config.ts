import type { NextConfig } from "next";

/**
 * Same-origin `/api/*` → Node API when BACKEND_PROXY_ORIGIN is set for this project.
 * Enable that variable for **Production** and **Preview**, and include it in **Build**
 * so rewrites are applied during `next build` on Vercel.
 *
 * Route handlers under `src/app/api/**` still proxy via fetch when rewrites are absent;
 * set BACKEND_PROXY_ORIGIN or NEXT_PUBLIC_API_BASE_URL there too.
 */
const backendOrigin = process.env.BACKEND_PROXY_ORIGIN?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
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
