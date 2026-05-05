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
    <div className="hb-home-shell relative flex min-h-full flex-col">
      <div className="hb-home-ambient" aria-hidden>
        <div className="hb-home-ambient-mesh" />
      </div>
      <div className="relative z-[1] flex min-h-full flex-col">
      <HomeClientTrack />
      <SiteHeader active="home" />

      <main className="flex-1">
        {cmsHero ? <HomeHero hero={cmsHero} /> : null}

        {!cmsHero ? (
          <section className="mx-auto max-w-6xl px-4 py-14 grid gap-10 lg:grid-cols-2 items-center">
            <div className="hb-home-reveal">
              <div className="text-xs tracking-[0.25em] uppercase text-black/50 mb-3">
                Curated drops · Boutique pricing · Secure checkout
              </div>
              <h1 className="text-4xl leading-[1.05] md:text-6xl">Fresh boutique finds without the boutique markup</h1>
              <p className="mt-4 text-black/60 text-lg max-w-xl">
                Shop hand-selected clothing and accessories, save favorites, and checkout securely in a polished boutique
                experience.
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
                New arrivals, tracked orders, saved favorites, and support when you need it.
              </div>
            </div>

            <div className="hb-home-reveal relative overflow-hidden rounded-3xl border border-[color:var(--border-subtle)] bg-white/82 p-8 shadow-sm [animation-delay:0.1s]">
              <div className="relative">
                <div className="hb-script text-3xl">Pink &amp; gold. Always.</div>
                <p className="mt-2 text-black/60">
                  A curated storefront built around affordable finds, clear product details, and confident checkout.
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Curated drops</div>
                    <div className="text-black/55">Small edits, not clutter</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Secure checkout</div>
                    <div className="text-black/55">Stripe-powered payments</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Tracked orders</div>
                    <div className="text-black/55">Status stays clear</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-white/75 p-4">
                    <div className="font-semibold">Easy support</div>
                    <div className="text-black/55">Questions answered fast</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className={`mx-auto max-w-6xl px-4 pb-16 ${cmsHero ? "pt-4 md:pt-8" : ""}`}>
          <div className="hb-home-reveal mb-8 grid gap-3 sm:grid-cols-3 [animation-delay:0.08s]">
            {[
              ["1", "Find the best pieces", "Products are selected for style, fit potential, and margin before they hit the shop."],
              ["2", "Price for profit", "Admin tracks cost, sale price, supplier links, and inventory so every listing has a clear target."],
              ["3", "Sell with confidence", "Customers see polished pages, secure checkout, tracking, and clear support expectations."],
            ].map(([step, title, body]) => (
              <div key={step} className="rounded-3xl border border-[color:var(--border-subtle)] bg-white/72 p-5 shadow-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--gold)] text-sm font-bold text-[color:var(--charcoal)]">
                  {step}
                </div>
                <div className="mt-4 font-semibold text-[color:var(--foreground)]">{title}</div>
                <p className="mt-1 text-sm leading-6 text-black/58">{body}</p>
              </div>
            ))}
          </div>

          {featured.length > 0 ? (
            <div className="hb-home-reveal mb-12 rounded-[2rem] border border-[color:var(--border-subtle)] bg-white/60 p-6 sm:p-8 shadow-sm [animation-delay:0.12s]">
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
                {featured.map((p, i) => (
                  <div
                    key={p.id}
                    className="hb-home-reveal"
                    style={{ animationDelay: `${0.18 + i * 0.05}s` }}
                  >
                    <HomeProductCard product={p} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="hb-home-reveal rounded-[2rem] border border-[color:var(--border-subtle)] bg-[color:var(--pink-mist)]/25 p-6 sm:p-8 [animation-delay:0.15s]">
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
                ? newest.map((p, i) => (
                    <div
                      key={p.id}
                      className="hb-home-reveal"
                      style={{ animationDelay: `${0.2 + i * 0.05}s` }}
                    >
                      <HomeProductCard product={p} />
                    </div>
                  ))
                : null}
              {catalogState === "api_unreachable" ? (
                <div className="rounded-3xl border border-[color:var(--border-subtle)] bg-white/80 p-6 text-black/60 sm:col-span-2 lg:col-span-4">
                  <p className="font-semibold text-[color:var(--foreground)]">We couldn’t load products.</p>
                  {process.env.NODE_ENV === "development" ? (
                    <>
                      <p className="mt-2 text-sm">
                        Server rendering needs the store API. Set <strong>BACKEND_PROXY_ORIGIN</strong> (origin only, no{" "}
                        <code className="text-xs">/api</code>) or <strong>NEXT_PUBLIC_API_BASE_URL</strong> (full URL
                        ending in <code className="text-xs">/api</code>) — see <code className="text-xs">web/.env.example</code>.
                      </p>
                      <p className="mt-3 text-xs text-black/45">
                        {!hasBackendProxyOrigin() ? (
                          <span>No API origin is configured for this server.</span>
                        ) : (
                          <span>API origin is configured.</span>
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
    </div>
  );
}
