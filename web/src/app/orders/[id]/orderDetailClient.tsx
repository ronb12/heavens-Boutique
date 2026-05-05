"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { formatUsd } from "@/lib/money";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";

type OrderDetail = {
  order: {
    id: string;
    status: string;
    subtotalCents: number;
    discountCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
    trackingNumber: string | null;
    fulfillmentStatus: string;
    shippingTier: string | null;
    shippingAddress: any;
    createdAt: string;
    items: {
      id: string;
      productName: string;
      quantity: number;
      unitPriceCents: number;
      variantSize: string | null;
    }[];
  };
};

export function OrderDetailClient({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [returnStatus, setReturnStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setError(null);
      try {
        const r = await apiFetch<OrderDetail>(`/api/orders/${encodeURIComponent(id)}`, { method: "GET" });
        if (mounted) setData(r);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load order");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user, id]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="orders" />
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 text-black/60">
          <AccountSubNav />
          Loading…
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="orders" />
        <div className="mx-auto max-w-5xl flex-1 px-4 py-12">
          <AccountSubNav />
          <h1 className="text-3xl">Order</h1>
          <p className="mt-2 text-black/60">Sign in to view this order.</p>
        </div>
      </div>
    );
  }

  const o = data?.order;

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="orders" />
      <div className="border-b border-black/5 bg-[color:var(--background)]/90">
        <div className="mx-auto max-w-5xl px-4 py-2">
          <Link href="/orders" className="text-sm font-semibold text-[color:var(--gold)] no-underline">
            ← All orders
          </Link>
        </div>
      </div>

      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <AccountSubNav />
        <h1 className="text-3xl">Order {id.slice(0, 8)}</h1>
        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        {o ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white/80 p-6">
              <div className="font-semibold text-lg">Items</div>
              <div className="mt-4 grid gap-3">
                {o.items.map((it) => (
                  <div key={it.id} className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-semibold">{it.productName}</div>
                        <div className="text-sm text-black/55">
                          {it.variantSize ? `Size: ${it.variantSize} · ` : ""}Qty {it.quantity}
                        </div>
                      </div>
                      <div className="font-semibold">{formatUsd(it.unitPriceCents * it.quantity)}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/70">
                <div className="flex items-center justify-between">
                  <span>Status</span>
                  <span className="font-semibold">{o.status}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span>Fulfillment</span>
                  <span className="font-semibold">{o.fulfillmentStatus}</span>
                </div>
                {o.trackingNumber ? (
                  <div className="mt-2 flex items-center justify-between">
                    <span>Tracking</span>
                    <span className="font-semibold">{o.trackingNumber}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-black/10 bg-white/80 p-6 h-fit">
              <div className="font-semibold text-lg">Summary</div>
              <div className="mt-4 grid gap-2 text-sm text-black/70">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold">{formatUsd(o.subtotalCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span className="font-semibold">-{formatUsd(o.discountCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span className="font-semibold">{formatUsd(o.shippingCents)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax</span>
                  <span className="font-semibold">{formatUsd(o.taxCents)}</span>
                </div>
                <div className="pt-3 mt-1 border-t border-black/10 flex items-center justify-between">
                  <span>Total</span>
                  <span className="font-semibold">{formatUsd(o.totalCents)}</span>
                </div>
              </div>

              <div className="mt-8">
                <div className="font-semibold">Request a return</div>
                <div className="mt-1 text-sm text-black/60">Send a return request for this order.</div>
                <div className="mt-3 grid gap-3">
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Reason"
                    className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="min-h-24 rounded-2xl border border-black/10 bg-white px-4 py-3"
                  />
                  {returnStatus ? <div className="text-sm text-black/60">{returnStatus}</div> : null}
                  <button
                    type="button"
                    className="h-11 rounded-2xl bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
                    onClick={async () => {
                      setReturnStatus(null);
                      try {
                        await apiFetch(`/api/returns`, {
                          method: "POST",
                          body: JSON.stringify({ orderId: o.id, reason, notes, items: [] }),
                        });
                        setReturnStatus("Return requested. You’ll see updates in Returns.");
                      } catch (e: any) {
                        setReturnStatus(e?.message || "Return request failed");
                      }
                    }}
                  >
                    Submit return request
                  </button>
                  <Link href="/returns" className="text-sm font-semibold text-[color:var(--gold)] no-underline">
                    View returns →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

