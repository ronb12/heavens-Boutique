"use client";

import { useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { getApiBaseUrl } from "@/lib/env";
import { getAuthToken } from "@/lib/authToken";

const uploadInputId = "admin-products-csv-file";

export function AdminProductsCsvClient() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const base = getApiBaseUrl();

  return (
    <AdminShell title="Products CSV">
      <p className="text-black/60 max-w-3xl">
        Export products to CSV or import/update via CSV. (Requires admin.)
      </p>

      {status ? <div className="mt-4 text-sm text-emerald-700 font-semibold">{status}</div> : null}
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="font-semibold">Export</div>
          <p className="mt-2 text-sm text-black/60">Downloads a CSV file.</p>
          <button
            type="button"
            className="mt-4 h-11 px-5 rounded-2xl bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
            onClick={() => {
              const token = getAuthToken();
              const url = `${base}/api/admin/products-csv`;
              // Easiest: open a new tab (the endpoint returns CSV).
              // If your API requires Authorization header, you may prefer server-side export via signed URL.
              if (!token) {
                setError("Sign in as admin first.");
                return;
              }
              window.open(url, "_blank");
            }}
          >
            Download CSV
          </button>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
          <div className="font-semibold">Import</div>
          <p className="mt-2 text-sm text-black/60">Upload a CSV file to upsert products.</p>
          <div className="mt-4 flex flex-col gap-3">
            <label
              htmlFor={uploadInputId}
              className="inline-flex h-11 w-fit cursor-pointer items-center justify-center rounded-2xl bg-[color:var(--gold)] px-6 font-semibold text-[color:var(--charcoal)] shadow-[0_2px_10px_rgba(212,175,55,0.45)] ring-2 ring-[color:var(--charcoal)]/10 transition hover:brightness-[1.06] active:scale-[0.99]"
            >
              Choose CSV file
            </label>
            <input
              id={uploadInputId}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
              setError(null);
              setStatus(null);
              try {
                const f = e.target.files?.[0];
                if (!f) {
                  setSelectedFileName(null);
                  return;
                }
                setSelectedFileName(f.name);
                const token = getAuthToken();
                if (!token) throw new Error("Sign in as admin first.");
                const text = await f.text();
                const r = await fetch(`${base}/api/admin/products-csv`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ csv: text }),
                });
                const j = await r.json().catch(() => ({}));
                if (!r.ok) throw new Error(j?.error || "Import failed");
                setStatus("Import complete.");
              } catch (e2: any) {
                setError(e2?.message || "Import failed");
              } finally {
                e.currentTarget.value = "";
              }
            }}
            />
            {selectedFileName ? (
              <p className="text-sm text-black/55">
                Last selected: <span className="font-medium text-black/80">{selectedFileName}</span>
              </p>
            ) : (
              <p className="text-xs text-black/45">Accepted: .csv</p>
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

