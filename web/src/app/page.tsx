import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { hasBackendProxyOrigin } from "@/lib/env";
import { normalizeHomepageContent } from "@/lib/homepageContent";
import type { ProductsResponse } from "@/lib/types";
import { HomeClientTrack } from "./trackClient";
import { HomeHero } from "@/components/HomeHero";
import { HomeProductCard } from "@/components/HomeProductCard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const HOME_PRODUCT_LIMIT = 8;

export default async function Home() {
  let featured: ProductsResponse["products"] = [];
  let newest: ProductsResponse["products"] = [];
  let catalogState: "ok" | "api_unreachable" | "empty" = "ok";

  try {
    const [featRes, newRes] = await Promise.all([
      apiFetch<ProductsResponse>("/api/products?featured=1&sort=newest", { auth: false }),
      apiFetch<ProductsResponse>("/api/products?sort=newest", { auth: false }),
    ]);
    featured = (featRes.products || []).slice(0, HOME_PRODUCT_LIMIT);
    const featuredIds = new Set(featured.map((p) => p.id));
    newest = (newRes.products || [])
      .filter((p) => !featuredIds.has(p.id))
      .slice(0, HOME_PRODUCT_LIMIT);
    if (!featured.length && !newest.length) catalogState = "empty";
  } catch {
    featured = [];
    newest = [];
    catalogState = "api_unreachable";
  }

  let homepage = normalizeHomepageContent({});
  try {
    const r = await apiFetch<{ content: unknown }>("/api/homepage", { auth: false });
    homepage = normalizeHomepageContent(r.content);
  } catch {
    /* keep defaults */
  }
  const cmsHero = homepage.hero?.imageUrl?.trim() ? homepage.hero : null;

  return (
    <div className="min-h-full flex flex-col">
      <HomeClientTrack />
      <SiteHeader active="home" />

      <main className="flex-1">
        {cmsHero ? <HomeHero hero={cmsHero} /> : null}

        {!cmsHero ? (
          <section className="mx-auto max-w-6xl px-4 py-14 grid gap-10 lg:grid-cols-2 items-center">
            <div>
              <div className="text-xs tracking-[0.25em] uppercase text-black/50 mb-3">
                Curated · Feminine · Timeless
              </div>
              <h1 className="text-4xl leading-[1.05] md:text-6xl">Where elegance meets everyday confidence</h1>
              <p className="mt-4 text-black/60 text-lg max-w-xl">
                Shop new arrivals, save favorites, and checkout securely—designed to feel calm, not noisy.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/shop"
                  className="px-6 py-3 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold no-underline shadow"
                >
                  Start shopping
                </Link>
                <a
                  href="https://apps.apple.com/us/search?term=Heavens%20Boutique"
                  target="_blank"
                  rel="noreferrer"
                  className="px-6 py-3 rounded-full border border-black/10 bg-white/70 font-semibold no-underline"
                >
                  Download on iOS
                </a>
              </div>
              <div className="mt-4 text-sm text-black/55">
                Web + iOS supported. Secure checkout, order tracking, easy returns.
              </div>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-[color:var(--border-subtle)] bg-gradient-to-br from-white/90 via-[color:var(--pink-mist)]/50 to-white/80 p-8 shadow-sm">
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[color:var(--soft-pink)] blur-2xl opacity-80" />
              <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-[color:var(--gold-light)] blur-2xl opacity-55" />
              <div className="absolute top-1/2 left-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[color:var(--rose)] blur-3xl opacity-20" />
              <div className="relative">
                <div className="hb-script text-3xl">Pink &amp; gold. Always.</div>
                <p className="mt-2 text-black/60">
                  A boutique experience that feels personal—built around curation, fit, and confidence.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Secure checkout</div>
                    <div className="text-black/55">Fast, modern payments</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Order tracking</div>
                    <div className="text-black/55">Updates that stay clear</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Saved favorites</div>
                    <div className="text-black/55">Build looks over time</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Human support</div>
                    <div className="text-black/55">Reply within 1 day</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className={`mx-auto max-w-6xl px-4 pb-16 ${cmsHero ? "pt-4 md:pt-8" : ""}`}>
          {featured.length > 0 ? (
            <div className="mb-12 rounded-[2rem] border border-[color:var(--border-subtle)] bg-white/60 p-6 sm:p-8 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-display)]">Featured</h2>
                  <p className="mt-1 text-black/60 text-sm md:text-base">
                    Hand-picked in admin — spotlight your best sellers or seasonal edits.
                  </p>
                </div>
                <Link href="/shop?featured=1" className="font-semibold text-[color:var(--gold)] no-underline shrink-0">
                  Shop featured →
                </Link>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {featured.map((p) => (
                  <HomeProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[2rem] border border-[color:var(--border-subtle)] bg-[color:var(--pink-mist)]/25 p-6 sm:p-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-[family-name:var(--font-display)]">New arrivals</h2>
                <p className="text-black/60 mt-1 text-sm md:text-base">
                  Fresh drops — then explore the full catalog in Shop.
                </p>
              </div>
              <Link href="/shop" className="font-semibold text-[color:var(--gold)] no-underline shrink-0">
                View all →
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {catalogState === "ok"
                ? newest.map((p) => <HomeProductCard key={p.id} product={p} />)
                : null}
              {catalogState === "api_unreachable" ? (
                <div className="rounded-3xl border border-[color:var(--border-subtle)] bg-white/80 p-6 text-black/60 sm:col-span-2 lg:col-span-4">
                  <p className="font-semibold text-[color:var(--foreground)]">We couldn’t load products.</p>
                  {process.env.NODE_ENV === "development" ? (
                    <>
                      <p className="mt-2 text-sm">
                        Server rendering needs an API URL. Set <strong>BACKEND_PROXY_ORIGIN</strong> on this Next project
                        (API origin only, no <code className="text-xs">/api</code>) — see{" "}
                        <code className="text-xs">web/.env.example</code>.
                      </p>
                      <p className="mt-3 text-xs text-black/45">
                        {!hasBackendProxyOrigin() && !process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ? (
                          <span>Neither BACKEND_PROXY_ORIGIN nor NEXT_PUBLIC_API_BASE_URL is set for this server.</span>
                        ) : (
                          <span>Proxy / API URL is configured.</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm">
                      Please try again later or open Shop — we’re having trouble reaching the catalog.
                    </p>
                  )}
                </div>
              ) : null}
              {catalogState === "empty" ? (
                <div className="rounded-3xl border border-[color:var(--border-subtle)] bg-white/80 p-6 text-black/60 sm:col-span-2 lg:col-span-4">
                  Products will appear here when you publish them in admin. Mark favorites as{" "}
                  <span className="font-semibold text-[color:var(--foreground)]">Featured</span> to fill the top row.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
