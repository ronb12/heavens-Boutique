"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { CartItem } from "@/lib/cartTypes";
import { addToCart as add, loadCart, saveCart, setCartQty as setQty } from "@/lib/cartStore";
import { refreshCartItemUnitPrices } from "@/lib/cartPricing";

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  clear: () => void;
  revalidatePrices: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const itemsRef = useRef<CartItem[]>([]);
  itemsRef.current = items;

  useEffect(() => {
    setItems(loadCart());
  }, []);

  useEffect(() => {
    saveCart(items);
  }, [items]);

  const revalidatePrices = useCallback(async () => {
    const current = itemsRef.current;
    if (current.length === 0) return;
    const next = await refreshCartItemUnitPrices(current);
    setItems(next);
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      addItem: (item) => setItems((prev) => add(prev, item)),
      setQuantity: (variantId, quantity) => setItems((prev) => setQty(prev, variantId, quantity)),
      clear: () => setItems([]),
      revalidatePrices,
    }),
    [items, revalidatePrices],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const v = useContext(CartContext);
  if (!v) throw new Error("useCart must be used within CartProvider");
  return v;
}

