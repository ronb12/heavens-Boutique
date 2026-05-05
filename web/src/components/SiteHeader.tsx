"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/components/AuthProvider";
import { useStoreSettings } from "@/components/StoreSettingsProvider";

function HamburgerIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function SiteHeader({
  active,
}: {
  active?:
    | "home"
    | "shop"
    | "cart"
    | "account"
    | "messages"
    | "orders"
    | "admin"
    | "wishlist"
    | "gift-cards"
    | "returns";
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { giftCardsPurchaseEnabled, loading: settingsLoading } = useStoreSettings();
  const showGiftCardsNav = !settingsLoading && giftCardsPurchaseEnabled;

  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const pill = (isActive: boolean) =>
    [
      "block w-full text-center px-4 py-3 rounded-2xl font-semibold no-underline transition",
      isActive
        ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow"
        : "border border-black/10 bg-white/90 text-[color:var(--foreground)] active:bg-white",
    ].join(" ");

  const pillInline = (isActive: boolean) =>
    [
      "px-4 py-2 rounded-full font-semibold no-underline transition whitespace-nowrap",
      isActive
        ? "bg-[color:var(--gold)] text-[color:var(--charcoal)] shadow"
        : "border border-black/10 bg-white/70 text-[color:var(--foreground)] hover:bg-white",
    ].join(" ");

  return (
    <>
      <header
        className={`sticky top-0 backdrop-blur bg-[color:var(--cream)]/85 border-b border-[color:var(--border-subtle)] ${
          menuOpen ? "z-[120]" : "z-50"
        }`}
      >
        <div className="mx-auto max-w-6xl px-4 py-3 sm:py-4 flex items-center justify-between gap-3 min-h-[3.25rem]">
          <Link href="/" className="flex items-center gap-3 no-underline min-w-0 shrink">
            <div className="hb-script text-xl sm:text-2xl text-[color:var(--foreground)] truncate">
              Heaven’s Boutique
            </div>
          </Link>

          {/* Desktop / tablet */}
          <nav className="hidden lg:flex items-center gap-2 xl:gap-3 flex-wrap justify-end">
            <Link href="/shop" className={pillInline(active === "shop")}>
              Shop
            </Link>
            {showGiftCardsNav ? (
              <Link href="/gift-cards" className={pillInline(active === "gift-cards")}>
                Gift cards
              </Link>
            ) : null}
            <Link href="/cart" className={pillInline(active === "cart")}>
              Cart
            </Link>
            <Link href="/wishlist" className={pillInline(active === "wishlist")}>
              Wishlist
            </Link>
            <Link href="/account" className={pillInline(active === "account")}>
              Account
            </Link>
            {!loading ? (
              user ? (
                <>
                  <Link href="/orders" className={pillInline(active === "orders")}>
                    Orders
                  </Link>
                  <Link href="/returns" className={pillInline(active === "returns")}>
                    Returns
                  </Link>
                  <Link href="/messages" className={pillInline(active === "messages")}>
                    Messages
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login?next=%2Forders" className={pillInline(active === "orders")}>
                    Orders
                  </Link>
                  <Link href="/login?next=%2Freturns" className={pillInline(active === "returns")}>
                    Returns
                  </Link>
                  <Link href="/login?next=%2Fmessages" className={pillInline(active === "messages")}>
                    Messages
                  </Link>
                </>
              )
            ) : null}
            {!loading && user?.role === "admin" ? (
              <Link href="/admin" className={pillInline(active === "admin")}>
                Admin
              </Link>
            ) : null}
          </nav>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="lg:hidden inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[color:var(--charcoal)] shadow-sm ring-2 ring-transparent hover:bg-white focus-visible:outline-none focus-visible:ring-[color:var(--gold)]/55"
            aria-expanded={menuOpen}
            aria-controls="mobile-primary-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <HamburgerIcon open={menuOpen} />
          </button>
        </div>
      </header>

      {/* Outside header: backdrop-blur on the bar would otherwise trap fixed layers behind page content (e.g. home hero). */}
      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[100] bg-black/45 lg:hidden motion-safe:animate-in fade-in duration-200"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id="mobile-primary-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
            className="fixed inset-y-0 right-0 z-[115] flex w-[min(100vw-3rem,20rem)] flex-col border-l border-black/10 bg-[color:var(--cream)] shadow-2xl lg:hidden motion-safe:animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-4">
              <span className="font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                Menu
              </span>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 bg-white text-[color:var(--charcoal)]"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                <HamburgerIcon open />
              </button>
            </div>
            <nav className="flex flex-col gap-2 overflow-y-auto p-4 pb-10">
              <Link href="/shop" className={pill(active === "shop")} onClick={() => setMenuOpen(false)}>
                Shop
              </Link>
              {showGiftCardsNav ? (
                <Link href="/gift-cards" className={pill(active === "gift-cards")} onClick={() => setMenuOpen(false)}>
                  Gift cards
                </Link>
              ) : null}
              <Link href="/cart" className={pill(active === "cart")} onClick={() => setMenuOpen(false)}>
                Cart
              </Link>
              <Link href="/wishlist" className={pill(active === "wishlist")} onClick={() => setMenuOpen(false)}>
                Wishlist
              </Link>
              <Link href="/account" className={pill(active === "account")} onClick={() => setMenuOpen(false)}>
                Account
              </Link>
              {!loading ? (
                user ? (
                  <>
                    <Link href="/orders" className={pill(active === "orders")} onClick={() => setMenuOpen(false)}>
                      Orders
                    </Link>
                    <Link href="/returns" className={pill(active === "returns")} onClick={() => setMenuOpen(false)}>
                      Returns
                    </Link>
                    <Link href="/messages" className={pill(active === "messages")} onClick={() => setMenuOpen(false)}>
                      Messages
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login?next=%2Forders"
                      className={pill(active === "orders")}
                      onClick={() => setMenuOpen(false)}
                    >
                      Orders
                    </Link>
                    <Link
                      href="/login?next=%2Freturns"
                      className={pill(active === "returns")}
                      onClick={() => setMenuOpen(false)}
                    >
                      Returns
                    </Link>
                    <Link
                      href="/login?next=%2Fmessages"
                      className={pill(active === "messages")}
                      onClick={() => setMenuOpen(false)}
                    >
                      Messages
                    </Link>
                  </>
                )
              ) : null}
              {!loading && user?.role === "admin" ? (
                <Link href="/admin" className={pill(active === "admin")} onClick={() => setMenuOpen(false)}>
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
