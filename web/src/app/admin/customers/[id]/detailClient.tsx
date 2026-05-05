"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

type AdminAddress = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
};

type RecentOrder = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string;
  stripePaymentIntentId: string | null;
};

type CustomerDetail = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: string;
    loyaltyPoints: number;
    createdAt: string;
  };
  addresses: AdminAddress[];
  recentOrders: RecentOrder[];
};

type Section = "profile" | "orders";

export function AdminCustomerDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("profile");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<CustomerDetail>(`/api/admin/customers/${encodeURIComponent(id)}`, {
          method: "GET",
        });
        if (mounted) setData(r);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load customer");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const c = data?.user;

  const tabClass = (active: boolean) =>
    [
      "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
      active
        ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow"
        : "border border-black/10 bg-white/80 text-[color:var(--foreground)] hover:bg-white",
    ].join(" ");

  return (
    <AdminShell title="Customer">
      <div className="mb-6">
        <Link href="/admin/customers" className="font-semibold text-[color:var(--gold)] no-underline">
          ← Back to customers
        </Link>
      </div>
      {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}
      {c && data ? (
        <>
          <div className="mb-4 flex flex-wrap gap-2 border-b border-black/10 pb-3" role="tablist" aria-label="Customer">
            <button
              type="button"
              role="tab"
              aria-selected={section === "profile"}
              className={tabClass(section === "profile")}
              onClick={() => setSection("profile")}
            >
              Profile
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={section === "orders"}
              className={tabClass(section === "orders")}
              onClick={() => setSection("orders")}
            >
              Orders
            </button>
          </div>
          {section === "profile" ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
                <div className="font-semibold text-lg">{c.fullName || c.email}</div>
                <div className="mt-2 text-sm text-black/60">Email: {c.email}</div>
                {c.phone ? <div className="mt-1 text-sm text-black/60">Phone: {c.phone}</div> : null}
                <div className="mt-1 text-sm text-black/60">Role: {c.role}</div>
                <div className="mt-1 text-sm text-black/60">Loyalty points: {c.loyaltyPoints}</div>
                <div className="mt-1 text-sm text-black/60">Joined: {new Date(c.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-lg font-semibold">Addresses</div>
                <div className="mt-3 grid gap-3">
                  {data.addresses.length ? (
                    data.addresses.map((a) => (
                      <div key={a.id} className="rounded-3xl border border-black/10 bg-white/80 p-6">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{a.label || "Address"}</div>
                          {a.isDefault ? (
                            <span className="text-xs font-semibold rounded-full bg-[color:var(--soft-pink)] px-3 py-1">
                              Default
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-2 text-sm text-black/60">
                          {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}, {a.city}
                          {a.state ? `, ${a.state}` : ""} {a.postal} · {a.country}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-black/10 bg-white/80 p-6 text-black/60">No saved addresses.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div>
              {data.recentOrders.length ? (
                <ul className="mt-0 grid gap-3">
                  {data.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        className="block rounded-3xl border border-black/10 bg-white/80 p-5 no-underline transition hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">Order {o.id.slice(0, 8)}…</div>
                            <div className="mt-1 text-sm text-black/55">
                              {new Date(o.createdAt).toLocaleString()} · {o.status}
                            </div>
                          </div>
                          <div className="shrink-0 font-semibold">{formatUsd(o.totalCents)}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">No orders yet for this account.</div>
              )}
            </div>
          )}
        </>
      ) : null}
    </AdminShell>
  );
}
