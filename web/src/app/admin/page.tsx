import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";

export default function AdminLandingPage() {
  return (
    <AdminShell title="Admin">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/products"
        >
          <div className="font-semibold">Products</div>
          <div className="text-sm text-black/55 mt-1">Create + edit catalog items, images, variants</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/orders"
        >
          <div className="font-semibold">Orders</div>
          <div className="text-sm text-black/55 mt-1">Manage fulfillment + shipping</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/analytics"
        >
          <div className="font-semibold">Analytics</div>
          <div className="text-sm text-black/55 mt-1">Sales summary, daily trends, and links to promo stats</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/customers"
        >
          <div className="font-semibold">Customers</div>
          <div className="text-sm text-black/55 mt-1">View customers + details</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/homepage"
        >
          <div className="font-semibold">App home screen</div>
          <div className="text-sm text-black/55 mt-1">Sliding promos and product rows on the iPhone app (not the website)</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/staff"
        >
          <div className="font-semibold">Staff</div>
          <div className="text-sm text-black/55 mt-1">Invite team members and set permissions (store owners only)</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/purchase-orders"
        >
          <div className="font-semibold">Purchase orders</div>
          <div className="text-sm text-black/55 mt-1">Any supplier — track orders and receive stock</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/discounts"
        >
          <div className="font-semibold">Discount codes</div>
          <div className="text-sm text-black/55 mt-1">Percentage or fixed-amount checkout promos</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/gift-cards"
        >
          <div className="font-semibold">Gift cards</div>
          <div className="text-sm text-black/55 mt-1">Issue store-credit codes and track balances</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/content-pages"
        >
          <div className="font-semibold">Pages & journal</div>
          <div className="text-sm text-black/55 mt-1">About, shipping, returns, and blog-style posts</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/returns"
        >
          <div className="font-semibold">Returns</div>
          <div className="text-sm text-black/55 mt-1">Review return requests</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/promo-analytics"
        >
          <div className="font-semibold">Promo analytics</div>
          <div className="text-sm text-black/55 mt-1">Usage and revenue by discount code</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/products-csv"
        >
          <div className="font-semibold">Bulk CSV</div>
          <div className="text-sm text-black/55 mt-1">Import or export products &amp; variants</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/inventory"
        >
          <div className="font-semibold">Inventory</div>
          <div className="text-sm text-black/55 mt-1">On-hand quantities by variant + adjustment history</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/stripe-settings"
        >
          <div className="font-semibold">Stripe</div>
          <div className="text-sm text-black/55 mt-1">Payments &amp; webhook keys</div>
        </Link>
        <Link
          className="rounded-3xl border border-black/10 bg-white/80 p-6 no-underline hover:shadow-sm transition-shadow"
          href="/admin/easypost-settings"
        >
          <div className="font-semibold">EasyPost</div>
          <div className="text-sm text-black/55 mt-1">Shipping labels &amp; origin address</div>
        </Link>
      </div>
    </AdminShell>
  );
}

