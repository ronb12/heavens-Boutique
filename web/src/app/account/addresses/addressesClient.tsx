"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { apiFetch } from "@/lib/api";
import { AccountSubNav } from "@/components/AccountSubNav";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  COUNTRY_OPTIONS,
  US_STATE_OPTIONS,
  coerceCountryCode,
  coerceUsStateCode,
  SELECT_FIELD_CLASS,
} from "@/lib/formOptions";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

type Address = {
  id: string;
  name: string | null;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal: string;
  country: string;
  isDefault: boolean;
};

const emptyForm = {
  id: "" as string,
  name: "",
  label: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postal: "",
  country: "US",
  isDefault: false,
};

export function AddressesClient() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<Address[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = Boolean(form.id);

  const load = async () => {
    const r = await apiFetch<{ addresses: Address[] }>("/api/users/addresses", { method: "GET" });
    setRows(r.addresses || []);
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        await load();
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load addresses"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  }, [rows]);

  const countryCode = coerceCountryCode(form.country);
  const isUS = countryCode === "US";
  const countrySelectOptions = useMemo(() => {
    const base = [...COUNTRY_OPTIONS];
    if (countryCode && !base.some((c) => c.value === countryCode)) {
      return [{ value: countryCode, label: `${countryCode} (saved)` }, ...base];
    }
    return base;
  }, [countryCode]);

  if (loading) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="account" />
        <main className="mx-auto max-w-5xl px-4 py-12 flex-1 text-black/60">Loading…</main>
        <SiteFooter />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-full flex flex-col">
        <SiteHeader active="account" />
        <main className="mx-auto max-w-5xl px-4 py-12 flex-1">
          <h1 className="text-3xl">Addresses</h1>
          <p className="mt-2 text-black/60">Sign in to manage shipping addresses.</p>
          <div className="mt-6">
            <Link
              href="/login?next=%2Faccount%2Faddresses"
              className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
            >
              Sign in
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="account" />

      <main className="mx-auto max-w-5xl px-4 py-10 flex-1">
        <AccountSubNav />
        <div>
          <h1 className="text-3xl">Addresses</h1>
          <p className="mt-2 text-black/60">Save addresses for faster checkout.</p>
        </div>

        {error ? <div className="mt-6 text-sm text-rose-700 font-semibold">{error}</div> : null}
        {saved ? <div className="mt-6 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-2 items-start">
          <div className="rounded-3xl border border-black/10 bg-white/80 p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold text-lg">Saved</div>
              <button
                type="button"
                className="px-4 py-2 rounded-full border border-black/10 bg-white font-semibold"
                onClick={() => {
                  setForm(emptyForm);
                  setSaved(null);
                  setError(null);
                }}
              >
                New
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {sorted.length ? (
                sorted.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSaved(null);
                      setError(null);
                      setForm({
                        id: a.id,
                        name: a.name || "",
                        label: a.label || "",
                        line1: a.line1,
                        line2: a.line2 || "",
                        city: a.city,
                        state: a.state || "",
                        postal: a.postal,
                        country: a.country || "US",
                        isDefault: Boolean(a.isDefault),
                      });
                    }}
                    className={[
                      "text-left rounded-2xl border p-4 transition",
                      form.id === a.id ? "border-black/40 bg-white" : "border-black/10 bg-white/70 hover:shadow-sm",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold">{a.label || "Address"}</div>
                      {a.isDefault ? (
                        <span className="text-xs font-semibold rounded-full bg-[color:var(--soft-pink)] px-3 py-1">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-black/60">
                      {a.name ? `${a.name} · ` : ""}
                      {a.line1}
                      {a.line2 ? `, ${a.line2}` : ""}, {a.city}
                      {a.state ? `, ${a.state}` : ""} {a.postal} · {a.country}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-black/60">No addresses yet.</div>
              )}
            </div>
          </div>

          <form
            className="rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setError(null);
              setSaved(null);
              try {
                const shipCountry = coerceCountryCode(form.country);
                const payload = {
                  name: form.name.trim() || null,
                  label: form.label.trim() || null,
                  line1: form.line1.trim(),
                  line2: form.line2.trim() || null,
                  city: form.city.trim(),
                  state:
                    shipCountry === "US"
                      ? coerceUsStateCode(form.state) || null
                      : form.state.trim() || null,
                  postal: form.postal.trim(),
                  country: shipCountry,
                  isDefault: Boolean(form.isDefault),
                };

                if (isEditing) {
                  await apiFetch(`/api/users/addresses/${encodeURIComponent(form.id)}`, {
                    method: "PATCH",
                    body: JSON.stringify(payload),
                  });
                } else {
                  await apiFetch("/api/users/addresses", {
                    method: "POST",
                    body: JSON.stringify(payload),
                  });
                }

                setSaved("Saved.");
                await load();
              } catch (err: unknown) {
                setError(errMsg(err, "Save failed"));
              } finally {
                setSaving(false);
              }
            }}
          >
            <div className="font-semibold text-lg">{isEditing ? "Edit address" : "Add address"}</div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Recipient name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Label (optional)</span>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                placeholder="Home, Work…"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Line 1</span>
              <input
                value={form.line1}
                onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                required
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Line 2</span>
              <input
                value={form.line2}
                onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Country</span>
              <select
                value={countryCode}
                onChange={(e) => {
                  const next = e.target.value;
                  setForm((f) => ({
                    ...f,
                    country: next,
                    state:
                      next === "US"
                        ? coerceUsStateCode(f.state)
                        : f.state.trim(),
                  }));
                }}
                className={SELECT_FIELD_CLASS}
              >
                {countrySelectOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">City</span>
                <input
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                  required
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-semibold">{isUS ? "State" : "State / region"}</span>
                {isUS ? (
                  <select
                    value={coerceUsStateCode(form.state)}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className={SELECT_FIELD_CLASS}
                  >
                    <option value="">Select state</option>
                    {US_STATE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.state}
                    onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
                    className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                    placeholder="Optional"
                  />
                )}
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Postal</span>
              <input
                value={form.postal}
                onChange={(e) => setForm((f) => ({ ...f, postal: e.target.value }))}
                className="h-11 rounded-2xl border border-black/10 bg-white px-4"
                required
              />
            </label>

            <label className="flex items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
              />
              Set as default
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-12 px-6 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save address"}
              </button>

              {isEditing ? (
                <button
                  type="button"
                  className="h-12 px-6 rounded-full border border-black/10 bg-white font-semibold"
                  onClick={async () => {
                    const ok = window.confirm("Delete this address?");
                    if (!ok) return;
                    setSaving(true);
                    setError(null);
                    setSaved(null);
                    try {
                      await apiFetch(`/api/users/addresses/${encodeURIComponent(form.id)}`, { method: "DELETE" });
                      setSaved("Deleted.");
                      setForm(emptyForm);
                      await load();
                    } catch (e: unknown) {
                      setError(errMsg(e, "Delete failed"));
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
