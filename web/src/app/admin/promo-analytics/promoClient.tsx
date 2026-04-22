"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";

type Row = {
  promoId: string;
  code: string;
  uses: number;
  discountCents: number;
  totalCents: number;
};

export function AdminPromoAnalyticsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ promos: Row[] }>("/api/admin/promo-analytics", { method: "GET" });
        if (mounted) setRows(r.promos || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load promo analytics");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AdminShell title="Promo analytics">
      {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}
      <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-left">
              <th className="p-4">Code</th>
              <th className="p-4">Uses</th>
              <th className="p-4">Discount</th>
              <th className="p-4">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.promoId} className="border-t border-black/5">
                <td className="p-4 font-semibold">{r.code}</td>
                <td className="p-4">{r.uses}</td>
                <td className="p-4">{formatUsd(r.discountCents)}</td>
                <td className="p-4">{formatUsd(r.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <div className="p-8 text-black/60">No promo redemptions yet.</div> : null}
      </div>
    </AdminShell>
  );
}

