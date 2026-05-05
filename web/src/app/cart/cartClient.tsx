"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useCart } from "@/components/CartProvider";
import { formatUsd } from "@/lib/money";

export function CartClient() {
  const { items, setQuantity, revalidatePrices } = useCart();

  useEffect(() => {
    if (!items.length) return;
    void revalidatePrices();
  }, [revalidatePrices, items.length]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
  }, [items]);

  if (!items.length) {
    return (
      <div className="mt-8 rounded-3xl border border-black/10 bg-white/80 p-8">
        <div className="text-black/60">Your cart is empty.</div>
        <div className="mt-6">
          <Link
            href="/shop"
            className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
          >
            Start shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white/80 p-6">
        <div className="font-semibold text-lg">Items</div>
        <div className="mt-4 grid gap-4">
          {items.map((i) => (
            <div key={i.variantId} className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{i.name}</div>
                  <div className="text-sm text-black/55">Size: {i.size || "One size"}</div>
                  <div className="mt-2 font-semibold">{formatUsd(i.unitPriceCents)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(i.variantId, i.quantity - 1)}
                    className="h-10 w-10 rounded-full border border-black/10 bg-white font-bold"
                  >
                    –
                  </button>
                  <div className="min-w-10 text-center font-semibold">{i.quantity}</div>
                  <button
                    type="button"
                    onClick={() => setQuantity(i.variantId, i.quantity + 1)}
                    className="h-10 w-10 rounded-full border border-black/10 bg-white font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-3 text-sm text-black/55">
                Line total: {formatUsd(i.unitPriceCents * i.quantity)}
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setQuantity(i.variantId, 0)}
                  className="text-sm font-semibold text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/80 p-6 h-fit">
        <div className="font-semibold text-lg">Summary</div>
        <div className="mt-4 flex items-center justify-between text-black/70">
          <div>Subtotal</div>
          <div className="font-semibold">{formatUsd(subtotal)}</div>
        </div>
        <div className="mt-6">
          <Link
            href="/checkout"
            className="inline-flex w-full justify-center px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
          >
            Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}

