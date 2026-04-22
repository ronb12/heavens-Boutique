"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import type { ProductDTO } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { ProductShareControls } from "@/components/ProductShareControls";
import { useShopProductShareUrl } from "@/lib/useShopProductShareUrl";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

function AdminProductShareActions({ productId, title }: { productId: string; title: string }) {
  const url = useShopProductShareUrl(productId);
  if (!url) return null;
  return <ProductShareControls url={url} title={title} compact />;
}

export function AdminProductsClient() {
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ products: ProductDTO[] }>("/api/products?sort=newest", { method: "GET" });
        if (mounted) setItems(r.products || []);
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load products"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AdminShell title="Products">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl text-black/60">
          Edit catalog items, images, variants, and supplier notes. For bulk quantity edits across variants, use{" "}
          <Link href="/admin/inventory" className="font-semibold text-[color:var(--gold)] no-underline hover:underline">
            Inventory
          </Link>
          .
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/inventory"
            className="inline-flex items-center px-5 py-2.5 rounded-full border border-black/12 bg-white font-semibold text-[color:var(--charcoal)] no-underline shadow-sm hover:border-[color:var(--gold)]/40"
          >
            Inventory counts
          </Link>
          <Link
            href="/admin/products/new"
            className="inline-flex px-5 py-2.5 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
          >
            New product
          </Link>
        </div>
      </div>

      {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

      <div className="mt-8 grid gap-3">
        {items.map((p) => {
          const img = (p.images || [])[0] || "";
          return (
            <div
              key={p.id}
              className="rounded-3xl border border-black/10 bg-white/80 p-5 flex flex-wrap items-center justify-between gap-4 hover:shadow-sm transition-shadow"
            >
              <Link
                href={`/admin/products/${p.id}`}
                className="flex flex-1 items-center gap-4 min-w-0 no-underline"
              >
                <div className="h-14 w-14 rounded-2xl bg-black/5 overflow-hidden shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-lg truncate text-[color:var(--foreground)]">{p.name}</div>
                  <div className="text-sm text-black/55 truncate">{p.category || ""}</div>
                </div>
              </Link>
              <div className="flex items-center gap-4 shrink-0">
                <div className="font-semibold">{formatUsd(p.salePriceCents ?? p.priceCents)}</div>
                <AdminProductShareActions productId={p.id} title={p.name} />
              </div>
            </div>
          );
        })}
        {!items.length && !error ? (
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">No products found.</div>
        ) : null}
      </div>
    </AdminShell>
  );
}
