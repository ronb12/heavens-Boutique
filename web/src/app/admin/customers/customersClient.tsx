"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { COUNTRY_OPTIONS, SELECT_FIELD_CLASS, US_STATE_OPTIONS } from "@/lib/formOptions";

type Customer = {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
};

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

function generateTempPassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const len = 14;
  const out: string[] = [];
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) {
    out.push(chars[buf[i]! % chars.length]);
  }
  return out.join("") + "!A1";
}

export function AdminCustomersClient() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostal, setAddrPostal] = useState("");
  const [addrCountry, setAddrCountry] = useState("US");
  const [addrCompany, setAddrCompany] = useState("");
  const [saving, setSaving] = useState(false);

  const loadCustomers = useCallback(async () => {
    setError(null);
    try {
      const r = await apiFetch<{ customers: Customer[] }>("/api/admin/customers", { method: "GET" });
      setCustomers(r.customers || []);
    } catch (e: unknown) {
      let msg = "Failed to load customers";
      if (typeof e === "object" && e !== null && "message" in e) msg = String((e as { message: unknown }).message);
      else if (e instanceof Error) msg = e.message;
      setError(msg);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  return (
    <AdminShell title="Customers">
      <div className="mb-10 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
        <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Account</p>
          <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
            Add customer
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-black/55">
            Creates a storefront login. Share the password with the customer securely (they can change it after signing in).
            Minimum 8 characters — use generate if you don’t want to pick one.
          </p>
        </div>

        <form
          className="grid gap-5 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError(null);
            try {
              const hasAddr =
                addrLine1.trim() && addrCity.trim() && addrPostal.trim() && (addrCountry.trim() || "US");
              const body: Record<string, unknown> = {
                email: email.trim().toLowerCase(),
                password: password.trim(),
                firstName: firstName.trim() || undefined,
                lastName: lastName.trim() || undefined,
                phone: phone.trim() || undefined,
                marketingEmails,
              };
              if (hasAddr) {
                body.defaultAddress = {
                  company: addrCompany.trim() || undefined,
                  line1: addrLine1.trim(),
                  line2: addrLine2.trim() || undefined,
                  city: addrCity.trim(),
                  state: addrState.trim() || undefined,
                  postal: addrPostal.trim(),
                  country: addrCountry.trim() || "US",
                };
              }
              const r = await apiFetch<{ customer: { id: string } }>("/api/admin/customers", {
                method: "POST",
                body: JSON.stringify(body),
              });
              await loadCustomers();
              router.push(`/admin/customers/${r.customer.id}`);
            } catch (err: unknown) {
              let msg = "Could not create customer";
              if (typeof err === "object" && err !== null && "message" in err) {
                msg = String((err as { message: unknown }).message);
              } else if (err instanceof Error) msg = err.message;
              setError(msg);
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Email</span>
              <input
                type="email"
                autoComplete="off"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT_CLASS}
                placeholder="customer@example.com"
              />
            </label>
            <div className="grid gap-2">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Password</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="text"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${INPUT_CLASS} sm:min-w-0 sm:flex-1`}
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  className="h-11 shrink-0 rounded-full border border-black/[0.1] bg-[#fffafb] px-4 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:border-[color:var(--gold)]/40"
                  onClick={() => {
                    const p = generateTempPassword();
                    setPassword(p);
                  }}
                >
                  Generate
                </button>
              </div>
              <span className="text-xs text-black/45">Store this somewhere safe before saving — it won’t be shown again.</span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">First name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Last name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Phone</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
                placeholder="Optional"
              />
            </label>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-black/[0.07] bg-[#fffafb]/80 px-4 py-3">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-black/20"
              checked={marketingEmails}
              onChange={(e) => setMarketingEmails(e.target.checked)}
            />
            <span className="text-sm text-black/75">
              <span className="font-semibold text-[color:var(--charcoal)]">Marketing emails</span>
              <span className="text-black/50"> · Adds the marketing tag for campaigns.</span>
            </span>
          </label>

          <div className="rounded-2xl border border-black/[0.06] bg-black/[0.02] p-5">
            <div className="text-sm font-semibold text-[color:var(--charcoal)]">Default shipping address</div>
            <p className="mt-1 text-xs text-black/45">Optional. Requires street, city, and ZIP/postal to save.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-semibold text-black/55">Company (optional)</span>
                <input value={addrCompany} onChange={(e) => setAddrCompany(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-semibold text-black/55">Street line 1</span>
                <input value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span className="text-xs font-semibold text-black/55">Street line 2</span>
                <input value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold text-black/55">City</span>
                <input value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold text-black/55">State / province</span>
                {addrCountry === "US" ? (
                  <select
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    className={`${SELECT_FIELD_CLASS} w-full`}
                  >
                    <option value="">—</option>
                    {US_STATE_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={addrState} onChange={(e) => setAddrState(e.target.value)} className={INPUT_CLASS} />
                )}
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold text-black/55">Postal code</span>
                <input value={addrPostal} onChange={(e) => setAddrPostal(e.target.value)} className={INPUT_CLASS} />
              </label>
              <label className="grid gap-2">
                <span className="text-xs font-semibold text-black/55">Country</span>
                <select
                  value={addrCountry}
                  onChange={(e) => setAddrCountry(e.target.value)}
                  className={`${SELECT_FIELD_CLASS} w-full`}
                >
                  {COUNTRY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="h-12 rounded-full bg-[color:var(--gold)] px-8 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_6px_24px_rgba(212,175,55,0.38)] transition hover:brightness-[1.06] disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create customer"}
            </button>
          </div>
        </form>
      </div>

      {error ? <div className="mb-6 text-sm text-rose-700 font-semibold">{error}</div> : null}

      <div className="mt-2 font-semibold text-[color:var(--charcoal)]">All customers</div>
      <div className="mt-4 grid gap-3">
        {customers.map((c) => (
          <Link
            key={c.id}
            href={`/admin/customers/${c.id}`}
            className="block rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          >
            <div className="font-semibold">{c.fullName || c.email}</div>
            <div className="mt-1 text-sm text-black/55">{c.email}</div>
            <div className="mt-1 text-sm text-black/55">Joined {new Date(c.createdAt).toLocaleDateString()}</div>
          </Link>
        ))}
        {!customers.length ? (
          <div className="rounded-3xl border border-black/10 bg-white/80 p-8 text-black/60">
            No customers yet — add one above.
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
