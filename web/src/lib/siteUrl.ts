/** Canonical storefront origin for metadata, OG tags, and share links (set `NEXT_PUBLIC_SITE_URL` on Vercel if needed). */
export function getSiteOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (explicit) return explicit;

  /** Stable production hostname (shortest *.vercel.app or custom domain) — set on all deployments by Vercel. */
  const rawProd = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (rawProd) {
    const host = rawProd.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    if (host) return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

/** Alias used by `robots.ts` / `sitemap.ts` — same as {@link getSiteOrigin}. */
export function getSiteUrl(): string {
  return getSiteOrigin();
}

export function absoluteStoreUrl(path: string): string {
  const origin = getSiteOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
