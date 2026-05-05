import { apiFetch } from "@/lib/api";
import type { CartItem } from "@/lib/cartTypes";
import type { ProductDTO } from "@/lib/types";

type ProductResponse = { product: ProductDTO };

/**
 * Re-fetch current catalog prices for each line so cart / checkout subtotals match
 * what the server charges (see `buildOrderTotals` in the API).
 */
export async function refreshCartItemUnitPrices(items: CartItem[]): Promise<CartItem[]> {
  if (items.length === 0) return [];
  const byProduct = new Map<string, CartItem[]>();
  for (const it of items) {
    const list = byProduct.get(it.productId) || [];
    list.push(it);
    byProduct.set(it.productId, list);
  }
  const out: CartItem[] = [];
  for (const [productId, lines] of byProduct) {
    try {
      const r = await apiFetch<ProductResponse>(`/api/products/${encodeURIComponent(productId)}`, {
        method: "GET",
        auth: false,
      });
      const p = r.product;
      const unit = p.salePriceCents ?? p.priceCents;
      for (const line of lines) {
        const v = p.variants.find((x) => x.id === line.variantId);
        if (!v) {
          out.push(line);
          continue;
        }
        out.push({
          ...line,
          name: p.name,
          size: v.size,
          unitPriceCents: unit,
        });
      }
    } catch {
      out.push(...lines);
    }
  }
  return out;
}
