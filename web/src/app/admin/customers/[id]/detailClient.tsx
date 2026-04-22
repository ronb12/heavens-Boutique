"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

type CustomerDetail = {
  customer: {
    id: string;
    email: string;
    fullName: string | null;
    phone: string | null;
    role: string;
    loyaltyPoints: number;
    createdAt: string;
  };
};

export function AdminCustomerDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const c = data?.customer;

  return (
    <AdminShell title="Customer">
      <div className="mb-6">
        <Link href="/admin/customers" className="font-semibold text-[color:var(--gold)] no-underline">
          ← Back to customers
        </Link>
      </div>
      {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}
      {c ? (
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="font-semibold text-lg">{c.fullName || c.email}</div>
          <div className="mt-2 text-sm text-black/60">Email: {c.email}</div>
          {c.phone ? <div className="mt-1 text-sm text-black/60">Phone: {c.phone}</div> : null}
          <div className="mt-1 text-sm text-black/60">Role: {c.role}</div>
          <div className="mt-1 text-sm text-black/60">Loyalty points: {c.loyaltyPoints}</div>
          <div className="mt-1 text-sm text-black/60">
            Joined: {new Date(c.createdAt).toLocaleString()}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

