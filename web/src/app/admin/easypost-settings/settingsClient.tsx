"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

type Settings = {
  apiKey: string | null;
  fromName: string | null;
  fromStreet1: string | null;
  fromStreet2: string | null;
  fromCity: string | null;
  fromState: string | null;
  fromZip: string | null;
  fromPhone: string | null;
  fromEmail: string | null;
};

export function AdminEasyPostSettingsClient() {
  const [form, setForm] = useState<Settings>({
    apiKey: "",
    fromName: "",
    fromStreet1: "",
    fromStreet2: "",
    fromCity: "",
    fromState: "",
    fromZip: "",
    fromPhone: "",
    fromEmail: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ settings: Settings }>("/api/admin/easypost-settings", { method: "GET" });
        if (mounted) setForm(r.settings || form);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load EasyPost settings");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="EasyPost settings">
      <p className="text-black/60 max-w-3xl">
        Configure EasyPost for shipping + returns. Values are stored in the database and can be overridden by env vars.
      </p>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {saved ? <div className="mt-4 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

      <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">API key</span>
          <input
            value={form.apiKey || ""}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            placeholder="EZAK..."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">From name</span>
            <input
              value={form.fromName || ""}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">From email</span>
            <input
              value={form.fromEmail || ""}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Street 1</span>
          <input
            value={form.fromStreet1 || ""}
            onChange={(e) => setForm((f) => ({ ...f, fromStreet1: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Street 2</span>
          <input
            value={form.fromStreet2 || ""}
            onChange={(e) => setForm((f) => ({ ...f, fromStreet2: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">City</span>
            <input
              value={form.fromCity || ""}
              onChange={(e) => setForm((f) => ({ ...f, fromCity: e.target.value }))}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">State</span>
            <input
              value={form.fromState || ""}
              onChange={(e) => setForm((f) => ({ ...f, fromState: e.target.value }))}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">ZIP</span>
            <input
              value={form.fromZip || ""}
              onChange={(e) => setForm((f) => ({ ...f, fromZip: e.target.value }))}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            />
          </label>
        </div>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Phone</span>
          <input
            value={form.fromPhone || ""}
            onChange={(e) => setForm((f) => ({ ...f, fromPhone: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
          />
        </label>

        <button
          type="button"
          disabled={saving}
          className="h-12 px-6 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
          onClick={async () => {
            setSaved(null);
            setError(null);
            setSaving(true);
            try {
              await apiFetch("/api/admin/easypost-settings", {
                method: "POST",
                body: JSON.stringify(form),
              });
              setSaved("Saved.");
            } catch (e: any) {
              setError(e?.message || "Save failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </AdminShell>
  );
}

