export type ProductVariantDTO = {
  id: string;
  productId?: string;
  size: string | null;
  sku?: string | null;
  stock: number;
};

export type ProductDTO = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  priceCents: number;
  salePriceCents: number | null;
  costCents?: number | null;
  isFeatured?: boolean;
  shopLookGroup?: string | null;
  supplierName?: string | null;
  supplierUrl?: string | null;
  supplierNotes?: string | null;
  images: string[];
  /**
   * Underlying stored image ids/URLs (Cloudinary public ids and/or absolute Blob URLs).
   * The API includes this for admin reads (alongside cost fields).
   */
  cloudinaryIds?: string[];
  createdAt?: string;
  variants: ProductVariantDTO[];
};

export type ProductsResponse = { products: ProductDTO[] };

export type MeResponse = {
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    phone?: string | null;
    role?: "admin" | "customer";
  };
};

