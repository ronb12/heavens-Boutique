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

function productProfit(product: ProductDTO): { profitCents: number | null; margin: number | null } {
  const revenue = product.salePriceCents ?? product.priceCents;
  const cost = product.costCents;
  if (cost == null || !Number.isFinite(cost)) return { profitCents: null, margin: null };
  const profitCents = revenue - cost;
  const margin = revenue > 0 ? (profitCents / revenue) * 100 : null;
  return { profitCents, margin };
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
          const profit = productProfit(p);
          return (
            <div
              key={p.id}
              className="grid gap-4 rounded-3xl border border-black/10 bg-white/80 p-5 transition-shadow hover:shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <Link
                href={`/admin/products/${p.id}`}
                className="flex min-w-0 items-center gap-4 no-underline"
              >
                <div className="h-14 w-14 rounded-2xl bg-black/5 overflow-hidden shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-lg truncate text-[color:var(--foreground)]">{p.name}</div>
                  <div className="text-sm text-black/55 truncate">
                    {[p.category || "Uncategorized", p.supplierName ? `Source: ${p.supplierName}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </Link>
              <div className="grid min-w-0 grid-cols-2 items-center gap-3 sm:flex sm:flex-wrap sm:justify-end">
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-2 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Price</div>
                  <div className="font-semibold tabular-nums">{formatUsd(p.salePriceCents ?? p.priceCents)}</div>
                </div>
                <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-2 text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40">Profit</div>
                  <div className="font-semibold tabular-nums text-[color:var(--charcoal)]">
                    {profit.profitCents != null ? formatUsd(profit.profitCents) : "Add cost"}
                  </div>
                  {profit.margin != null ? (
                    <div className="text-[11px] text-black/45">{profit.margin.toFixed(1)}% margin</div>
                  ) : null}
                </div>
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <AdminProductShareActions productId={p.id} title={p.name} />
                </div>
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
