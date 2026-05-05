import { NextResponse } from "next/server";
import { resolveUpstreamApiBase } from "@/lib/backendOrigin";

/**
 * Proxies public store flags from the Node API deployment.
 * Ensures `/api/store-settings` works on the Next origin even when rewrites mis-order or env is minimal.
 */
export async function GET() {
  const base = resolveUpstreamApiBase();

  if (base) {
    try {
      const r = await fetch(`${base.replace(/\/+$/, "")}/store-settings`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const text = await r.text();
      return new NextResponse(text, {
        status: r.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({
    giftCardsPurchaseEnabled: true,
    giftCardsPurchaseDisabledByEnv: false,
  });
}
