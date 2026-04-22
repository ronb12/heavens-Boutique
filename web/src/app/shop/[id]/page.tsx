import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import type { ProductDTO } from "@/lib/types";
import { ProductClient } from "./productClient";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { absoluteStoreUrl } from "@/lib/siteUrl";

type ProductResponse = { product: ProductDTO };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const r = await apiFetch<ProductResponse>(`/api/products/${encodeURIComponent(id)}`, {
      auth: false,
    });
    const p = r.product;
    const title = `${p.name} · Heaven’s Boutique`;
    const description =
      (p.description?.trim().slice(0, 155) || "").trim() ||
      `Shop ${p.name} — curated fashion at Heaven’s Boutique.`;
    const pageUrl = absoluteStoreUrl(`/shop/${id}`);
    const img = (p.images || []).find((u) => /^https?:\/\//i.test(String(u).trim()));

    const md: Metadata = {
      title,
      description,
      alternates: { canonical: `/shop/${id}` },
      openGraph: {
        title,
        description,
        url: pageUrl,
        siteName: "Heaven’s Boutique",
        type: "website",
        locale: "en_US",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };

    if (img) {
      const src = String(img).trim();
      md.openGraph = { ...md.openGraph, images: [{ url: src, alt: p.name }] };
      md.twitter = { ...md.twitter, images: [src] };
    }

    return md;
  } catch {
    return { title: "Product · Heaven’s Boutique" };
  }
}
type ReviewsResponse = {
  summary: { count: number; average: number };
  reviews: { id: string; rating: number; title: string | null; body: string | null; createdAt: string }[];
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiFetch<ProductResponse>(`/api/products/${encodeURIComponent(id)}`, { auth: false });
  const p = r.product;
  let reviews: ReviewsResponse | null = null;
  try {
    reviews = await apiFetch<ReviewsResponse>(`/api/products/${encodeURIComponent(id)}/reviews`, { auth: false });
  } catch {
    reviews = null;
  }

  const shareUrl = absoluteStoreUrl(`/shop/${id}`);

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="shop" />

      <main className="mx-auto max-w-6xl px-4 py-10 flex-1">
        <ProductClient product={p} reviews={reviews} shareUrl={shareUrl} />
      </main>

      <SiteFooter />
    </div>
  );
}

