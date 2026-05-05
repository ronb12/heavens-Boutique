"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";
import { formatUsd } from "@/lib/money";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  trackingNumber: string | null;
  items: { id: string; productName: string; quantity: number; unitPriceCents: number }[];
};

export function OrdersClient() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setError(null);
      try {
        const r = await apiFetch<{ orders: Order[] }>("/api/orders", { method: "GET" });
        if (mounted) setOrders(r.orders || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load orders");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

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
          <h1 className="text-3xl">Orders</h1>
          <p className="mt-2 text-black/60">Sign in to view your order history.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Forders"
              className="inline-flex rounded-full bg-[color:var(--gold)] px-6 py-3 font-semibold text-[color:var(--charcoal)] no-underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="orders" />

      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <AccountSubNav />
        <h1 className="text-3xl">Orders</h1>
        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}
        <div className="mt-8 grid gap-3">
          {orders.length ? (
            orders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.id}`}
                className="block rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">Order {o.id.slice(0, 8)}</div>
                    <div className="mt-1 text-sm text-black/55">
                      {new Date(o.createdAt).toLocaleString()} · {o.status}
                    </div>
                    {o.trackingNumber ? (
                      <div className="mt-2 text-sm text-black/55">Tracking: {o.trackingNumber}</div>
                    ) : null}
                  </div>
                  <div className="font-semibold">{formatUsd(o.totalCents)}</div>
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
              No orders yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

