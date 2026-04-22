export type CartItem = {
  productId: string;
  variantId: string;
  quantity: number;
  // Denormalized for UX (so cart renders without extra roundtrips).
  name: string;
  size?: string | null;
  unitPriceCents: number;
};

