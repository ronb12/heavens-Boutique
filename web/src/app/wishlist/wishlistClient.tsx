"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import type { ProductDTO } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function WishlistClient() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<ProductDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    const r = await apiFetch<{ products: ProductDTO[] }>("/api/wishlist", { method: "GET" });
    setItems(r.products || []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        await reload();
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load wishlist"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="wishlist" />
        <main className="mx-auto max-w-6xl px-4 py-12 flex-1 text-black/60">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="wishlist" />
        <main className="mx-auto max-w-6xl px-4 py-12 flex-1">
          <h1 className="text-3xl md:text-4xl">Wishlist</h1>
          <p className="mt-2 text-black/60">Sign in to view saved items.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Fwishlist"
              className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
            >
              Sign in
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="wishlist" />

      <main className="mx-auto max-w-6xl px-4 py-10 flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">Wishlist</h1>
            <p className="mt-2 text-black/60">Your saved pieces.</p>
          </div>
          <Link href="/shop" className="font-semibold text-[color:var(--gold)] no-underline">
            Continue shopping →
          </Link>
        </div>

        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.length ? (
            items.map((p) => {
              const img = (p.images || [])[0] || "";
              return (
                <div key={p.id} className="rounded-3xl border border-black/10 bg-white/80 p-5">
                  <div className="aspect-[4/3] rounded-2xl bg-black/5 overflow-hidden">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-sm text-black/55 px-4 text-center">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="mt-4 font-semibold text-lg">{p.name}</div>
                  <div className="mt-1 text-sm text-black/55">{p.category || ""}</div>
                  <div className="mt-3 font-semibold">{formatUsd(p.salePriceCents ?? p.priceCents)}</div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={`/shop/${p.id}`}
                      className="inline-flex px-5 py-2.5 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
                    >
                      View
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === p.id}
                      onClick={async () => {
                        setBusyId(p.id);
                        setError(null);
                        try {
                          await apiFetch(`/api/wishlist?productId=${encodeURIComponent(p.id)}`, { method: "DELETE" });
                          await reload();
                        } catch (e: unknown) {
                          setError(errMsg(e, "Remove failed"));
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      className="inline-flex px-5 py-2.5 rounded-full border border-black/10 bg-white/70 font-semibold disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60 sm:col-span-2 lg:col-span-3">
              Your wishlist is empty.
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
