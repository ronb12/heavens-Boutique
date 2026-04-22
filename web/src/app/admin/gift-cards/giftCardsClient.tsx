"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import { formatUsd } from "@/lib/money";
import { GiftCardBalanceRow, GiftCardIssueFormShell, GiftCardIssuedReveal } from "@/components/GiftCardChrome";

type Row = {
  id: string;
  balanceCents: number;
  recipientEmail: string | null;
  internalNote: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  recoveryAvailable?: boolean;
};

type GiftCardDetailResponse = {
  giftCard: Row;
  revealedCode: string | null;
  legacyNoCipher: boolean;
};

type ReissueResponse = {
  ok: boolean;
  code: string;
  emailed: boolean;
  message?: string;
};

function apiErrMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: string }).message);
  }
  return "Something went wrong";
}

export function GiftCardsAdminClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [purchaseEnabled, setPurchaseEnabled] = useState(true);
  const [purchaseForcedOffByEnv, setPurchaseForcedOffByEnv] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [toggleSaving, setToggleSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState("25");
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [createdBalanceCents, setCreatedBalanceCents] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryTargetId, setRecoveryTargetId] = useState<string | null>(null);
  const [recoveryDetail, setRecoveryDetail] = useState<GiftCardDetailResponse | null>(null);
  const [reissueLoading, setReissueLoading] = useState(false);
  const [replacement, setReplacement] = useState<{ code: string; balanceCents: number; footer: string } | null>(
    null,
  );

  const load = async () => {
    const r = await apiFetch<{ giftCards: Row[] }>("/api/admin/gift-cards", { method: "GET" });
    setRows(r.giftCards || []);
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<{
          giftCardsPurchaseEnabled?: boolean;
          giftCardsPurchaseDisabledByEnv?: boolean;
        }>("/api/admin/store-settings", { method: "GET" });
        if (!alive) return;
        setPurchaseEnabled(r.giftCardsPurchaseEnabled !== false);
        setPurchaseForcedOffByEnv(Boolean(r.giftCardsPurchaseDisabledByEnv));
      } catch {
        if (!alive) return;
      } finally {
        if (alive) setSettingsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function openRecovery(id: string) {
    setRecoveryTargetId(id);
    setRecoveryDetail(null);
    setRecoveryOpen(true);
    setRecoveryLoading(true);
    setError(null);
    try {
      const d = await apiFetch<GiftCardDetailResponse>(`/api/admin/gift-cards/${id}`, { method: "GET" });
      setRecoveryDetail(d);
    } catch (e: unknown) {
      setError(apiErrMessage(e));
      setRecoveryOpen(false);
    } finally {
      setRecoveryLoading(false);
    }
  }

  async function runReissue(id: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Issue a new code? The previous code will stop working. If a recipient email is on file, we can email the new code.",
      )
    ) {
      return;
    }
    setReissueLoading(true);
    setError(null);
    try {
      const r = await apiFetch<ReissueResponse>(`/api/admin/gift-cards/${id}/reissue`, {
        method: "POST",
        body: JSON.stringify({ sendEmail: true }),
      });
      const row = rows.find((x) => x.id === id);
      const bal = row?.balanceCents ?? recoveryDetail?.giftCard.balanceCents ?? 0;
      setReplacement({
        code: r.code,
        balanceCents: bal,
        footer: r.message || (r.emailed ? "New code emailed to recipient." : "Copy this code for the customer."),
      });
      setRecoveryOpen(false);
      await load();
      const d = await apiFetch<GiftCardDetailResponse>(`/api/admin/gift-cards/${id}`, { method: "GET" }).catch(
        () => null,
      );
      if (d) setRecoveryDetail(d);
    } catch (e: unknown) {
      setError(apiErrMessage(e));
    } finally {
      setReissueLoading(false);
    }
  }

  return (
    <AdminShell title="Gift cards">
      <div className="text-black/60 max-w-2xl space-y-3">
        <p>
          Create store-credit codes. When a customer loses their email or code, verify their purchase (order receipt,
          last four of card, billing address), then use <span className="font-semibold text-black/75">Reveal code</span>{" "}
          for cards issued after encryption is enabled, or <span className="font-semibold text-black/75">Replace code</span>{" "}
          to invalidate the old code and email a new one to the address on file.
        </p>
        <p className="text-sm">
          Customers should contact support — never share codes in public channels. Set a recipient email on the card when
          possible so replacements can be delivered automatically.
        </p>
      </div>

      <div className="mt-8 max-w-xl rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="font-semibold text-[color:var(--charcoal)]">Online gift card sales</div>
        <p className="mt-2 text-sm text-black/55">
          When turned off, customers cannot buy new gift cards on the website (existing codes still redeem at checkout).
        </p>
        {purchaseForcedOffByEnv ? (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
            Emergency server flag is forcing purchases off — toggling below has no effect until that is cleared.
          </p>
        ) : null}
        <label className="mt-4 flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-5 w-5 rounded border-black/20"
            checked={purchaseEnabled}
            disabled={settingsLoading || toggleSaving || purchaseForcedOffByEnv}
            onChange={async (e) => {
              const on = e.target.checked;
              setToggleSaving(true);
              setError(null);
              try {
                const saved = await apiFetch<{ giftCardsPurchaseEnabled?: boolean }>("/api/admin/store-settings", {
                  method: "PATCH",
                  body: JSON.stringify({ giftCardsPurchaseEnabled: on }),
                });
                setPurchaseEnabled(saved.giftCardsPurchaseEnabled !== false);
              } catch (err: unknown) {
                setError(apiErrMessage(err));
              } finally {
                setToggleSaving(false);
              }
            }}
          />
          <span className="text-sm font-semibold text-black/80">
            {settingsLoading ? "Loading…" : "Allow customers to purchase gift cards online"}
          </span>
        </label>
      </div>

      {error ? <div className="mt-4 text-sm text-rose-700 font-semibold">{error}</div> : null}

      {replacement ? (
        <div className="mt-6 max-w-lg">
          <GiftCardIssuedReveal
            code={replacement.code}
            balanceCents={replacement.balanceCents}
            formatUsd={formatUsd}
            footerNote={replacement.footer}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(replacement.code);
              } catch {
                /* ignore */
              }
            }}
          />
        </div>
      ) : null}

      {created && createdBalanceCents != null ? (
        <div className="mt-6 max-w-lg">
          <GiftCardIssuedReveal
            code={created}
            balanceCents={createdBalanceCents}
            formatUsd={formatUsd}
            onCopy={async () => {
              try {
                await navigator.clipboard.writeText(created);
              } catch {
                /* ignore */
              }
            }}
          />
        </div>
      ) : null}

      <form
        className="mt-8 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          setError(null);
          setCreated(null);
          setCreatedBalanceCents(null);
          try {
            const cents = Math.round(Number(amount) * 100);
            const r = await apiFetch<{ code: string }>("/api/admin/gift-cards", {
              method: "POST",
              body: JSON.stringify({
                initialBalanceCents: cents,
                internalNote: note.trim() || null,
                recipientEmail: email.trim() || null,
              }),
            });
            setCreated(r.code);
            setCreatedBalanceCents(cents);
            await load();
            setNote("");
            setEmail("");
          } catch (err: unknown) {
            setError(apiErrMessage(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <GiftCardIssueFormShell
          title="Issue a new card"
          subtitle="Balance is stored as store credit. The customer redeems this code at checkout."
        >
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-black/75">Amount (USD)</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 shadow-sm"
              type="number"
              min={1}
              step={1}
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-black/75">Recipient email (optional)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 shadow-sm"
              type="email"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-black/75">Internal note</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4 shadow-sm"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="mt-2 h-12 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold shadow-[0_6px_24px_rgba(212,175,55,0.35)] disabled:opacity-60"
          >
            {saving ? "Creating…" : "Create gift card"}
          </button>
        </GiftCardIssueFormShell>
      </form>

      <div className="mt-10 font-semibold text-lg font-[family-name:var(--font-display)]">Issued cards</div>
      <p className="mt-1 text-sm text-black/55 max-w-2xl">
        Remaining balance per card. Codes are stored encrypted for staff recovery; very old rows may only support
        replacement.
      </p>
      <div className="mt-4 grid gap-4 max-w-2xl">
        {rows.map((r) => (
          <div key={r.id} className="space-y-2">
            <GiftCardBalanceRow
              balanceCents={r.balanceCents}
              formatUsd={formatUsd}
              active={r.active}
              meta={
                <>
                  <span className="font-mono text-xs text-white/45">ID {r.id.slice(0, 8)}…</span>
                  {r.recipientEmail ? <div className="mt-1 text-white/80">{r.recipientEmail}</div> : null}
                  {r.internalNote ? <div className="mt-1 text-white/55">{r.internalNote}</div> : null}
                  {r.recoveryAvailable === false ? (
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-amber-200/95">
                      Legacy row — replace code to enable recovery
                    </div>
                  ) : null}
                </>
              }
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openRecovery(r.id)}
                className="rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm hover:bg-black/[0.02]"
              >
                Reveal / replace
              </button>
            </div>
          </div>
        ))}
      </div>

      {recoveryOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gc-recovery-title"
        >
          <div className="max-w-md w-full rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
            <h2 id="gc-recovery-title" className="font-[family-name:var(--font-display)] text-lg font-semibold text-[#2b2b2b]">
              Gift card recovery
            </h2>
            {recoveryLoading ? (
              <p className="mt-4 text-sm text-black/55">Loading…</p>
            ) : recoveryDetail ? (
              <div className="mt-4 space-y-4 text-sm">
                {recoveryDetail.legacyNoCipher ? (
                  <p className="text-black/70">
                    This card was created before encrypted recovery. Issue a replacement code — the old code will stop
                    working, and we can email the new code if a recipient address is set.
                  </p>
                ) : recoveryDetail.revealedCode ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Code</p>
                    <p className="mt-2 break-all font-mono text-base font-bold text-[#2b2b2b]">{recoveryDetail.revealedCode}</p>
                    <button
                      type="button"
                      className="mt-3 rounded-full bg-[color:var(--gold)] px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)]"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(recoveryDetail.revealedCode || "");
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      Copy code
                    </button>
                  </div>
                ) : (
                  <p className="text-rose-700 font-medium">
                    Could not decrypt the stored code (check server encryption key). Use Replace code so the customer gets
                    a working code.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={reissueLoading || !recoveryTargetId}
                    onClick={() => recoveryTargetId && runReissue(recoveryTargetId)}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 disabled:opacity-50"
                  >
                    {reissueLoading ? "Working…" : "Replace code (invalidate old)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryOpen(false);
                      setRecoveryDetail(null);
                    }}
                    className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-black/70"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-black/55">No data.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <Link href="/admin" className="font-semibold text-[color:var(--gold)] no-underline">
          ← Admin home
        </Link>
      </div>
    </AdminShell>
  );
}
