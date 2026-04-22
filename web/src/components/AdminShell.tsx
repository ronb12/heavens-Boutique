"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/components/AuthProvider";
import type { AdminUser } from "@/lib/staffPermissions";
import { PERM, canAccessAdminPortal, canPerm, hrefToPermission } from "@/lib/staffPermissions";

const AdminNavCloseContext = React.createContext<() => void>(() => {});

function HamburgerIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={22}
        height={22}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function SidebarLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const close = React.useContext(AdminNavCloseContext);
  const active =
    pathname === href ||
    (href !== "/admin" && (pathname.startsWith(`${href}/`) || pathname === href));

  return (
    <Link
      href={href}
      onClick={() => close()}
      className={`block rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
        active
          ? "bg-[color:var(--gold)]/28 font-semibold text-[color:var(--charcoal)]"
          : "font-medium text-black/78 hover:bg-black/[0.05]"
      }`}
    >
      {children}
    </Link>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-black/45">{label}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function GuardedNavLink({ href, children, user }: { href: string; children: React.ReactNode; user: AdminUser }) {
  if (href.startsWith("/admin/staff")) {
    if (user.role?.toLowerCase() !== "admin") return null;
    return <SidebarLink href={href}>{children}</SidebarLink>;
  }
  if (href.startsWith("/admin/inventory")) {
    const ok = canPerm(user, PERM.INVENTORY) || canPerm(user, PERM.PRODUCTS);
    return ok ? <SidebarLink href={href}>{children}</SidebarLink> : null;
  }
  const perm = hrefToPermission(href);
  if (perm === "dashboard") {
    return canAccessAdminPortal(user) ? <SidebarLink href={href}>{children}</SidebarLink> : null;
  }
  if (perm !== null && !canPerm(user, perm)) return null;
  return <SidebarLink href={href}>{children}</SidebarLink>;
}

export function AdminShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const closeNav = React.useCallback(() => setNavOpen(false), []);
  const isLg = React.useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => undefined;
      const m = window.matchMedia("(min-width: 1024px)");
      m.addEventListener("change", onStoreChange);
      return () => m.removeEventListener("change", onStoreChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia("(min-width: 1024px)").matches : false),
    () => true,
  );

  React.useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  React.useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  if (!user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl">Admin</h1>
        <p className="mt-2 text-black/60">Sign in as a store owner or staff member to continue.</p>
        <div className="mt-6">
          <Link
            href="/login?next=%2Fadmin"
            className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (!canAccessAdminPortal(user)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl">Admin</h1>
        <p className="mt-2 text-black/60">
          You’re signed in as <span className="font-semibold text-black/80">{user.email || "this account"}</span>, but
          this account doesn’t have admin or staff permissions for this store.
        </p>
        <p className="mt-3 text-black/60">
          Store owners are listed in <span className="font-semibold">ADMIN_EMAILS</span> on the API project. Staff
          accounts are invited from Admin → Staff with specific permissions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
            onClick={() => {
              signOut();
              router.push("/login?next=%2Fadmin");
              router.refresh();
            }}
          >
            Switch account
          </button>
          <Link
            href="/account"
            className="inline-flex px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold no-underline"
          >
            Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdminNavCloseContext.Provider value={closeNav}>
      <div className="min-h-screen flex flex-col bg-[color:var(--background)] lg:flex-row">
        <header
          className={`sticky top-0 z-[70] flex h-14 shrink-0 items-center justify-between border-b border-black/10 bg-white/95 px-3 backdrop-blur sm:px-4 lg:hidden ${
            navOpen ? "z-[80]" : ""
          }`}
        >
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white/80 text-[color:var(--charcoal)] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/55"
            aria-expanded={navOpen}
            aria-controls="admin-primary-nav"
            aria-label={navOpen ? "Close admin menu" : "Open admin menu"}
            onClick={() => setNavOpen((o) => !o)}
          >
            <HamburgerIcon open={navOpen} />
          </button>
          <Link
            href="/admin"
            className="hb-script min-w-0 grow truncate text-center text-lg no-underline text-[color:var(--foreground)]"
            onClick={() => closeNav()}
          >
            Heaven’s Boutique
          </Link>
          <span className="w-10 shrink-0" aria-hidden />
        </header>

        {navOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[50] bg-black/45 motion-safe:animate-in fade-in duration-200 lg:hidden"
            aria-label="Close admin menu"
            onClick={() => setNavOpen(false)}
          />
        ) : null}

        <aside
          id="admin-primary-nav"
          className={`shrink-0 border-b border-black/10 bg-white/85 lg:static lg:z-auto lg:min-h-screen lg:translate-x-0 lg:w-60 lg:border-b-0 lg:border-r lg:border-black/10 max-lg:fixed max-lg:bottom-0 max-lg:left-0 max-lg:top-14 max-lg:z-[60] max-lg:w-[min(20rem,88vw)] max-lg:overflow-y-auto max-lg:shadow-2xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-out ${
            navOpen ? "max-lg:translate-x-0" : "max-lg:-translate-x-full"
          }`}
          aria-hidden={!isLg && !navOpen ? true : undefined}
          aria-modal={!isLg && navOpen ? true : undefined}
          role={!isLg && navOpen ? "dialog" : undefined}
          aria-label="Admin navigation"
        >
        <div className="sticky top-0 z-40 flex flex-col gap-6 p-4 lg:h-screen lg:overflow-y-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href="/admin"
                className="hb-script text-xl no-underline text-[color:var(--foreground)]"
                onClick={() => closeNav()}
              >
                Heaven’s Boutique
              </Link>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-black/40">Admin</p>
            </div>
            <button
              type="button"
              className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/90 text-[color:var(--charcoal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold)]/55 lg:hidden"
              aria-label="Close admin menu"
              onClick={() => setNavOpen(false)}
            >
              <HamburgerIcon open />
            </button>
          </div>

          <nav className="flex flex-col">
            <NavSection label="Overview">
              <GuardedNavLink href="/admin" user={user}>
                Dashboard
              </GuardedNavLink>
              <GuardedNavLink href="/admin/analytics" user={user}>
                Analytics
              </GuardedNavLink>
              <GuardedNavLink href="/admin/staff" user={user}>
                Staff
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Sell">
              <GuardedNavLink href="/admin/orders" user={user}>
                Orders
              </GuardedNavLink>
              <GuardedNavLink href="/admin/customers" user={user}>
                Customers
              </GuardedNavLink>
              <GuardedNavLink href="/admin/returns" user={user}>
                Returns
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Catalog">
              <GuardedNavLink href="/admin/products" user={user}>
                Products
              </GuardedNavLink>
              <GuardedNavLink href="/admin/products-csv" user={user}>
                Bulk CSV
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Marketing">
              <GuardedNavLink href="/admin/discounts" user={user}>
                Discount codes
              </GuardedNavLink>
              <GuardedNavLink href="/admin/promo-analytics" user={user}>
                Promo analytics
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Inventory">
              <GuardedNavLink href="/admin/inventory" user={user}>
                Inventory
              </GuardedNavLink>
              <GuardedNavLink href="/admin/purchase-orders" user={user}>
                Purchase orders
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Content">
              <GuardedNavLink href="/admin/homepage" user={user}>
                App home screen
              </GuardedNavLink>
              <GuardedNavLink href="/admin/content-pages" user={user}>
                Pages &amp; journal
              </GuardedNavLink>
            </NavSection>

            <NavSection label="Payments &amp; shipping">
              <GuardedNavLink href="/admin/gift-cards" user={user}>
                Gift cards
              </GuardedNavLink>
              <GuardedNavLink href="/admin/stripe-settings" user={user}>
                Stripe
              </GuardedNavLink>
              <GuardedNavLink href="/admin/easypost-settings" user={user}>
                EasyPost
              </GuardedNavLink>
            </NavSection>

            <div className="mt-2 border-t border-black/10 pt-4">
              <SidebarLink href="/shop">View storefront</SidebarLink>
              <SidebarLink href="/account">Your account</SidebarLink>
            </div>
          </nav>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="text-3xl md:text-4xl">{title}</h1>
          <div className="mt-8">{children}</div>
        </main>
      </div>
    </div>
    </AdminNavCloseContext.Provider>
  );
}
