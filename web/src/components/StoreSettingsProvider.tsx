"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api";

type StoreSettingsState = {
  giftCardsPurchaseEnabled: boolean;
  giftCardsPurchaseDisabledByEnv: boolean;
  loading: boolean;
};

const defaultState: StoreSettingsState = {
  /** Optimistic false until `/api/store-settings` loads — avoids flashing Gift cards when admin has purchases off. */
  giftCardsPurchaseEnabled: false,
  giftCardsPurchaseDisabledByEnv: false,
  loading: true,
};

const StoreSettingsContext = React.createContext<StoreSettingsState>(defaultState);

export function StoreSettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<StoreSettingsState>(defaultState);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch<{
          giftCardsPurchaseEnabled?: boolean;
          giftCardsPurchaseDisabledByEnv?: boolean;
        }>("/api/store-settings", { method: "GET", auth: false });
        if (!alive) return;
        setState({
          giftCardsPurchaseEnabled: r.giftCardsPurchaseEnabled !== false,
          giftCardsPurchaseDisabledByEnv: Boolean(r.giftCardsPurchaseDisabledByEnv),
          loading: false,
        });
      } catch {
        if (!alive) return;
        setState({
          giftCardsPurchaseEnabled: true,
          giftCardsPurchaseDisabledByEnv: false,
          loading: false,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const value = React.useMemo(() => state, [state]);
  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings() {
  return React.useContext(StoreSettingsContext);
}
