"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProductDTO } from "@/lib/types";
import { formatUsd } from "@/lib/money";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { ProductShareControls } from "@/components/ProductShareControls";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Reviews = {
  summary: { count: number; average: number };
  reviews: { id: string; rating: number; title: string | null; body: string | null; createdAt: string }[];
} | null;

export function ProductClient({
  product,
  reviews,
  shareUrl,
}: {
  product: ProductDTO;
  reviews: Reviews;
  shareUrl: string;
}) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const variants = useMemo(() => product.variants ?? [], [product.variants]);

  const firstInStock = useMemo(() => variants.find((v) => (v.stock ?? 0) > 0) ?? variants[0], [variants]);
  const [variantId, setVariantId] = useState<string>(firstInStock?.id || "");
  const selected = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);
  const [qty, setQty] = useState<number>(1);
  const [subscribing, setSubscribing] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [wishBusy, setWishBusy] = useState(false);
  const [wishError, setWishError] = useState<string | null>(null);

  const maxQty = Math.max(1, Math.min(20, selected?.stock ?? 1));
  const imgs = (product.images || []).filter(Boolean);
  const [imgIdx, setImgIdx] = useState(0);
  const hero = imgs[Math.min(imgIdx, Math.max(0, imgs.length - 1))] || "";

  const compareAtCents = product.salePriceCents != null ? product.priceCents : null;
  const payCents = product.salePriceCents ?? product.priceCents;
  const lineTotalCents = payCents * qty;
  const lowStock = selected ? (selected.stock ?? 0) > 0 && (selected.stock ?? 0) <= 3 : false;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) {
        if (mounted) setWishlisted(false);
        return;
      }
      try {
        const r = await apiFetch<{ products: ProductDTO[] }>("/api/wishlist", { method: "GET" });
        const ids = new Set((r.products || []).map((p) => p.id));
        if (mounted) setWishlisted(ids.has(product.id));
      } catch {
        if (mounted) setWishlisted(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, product.id]);

  return (
    <div className="space-y-10 lg:space-y-14">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-black/55">
        <Link href="/" className="hover:text-black/80 no-underline">
          Home
        </Link>
        <span aria-hidden>/</span>
        <Link href="/shop" className="hover:text-black/80 no-underline">
          Shop
        </Link>
        {product.category ? (
          <>
            <span aria-hidden>/</span>
            <span className="text-black/75">{product.category}</span>
          </>
        ) : null}
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-start">
        {/* Gallery — hero + thumbnails */}
        <div className="rounded-3xl border border-black/10 bg-white/70 p-4 sm:p-6 lg:sticky lg:top-6">
          <div className="aspect-[3/4] max-h-[min(640px,70vh)] rounded-2xl bg-black/[0.03] overflow-hidden flex items-center justify-center">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hero}
                alt={product.name}
                className="max-h-full max-w-full w-auto h-auto object-contain object-center"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-black/55 px-6 text-center">
                No product photo yet.
              </div>
            )}
          </div>
          {imgs.length > 1 ? (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {imgs.map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setImgIdx(i)}
                  className={[
                    "shrink-0 rounded-xl border overflow-hidden w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20",
                    i === imgIdx ? "border-black/50 ring-2 ring-black/15" : "border-black/10 hover:border-black/25",
                  ].join(" ")}
                  aria-label={`Show image ${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Buy box */}
        <div className="min-w-0">
          {product.category ? (
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-black/45">{product.category}</div>
          ) : null}
          <h1 className="mt-2 text-3xl md:text-[2rem] font-semibold tracking-tight text-black leading-tight">
            {product.name}
          </h1>

          {reviews ? (
            <div className="mt-3 text-sm text-black/55">
              <span className="font-semibold text-black/80">{reviews.summary.average.toFixed(1)}</span>
              {" · "}
              {reviews.summary.count} review{reviews.summary.count === 1 ? "" : "s"}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2">
            {compareAtCents != null && compareAtCents > payCents ? (
              <span className="text-xl text-black/45 line-through">{formatUsd(compareAtCents)}</span>
            ) : null}
            <span className="text-3xl md:text-4xl font-semibold tabular-nums">{formatUsd(payCents)}</span>
            {product.salePriceCents != null ? (
              <span className="rounded-full bg-[color:var(--gold)]/35 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[color:var(--charcoal)]">
                Sale
              </span>
            ) : null}
          </div>
          {qty > 1 ? (
            <div className="mt-2 text-sm text-black/55">
              Line total ({qty}): <span className="font-semibold text-black/80">{formatUsd(lineTotalCents)}</span>
            </div>
          ) : null}

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ["Curated find", "Selected for boutique style and everyday wear."],
              ["Secure checkout", "Card and wallet payments are processed safely."],
              ["Tracked orders", "Order status stays available in your account."],
              ["Support ready", "Questions about sizing or delivery are welcome."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-black/10 bg-white/70 p-4">
                <div className="text-sm font-semibold text-black/82">{title}</div>
                <div className="mt-1 text-xs leading-5 text-black/52">{body}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="font-semibold">Size</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {variants.map((v) => {
              const active = v.id === variantId;
              const disabled = (v.stock ?? 0) <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVariantId(v.id);
                    setQty(1);
                  }}
                  disabled={disabled}
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold",
                    active ? "border-black/30 bg-[color:var(--soft-pink)]" : "border-black/10 bg-white",
                    disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm",
                  ].join(" ")}
                >
                  {v.size || "One size"}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Quantity</div>
              <div className="text-sm text-black/55">Max {maxQty}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-full border border-black/10 bg-white font-bold"
              >
                –
              </button>
              <div className="min-w-10 text-center font-semibold">{qty}</div>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                className="h-10 w-10 rounded-full border border-black/10 bg-white font-bold"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!selected || (selected.stock ?? 0) <= 0}
              onClick={() => {
                if (!selected) return;
                addItem({
                  productId: product.id,
                  variantId: selected.id,
                  quantity: qty,
                  name: product.name,
                  size: selected.size,
                  unitPriceCents: product.salePriceCents ?? product.priceCents,
                });
              }}
              className="px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-50"
            >
              Add to cart
            </button>
            {user ? (
              <button
                type="button"
                disabled={wishBusy}
                onClick={async () => {
                  setWishError(null);
                  setWishBusy(true);
                  try {
                    if (wishlisted) {
                      await apiFetch(`/api/wishlist?productId=${encodeURIComponent(product.id)}`, { method: "DELETE" });
                      setWishlisted(false);
                    } else {
                      await apiFetch(`/api/wishlist?productId=${encodeURIComponent(product.id)}`, { method: "POST" });
                      setWishlisted(true);
                    }
                  } catch (e: unknown) {
                    setWishError(errMsg(e, "Wishlist update failed"));
                  } finally {
                    setWishBusy(false);
                  }
                }}
                className="px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold disabled:opacity-60"
              >
                {wishlisted ? "Saved" : wishBusy ? "Saving…" : "Wishlist"}
              </button>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/shop/${product.id}`)}`}
                className="px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold no-underline"
              >
                Wishlist
              </Link>
            )}
            <Link
              href="/cart"
              className="px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold no-underline"
            >
              View cart
            </Link>
          </div>

          <div className="mt-4">
            <ProductShareControls
              url={shareUrl}
              title={product.name}
              description={product.description?.trim().slice(0, 280) ?? null}
            />
          </div>

          {wishError ? <div className="mt-3 text-sm text-rose-700 font-semibold">{wishError}</div> : null}

          {selected ? (
            <div className="mt-4 space-y-1 text-sm text-black/55">
              <div>
                {selected.stock > 0 ? (
                  lowStock ? (
                    <span className="font-semibold text-amber-800">Only {selected.stock} left in this size</span>
                  ) : (
                    `${selected.stock} in stock`
                  )
                ) : (
                  "Sold out"
                )}
              </div>
              {selected.sku ? (
                <div className="text-black/45">
                  SKU: <span className="font-mono text-black/70">{selected.sku}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {selected && (selected.stock ?? 0) <= 0 ? (
            <div className="mt-5 rounded-2xl border border-black/10 bg-white p-4">
              <div className="font-semibold">Back in stock</div>
              <div className="mt-1 text-sm text-black/60">
                Get a notification when this size returns.
              </div>
              <div className="mt-3 flex flex-wrap gap-3 items-center">
                {user ? (
                  <button
                    type="button"
                    disabled={subscribing || subscribed}
                    onClick={async () => {
                      setSubError(null);
                      setSubscribing(true);
                      try {
                        await apiFetch<{ ok: boolean }>("/api/back-in-stock", {
                          method: "POST",
                          body: JSON.stringify({ variantId: selected.id }),
                        });
                        setSubscribed(true);
                      } catch (e: unknown) {
                        setSubError(errMsg(e, "Could not subscribe"));
                      } finally {
                        setSubscribing(false);
                      }
                    }}
                    className="px-5 py-2.5 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
                  >
                    {subscribed ? "Subscribed" : subscribing ? "Subscribing…" : "Notify me"}
                  </button>
                ) : (
                  <Link
                    href={`/login?next=${encodeURIComponent(`/shop/${product.id}`)}`}
                    className="px-5 py-2.5 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
                  >
                    Sign in to subscribe
                  </Link>
                )}
                {subError ? <div className="text-sm text-rose-700 font-semibold">{subError}</div> : null}
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>

      {product.description ? (
        <section className="grid gap-6 border-t border-black/10 pt-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-10 lg:pt-12">
          <div>
            <h2 className="text-xl font-semibold">Product details</h2>
            <p className="mt-4 max-w-3xl text-black/65 leading-8 whitespace-pre-wrap">{product.description}</p>
          </div>
          <aside className="rounded-3xl border border-black/10 bg-white/75 p-6">
            <h3 className="text-base font-semibold">Before you order</h3>
            <div className="mt-4 grid gap-3 text-sm text-black/62">
              <div>
                <span className="font-semibold text-black/80">Fit:</span> Review the selected size and product notes before
                checkout.
              </div>
              <div>
                <span className="font-semibold text-black/80">Delivery:</span> Orders are prepared with tracking when
                available.
              </div>
              <div>
                <span className="font-semibold text-black/80">Need help?</span> Save it to your wishlist or message support
                before buying.
              </div>
            </div>
          </aside>
        </section>
      ) : null}

      <section className="border-t border-black/10 pt-10 lg:pt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">Reviews</h2>
            <div className="mt-1 text-black/60">
              {reviews
                ? `${reviews.summary.average.toFixed(1)} / 5 · ${reviews.summary.count} review${
                    reviews.summary.count === 1 ? "" : "s"
                  }`
                : "Reviews will appear here once available."}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(reviews?.reviews || []).slice(0, 6).map((r) => (
            <div key={r.id} className="rounded-3xl border border-black/10 bg-white/80 p-6">
              <div className="text-sm font-semibold text-[color:var(--gold)]">
                {"★".repeat(Math.max(1, Math.min(5, r.rating)))}
              </div>
              {r.title ? <div className="mt-2 font-semibold">{r.title}</div> : null}
              {r.body ? <div className="mt-2 text-sm text-black/60 leading-6">{r.body}</div> : null}
            </div>
          ))}
          {reviews && (!reviews.reviews || reviews.reviews.length === 0) ? (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60 sm:col-span-2 lg:col-span-3">
              No reviews yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
