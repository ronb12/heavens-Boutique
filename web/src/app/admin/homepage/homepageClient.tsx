"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import {
  type HomepageContent,
  normalizeHeroAnimation,
  normalizeHomepageContent,
  toHomepagePayload,
  type HomepageHero,
  type HomepageHeroAnimation,
} from "@/lib/homepageContent";

/** Re-export for any external imports */
export type { HomepageBanner, HomepageCollection } from "@/lib/homepageContent";

const HERO_ANIM_OPTIONS: { value: HomepageHeroAnimation; label: string }[] = [
  { value: "kenburns", label: "Ken burns (slow zoom + pan)" },
  { value: "subtle-zoom", label: "Subtle zoom" },
  { value: "fade", label: "Fade overlay pulse" },
  { value: "none", label: "Static image" },
];

function normalizeContent(raw: unknown): HomepageContent {
  return normalizeHomepageContent(raw);
}

function toPayload(c: HomepageContent): HomepageContent {
  return toHomepagePayload(c);
}

function emptyHero(): HomepageHero {
  return {
    animation: "kenburns",
    imageUrl: "",
    eyebrow: "",
    title: "",
    subtitle: "",
    ctaLabel: "",
    ctaHref: "/shop",
  };
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

export function AdminHomepageClient() {
  const [content, setContent] = useState<HomepageContent>({ banners: [], collections: [] });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedText, setAdvancedText] = useState("{}");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      try {
        const r = await apiFetch<{ content: unknown; updatedAt: string | null }>("/api/admin/homepage", {
          method: "GET",
        });
        const norm = normalizeContent(r.content || {});
        if (mounted) {
          setContent(norm);
          setUpdatedAt(r.updatedAt || null);
          setAdvancedText(JSON.stringify(toPayload(norm), null, 2));
        }
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load homepage content"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const syncAdvancedFromForm = () => {
    setAdvancedText(JSON.stringify(toPayload(content), null, 2));
  };

  const applyAdvancedJson = () => {
    try {
      const parsed = JSON.parse(advancedText) as unknown;
      const norm = normalizeContent(parsed);
      setContent(norm);
      setError(null);
      setSaved("Preview updated from raw data — click Save homepage to publish.");
    } catch {
      setError("That raw data isn’t valid. Check commas and quotation marks, or use the forms above instead.");
    }
  };

  const save = async () => {
    setSaved(null);
    setError(null);
    setSaving(true);
    try {
      const payload = toPayload(content);
      await apiFetch("/api/admin/homepage", {
        method: "POST",
        body: JSON.stringify({ content: payload }),
      });
      setSaved("Saved. Website homepage and app home screen update when visitors refresh.");
      setAdvancedText(JSON.stringify(payload, null, 2));
      const r = await apiFetch<{ updatedAt: string | null }>("/api/admin/homepage", { method: "GET" });
      setUpdatedAt(r.updatedAt ?? null);
    } catch (e: unknown) {
      setError(errMsg(e, "Couldn’t save. Try again or use Restore from backup below."));
    } finally {
      setSaving(false);
    }
  };

  const lastSavedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  const mergedHero: HomepageHero = { ...emptyHero(), ...(content.hero || {}) };

  const patchHero = (patch: Partial<HomepageHero>) => {
    setContent((c) => ({
      ...c,
      hero: { ...emptyHero(), ...(c.hero || {}), ...patch },
    }));
  };

  const clearHero = () => {
    setContent((c) => {
      const next: HomepageContent = { ...c };
      delete next.hero;
      return next;
    });
  };

  return (
    <AdminShell title="Homepage (app & web)">
      <div className="max-w-3xl rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--pink-mist)]/40 p-6 mb-8">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Synced homepage content</h2>
        <p className="mt-2 text-black/70 leading-relaxed">
          The <span className="font-semibold text-black/85">hero banner</span> below appears on both the{" "}
          <span className="font-semibold text-black/85">marketing website</span> and the{" "}
          <span className="font-semibold text-black/85">Heaven&apos;s Boutique app home screen</span> — same image, copy,
          and animation style (Ken burns, subtle zoom, fade pulse, or static).{" "}
          <span className="font-semibold text-black/85">Promo slides</span> and{" "}
          <span className="font-semibold text-black/85">product rows</span> still apply only to the app below the hero.
        </p>
        {lastSavedLabel ? (
          <p className="mt-3 text-sm text-black/55">
            Last saved: <span className="font-medium text-black/70">{lastSavedLabel}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-black/55">Nothing saved yet — defaults will show until you save.</p>
        )}
      </div>

      {/* —— Hero (web + app) —— */}
      <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Hero image &amp; animation</h3>
            <p className="mt-1 text-sm text-black/60 max-w-2xl">
              Requires a direct image URL (HTTPS). Leave everything empty to use the built-in layouts on web and app.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-rose-800 hover:underline disabled:opacity-40"
            disabled={!content.hero}
            onClick={() => clearHero()}
          >
            Clear hero
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Hero image URL</span>
            <input
              value={mergedHero.imageUrl ?? ""}
              onChange={(e) => patchHero({ imageUrl: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
              placeholder="https://… (.jpg / .png / WebP)"
            />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Motion (same on web &amp; app)</span>
            <select
              value={normalizeHeroAnimation(mergedHero.animation)}
              onChange={(e) => patchHero({ animation: e.target.value as HomepageHeroAnimation })}
              className="h-11 rounded-2xl border border-black/10 bg-white px-4"
            >
              {HERO_ANIM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Eyebrow (optional)</span>
            <input
              value={mergedHero.eyebrow ?? ""}
              onChange={(e) => patchHero({ eyebrow: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="e.g. New collection"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Title (optional)</span>
            <input
              value={mergedHero.title ?? ""}
              onChange={(e) => patchHero({ title: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="Main headline over the image"
            />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Subtitle (optional)</span>
            <textarea
              value={mergedHero.subtitle ?? ""}
              onChange={(e) => patchHero({ subtitle: e.target.value })}
              className="min-h-24 rounded-2xl border border-black/10 px-4 py-3"
              placeholder="Supporting line under the title"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Button label (optional)</span>
            <input
              value={mergedHero.ctaLabel ?? ""}
              onChange={(e) => patchHero({ ctaLabel: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="Shop now"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Button link</span>
            <input
              value={mergedHero.ctaHref ?? ""}
              onChange={(e) => patchHero({ ctaHref: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
              placeholder="/shop"
            />
            <span className="text-xs text-black/50">Website path (e.g. /shop) or https://… App opens Shop for /shop.</span>
          </label>
        </div>
      </section>

      {error ? <div className="mb-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {saved && !error ? <div className="mb-4 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

      {/* —— Banners —— */}
      <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Promo slides</h3>
            <p className="mt-1 text-sm text-black/60 max-w-xl">
              Big sliding cards at the top of the app home screen. Add one or more — they rotate like a carousel. If you
              leave this empty, the app shows its default “Shop the Look” slide.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 px-4 py-2 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold text-sm"
            onClick={() =>
              setContent((c) => ({
                ...c,
                banners: [
                  ...c.banners,
                  {
                    title: "New headline",
                    subtitle: "Short supporting sentence",
                    imageUrl: "",
                    ctaLabel: "Shop now",
                    ctaPath: "",
                  },
                ],
              }))
            }
          >
            + Add slide
          </button>
        </div>

        <div className="mt-6 grid gap-6">
          {content.banners.length === 0 ? (
            <p className="text-sm text-black/55 italic">No custom slides — the app will use the built-in default banner.</p>
          ) : (
            content.banners.map((b, i) => (
              <div
                key={`banner-${i}`}
                className="rounded-2xl border border-black/10 bg-white p-5 grid gap-4 sm:grid-cols-2"
              >
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Headline (required)</span>
                  <input
                    value={b.title}
                    onChange={(e) =>
                      setContent((c) => {
                        const banners = [...c.banners];
                        banners[i] = { ...banners[i], title: e.target.value };
                        return { ...c, banners };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4"
                    placeholder="e.g. Spring drop is here"
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Supporting text (optional)</span>
                  <input
                    value={b.subtitle ?? ""}
                    onChange={(e) =>
                      setContent((c) => {
                        const banners = [...c.banners];
                        banners[i] = { ...banners[i], subtitle: e.target.value };
                        return { ...c, banners };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4"
                    placeholder="One line that appears under the headline"
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Photo — web address (optional)</span>
                  <input
                    value={b.imageUrl ?? ""}
                    onChange={(e) =>
                      setContent((c) => {
                        const banners = [...c.banners];
                        banners[i] = { ...banners[i], imageUrl: e.target.value };
                        return { ...c, banners };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
                    placeholder="https://… (must be a direct link to an image)"
                  />
                  <span className="text-xs text-black/50">
                    Paste a link that opens only the image (usually ends in .jpg or .png). If blank, the app uses a soft
                    pink background.
                  </span>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Button label (optional)</span>
                  <input
                    value={b.ctaLabel ?? ""}
                    onChange={(e) =>
                      setContent((c) => {
                        const banners = [...c.banners];
                        banners[i] = { ...banners[i], ctaLabel: e.target.value };
                        return { ...c, banners };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4"
                    placeholder="e.g. Shop the collection"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Button link — app path (optional)</span>
                  <input
                    value={b.ctaPath ?? ""}
                    onChange={(e) =>
                      setContent((c) => {
                        const banners = [...c.banners];
                        banners[i] = { ...banners[i], ctaPath: e.target.value };
                        return { ...c, banners };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
                    placeholder="e.g. shop?category=Dresses"
                  />
                  <span className="text-xs text-black/50">
                    For technical routing in the app. Leave blank if unsure — the slide still shows text and image.
                  </span>
                </label>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-rose-800 hover:underline"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        banners: c.banners.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    Remove this slide
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* —— Collections —— */}
      <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Product rows</h3>
            <p className="mt-1 text-sm text-black/60 max-w-xl">
              Each row has a <span className="font-medium text-black/75">title</span> (what shoppers read) and loads
              products from your catalog using a simple filter. Rows appear below “Featured” on the app home screen.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 px-4 py-2 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold text-sm"
            onClick={() =>
              setContent((c) => ({
                ...c,
                collections: [...c.collections, { title: "New row title", query: "featured=1" }],
              }))
            }
          >
            + Add row
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-black/[0.03] p-4 text-sm text-black/65">
          <div className="font-semibold text-black/80 mb-1">Filter examples (copy into the filter box)</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <code className="bg-white/80 px-1 rounded">featured=1</code> — products marked featured in admin
            </li>
            <li>
              <code className="bg-white/80 px-1 rounded">category=Dresses</code> — match the category name exactly as in
              your products
            </li>
            <li>
              Leave filter empty only if support told you to — usually use <code className="bg-white/80 px-1 rounded">featured=1</code> so the row isn’t empty.
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-6">
          {content.collections.length === 0 ? (
            <p className="text-sm text-black/55 italic">No extra product rows — only Featured will show (plus your slides above).</p>
          ) : (
            content.collections.map((col, i) => (
              <div key={`col-${i}`} className="rounded-2xl border border-black/10 bg-white p-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Row title (shown to customers)</span>
                  <input
                    value={col.title}
                    onChange={(e) =>
                      setContent((c) => {
                        const collections = [...c.collections];
                        collections[i] = { ...collections[i], title: e.target.value };
                        return { ...c, collections };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4"
                    placeholder="e.g. Weekend picks"
                  />
                </label>
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Product filter</span>
                  <input
                    value={col.query ?? ""}
                    onChange={(e) =>
                      setContent((c) => {
                        const collections = [...c.collections];
                        collections[i] = { ...collections[i], query: e.target.value };
                        return { ...c, collections };
                      })
                    }
                    className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
                    placeholder="featured=1"
                  />
                </label>
                <div className="sm:col-span-2 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-rose-800 hover:underline"
                    onClick={() =>
                      setContent((c) => ({
                        ...c,
                        collections: c.collections.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    Remove this row
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 mb-8">
        <button
          type="button"
          disabled={saving}
          className="h-12 px-8 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] font-semibold disabled:opacity-60"
          onClick={() => void save()}
        >
          {saving ? "Saving…" : "Save homepage"}
        </button>
        <button
          type="button"
          className="h-12 px-6 rounded-full border border-black/15 bg-white font-semibold"
          onClick={() => {
            syncAdvancedFromForm();
            setShowAdvanced((v) => !v);
          }}
        >
          {showAdvanced ? "Hide technical view" : "Technical view (raw data)"}
        </button>
      </div>

      {showAdvanced ? (
        <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
          <h3 className="font-semibold">Technical view</h3>
          <p className="mt-2 text-sm text-black/60">
            For developers or support. This is the same information as the forms — edit carefully. Click “Apply raw data”
            to load it into the forms, then use <span className="font-medium">Save homepage</span>.
          </p>
          <textarea
            value={advancedText}
            onChange={(e) => setAdvancedText(e.target.value)}
            className="mt-4 w-full min-h-[280px] rounded-2xl border border-black/10 bg-white p-4 font-mono text-xs"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-full border border-black/10 bg-white font-semibold text-sm"
              onClick={applyAdvancedJson}
            >
              Apply raw data to forms
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-full border border-black/10 bg-white font-semibold text-sm"
              onClick={syncAdvancedFromForm}
            >
              Copy forms into box
            </button>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-black/45 max-w-2xl">
        Tip: Take a screenshot of this page or ask your developer for a backup JSON before big changes. Questions about
        filters or image links? Ask support — you don’t need to understand code to use the forms above.
      </p>
    </AdminShell>
  );
}
