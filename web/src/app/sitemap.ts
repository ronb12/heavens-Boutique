import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/siteUrl";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const main: MetadataRoute.Sitemap = [
    "",
    "/shop",
    "/cart",
    "/checkout",
    "/blog",
    "/wishlist",
    "/login",
    "/register",
    "/returns",
    "/pages/about",
    "/pages/shipping",
    "/pages/returns",
  ].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === "" ? "daily" : "weekly",
    priority: path === "" ? 1 : 0.7,
  }));

  const api = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const extra: MetadataRoute.Sitemap = [];
  if (api) {
    try {
      const baseApi = api.replace(/\/+$/, "");
      const res = await fetch(`${baseApi}/api/pages`, { next: { revalidate: 3600 } });
      if (res.ok) {
        const j = (await res.json()) as {
          posts?: { slug: string }[];
          pages?: { slug: string }[];
        };
        for (const p of j.posts || []) {
          extra.push({
            url: `${base}/blog/${encodeURIComponent(p.slug)}`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.6,
          });
        }
        for (const p of j.pages || []) {
          if (["about", "shipping", "returns"].includes(p.slug)) continue;
          extra.push({
            url: `${base}/pages/${encodeURIComponent(p.slug)}`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.6,
          });
        }
      }
    } catch {
      /* ignore */
    }
  }

  return [...main, ...extra];
}
