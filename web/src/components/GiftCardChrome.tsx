"use client";

import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Checkout: pink · gold · black card frame for redeeming a code.
 */
export function GiftCardCheckoutPanel({
  value,
  onChange,
  id = "gift-card-code",
  disabled = false,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/50 shadow-[0_12px_44px_rgba(43,43,43,0.28),inset_0_1px_0_rgba(255,255,255,0.15)]">
      {/* Black base + rose wash + gold sweep */}
      <div
        className="absolute inset-0 bg-gradient-to-br from-[#1a1216] via-[#2b1822] to-[#0d0a0c]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-90 bg-[radial-gradient(ellipse_120%_80%_at_20%_0%,rgba(234,176,200,0.35)_0%,transparent_55%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-[0.18] bg-[linear-gradient(115deg,transparent_30%,rgba(212,175,55,0.7)_48%,transparent_65%)]"
        aria-hidden
      />
      <div
        className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#eab0c8]/25 blur-3xl"
        aria-hidden
      />

      <div className="relative px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--gold-light)]/95">
              Heaven&apos;s Boutique
            </p>
            <h3 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide text-[#fdf2f6]">
              Gift card
            </h3>
            <p className="mt-1.5 max-w-[20rem] text-xs leading-relaxed text-[#f5d0dd]/85">
              Enter the code from your card or email. Applied when you continue — at least $0.50 must remain for
              card processing.
            </p>
          </div>
          <Image
            src="/app-icon.png"
            alt=""
            width={50}
            height={50}
            className="mt-0.5 h-[50px] w-[50px] shrink-0 rounded-[11px] object-cover shadow-[0_6px_20px_rgba(212,175,55,0.32)] ring-1 ring-[#eab0c8]/40"
            aria-hidden
          />
        </div>

        <label className="mt-5 block" htmlFor={id}>
          <span className="sr-only">Gift card code</span>
          <div className="rounded-xl border border-[#eab0c8]/35 bg-black/35 p-1 shadow-inner ring-1 ring-[color:var(--gold)]/25">
            <input
              id={id}
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              placeholder="HB-XXXXXXXX"
              className="w-full rounded-lg border border-white/10 bg-[#0a0809]/90 px-3.5 py-3 font-mono text-[0.95rem] tracking-[0.14em] text-[#fef7fa] placeholder:text-[#eab0c8]/45 outline-none ring-0 focus:border-[color:var(--gold)]/55 focus:bg-black/50 focus:ring-1 focus:ring-[color:var(--gold)]/40 disabled:opacity-55"
            />
          </div>
          <span className="mt-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-[color:var(--gold-light)]/85">
            Redemption code
          </span>
        </label>
      </div>
    </div>
  );
}

type AdminRevealProps = {
  code: string;
  balanceCents: number;
  formatUsd: (cents: number) => string;
  onCopy?: () => void;
};

/** Admin: one-time reveal — pink & gold certificate on soft blush. */
export function GiftCardIssuedReveal({
  code,
  balanceCents,
  formatUsd,
  onCopy,
  footerNote,
}: AdminRevealProps & { footerNote?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[color:var(--gold)]/45 bg-gradient-to-b from-[#fffafb] via-[#fdeef4] to-[#fce8f0] shadow-[0_18px_52px_rgba(217,136,158,0.22)]">
      <div
        className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-transparent via-[color:var(--gold)] to-transparent opacity-90"
        aria-hidden
      />
      <div
        className="absolute -left-8 bottom-0 h-40 w-40 rounded-full bg-[#eab0c8]/30 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-4 top-12 h-24 w-24 rounded-full bg-[color:var(--gold)]/15 blur-2xl"
        aria-hidden
      />

      <div className="relative p-8 text-center">
        <p className="hb-script text-2xl text-[color:var(--charcoal)]">Heaven&apos;s Boutique</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-[color:var(--rose)]">
          Gift card
        </p>
        <p className="mt-6 font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums text-[#2b2b2b]">
          {formatUsd(balanceCents)}
        </p>
        <div className="mx-auto mt-8 max-w-md rounded-xl border border-dashed border-[color:var(--gold)]/40 bg-white/85 px-4 py-4 shadow-inner ring-1 ring-[#eab0c8]/25">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black/50">Card number</p>
          <p className="mt-2 break-all font-mono text-lg font-bold tracking-wide text-[#2b2b2b]">{code}</p>
        </div>
        <p className="mt-5 text-xs text-black/50">
          {footerNote ??
            "Copy and send to your customer — you can also reveal this code later from the card list."}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="mt-5 inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-8 py-3 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_6px_24px_rgba(212,175,55,0.45)] ring-2 ring-[#2b2b2b]/10 transition hover:brightness-105"
        >
          Copy code
        </button>
      </div>
    </div>
  );
}

/** Admin: blush foil panel + gold trim. */
export function GiftCardIssueFormShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[color:var(--gold)]/40 bg-gradient-to-br from-white via-[#fff5f9] to-[#fdeef4] shadow-[0_14px_40px_rgba(43,43,43,0.1)]">
      <div
        className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--gold)]/70 to-transparent"
        aria-hidden
      />
      <div className="relative p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--rose)]/90">Issue store credit</p>
        <h3 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold text-[#2b2b2b]">{title}</h3>
        {subtitle ? <p className="mt-2 text-sm text-black/55">{subtitle}</p> : null}
        <div className="mt-6 grid gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Admin: balance row — black & rose with gold chip. */
export function GiftCardBalanceRow({
  balanceCents,
  formatUsd,
  active,
  meta,
}: {
  balanceCents: number;
  formatUsd: (cents: number) => string;
  active: boolean;
  meta: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#eab0c8]/25 bg-gradient-to-r from-[#1a1418] via-[#2d1f26] to-[#0f0c0e] p-5 text-white shadow-lg shadow-black/20">
      <div
        className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_80%_100%_at_0%_50%,rgba(234,176,200,0.35)_0%,transparent_60%)]"
        aria-hidden
      />
      <div
        className="absolute right-3 top-3 h-16 w-24 rounded-md bg-gradient-to-br from-[#fdeef4] via-[color:var(--gold)] to-[#4a3d12] opacity-95 shadow-inner ring-1 ring-[color:var(--gold)]/30"
        aria-hidden
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3 pr-28">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#eab0c8]/80">Remaining balance</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[#fff5f9]">
            {formatUsd(balanceCents)}
          </p>
          <div className="mt-3 text-sm text-[#f0c8d8]/90">{meta}</div>
        </div>
        <span
          className={[
            "shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1",
            active
              ? "bg-[color:var(--gold)]/25 text-[color:var(--gold-light)] ring-[color:var(--gold)]/40"
              : "bg-black/40 text-white/50 ring-white/10",
          ].join(" ")}
        >
          {active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
