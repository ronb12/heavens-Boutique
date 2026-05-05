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
  { value: "kenburns", label: "Gentle slow zoom (recommended)" },
  { value: "subtle-zoom", label: "Light zoom" },
  { value: "fade", label: "Soft light pulse over the photo" },
  { value: "none", label: "No movement — still photo" },
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

/** Resize to JPEG data URL for admin upload (same idea as product editor). */
function fileToJpegDataUrl(file: File, maxW = 2000, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = w > maxW ? maxW / w : 1;
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not available");
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}

function isHttpImageUrl(s: string | null | undefined): boolean {
  return Boolean(s && /^https?:\/\//i.test(s.trim()));
}

export function AdminHomepageClient() {
  const [content, setContent] = useState<HomepageContent>({ banners: [], collections: [] });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedText, setAdvancedText] = useState("{}");
  const [heroUploading, setHeroUploading] = useState(false);
  const [bannerUploadIndex, setBannerUploadIndex] = useState<number | null>(null);

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
        if (mounted) setError(errMsg(e, "Couldn’t load this page. Refresh, or sign in again."));
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
      setSaved("Preview updated from the backup box — click Save changes to publish.");
    } catch {
      setError("That backup text isn’t valid. Use the forms above, or ask support to fix the text.");
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
      setSaved("Saved. Shoppers see updates after they refresh the site or pull down to refresh in the app.");
      setAdvancedText(JSON.stringify(payload, null, 2));
      const r = await apiFetch<{ updatedAt: string | null }>("/api/admin/homepage", { method: "GET" });
      setUpdatedAt(r.updatedAt ?? null);
    } catch (e: unknown) {
      setError(errMsg(e, "Couldn’t save. Try again. If it keeps failing, use the backup box below or ask support."));
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
    <AdminShell title="Store home (website + app)">
      <div className="max-w-3xl rounded-3xl border border-[color:var(--border-subtle)] bg-[color:var(--pink-mist)]/40 p-6 mb-8">
        <h2 className="text-lg font-semibold text-[color:var(--foreground)]">What this page controls</h2>
        <p className="mt-2 text-black/70 leading-relaxed">
          <span className="font-semibold text-black/85">Big photo at the top</span> — the wide picture and words at the top
          of your <span className="font-semibold text-black/85">website</span> and the{" "}
          <span className="font-semibold text-black/85">iPhone app Home tab</span> stay in sync. You choose the photo, text,
          and how gently it moves.
        </p>
        <p className="mt-3 text-black/70 leading-relaxed">
          <span className="font-semibold text-black/85">Promo slides</span> and{" "}
          <span className="font-semibold text-black/85">extra product rows</span> show on the{" "}
          <span className="font-semibold text-black/85">app only</span> (under the featured products area). No code needed
          — just fill in the boxes.
        </p>
        {lastSavedLabel ? (
          <p className="mt-3 text-sm text-black/55">
            Last saved: <span className="font-medium text-black/70">{lastSavedLabel}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-black/55">You haven’t saved yet — shoppers still see the usual defaults.</p>
        )}
      </div>

      {/* —— Hero (web + app) —— */}
      <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Big photo at the top (website + app)</h3>
            <p className="mt-1 text-sm text-black/60 max-w-2xl">
              Upload an image from your device or paste a direct picture URL (https://…). Leave the photo empty to keep the
              default pink banner on the site and app until you publish one.
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-rose-800 hover:underline disabled:opacity-40"
            disabled={!content.hero}
            onClick={() => clearHero()}
          >
            Use default banner instead
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-black/10 bg-gradient-to-br from-[#fffefb] to-[#fdf5fa]/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-[color:var(--charcoal)]">Hero image</span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full bg-[color:var(--gold)] px-5 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-55">
                  {heroUploading ? "Uploading…" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={heroUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setHeroUploading(true);
                      setError(null);
                      try {
                        const dataUrl = await fileToJpegDataUrl(file);
                        const up = await apiFetch<{ publicId?: string; url?: string }>("/api/admin/upload", {
                          method: "POST",
                          body: JSON.stringify({ imageBase64: dataUrl }),
                        });
                        const nextUrl = String(up.url || up.publicId || "").trim();
                        if (!nextUrl) throw new Error("Upload did not return an image address");
                        patchHero({ imageUrl: nextUrl });
                      } catch (err: unknown) {
                        setError(errMsg(err, "Couldn’t upload. Check you’re signed in and try a smaller JPG/PNG."));
                      } finally {
                        setHeroUploading(false);
                      }
                    }}
                  />
                </label>
                {mergedHero.imageUrl?.trim() ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-rose-800 hover:underline disabled:opacity-50"
                    disabled={heroUploading}
                    onClick={() => patchHero({ imageUrl: "" })}
                  >
                    Clear photo
                  </button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-black/50">
              Uploads go to your store’s image hosting (same as product photos). You can still paste any https image URL
              below instead.
            </p>
            {isHttpImageUrl(mergedHero.imageUrl) ? (
              <div className="relative aspect-[21/11] max-h-44 w-full max-w-2xl overflow-hidden rounded-2xl border border-black/10 bg-black/[0.06] shadow-inner">
                {/* eslint-disable-next-line @next/next/no-img-element -- CMS preview */}
                <img
                  src={mergedHero.imageUrl!.trim()}
                  alt=""
                  className="h-full w-full object-cover object-center"
                />
              </div>
            ) : null}
          </div>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Or paste image URL</span>
            <input
              value={mergedHero.imageUrl ?? ""}
              onChange={(e) => patchHero({ imageUrl: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
              placeholder="https://…"
            />
            <span className="text-xs text-black/50">Direct link to a .jpg, .png, or .webp file works best.</span>
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Photo movement (website and app match)</span>
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
            <span className="text-sm font-semibold">Small line above the headline (optional)</span>
            <input
              value={mergedHero.eyebrow ?? ""}
              onChange={(e) => patchHero({ eyebrow: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="e.g. New collection"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Main headline (optional)</span>
            <input
              value={mergedHero.title ?? ""}
              onChange={(e) => patchHero({ title: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="e.g. Spring favorites"
            />
          </label>
          <label className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-semibold">Extra sentence under the headline (optional)</span>
            <textarea
              value={mergedHero.subtitle ?? ""}
              onChange={(e) => patchHero({ subtitle: e.target.value })}
              className="min-h-24 rounded-2xl border border-black/10 px-4 py-3"
              placeholder="A short inviting line"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Button words (optional)</span>
            <input
              value={mergedHero.ctaLabel ?? ""}
              onChange={(e) => patchHero({ ctaLabel: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4"
              placeholder="Shop now"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Where the button goes (website)</span>
            <input
              value={mergedHero.ctaHref ?? ""}
              onChange={(e) => patchHero({ ctaHref: e.target.value })}
              className="h-11 rounded-2xl border border-black/10 px-4 font-mono text-sm"
              placeholder="/shop"
            />
            <span className="text-xs text-black/50">
              Usually type <span className="font-mono">/shop</span> for your shop page. The app button still opens the shop
              the same way.
            </span>
          </label>
        </div>
      </section>

      {error ? <div className="mb-4 text-sm text-rose-700 font-semibold">{error}</div> : null}
      {saved && !error ? <div className="mb-4 text-sm text-emerald-700 font-semibold">{saved}</div> : null}

      {/* —— Banners —— */}
      <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Swipe promos (app only)</h3>
            <p className="mt-1 text-sm text-black/60 max-w-xl">
              Large cards customers swipe sideways on the iPhone Home tab. Add one or more. If you leave this empty, the
              app keeps its built-in “Shop the Look” card.
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
            + Add a promo card
          </button>
        </div>

        <div className="mt-6 grid gap-6">
          {content.banners.length === 0 ? (
            <p className="text-sm text-black/55 italic">No custom cards — the app uses its usual default promo.</p>
          ) : (
            content.banners.map((b, i) => (
              <div
                key={`banner-${i}`}
                className="rounded-2xl border border-black/10 bg-white p-5 grid gap-4 sm:grid-cols-2"
              >
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Title on the card (required)</span>
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
                  <span className="text-sm font-semibold">Smaller line under the title (optional)</span>
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
                <div className="sm:col-span-2 grid gap-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">Card photo (optional)</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full bg-[color:var(--gold)] px-4 text-xs font-semibold text-[color:var(--charcoal)] shadow-sm hover:brightness-[1.04] disabled:opacity-55">
                        {bannerUploadIndex === i ? "Uploading…" : "Upload"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          disabled={bannerUploadIndex !== null}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            setBannerUploadIndex(i);
                            setError(null);
                            try {
                              const dataUrl = await fileToJpegDataUrl(file);
                              const up = await apiFetch<{ publicId?: string; url?: string }>("/api/admin/upload", {
                                method: "POST",
                                body: JSON.stringify({ imageBase64: dataUrl }),
                              });
                              const nextUrl = String(up.url || up.publicId || "").trim();
                              if (!nextUrl) throw new Error("Upload did not return an image address");
                              setContent((c) => {
                                const banners = [...c.banners];
                                banners[i] = { ...banners[i], imageUrl: nextUrl };
                                return { ...c, banners };
                              });
                            } catch (err: unknown) {
                              setError(errMsg(err, "Couldn’t upload this card image."));
                            } finally {
                              setBannerUploadIndex(null);
                            }
                          }}
                        />
                      </label>
                      {b.imageUrl?.trim() ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-800 hover:underline"
                          onClick={() =>
                            setContent((c) => {
                              const banners = [...c.banners];
                              banners[i] = { ...banners[i], imageUrl: "" };
                              return { ...c, banners };
                            })
                          }
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {isHttpImageUrl(b.imageUrl) ? (
                    <div className="relative h-28 max-w-xs overflow-hidden rounded-xl border border-black/10 bg-black/[0.06]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl!.trim()} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : null}
                  <label className="grid gap-1.5">
                    <span className="text-xs font-semibold text-black/70">Or paste image URL</span>
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
                      placeholder="https://…"
                    />
                  </label>
                  <span className="text-xs text-black/50">
                    If you skip a photo, the card uses a soft pink background.
                  </span>
                </div>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Button words (optional)</span>
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
                  <span className="text-sm font-semibold">Special button link (optional)</span>
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
                    placeholder="Leave blank unless support gave you text to paste here"
                  />
                  <span className="text-xs text-black/50">
                    Most owners leave this blank. The card still shows your photo and words.
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
                    Remove this card
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
            <h3 className="text-xl font-semibold">Extra product rows (app only)</h3>
            <p className="mt-1 text-sm text-black/60 max-w-xl">
              Each row needs a <span className="font-medium text-black/75">title</span> customers see (like “Best
              sellers”) and a simple rule for which products to pull from your catalog. Rows show under the featured
              products on the iPhone Home tab.
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
            + Add a product row
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-black/[0.03] p-4 text-sm text-black/65">
          <div className="font-semibold text-black/80 mb-2">How to fill “Which products?”</div>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="font-medium text-black/80">Show your featured picks</span> — type{" "}
              <code className="bg-white/80 px-1 rounded text-xs">featured=1</code> (same items you star under Products in
              admin).
            </li>
            <li>
              <span className="font-medium text-black/80">Show one category</span> — type{" "}
              <code className="bg-white/80 px-1 rounded text-xs">category=</code> then the exact category name from your
              catalog, e.g. <code className="bg-white/80 px-1 rounded text-xs">category=Dresses</code>.
            </li>
            <li>
              <span className="font-medium text-black/80">Not sure?</span> Use{" "}
              <code className="bg-white/80 px-1 rounded text-xs">featured=1</code> or remove the row so the app doesn’t
              show an empty strip.
            </li>
          </ul>
        </div>

        <div className="mt-6 grid gap-6">
          {content.collections.length === 0 ? (
            <p className="text-sm text-black/55 italic">
              No extra rows — customers only see featured products plus your swipe promos above.
            </p>
          ) : (
            content.collections.map((col, i) => (
              <div key={`col-${i}`} className="rounded-2xl border border-black/10 bg-white p-5 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 sm:col-span-2">
                  <span className="text-sm font-semibold">Title shoppers see</span>
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
                  <span className="text-sm font-semibold">Which products? (see the gray box above)</span>
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
                    placeholder="e.g. featured=1"
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
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          className="h-12 px-6 rounded-full border border-black/15 bg-white font-semibold"
          onClick={() => {
            syncAdvancedFromForm();
            setShowAdvanced((v) => !v);
          }}
        >
          {showAdvanced ? "Hide backup / tech view" : "Backup for tech support (optional)"}
        </button>
      </div>

      {showAdvanced ? (
        <section className="rounded-3xl border border-black/10 bg-white/90 p-6 mb-8">
          <h3 className="font-semibold">Backup copy of your settings</h3>
          <p className="mt-2 text-sm text-black/60">
            You can ignore this unless someone helping you asked for it. It matches the forms above. “Apply to forms”
            loads it into the boxes; then tap <span className="font-medium">Save changes</span>.
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
              Apply to forms
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-full border border-black/10 bg-white font-semibold text-sm"
              onClick={syncAdvancedFromForm}
            >
              Copy forms into this box
            </button>
          </div>
        </section>
      ) : null}

      <p className="text-xs text-black/45 max-w-2xl">
        Tip: screenshot this page before big changes, or use “Backup for tech support” to copy text for your helper. You
        only need the regular boxes above — no coding.
      </p>
    </AdminShell>
  );
}
