"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { PERM } from "@/lib/staffPermissions";

type StaffRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  staffPermissions: Record<string, boolean>;
  staffActive: boolean;
  createdAt?: string | null;
};

const LABELS: { key: keyof typeof PERM; label: string }[] = [
  { key: "ORDERS", label: "Orders & fulfillment" },
  { key: "PRODUCTS", label: "Products & catalog" },
  { key: "INVENTORY", label: "Inventory & counts" },
  { key: "CUSTOMERS", label: "Customers & messages" },
  { key: "RETURNS", label: "Returns" },
  { key: "DISCOUNTS", label: "Discount codes" },
  { key: "GIFT_CARDS", label: "Gift cards" },
  { key: "CONTENT", label: "Pages & journal" },
  { key: "HOMEPAGE", label: "App home screen (CMS)" },
  { key: "MARKETING", label: "Marketing notifications" },
  { key: "REPORTS", label: "Financial reports" },
  { key: "SETTINGS", label: "Stripe & EasyPost keys" },
  { key: "PURCHASE_ORDERS", label: "Purchase orders" },
  { key: "PROMO_ANALYTICS", label: "Promo analytics" },
  { key: "PRODUCTS_CSV", label: "Bulk CSV import/export" },
];

export function StaffAdminClient() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [invitePerms, setInvitePerms] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch<{ staff: StaffRow[] }>("/api/admin/staff", { method: "GET" });
      setRows(r.staff);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "Failed";
      setError(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function inviteStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const permObj: Record<string, boolean> = {};
    for (const { key } of LABELS) {
      const apiKey = PERM[key];
      permObj[apiKey] = Boolean(invitePerms[apiKey]);
    }
    try {
      await apiFetch("/api/admin/staff", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim() || undefined,
          permissions: permObj,
        }),
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setInvitePerms({});
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      setError(msg || "Could not create staff");
    }
  }

  async function toggleActive(row: StaffRow, active: boolean) {
    setError(null);
    try {
      await apiFetch(`/api/admin/staff?id=${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ staffActive: active }),
      });
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      setError(msg || "Update failed");
    }
  }

  async function removeStaff(row: StaffRow) {
    if (!confirm(`Remove ${row.email} from staff? They become a regular customer account.`)) return;
    setError(null);
    try {
      await apiFetch(`/api/admin/staff?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      await load();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "";
      setError(msg || "Remove failed");
    }
  }

  return (
    <div className="space-y-10">
      <p className="text-black/65 max-w-2xl">
        Invite team members with passwords and assign areas they can access. Only
        store owners manage this list.
      </p>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      ) : null}

      <section className="rounded-3xl border border-black/10 bg-white/80 p-6">
        <h2 className="text-lg font-semibold">Invite staff</h2>
        <p className="mt-1 text-sm text-black/55">Creates a staff login or upgrades an existing customer account.</p>
        <form onSubmit={inviteStaff} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-black/80">Email</span>
            <input
              className="mt-1 w-full rounded-xl border border-black/12 px-3 py-2"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-black/80">Temporary password</span>
            <input
              className="mt-1 w-full rounded-xl border border-black/12 px-3 py-2"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-black/80">Display name (optional)</span>
            <input
              className="mt-1 w-full rounded-xl border border-black/12 px-3 py-2"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <div className="sm:col-span-2">
            <div className="text-sm font-medium text-black/80">Permissions</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {LABELS.map(({ key, label }) => {
                const apiKey = PERM[key];
                return (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(invitePerms[apiKey])}
                      onChange={(e) =>
                        setInvitePerms((p) => ({
                          ...p,
                          [apiKey]: e.target.checked,
                        }))
                      }
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-[color:var(--gold)] px-6 py-3 text-sm font-semibold text-[color:var(--charcoal)]"
            >
              Add staff member
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Team</h2>
        {loading ? (
          <p className="mt-4 text-sm text-black/55">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-black/55">No team members yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-2xl border border-black/10 bg-white/80 px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="font-semibold">{row.email}</div>
                  <div className="text-sm text-black/55">
                    {row.role === "admin" ? (
                      <span className="text-[color:var(--gold)] font-medium">Store owner</span>
                    ) : row.staffActive ? (
                      "Staff"
                    ) : (
                      <span className="text-red-700">Deactivated</span>
                    )}
                    {row.fullName ? ` · ${row.fullName}` : ""}
                  </div>
                  {row.role === "staff" ? (
                    <div className="mt-2 text-xs text-black/45">
                      {Object.entries(row.staffPermissions || {})
                        .filter(([, v]) => v)
                        .map(([k]) => k)
                        .join(", ") || "No permissions"}
                    </div>
                  ) : null}
                </div>
                {row.role === "staff" ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-black/15 px-4 py-2 text-sm font-medium"
                      onClick={() => void toggleActive(row, !row.staffActive)}
                    >
                      {row.staffActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-800"
                      onClick={() => void removeStaff(row)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
