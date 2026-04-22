import type { CartItem } from "@/lib/cartTypes";

const KEY = "hb_cart_v1";

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => ({
        productId: String(x.productId || ""),
        variantId: String(x.variantId || ""),
        quantity: Number(x.quantity || 0),
        name: String(x.name || ""),
        size: x.size != null ? String(x.size) : null,
        unitPriceCents: Number(x.unitPriceCents || 0),
      }))
      .filter((x) => x.productId && x.variantId && Number.isFinite(x.quantity) && x.quantity > 0);
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function addToCart(items: CartItem[], next: CartItem): CartItem[] {
  const qty = Math.max(1, Math.floor(next.quantity || 1));
  const idx = items.findIndex((i) => i.variantId === next.variantId);
  if (idx >= 0) {
    const copy = items.slice();
    copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
    return copy;
  }
  return [...items, { ...next, quantity: qty }];
}

export function setCartQty(items: CartItem[], variantId: string, qty: number): CartItem[] {
  const q = Math.max(0, Math.floor(qty || 0));
  if (q <= 0) return items.filter((i) => i.variantId !== variantId);
  return items.map((i) => (i.variantId === variantId ? { ...i, quantity: q } : i));
}

