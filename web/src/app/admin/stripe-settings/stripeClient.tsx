"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";

type StripeSettings = {
  publishableKey: string | null;
  secretKey: string | null;
  webhookSecret: string | null;
};

export function AdminStripeSettingsClient() {
  const [form, setForm] = useState<StripeSettings>({
    publishableKey: "",
    secretKey: "",
    webhookSecret: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ settings: StripeSettings }>("/api/admin/stripe-settings", { method: "GET" });
        if (mounted) setForm(r.settings || form);
      } catch (e: any) {
        if (mounted) setError(e?.message || "Failed to load Stripe settings");
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AdminShell title="Stripe settings">
      <p className="text-black/60 max-w-3xl">
        Configure Stripe keys used by checkout + webhooks. Values are stored in the database.
      </p>
      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {saved ? <div className="mt-4 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

      <div className="mt-6 rounded-3xl border border-black/10 bg-white/80 p-6 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Publishable key</span>
          <input
            value={form.publishableKey || ""}
            onChange={(e) => setForm((f) => ({ ...f, publishableKey: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            placeholder="pk_live_..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Secret key</span>
          <input
            value={form.secretKey || ""}
            onChange={(e) => setForm((f) => ({ ...f, secretKey: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            placeholder="sk_live_..."
          />
        </label>
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Webhook secret</span>
          <input
            value={form.webhookSecret || ""}
            onChange={(e) => setForm((f) => ({ ...f, webhookSecret: e.target.value }))}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            placeholder="whsec_..."
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
              await apiFetch("/api/admin/stripe-settings", { method: "POST", body: JSON.stringify(form) });
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

