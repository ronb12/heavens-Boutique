/** Shared homepage CMS shape — persisted in `homepage_content` (API `/homepage`, admin `/admin/homepage`). */

export type HomepageBanner = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaPath?: string;
};

export type HomepageCollection = {
  title: string;
  query?: string;
};

/** Motion style for hero image — keep values aligned with iOS `HomepageHeroView`. */
export type HomepageHeroAnimation = "kenburns" | "fade" | "subtle-zoom" | "none";

export type HomepageHero = {
  imageUrl?: string;
  animation?: HomepageHeroAnimation | string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  /** Web: `/shop` ; app: same path where possible */
  ctaHref?: string;
};

export type HomepageContent = {
  banners: HomepageBanner[];
  collections: HomepageCollection[];
  hero?: HomepageHero | null;
};

const HERO_ANIMATIONS: HomepageHeroAnimation[] = ["kenburns", "fade", "subtle-zoom", "none"];

export function normalizeHeroAnimation(raw: string | undefined | null): HomepageHeroAnimation {
  const s = String(raw || "").trim().toLowerCase();
  if (HERO_ANIMATIONS.includes(s as HomepageHeroAnimation)) return s as HomepageHeroAnimation;
  return "kenburns";
}

export function normalizeHomepageContent(raw: unknown): HomepageContent {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const banners = Array.isArray(o.banners)
    ? (o.banners as unknown[]).map((b) => {
        const x = b && typeof b === "object" ? (b as Record<string, unknown>) : {};
        return {
          title: String(x.title ?? ""),
          subtitle: x.subtitle != null ? String(x.subtitle) : "",
          imageUrl: x.imageUrl != null ? String(x.imageUrl) : "",
          ctaLabel: x.ctaLabel != null ? String(x.ctaLabel) : "",
          ctaPath: x.ctaPath != null ? String(x.ctaPath) : "",
        };
      })
    : [];
  const collections = Array.isArray(o.collections)
    ? (o.collections as unknown[]).map((c) => {
        const x = c && typeof c === "object" ? (c as Record<string, unknown>) : {};
        return {
          title: String(x.title ?? ""),
          query: x.query != null ? String(x.query) : "",
        };
      })
    : [];

  let hero: HomepageHero | undefined;
  const hr = o.hero;
  if (hr && typeof hr === "object" && !Array.isArray(hr)) {
    const h = hr as Record<string, unknown>;
    const imageUrl = h.imageUrl != null ? String(h.imageUrl).trim() : "";
    const title = h.title != null ? String(h.title) : "";
    const eyebrow = h.eyebrow != null ? String(h.eyebrow) : "";
    const subtitle = h.subtitle != null ? String(h.subtitle) : "";
    const ctaLabel = h.ctaLabel != null ? String(h.ctaLabel) : "";
    const ctaHref = h.ctaHref != null ? String(h.ctaHref) : "";
    const animation = normalizeHeroAnimation(h.animation != null ? String(h.animation) : null);
    if (imageUrl || title || eyebrow || subtitle || ctaLabel || ctaHref) {
      hero = { animation };
      if (imageUrl) hero.imageUrl = imageUrl;
      if (title.trim()) hero.title = title.trim();
      if (eyebrow.trim()) hero.eyebrow = eyebrow.trim();
      if (subtitle.trim()) hero.subtitle = subtitle.trim();
      if (ctaLabel.trim()) hero.ctaLabel = ctaLabel.trim();
      if (ctaHref.trim()) hero.ctaHref = ctaHref.trim();
    }
  }

  return { banners, collections, ...(hero ? { hero } : {}) };
}

export function toHomepagePayload(c: HomepageContent): HomepageContent {
  const banners = c.banners.map((b) => {
    const out: HomepageBanner = { title: b.title.trim() };
    if (b.subtitle?.trim()) out.subtitle = b.subtitle.trim();
    if (b.imageUrl?.trim()) out.imageUrl = b.imageUrl.trim();
    if (b.ctaLabel?.trim()) out.ctaLabel = b.ctaLabel.trim();
    if (b.ctaPath?.trim()) out.ctaPath = b.ctaPath.trim();
    return out;
  });
  const collections = c.collections.map((col) => {
    const out: HomepageCollection = { title: col.title.trim() };
    if (col.query?.trim()) out.query = col.query.trim();
    return out;
  });

  let hero: HomepageHero | undefined;
  if (c.hero && typeof c.hero === "object") {
    const h = c.hero;
    const imageUrl = h.imageUrl?.trim() || "";
    const title = h.title?.trim() || "";
    const eyebrow = h.eyebrow?.trim() || "";
    const subtitle = h.subtitle?.trim() || "";
    const ctaLabel = h.ctaLabel?.trim() || "";
    const ctaHref = h.ctaHref?.trim() || "";
    const animation = normalizeHeroAnimation(h.animation != null ? String(h.animation) : null);
    if (imageUrl || title || eyebrow || subtitle || ctaLabel || ctaHref) {
      hero = { animation };
      if (imageUrl) hero.imageUrl = imageUrl;
      if (title) hero.title = title;
      if (eyebrow) hero.eyebrow = eyebrow;
      if (subtitle) hero.subtitle = subtitle;
      if (ctaLabel) hero.ctaLabel = ctaLabel;
      if (ctaHref) hero.ctaHref = ctaHref;
    }
  }

  return { banners, collections, ...(hero ? { hero } : {}) };
}
