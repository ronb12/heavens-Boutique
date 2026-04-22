"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/api";
import type { ProductDTO, ProductVariantDTO } from "@/lib/types";
import {
  CUSTOM_CATEGORY_VALUE,
  CUSTOM_SIZE_VALUE,
  PRODUCT_CATEGORY_OPTIONS,
  SELECT_FIELD_CLASS,
  VARIANT_SIZE_OPTIONS,
} from "@/lib/formOptions";
import { ProductShareControls } from "@/components/ProductShareControls";
import { formatUsd } from "@/lib/money";
import { useShopProductShareUrl } from "@/lib/useShopProductShareUrl";

type VariantRow = { id?: string; size: string; sku: string; stock: string };

const PRODUCT_IMAGES_INPUT_ID = "admin-product-editor-images";

const INPUT_CLASS =
  "h-11 w-full rounded-2xl border border-black/[0.08] bg-white px-4 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const SELECT_CLASS = `${SELECT_FIELD_CLASS} w-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22`;

const TEXTAREA_CLASS =
  "min-h-32 w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

const SUPPLIER_TEXTAREA_CLASS =
  "min-h-28 w-full rounded-2xl border border-black/[0.08] bg-white px-4 py-3 text-[color:var(--charcoal)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-black/35 focus:border-[color:var(--gold)]/50 focus:ring-2 focus:ring-[color:var(--gold)]/22";

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error ? e.message : fallback;
}

/** Stored id may be a Cloudinary path or an absolute Blob URL after upload. */
function imagePreviewSrc(storedId: string): string | null {
  const s = storedId.trim();
  if (/^https?:\/\//i.test(s)) return s;
  return null;
}

/** Display cents from DB as a dollar field string (e.g. 1999 → "19.99"). */
function centsToDollarInput(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (Math.round(cents) / 100).toFixed(2);
}

/** Parse admin dollar text → integer cents. Accepts "19.99", "$20", " 25.00 ". */
function parseDollarInputToCents(raw: string): number | null {
  const s = raw.trim().replace(/^\$\s*/, "").replace(/,/g, "");
  if (!s) return null;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function EditorSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
      <div className="border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-4">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">{eyebrow}</p>
        ) : null}
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[color:var(--charcoal)]">
          {title}
        </h2>
        {description ? <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-black/55">{description}</p> : null}
      </div>
      <div className="grid gap-5 p-6">{children}</div>
    </section>
  );
}

function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="grid gap-0.5">
      <span className="text-sm font-semibold text-[color:var(--charcoal)]">{children}</span>
      {hint ? <span className="text-xs font-normal font-sans text-black/45">{hint}</span> : null}
    </span>
  );
}

function fileToJpegDataUrl(file: File, maxW = 1600, quality = 0.82): Promise<string> {
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
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
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

export function AdminProductEditorClient({ id }: { id?: string }) {
  const isNew = !id;

  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("general");
  const [description, setDescription] = useState("");
  const [priceDollars, setPriceDollars] = useState("19.99");
  const [salePriceDollars, setSalePriceDollars] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [shopLookGroup, setShopLookGroup] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [cloudinaryIds, setCloudinaryIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<VariantRow[]>([{ size: "OS", sku: "", stock: "0" }]);
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const title = useMemo(() => (isNew ? "New product" : "Edit product"), [isNew]);

  const categorySelectValue = useMemo(() => {
    const t = category.trim();
    return PRODUCT_CATEGORY_OPTIONS.some((c) => c.value === t) ? t : CUSTOM_CATEGORY_VALUE;
  }, [category]);

  const storefrontShareUrl = useShopProductShareUrl(id ?? "");

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const r = await apiFetch<{ product: ProductDTO }>(`/api/products/${encodeURIComponent(id)}`, { method: "GET" });
        const p = r.product;
        if (!mounted) return;
        setName(p.name || "");
        setSlug(p.slug || "");
        setCategory(p.category || "general");
        setDescription(p.description || "");
        setPriceDollars(centsToDollarInput(Number(p.priceCents ?? 0)));
        setSalePriceDollars(p.salePriceCents != null ? centsToDollarInput(p.salePriceCents) : "");
        setCostDollars(p.costCents != null ? centsToDollarInput(p.costCents) : "");
        setIsFeatured(Boolean(p.isFeatured));
        setShopLookGroup(p.shopLookGroup || "");
        setSupplierName(p.supplierName || "");
        setSupplierUrl(p.supplierUrl || "");
        setSupplierNotes(p.supplierNotes || "");
        setCloudinaryIds(Array.isArray(p.cloudinaryIds) ? p.cloudinaryIds : []);
        setVariants(
          (p.variants || []).length
            ? (p.variants || []).map((v: ProductVariantDTO) => ({
                id: v.id,
                size: String(v.size || ""),
                sku: String(v.sku || ""),
                stock: String(v.stock ?? 0),
              }))
            : [{ size: "OS", sku: "", stock: "0" }],
        );
      } catch (e: unknown) {
        if (mounted) setError(errMsg(e, "Failed to load product"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <AdminShell title={title}>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/90 px-4 py-2 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:border-[color:var(--gold)]/35 hover:bg-[#fffafb]"
        >
          <span aria-hidden className="text-[color:var(--gold)]">
            ←
          </span>
          All products
        </Link>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4 rounded-3xl border border-black/[0.06] bg-white/80 p-8">
          <div className="h-6 w-48 rounded-lg bg-black/[0.06]" />
          <div className="h-32 rounded-2xl bg-black/[0.05]" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-11 rounded-2xl bg-black/[0.05]" />
            <div className="h-11 rounded-2xl bg-black/[0.05]" />
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-900">
          {saved}
        </div>
      ) : null}

      {!loading && id && storefrontShareUrl ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-black/[0.07] bg-white p-5 shadow-[0_8px_28px_rgba(43,43,43,0.05)]">
          <div className="text-sm text-black/70">
            <span className="font-semibold text-[color:var(--charcoal)]">Public product link</span>
            <span className="text-black/55"> · Share on social or copy for campaigns.</span>
          </div>
          <ProductShareControls
            url={storefrontShareUrl}
            title={name.trim() || "Product"}
            description={description.trim() ? description.trim().slice(0, 280) : null}
            compact
          />
        </div>
      ) : null}

      {!loading ? (
        <>
          <div className="mb-8 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Media</p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                  Product photos
                </h2>
                <p className="mt-1.5 max-w-xl text-sm text-black/55">
                  Upload images before or after filling in details—they save when you create or update.
                  {isNew ? " Shoppers see these in the catalog and on the product page." : null}
                </p>
              </div>
              <label
                htmlFor={PRODUCT_IMAGES_INPUT_ID}
                className="inline-flex h-11 w-fit shrink-0 cursor-pointer items-center justify-center rounded-full bg-[color:var(--gold)] px-7 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_4px_20px_rgba(212,175,55,0.42)] ring-2 ring-[color:var(--charcoal)]/8 transition hover:brightness-[1.05] active:scale-[0.99]"
              >
                {uploading ? "Uploading…" : "Choose images"}
              </label>
            </div>
            <div className="space-y-4 p-6">
              <input
                id={PRODUCT_IMAGES_INPUT_ID}
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                className="sr-only"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  e.target.value = "";
                  if (!files.length) return;
                  setUploading(true);
                  setError(null);
                  try {
                    const next: string[] = [...cloudinaryIds];
                    for (const f of files) {
                      const dataUrl = await fileToJpegDataUrl(f);
                      const up = await apiFetch<{ publicId?: string; url?: string }>("/api/admin/upload", {
                        method: "POST",
                        body: JSON.stringify({ imageBase64: dataUrl }),
                      });
                      const pid = String(up.publicId || up.url || "").trim();
                      if (pid) next.push(pid);
                    }
                    setCloudinaryIds(next);
                  } catch (err: unknown) {
                    setError(errMsg(err, "Upload failed"));
                  } finally {
                    setUploading(false);
                  }
                }}
              />
              <p className="text-xs text-black/45">JPEG, PNG, WebP, or GIF · multiple files allowed</p>

              {cloudinaryIds.length ? (
                <div className="flex flex-wrap gap-3">
                  {cloudinaryIds.map((cid) => {
                    const prev = imagePreviewSrc(cid);
                    return (
                      <div
                        key={cid}
                        className="group relative flex h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-md ring-1 ring-black/[0.04]"
                      >
                        {prev ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin preview; URLs from Blob or CDN
                          <img src={prev} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center p-1 text-center font-mono text-[10px] leading-tight text-black/50 break-all">
                            {cid.length > 40 ? `${cid.slice(0, 38)}…` : cid}
                          </div>
                        )}
                        <button
                          type="button"
                          className="absolute inset-0 flex items-start justify-end p-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
                          onClick={() => setCloudinaryIds((xs) => xs.filter((x) => x !== cid))}
                          aria-label="Remove image"
                        >
                          <span className="rounded-full bg-black/60 px-2 py-1 text-[11px] font-semibold text-white shadow backdrop-blur-sm">
                            Remove
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[color:var(--gold)]/35 bg-gradient-to-br from-[#fffafb] to-[#fdf5fa]/80 px-6 py-12 text-center">
                  <p className="text-sm font-medium text-black/55">
                    Drag isn&apos;t enabled here — use{" "}
                    <span className="font-semibold text-[color:var(--charcoal)]">Choose images</span> to add photos.
                  </p>
                  <p className="mt-2 text-xs text-black/40">First image is typically used as the catalog thumbnail.</p>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="grid gap-8">
              <EditorSection
                eyebrow="Basics"
                title="Listing"
                description="Name and description appear on the shop and in search."
              >
                <label className="grid gap-2">
                  <FieldLabel hint="Shown on the product page and in the catalog.">Name</FieldLabel>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="e.g. Silk wrap dress" />
                </label>
                <label className="grid gap-2">
                  <FieldLabel hint="URL-friendly ID; lowercase, hyphens.">Slug</FieldLabel>
                  <input value={slug} onChange={(e) => setSlug(e.target.value)} className={INPUT_CLASS} placeholder="silk-wrap-dress" />
                </label>
                <div className="grid gap-2">
                  <FieldLabel hint="Used for filtering and merchandising.">Category</FieldLabel>
                  <select
                    value={categorySelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === CUSTOM_CATEGORY_VALUE) setCategory("");
                      else setCategory(v);
                    }}
                    className={SELECT_CLASS}
                  >
                    {PRODUCT_CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>Custom…</option>
                  </select>
                  {categorySelectValue === CUSTOM_CATEGORY_VALUE ? (
                    <input
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Custom category (slug)"
                    />
                  ) : null}
                </div>
                <label className="grid gap-2">
                  <FieldLabel hint="Supports plain text; line breaks are preserved where shown.">Description</FieldLabel>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={TEXTAREA_CLASS}
                    placeholder="Materials, fit, care…"
                  />
                </label>
              </EditorSection>

              <EditorSection
                eyebrow="Commerce"
                title="Pricing & visibility"
                description="Enter dollar amounts (e.g. 24.99). We store cents in the database—same as checkout."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="grid gap-2">
                    <FieldLabel hint="What the customer pays when no sale is active.">Price (USD)</FieldLabel>
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value={priceDollars}
                      onChange={(e) => setPriceDollars(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="19.99"
                    />
                    {parseDollarInputToCents(priceDollars) != null ? (
                      <span className="text-xs font-medium text-[color:var(--gold)]">
                        Stored: {formatUsd(parseDollarInputToCents(priceDollars)!)}
                      </span>
                    ) : (
                      <span className="text-xs text-black/35">Enter a valid amount</span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel hint="Optional. When set, this is the price charged; “Price” can act as compare-at in the app.">
                      Sale price (USD)
                    </FieldLabel>
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value={salePriceDollars}
                      onChange={(e) => setSalePriceDollars(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Optional"
                    />
                    {salePriceDollars.trim() && parseDollarInputToCents(salePriceDollars) != null ? (
                      <span className="text-xs font-medium text-[color:var(--gold)]">
                        {formatUsd(parseDollarInputToCents(salePriceDollars)!)}
                      </span>
                    ) : (
                      <span className="text-xs text-black/35">Optional</span>
                    )}
                  </label>
                  <label className="grid gap-2">
                    <FieldLabel hint="For margin / reports.">Cost (USD)</FieldLabel>
                    <input
                      inputMode="decimal"
                      autoComplete="off"
                      value={costDollars}
                      onChange={(e) => setCostDollars(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Optional"
                    />
                    {costDollars.trim() && parseDollarInputToCents(costDollars) != null ? (
                      <span className="text-xs font-medium text-black/45">{formatUsd(parseDollarInputToCents(costDollars)!)}</span>
                    ) : (
                      <span className="text-xs text-black/35">Optional</span>
                    )}
                  </label>
                </div>

                <label className="flex cursor-pointer items-center gap-4 rounded-2xl border border-black/[0.07] bg-[#fffafb]/80 px-4 py-3.5 transition hover:border-[color:var(--gold)]/30">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded border-black/20 text-[color:var(--gold)] focus:ring-[color:var(--gold)]/40"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-semibold text-[color:var(--charcoal)]">Featured product</span>
                    <span className="text-xs text-black/45">Surfaces in featured spots when your theme supports it.</span>
                  </span>
                </label>

                <label className="grid gap-2">
                  <FieldLabel hint="Group items that should appear together as a “look”.">Shop look group</FieldLabel>
                  <input
                    value={shopLookGroup}
                    onChange={(e) => setShopLookGroup(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="Optional"
                  />
                </label>
              </EditorSection>
            </div>

            <EditorSection
              eyebrow="Sourcing"
              title="Supplier"
              description="Optional — wholesale, B2B portal, marketplace, or local vendor. Used in low-stock and purchase-order flows."
            >
              <div className="grid gap-5 border-l-[3px] border-[color:var(--gold)]/85 pl-5">
                <label className="grid gap-2">
                  <FieldLabel>Supplier name</FieldLabel>
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={INPUT_CLASS} />
                </label>
                <label className="grid gap-2">
                  <FieldLabel hint="Reorder or product page on the vendor site.">Supplier URL</FieldLabel>
                  <input
                    type="url"
                    value={supplierUrl}
                    onChange={(e) => setSupplierUrl(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="https://"
                  />
                </label>
                <label className="grid gap-2">
                  <FieldLabel hint="Account #, MOQ, contact…">Supplier notes</FieldLabel>
                  <textarea value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} className={SUPPLIER_TEXTAREA_CLASS} />
                </label>
              </div>
            </EditorSection>

            <div className="lg:col-span-2 overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(43,43,43,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-black/[0.06] bg-gradient-to-r from-[#fffafb] via-white to-[#fdf5fa] px-6 py-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--rose)]/90">Inventory</p>
                  <h2 className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[color:var(--charcoal)]">
                    Variants
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-black/55">
                    Each row is a sellable SKU. Enter <strong className="font-semibold text-black/70">on-hand</strong>{" "}
                    units in <span className="font-semibold text-black/70">Stock</span> (editable here or in{" "}
                    <Link href="/admin/inventory" className="font-semibold text-[color:var(--gold)] no-underline hover:underline">
                      Inventory
                    </Link>
                    ).
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white px-5 text-sm font-semibold text-[color:var(--charcoal)] shadow-sm transition hover:border-[color:var(--gold)]/40 hover:bg-[#fffafb]"
                  onClick={() => setVariants((vs) => [...vs, { size: "", sku: "", stock: "0" }])}
                >
                  Add variant
                </button>
              </div>

              <div className="p-6">
                <div className="mb-3 hidden gap-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 sm:grid sm:grid-cols-12 sm:items-end sm:px-4">
                  <div className="sm:col-span-4">Size</div>
                  <div className="sm:col-span-4">SKU</div>
                  <div className="sm:col-span-3">On hand</div>
                  <div className="sm:col-span-1" />
                </div>

                <div className="grid gap-4">
                  {variants.map((v, idx) => (
                    <div
                      key={`${v.id || "new"}-${idx}`}
                      className="grid gap-3 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-[#fffafb]/60 p-4 shadow-sm sm:grid-cols-12 sm:items-end"
                    >
                      <div className="sm:col-span-4 grid gap-2">
                        <span className="text-xs font-semibold text-black/60 sm:hidden">Size</span>
                        <select
                          value={VARIANT_SIZE_OPTIONS.some((o) => o.value === v.size) ? v.size : CUSTOM_SIZE_VALUE}
                          onChange={(e) => {
                            const val = e.target.value;
                            setVariants((vs) =>
                              vs.map((x, i) => (i === idx ? { ...x, size: val === CUSTOM_SIZE_VALUE ? "" : val } : x)),
                            );
                          }}
                          className={SELECT_CLASS}
                        >
                          {VARIANT_SIZE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                          <option value={CUSTOM_SIZE_VALUE}>Custom…</option>
                        </select>
                        {!VARIANT_SIZE_OPTIONS.some((o) => o.value === v.size) ? (
                          <input
                            value={v.size}
                            onChange={(e) =>
                              setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, size: e.target.value } : x)))
                            }
                            className={INPUT_CLASS}
                            placeholder="Custom size label"
                          />
                        ) : null}
                      </div>
                      <label className="sm:col-span-4 grid gap-2">
                        <span className="text-xs font-semibold text-black/60 sm:hidden">SKU</span>
                        <input
                          value={v.sku}
                          onChange={(e) => setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, sku: e.target.value } : x)))}
                          className={INPUT_CLASS}
                          placeholder="SKU-001"
                        />
                      </label>
                      <label className="sm:col-span-3 grid gap-2">
                        <span className="text-xs font-semibold text-black/60 sm:hidden">On hand</span>
                        <input
                          inputMode="numeric"
                          value={v.stock}
                          onChange={(e) =>
                            setVariants((vs) => vs.map((x, i) => (i === idx ? { ...x, stock: e.target.value } : x)))
                          }
                          className={INPUT_CLASS}
                        />
                      </label>
                      <div className="sm:col-span-1 flex justify-end sm:pb-0.5">
                        <button
                          type="button"
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-black/[0.08] bg-white text-lg font-bold leading-none text-black/45 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          onClick={() => {
                            if (v.id) setRemovedVariantIds((xs) => Array.from(new Set([...xs, v.id!])));
                            setVariants((vs) => vs.filter((_, i) => i !== idx));
                          }}
                          aria-label="Remove variant"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-black/[0.06] bg-gradient-to-r from-[#fdf5fa]/90 via-white to-[#fffafb] p-5">
                  <p className="text-sm text-black/50">
                    {isNew ? "Creates the product and variants in one step." : "Changes apply when you save."}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {!isNew ? (
                      <button
                        type="button"
                        className="h-12 rounded-full border border-rose-200/90 bg-white px-6 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50"
                        onClick={async () => {
                          const ok = window.confirm("Delete this product? This will fail if the product appears on orders.");
                          if (!ok) return;
                          setSaving(true);
                          setError(null);
                          setSaved(null);
                          try {
                            await apiFetch(`/api/products/${encodeURIComponent(id!)}`, { method: "DELETE" });
                            window.location.href = "/admin/products";
                          } catch (e: unknown) {
                            setError(errMsg(e, "Delete failed"));
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={saving}
                      className="h-12 min-w-[8.5rem] rounded-full bg-[color:var(--gold)] px-8 text-sm font-semibold text-[color:var(--charcoal)] shadow-[0_6px_24px_rgba(212,175,55,0.38)] transition hover:brightness-[1.06] disabled:opacity-60"
                      onClick={async () => {
                        setSaving(true);
                        setError(null);
                        setSaved(null);
                        try {
                          const priceParsed = parseDollarInputToCents(priceDollars);
                          if (priceParsed == null) {
                            setError("Enter a valid price in dollars (e.g. 19.99).");
                            setSaving(false);
                            return;
                          }

                          let saleCents: number | null = null;
                          if (salePriceDollars.trim()) {
                            const s = parseDollarInputToCents(salePriceDollars);
                            if (s == null) {
                              setError("Sale price must be a valid dollar amount or left empty.");
                              setSaving(false);
                              return;
                            }
                            saleCents = s;
                          }

                          let costParsed: number | null = null;
                          if (costDollars.trim()) {
                            const c = parseDollarInputToCents(costDollars);
                            if (c == null) {
                              setError("Cost must be a valid dollar amount or left empty.");
                              setSaving(false);
                              return;
                            }
                            costParsed = c;
                          }

                          const payload: Record<string, unknown> = {
                            name: name.trim(),
                            slug: slug.trim(),
                            category: category.trim(),
                            description: description.trim() ? description.trim() : null,
                            priceCents: priceParsed,
                            salePriceCents: saleCents,
                            costCents: costParsed,
                            isFeatured,
                            shopLookGroup: shopLookGroup.trim() ? shopLookGroup.trim() : null,
                            supplierName: supplierName.trim() ? supplierName.trim() : null,
                            supplierUrl: supplierUrl.trim() ? supplierUrl.trim() : null,
                            supplierNotes: supplierNotes.trim() ? supplierNotes.trim() : null,
                            cloudinaryIds,
                            removedVariantIds,
                            variants: variants
                              .filter((v) => String(v.size || "").trim() !== "")
                              .map((v) => ({
                                ...(v.id ? { id: v.id } : {}),
                                size: String(v.size).trim(),
                                sku: v.sku.trim() ? v.sku.trim() : null,
                                stock: Number(v.stock) || 0,
                              })),
                          };

                          if (isNew) {
                            await apiFetch("/api/products", { method: "POST", body: JSON.stringify(payload) });
                            setSaved("Created.");
                          } else {
                            await apiFetch(`/api/products/${encodeURIComponent(id!)}`, {
                              method: "PATCH",
                              body: JSON.stringify(payload),
                            });
                            setSaved("Saved.");
                          }
                        } catch (e: unknown) {
                          setError(errMsg(e, "Save failed"));
                        } finally {
                          setSaving(false);
                        }
                      }}
                    >
                      {saving ? "Saving…" : isNew ? "Create product" : "Save changes"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </AdminShell>
  );
}
