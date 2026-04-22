"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

type Order = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  userEmail: string | null;
  trackingNumber: string | null;
};

export function AdminOrdersClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ orders: Order[] }>("/api/orders?all=1", { method: "GET" });
        if (mounted) setOrders(r.orders || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load orders");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AdminShell title="Orders">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-sm text-black/55">
          Fulfillment and tracking. Use{" "}
          <span className="font-semibold text-black/75">Place manual order</span> for phone sales, in-store, or payments
          outside Stripe.
        </p>
        <Link
          href="/admin/orders/new"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold)] px-6 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_4px_18px_rgba(212,175,55,0.38)] no-underline transition hover:brightness-[1.05]"
        >
          Place manual order
        </Link>
      </div>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      <div className="mt-6 grid gap-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/admin/orders/${o.id}`}
            className="block rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold">Order {o.id.slice(0, 8)}</div>
                <div className="mt-1 text-sm text-black/55">
                  {new Date(o.createdAt).toLocaleString()} · {o.status}
                </div>
                <div className="mt-1 text-sm text-black/55">{o.userEmail || "Guest"}</div>
                {o.trackingNumber ? (
                  <div className="mt-1 text-sm text-black/55">Tracking: {o.trackingNumber}</div>
                ) : null}
              </div>
              <div className="font-semibold">{formatUsd(o.totalCents)}</div>
            </div>
          </Link>
        ))}
        {!orders.length ? (
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
            No orders found.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}

