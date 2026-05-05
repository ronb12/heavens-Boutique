import Link from "next/link";
import type { ProductDTO } from "@/lib/types";
import { formatUsd } from "@/lib/money";

export function HomeProductCard({ product }: { product: ProductDTO }) {
  const img = product.images?.[0];
  const payCents = product.salePriceCents ?? product.priceCents;
  const compareCents = product.salePriceCents != null ? product.priceCents : null;

  return (
    <Link
      href={`/shop/${product.id}`}
      className="group block overflow-hidden rounded-2xl border border-black/[0.08] bg-white no-underline shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-md motion-reduce:transform-none"
    >
      <div className="aspect-[3/4] w-full overflow-hidden bg-black/[0.04]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN URLs from API
          <img
            src={img}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-3 text-center text-[11px] font-medium uppercase tracking-wide text-black/35">
            Photo coming soon
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="line-clamp-2 font-semibold text-[color:var(--foreground)] leading-snug">{product.name}</div>
        <div className="mt-1 text-[12px] text-black/50">{product.category || "Boutique"}</div>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          <span className="font-semibold tabular-nums text-[color:var(--foreground)]">{formatUsd(payCents)}</span>
          {compareCents != null && compareCents !== payCents ? (
            <span className="text-[13px] text-black/40 line-through tabular-nums">{formatUsd(compareCents)}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
