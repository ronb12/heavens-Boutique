"use client";

import { useEffect, useState } from "react";

/** Absolute storefront URL for `/shop/[id]` — works after hydration without requiring env on first paint in dev. */
export function useShopProductShareUrl(productId: string): string {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "") || "";
  const [origin, setOrigin] = useState(envBase);

  useEffect(() => {
    if (!envBase && typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, [envBase]);

  const base = origin || envBase;
  return base ? `${base}/shop/${encodeURIComponent(productId)}` : "";
}
