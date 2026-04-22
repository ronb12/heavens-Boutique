"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { SiteHeader } from "@/components/SiteHeader";

type ReturnRow = {
  id: string;
  orderId: string;
  reason: string;
  notes: string | null;
  status: string;
  returnLabelUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function ReturnsClient() {
  const { user, loading } = useAuth();
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      setError(null);
      try {
        const r = await apiFetch<{ returns: ReturnRow[] }>("/api/returns", { method: "GET" });
        if (mounted) setReturns(r.returns || []);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load returns");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="returns" />
        <div className="mx-auto max-w-5xl flex-1 px-4 py-12 text-black/60">Loading…</div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="returns" />
        <div className="mx-auto max-w-5xl flex-1 px-4 py-12">
          <h1 className="text-3xl">Returns</h1>
          <p className="mt-2 text-black/60">Sign in to view your return requests.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Freturns"
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
      <SiteHeader active="returns" />

      <main className="mx-auto max-w-5xl flex-1 px-4 py-12">
        <h1 className="text-3xl">Returns</h1>
        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

        <div className="mt-8 grid gap-3">
          {returns.length ? (
            returns.map((r) => (
              <div key={r.id} className="rounded-3xl border border-black/10 bg-white/80 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">Return {r.id.slice(0, 8)}</div>
                    <div className="mt-1 text-sm text-black/55">
                      Order {r.orderId.slice(0, 8)} · {r.status}
                    </div>
                    <div className="mt-2 text-sm text-black/60">{r.reason}</div>
                  </div>
                  {r.returnLabelUrl ? (
                    <a
                      href={r.returnLabelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
                    >
                      Return label
                    </a>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
              No returns yet.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

