"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useStoreSettings } from "@/components/StoreSettingsProvider";

export function SiteFooter() {
  const { giftCardsPurchaseEnabled, loading: settingsLoading } = useStoreSettings();
  const showGiftCardsFooter = !settingsLoading && giftCardsPurchaseEnabled;
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submitNewsletter(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setStatus("error");
      setMessage("Enter your email address.");
      return;
    }
    setStatus("loading");
    setMessage(null);
    try {
      const r = await apiFetch<{ ok?: boolean; message?: string }>("/api/newsletter/subscribe", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email: trimmed, source: "footer" }),
      });
      setStatus("success");
      setMessage(r.message || "You're on the list.");
      setEmail("");
    } catch (err: unknown) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Could not subscribe. Try again.");
    }
  }

  const link =
    "block py-0.5 text-[12px] leading-tight text-black/60 no-underline transition-colors hover:text-[color:var(--charcoal)]";

  const heading = "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-black/40";

  return (
    <footer className="mt-auto border-t border-black/[0.06] bg-[#f5f5f5]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Single compact band: brand | nav columns | newsletter */}
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-8 lg:gap-y-6 lg:items-start">
          <div className="lg:col-span-2">
            <div className="hb-script text-base leading-none text-[color:var(--foreground)]">Heaven’s Boutique</div>
            <p className="mt-1.5 max-w-[220px] text-[11px] leading-snug text-black/45">
              Curated fashion · Secure checkout
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:col-span-6 lg:gap-x-8">
            <nav aria-label="Shop">
              <div className={heading}>Shop</div>
              <ul className="flex flex-col gap-0">
                <li>
                  <Link className={link} href="/shop">
                    Shop all
                  </Link>
                </li>
                {showGiftCardsFooter ? (
                  <li>
                    <Link className={link} href="/gift-cards">
                      Gift cards
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link className={link} href="/wishlist">
                    Wishlist
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/cart">
                    Cart
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="Orders and account">
              <div className={heading}>Orders &amp; account</div>
              <ul className="flex flex-col gap-0">
                <li>
                  <Link className={link} href="/orders">
                    Order status
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/returns">
                    Returns
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/account">
                    Account
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/account/addresses">
                    Addresses
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/messages">
                    Messages
                  </Link>
                </li>
              </ul>
            </nav>

            <nav aria-label="About" className="col-span-2 sm:col-span-1">
              <div className={heading}>About</div>
              <ul className="flex flex-col gap-0">
                <li>
                  <Link className={link} href="/blog">
                    Journal
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/pages/about">
                    About us
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/pages/shipping">
                    Shipping
                  </Link>
                </li>
                <li>
                  <Link className={link} href="/pages/returns">
                    Return policy
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          <div className="border-t border-black/[0.06] pt-6 lg:col-span-4 lg:border-t-0 lg:pt-0">
            <p className={heading}>Email updates</p>
            <p className="mb-2.5 text-[11px] leading-snug text-black/45">New arrivals &amp; offers. Unsubscribe anytime.</p>
            <form onSubmit={submitNewsletter} className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2">
              <label className="sr-only" htmlFor="footer-newsletter-email">
                Email for newsletter
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="send"
                placeholder="Email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status !== "idle") setStatus("idle");
                }}
                disabled={status === "loading"}
                className="h-9 min-w-0 flex-1 rounded-md border border-black/[0.12] bg-white px-2.5 text-[12px] text-[color:var(--foreground)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)] outline-none placeholder:text-black/35 focus:border-black/20 focus:ring-1 focus:ring-black/10 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-9 shrink-0 rounded-md bg-[color:var(--charcoal)] px-4 text-[12px] font-semibold text-white transition hover:bg-black/88 disabled:opacity-60"
              >
                {status === "loading" ? "…" : "Subscribe"}
              </button>
            </form>
            {message ? (
              <p
                className={
                  status === "success"
                    ? "mt-2 text-[11px] font-medium text-emerald-800"
                    : "mt-2 text-[11px] font-medium text-rose-700"
                }
                role="status"
              >
                {message}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] leading-snug text-black/38">
              By subscribing you agree to our{" "}
              <a href="/privacy.html" className="text-black/50 underline-offset-2 hover:text-[color:var(--charcoal)] hover:underline">
                Privacy policy
              </a>
              .
            </p>
          </div>
        </div>

        {/* Slim sub-footer */}
        <div className="mt-7 flex flex-col gap-3 border-t border-black/[0.06] pt-5 text-[11px] text-black/42 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
          <p>© {new Date().getFullYear()} Heaven’s Boutique</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a className="text-black/50 no-underline hover:text-[color:var(--charcoal)]" href="/terms.html">
              Terms
            </a>
            <a className="text-black/50 no-underline hover:text-[color:var(--charcoal)]" href="/privacy.html">
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
