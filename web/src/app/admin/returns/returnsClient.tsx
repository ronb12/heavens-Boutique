"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { RETURN_STATUS_OPTIONS, SELECT_FIELD_CLASS } from "@/lib/formOptions";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type ReturnRow = {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  notes: string | null;
  returnLabelUrl: string | null;
  createdAt: string;
};

export function AdminReturnsClient() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ returns: ReturnRow[] }>("/api/admin/returns", { method: "GET" });
        if (mounted) setRows(r.returns || []);
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load returns"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function patchStatus(id: string, status: string) {
    setError(null);
    setBusyId(id);
    try {
      const r = await apiFetch<{ return?: { status: string; returnLabelUrl?: string | null } }>(
        `/api/admin/returns/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      const nextStatus = r.return?.status ?? status;
      const labelUrl = r.return?.returnLabelUrl;
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                status: nextStatus,
                returnLabelUrl: labelUrl ?? row.returnLabelUrl,
              }
            : row,
        ),
      );
    } catch (e: unknown) {
      setError(errMsg(e, "Could not update status"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Returns">
      {error ? <div className="text-sm text-rose-700 font-semibold">{error}</div> : null}
      <div className="mt-6 grid gap-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="font-semibold">Return {r.id.slice(0, 8)}</div>
              <label className="grid gap-1 text-xs font-semibold text-black/55">
                Status
                <select
                  disabled={busyId === r.id}
                  value={r.status || "pending"}
                  onChange={(e) => patchStatus(r.id, e.target.value)}
                  className={`${SELECT_FIELD_CLASS} max-w-[220px] text-sm disabled:opacity-60`}
                >
                  {RETURN_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {!RETURN_STATUS_OPTIONS.some((o) => o.value === r.status) && r.status ? (
                    <option value={r.status}>{r.status}</option>
                  ) : null}
                </select>
              </label>
            </div>
            <div className="mt-1 text-sm text-black/55">Order {r.orderId.slice(0, 8)}</div>
            <div className="mt-2 text-sm text-black/60">{r.reason}</div>
            {r.returnLabelUrl ? (
              <a
                className="inline-flex mt-4 px-4 py-2 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
                href={r.returnLabelUrl}
                target="_blank"
                rel="noreferrer"
              >
                Label
              </a>
            ) : null}
          </div>
        ))}
        {!rows.length ? (
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">No returns.</div>
        ) : null}
      </div>
    </AdminShell>
  );
}

