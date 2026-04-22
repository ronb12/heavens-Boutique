import Link from "next/link";
import { apiFetch } from "@/lib/api";
import type { ProductsResponse } from "@/lib/types";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) || {};
  const q = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const size = Array.isArray(sp.size) ? sp.size[0] : sp.size;
  const sort = Array.isArray(sp.sort) ? sp.sort[0] : sp.sort;
  const category = Array.isArray(sp.category) ? sp.category[0] : sp.category;
  const featuredRaw = Array.isArray(sp.featured) ? sp.featured[0] : sp.featured;
  const featuredOnly = featuredRaw === "1" || featuredRaw === "true";

  const url = new URL("http://x.local/api/products");
  if (featuredOnly) url.searchParams.set("featured", "1");
  if (q) url.searchParams.set("q", q);
  if (size) url.searchParams.set("size", size);
  if (sort) url.searchParams.set("sort", sort);
  if (!sort) url.searchParams.set("sort", "newest");
  if (category && category !== "all") url.searchParams.set("category", category);

  const allUrl = new URL("http://x.local/api/products");
  if (q) allUrl.searchParams.set("q", q);
  if (size) allUrl.searchParams.set("size", size);
  if (sort) allUrl.searchParams.set("sort", sort);
  if (!sort) allUrl.searchParams.set("sort", "newest");

  const [r, allR] = await Promise.all([
    apiFetch<ProductsResponse>(`${url.pathname}?${url.searchParams.toString()}`, { auth: false }),
    apiFetch<ProductsResponse>(`${allUrl.pathname}?${allUrl.searchParams.toString()}`, { auth: false }),
  ]);
  const products = r.products || [];
  const categories = Array.from(
    new Set((allR.products || []).map((p) => String(p.category || "").trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <div className="min-h-full flex flex-col">
      <SiteHeader active="shop" />

      <main className="mx-auto max-w-6xl px-4 py-10 flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">{featuredOnly ? "Featured" : "Shop"}</h1>
            <p className="mt-2 text-black/60">
              {featuredOnly ? "Products marked featured in admin." : "Curated pieces, updated often."}
            </p>
          </div>
        </div>

        <form className="mt-6 grid gap-3 sm:grid-cols-3" action="/shop" method="get">
          {featuredOnly ? <input type="hidden" name="featured" value="1" /> : null}
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search…"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 sm:col-span-2"
          />
          <select
            name="sort"
            defaultValue={sort || "newest"}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
          >
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low → high</option>
            <option value="price_desc">Price: high → low</option>
          </select>
          <input
            name="size"
            defaultValue={size || ""}
            placeholder="Size (e.g. S)"
            className="h-11 rounded-2xl border border-black/10 bg-white px-4"
          />
          <button
            type="submit"
            className="h-11 rounded-2xl bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold"
          >
            Apply
          </button>
          <Link
            href="/shop"
            className="h-11 inline-flex items-center justify-center rounded-2xl border border-black/10 bg-white/70 font-semibold no-underline"
          >
            Reset
          </Link>
        </form>

        {categories.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={(() => {
                const u = new URLSearchParams();
                if (featuredOnly) u.set("featured", "1");
                if (q) u.set("q", q);
                if (size) u.set("size", size);
                if (sort) u.set("sort", sort);
                const qs = u.toString();
                return qs ? `/shop?${qs}` : "/shop";
              })()}
              className={[
                "px-4 py-2 rounded-full text-sm font-semibold no-underline border",
                !category || category === "all"
                  ? "border-black/30 bg-[color:var(--soft-pink)]"
                  : "border-black/10 bg-white/70 hover:shadow-sm",
              ].join(" ")}
            >
              All categories
            </Link>
            {categories.map((c) => {
              const u = new URLSearchParams();
              u.set("category", c);
              if (featuredOnly) u.set("featured", "1");
              if (q) u.set("q", q);
              if (size) u.set("size", size);
              if (sort) u.set("sort", sort);
              const active = category === c;
              return (
                <Link
                  key={c}
                  href={`/shop?${u.toString()}`}
                  className={[
                    "px-4 py-2 rounded-full text-sm font-semibold no-underline border",
                    active ? "border-black/30 bg-[color:var(--soft-pink)]" : "border-black/10 bg-white/70 hover:shadow-sm",
                  ].join(" ")}
                >
                  {c}
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/shop/${p.id}`}
              className="block rounded-3xl border border-black/10 bg-white/80 p-5 no-underline hover:shadow-sm transition-shadow"
            >
              <div className="font-semibold text-lg text-[color:var(--foreground)]">{p.name}</div>
              <div className="mt-1 text-sm text-black/55">{p.category || "Boutique pick"}</div>
              <div className="mt-4 font-semibold text-[color:var(--foreground)]">
                ${((p.salePriceCents ?? p.priceCents) / 100).toFixed(2)}
              </div>
            </Link>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

