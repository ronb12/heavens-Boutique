"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch, type ApiError } from "@/lib/api";

function apiErrMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) return String((e as ApiError).message);
  if (e instanceof Error) return e.message;
  return "Request failed";
}

type PromoRow = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
};

export function DiscountsAdminClient() {
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed_cents">("percent");
  const [valueText, setValueText] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, true>>({});

  const load = async () => {
    const r = await apiFetch<{ promos: PromoRow[] }>("/api/admin/promos", { method: "GET" });
    setRows(r.promos || []);
  };

  useEffect(() => {
    let m = true;
    (async () => {
      try {
        await load();
      } catch (e: unknown) {
        if (m) setError(apiErrMessage(e));
      }
    })();
    return () => {
      m = false;
    };
  }, []);

  const summary = (p: PromoRow) => {
    if (p.discount_type === "percent") return `${p.discount_value}% off`;
    return `$${(p.discount_value / 100).toFixed(2)} off`;
  };

  return (
    <AdminShell title="Discount codes">
      <p className="text-black/60 max-w-2xl">
        Create checkout promo codes with percentage or fixed-amount discounts.
      </p>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

      <form
        className="mt-8 max-w-md grid gap-3 rounded-3xl border border-black/10 bg-white/80 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          try {
            const c = code.trim().toUpperCase();
            if (c.length < 2) throw new Error("Enter a code");
            let discountValue: number;
            if (discountType === "percent") {
              const v = Number(valueText);
              if (!Number.isFinite(v) || v <= 0 || v > 100) throw new Error("Percent must be 1–100");
              discountValue = Math.round(v);
            } else {
              const dollars = Number(valueText);
              if (!Number.isFinite(dollars) || dollars <= 0) throw new Error("Enter a dollar amount");
              discountValue = Math.round(dollars * 100);
            }
            const body: Record<string, unknown> = {
              code: c,
              discountType,
              discountValue,
            };
            const mu = maxUses.trim();
            if (mu) {
              const n = Number(mu);
              if (Number.isFinite(n) && n > 0) body.maxUses = n;
            }
            await apiFetch("/api/admin/promos", { method: "POST", body: JSON.stringify(body) });
            setCode("");
            setValueText(discountType === "percent" ? "10" : "5");
            setMaxUses("");
            await load();
          } catch (err: unknown) {
            setError(apiErrMessage(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="font-semibold">New discount</div>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-11 rounded-2xl border border-black/10 px-4 uppercase"
            required
            minLength={2}
          />
        </label>
        <div className="grid gap-2">
          <span className="text-sm font-semibold">Type</span>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex-1 h-10 rounded-2xl text-sm font-semibold ${
                discountType === "percent" ? "bg-[color:var(--gold)] text-[color:var(--charcoal)]" : "border border-black/10"
              }`}
              onClick={() => {
                setDiscountType("percent");
                setValueText("10");
              }}
            >
              Percent
            </button>
            <button
              type="button"
              className={`flex-1 h-10 rounded-2xl text-sm font-semibold ${
                discountType === "fixed_cents" ? "bg-[color:var(--gold)] text-[color:var(--charcoal)]" : "border border-black/10"
              }`}
              onClick={() => {
                setDiscountType("fixed_cents");
                setValueText("5");
              }}
            >
              Fixed ($)
            </button>
          </div>
        </div>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">{discountType === "percent" ? "Percent" : "Dollars"}</span>
          <input
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            className="h-11 rounded-2xl border border-black/10 px-4"
            type="number"
            min={0.01}
            step={0.01}
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm font-semibold">Max uses (optional)</span>
          <input
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="h-11 rounded-2xl border border-black/10 px-4"
            type="number"
            min={1}
            step={1}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
        >
          {saving ? "Saving…" : "Create code"}
        </button>
      </form>

      <div className="mt-10">
        <div className="font-semibold">All codes</div>
        <ul className="mt-3 space-y-2">
          {rows.map((p) => (
            <li
              key={p.id}
              className="rounded-2xl border border-black/10 bg-white/80 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono font-semibold">{p.code}</span>
                  <span className="text-sm text-black/60">
                    {summary(p)} · uses {p.uses_count}
                    {p.max_uses != null ? ` / ${p.max_uses}` : ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-black/45">{p.active ? "Enabled" : "Disabled"}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!!busyIds[p.id]}
                  className={`h-9 rounded-full px-4 text-sm font-semibold border ${
                    p.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-black/10 bg-white text-black/70"
                  } disabled:opacity-60`}
                  onClick={async () => {
                    setError(null);
                    setBusyIds((s) => ({ ...s, [p.id]: true }));
                    try {
                      await apiFetch("/api/admin/promos", {
                        method: "PATCH",
                        body: JSON.stringify({ id: p.id, active: !p.active }),
                      });
                      await load();
                    } catch (e: unknown) {
                      setError(apiErrMessage(e));
                    } finally {
                      setBusyIds((s) => {
                        const next = { ...s };
                        delete next[p.id];
                        return next;
                      });
                    }
                  }}
                >
                  {p.active ? "Disable" : "Enable"}
                </button>

                <button
                  type="button"
                  disabled={!!busyIds[p.id]}
                  className="h-9 rounded-full px-4 text-sm font-semibold border border-rose-200 bg-rose-50 text-rose-800 disabled:opacity-60"
                  onClick={async () => {
                    if (!confirm(`Delete code ${p.code}? This cannot be undone.`)) return;
                    setError(null);
                    setBusyIds((s) => ({ ...s, [p.id]: true }));
                    try {
                      await apiFetch("/api/admin/promos", {
                        method: "PATCH",
                        body: JSON.stringify({ id: p.id, delete: true }),
                      });
                      await load();
                    } catch (e: unknown) {
                      setError(apiErrMessage(e));
                    } finally {
                      setBusyIds((s) => {
                        const next = { ...s };
                        delete next[p.id];
                        return next;
                      });
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}
