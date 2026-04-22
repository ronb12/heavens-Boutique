"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { HomepageHero } from "@/lib/homepageContent";
import { normalizeHeroAnimation } from "@/lib/homepageContent";

function animWrapperClass(animation: string | undefined | null): string {
  const key = normalizeHeroAnimation(animation ?? undefined);
  switch (key) {
    case "fade":
      return "hb-hero-anim-fade";
    case "subtle-zoom":
      return "hb-hero-anim-subtle-zoom";
    case "none":
      return "";
    default:
      return "hb-hero-anim-kenburns";
  }
}

export function HomeHero({ hero }: { hero: HomepageHero }) {
  const url = hero.imageUrl?.trim();
  if (!url) return null;

  const eyebrow = hero.eyebrow?.trim();
  const title = hero.title?.trim();
  const subtitle = hero.subtitle?.trim();
  const ctaLabel = hero.ctaLabel?.trim();
  const ctaHrefRaw = hero.ctaHref?.trim();
  const wrapperAnim = animWrapperClass(hero.animation);
  const isFade = normalizeHeroAnimation(hero.animation ?? undefined) === "fade";

  const CtaInner = ({ children }: { children: ReactNode }) => (
    <span className="inline-flex items-center justify-center rounded-full bg-[color:var(--gold)] px-7 py-3 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_8px_28px_rgba(212,175,55,0.38)] transition hover:brightness-[1.05]">
      {children}
    </span>
  );

  let cta: ReactNode = null;
  const label = ctaLabel || "Shop now";
  if (ctaLabel || ctaHrefRaw) {
    const href = (ctaHrefRaw || "/shop").trim();
    const external = /^https?:\/\//i.test(href);
    cta = external ? (
      <a href={href} target="_blank" rel="noreferrer" className="no-underline mt-6 inline-block">
        <CtaInner>{label}</CtaInner>
      </a>
    ) : (
      <Link href={href.startsWith("/") ? href : `/${href}`} className="no-underline mt-6 inline-block">
        <CtaInner>{label}</CtaInner>
      </Link>
    );
  }

  return (
    <section className="relative mx-auto max-w-6xl px-4 pt-8 pb-2">
      <div className="relative overflow-hidden rounded-[2rem] border border-[color:var(--border-subtle)] shadow-[0_24px_60px_rgba(43,43,43,0.14)]">
        <div
          className={`relative aspect-[21/11] min-h-[280px] w-full max-h-[min(52vh,560px)] overflow-hidden md:aspect-[21/9] ${wrapperAnim}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS-supplied CDN image URL */}
          <img
            src={url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="(max-width: 768px) 100vw, 1152px"
          />
          {isFade ? (
            <div className="hb-hero-fade-layer pointer-events-none absolute inset-0 bg-gradient-to-br from-black/35 via-transparent to-black/45" />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/72 via-black/28 to-transparent" />
        </div>

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end">
          <div className="pointer-events-auto px-8 pb-10 pt-24 md:px-12 md:pb-12 lg:px-14 lg:pb-14">
            <div className="max-w-2xl">
              {eyebrow ? (
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/88">{eyebrow}</p>
              ) : null}
              {title ? (
                <h1 className="mt-3 text-3xl font-[family-name:var(--font-display)] font-semibold leading-[1.08] text-white drop-shadow md:text-5xl md:leading-[1.05]">
                  {title}
                </h1>
              ) : null}
              {subtitle ? (
                <p className="mt-4 max-w-xl text-base leading-relaxed text-white/90 md:text-lg">{subtitle}</p>
              ) : null}
              {cta ? <div className="pointer-events-auto">{cta}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
