"use client";

import { useCallback, useState } from "react";

type Props = {
  url: string;
  title: string;
  /** Short line for native share / previews */
  description?: string | null;
  /** Icon-only row (admin list); default shows labels */
  compact?: boolean;
};

export function ProductShareControls({ url, title, description, compact }: Props) {
  const [copied, setCopied] = useState(false);
  const text = description?.trim() || `Shop ${title} at Heaven's Boutique`;

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [url]);

  const shareNative = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title,
        text,
        url,
      });
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") await copyLink();
    }
  }, [copyLink, text, title, url]);

  const twitterHref = `https://twitter.com/intent/tweet?${new URLSearchParams({
    text: `${title}`,
    url,
  }).toString()}`;

  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 min-w-0 shrink">
        <button
          type="button"
          aria-label="Share product link"
          onClick={(e) => {
            e.preventDefault();
            void shareNative();
          }}
          className="px-3 py-2 rounded-full border border-black/10 bg-white text-xs font-semibold hover:bg-black/[0.03]"
        >
          Share
        </button>
        <button
          type="button"
          aria-label={copied ? "Link copied" : "Copy product link"}
          onClick={(e) => {
            e.preventDefault();
            void copyLink();
          }}
          className="px-3 py-2 rounded-full border border-black/10 bg-white text-xs font-semibold hover:bg-black/[0.03]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="text-sm font-semibold text-black/80">Share</div>
      <p className="mt-1 text-xs text-black/50">Post this product on social media or copy the link.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void shareNative()}
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[color:var(--gold)] text-[color:var(--charcoal)] text-sm font-semibold"
        >
          Share…
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-black/10 bg-white text-sm font-semibold"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          href={twitterHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-black/10 bg-white text-sm font-semibold no-underline text-black/80"
        >
          X / Twitter
        </a>
        <a
          href={fbHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-black/10 bg-white text-sm font-semibold no-underline text-black/80"
        >
          Facebook
        </a>
      </div>
    </div>
  );
}
