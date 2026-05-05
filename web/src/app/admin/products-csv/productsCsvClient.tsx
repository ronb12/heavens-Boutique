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
  const sampleCsv = [
    "name,slug,category,description,price,cost,supplier_name,supplier_url,supplier_notes,image_urls,size,sku,stock,is_featured",
    "\"Midnight Glow Curve Maxi Dress\",midnight-glow-curve-maxi-dress,Dresses,\"Curve-friendly black maxi dress for date night and birthday looks\",39.99,12.14,AliExpress,https://www.aliexpress.us/item/3256810343301765.html,\"Ships from U.S. partner warehouse if available. Verify sizes before ordering.\",\"https://example.com/image1.jpg|https://example.com/image2.jpg\",1X,HB-MIDNIGHT-1X,10,true",
    "\"Midnight Glow Curve Maxi Dress\",midnight-glow-curve-maxi-dress,Dresses,\"Curve-friendly black maxi dress for date night and birthday looks\",39.99,12.14,AliExpress,https://www.aliexpress.us/item/3256810343301765.html,\"Ships from U.S. partner warehouse if available. Verify sizes before ordering.\",\"https://example.com/image1.jpg|https://example.com/image2.jpg\",2X,HB-MIDNIGHT-2X,10,true",
  ].join("\n");

  return (
    <AdminShell title="Products CSV">
      <p className="text-black/60 max-w-3xl">
        Export products or import 10-100 supplier-sourced items at once. Use one row per variant/size; rows with the same
        slug update the same product.
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
          <p className="mt-2 text-sm text-black/60">
            Upload a CSV file to upsert products, supplier links, image URLs, cost, pricing, and variants.
          </p>
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
                setStatus(
                  `Import complete. Created ${j?.createdProducts ?? 0}, updated ${j?.updatedProducts ?? 0}, variants ${j?.upsertedVariants ?? 0}.`,
                );
              } catch (e2: unknown) {
                setError(e2 instanceof Error ? e2.message : "Import failed");
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

      <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-semibold">Bulk import template</div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-black/60">
              Required columns: <span className="font-semibold">name</span>, <span className="font-semibold">slug</span>,{" "}
              <span className="font-semibold">price</span>, and <span className="font-semibold">size</span>. Optional
              supplier columns let the store track AliExpress cost, URL, and notes.
            </p>
          </div>
          <button
            type="button"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold"
            onClick={() => navigator.clipboard?.writeText(sampleCsv)}
          >
            Copy sample
          </button>
        </div>
        <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-black/[0.04] p-4 text-xs leading-5 text-black/70">
          {sampleCsv}
        </pre>
      </div>
    </AdminShell>
  );
}
