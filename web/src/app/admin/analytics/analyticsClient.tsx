"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

type ReportsResponse = {
  currency: string;
  asOf: string;
  days: number;
  summary: {
    grossSalesCents: number;
    refundedCents: number;
    netSalesCents: number;
    discountsCents: number;
    taxCents: number;
    shippingCents: number;
    paidOrderCount: number;
    averageOrderValueCents: number;
  };
  byStatus: { status: string; count: number; totalCents: number }[];
  daily: { date: string; revenueCents: number; orderCount: number }[];
};

const RANGE_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
] as const;

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Pending",
    paid: "Paid",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };
  return map[s] || s;
}

export function AdminAnalyticsClient() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<ReportsResponse>(`/api/admin/reports?days=${days}`, { method: "GET" });
      setData(r);
    } catch (e: unknown) {
      setData(null);
      setError(e instanceof Error ? e.message : "Could not load analytics");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const dailyMax = useMemo(() => {
    if (!data?.daily?.length) return 1;
    return Math.max(1, ...data.daily.map((d) => d.revenueCents));
  }, [data]);

  return (
    <AdminShell title="Analytics">
      <p className="max-w-3xl text-black/60">
        Revenue and orders from your database. Daily chart uses completed sales in the selected window; summary cards
        reflect all time in the database.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-black/55">Trend range</span>
        <div className="inline-flex rounded-full border border-black/10 bg-white p-1 shadow-sm">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDays(opt.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                days === opt.value
                  ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow-sm"
                  : "text-black/65 hover:bg-black/[0.04]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {data?.asOf ? (
          <span className="text-xs text-black/45">Updated {new Date(data.asOf).toLocaleString()}</span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="mt-8 animate-pulse space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-3xl border border-black/[0.06] bg-white" />
            ))}
          </div>
          <div className="h-48 rounded-3xl border border-black/[0.06] bg-white" />
        </div>
      ) : null}

      {data ? (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Net sales (all time)" value={formatUsd(data.summary.netSalesCents)} hint="Gross minus refunds" />
            <StatCard label="Paid orders (all time)" value={String(data.summary.paidOrderCount)} hint="Paid, shipped, delivered" />
            <StatCard label="Average order" value={formatUsd(data.summary.averageOrderValueCents)} hint="Among completed orders" />
            <StatCard label="Refunded (all time)" value={formatUsd(data.summary.refundedCents)} hint="Total refund volume" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <StatCard label="Discounts (all time)" value={formatUsd(data.summary.discountsCents)} subtle />
            <StatCard label="Tax collected" value={formatUsd(data.summary.taxCents)} subtle />
            <StatCard label="Shipping collected" value={formatUsd(data.summary.shippingCents)} subtle />
          </div>

          <div className="mt-10 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
            <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Trend</p>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                Daily revenue · last {data.days} days
              </h2>
              <p className="mt-1 text-sm text-black/55">Bars scale to the highest day in this range.</p>
            </div>
            <div className="p-6">
              {data.daily.length === 0 ? (
                <p className="text-sm text-black/55">No orders in this range.</p>
              ) : (
                <div className="flex h-48 items-end gap-0.5 sm:gap-1">
                  {data.daily.map((d) => {
                    const barPx = Math.max(6, Math.round((d.revenueCents / dailyMax) * 168));
                    return (
                      <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                        <div
                          className="w-full max-w-[12px] rounded-t-md bg-gradient-to-t from-[color:var(--gold)]/85 to-[color:var(--rose)]/40 sm:max-w-[16px]"
                          style={{ height: `${barPx}px` }}
                          title={`${d.date}: ${formatUsd(d.revenueCents)} · ${d.orderCount} orders`}
                        />
                        <span className="w-full truncate text-center text-[8px] font-medium leading-none text-black/40 sm:text-[9px]">
                          {d.date.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
            <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Orders</p>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                By status
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-black/50">
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold">Count</th>
                    <th className="px-6 py-3 font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byStatus.map((row) => (
                    <tr key={row.status} className="border-b border-black/[0.04]">
                      <td className="px-6 py-3 font-medium">{statusLabel(row.status)}</td>
                      <td className="px-6 py-3 tabular-nums">{row.count}</td>
                      <td className="px-6 py-3 tabular-nums font-semibold">{formatUsd(row.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.byStatus.length ? (
                <div className="px-6 py-8 text-center text-black/55">No orders yet.</div>
              ) : null}
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link
              href="/admin/promo-analytics"
              className="rounded-3xl border border-black/[0.08] bg-white p-6 no-underline shadow-sm transition hover:border-[color:var(--gold)]/35 hover:shadow-md"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--rose)]/90">Marketing</div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                Promo analytics
              </div>
              <p className="mt-2 text-sm text-black/55">Discount code usage and revenue attributed to promos.</p>
            </Link>
            <Link
              href="/admin/orders"
              className="rounded-3xl border border-black/[0.08] bg-white p-6 no-underline shadow-sm transition hover:border-[color:var(--gold)]/35 hover:shadow-md"
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--rose)]/90">Operations</div>
              <div className="mt-2 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                All orders
              </div>
              <p className="mt-2 text-sm text-black/55">Fulfillment, tracking, and order detail.</p>
            </Link>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  hint,
  subtle,
}: {
  label: string;
  value: string;
  hint?: string;
  subtle?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl border border-black/[0.07] bg-white px-5 py-4 shadow-[0_8px_28px_rgba(43,43,43,0.05)] ${
        subtle ? "opacity-95" : ""
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-black/45">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[color:var(--charcoal)]">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-black/45">{hint}</p> : null}
    </div>
  );
}
