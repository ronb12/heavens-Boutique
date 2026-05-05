/** Mirrors backend `PERM` — staff-only; admins bypass checks. */
export const PERM = {
  ORDERS: "orders",
  PRODUCTS: "products",
  INVENTORY: "inventory",
  CUSTOMERS: "customers",
  RETURNS: "returns",
  DISCOUNTS: "discounts",
  GIFT_CARDS: "giftCards",
  CONTENT: "content",
  HOMEPAGE: "homepage",
  MARKETING: "marketing",
  REPORTS: "reports",
  SETTINGS: "settings",
  PURCHASE_ORDERS: "purchaseOrders",
  PROMO_ANALYTICS: "promoAnalytics",
  PRODUCTS_CSV: "productsCsv",
} as const;

export type StaffPermissionKey = (typeof PERM)[keyof typeof PERM];

export type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  role: string;
  loyaltyPoints?: number;
  staffPermissions?: Partial<Record<StaffPermissionKey, boolean>>;
  staffActive?: boolean;
};

export function canAccessAdminPortal(user: AdminUser | null): boolean {
  if (!user) return false;
  const r = user.role?.toLowerCase();
  if (r === "admin") return true;
  if (r !== "staff") return false;
  if (user.staffActive === false) return false;
  const p = user.staffPermissions;
  if (!p) return false;
  return Object.values(p).some(Boolean);
}

export function canPerm(user: AdminUser | null, key: StaffPermissionKey): boolean {
  if (!user) return false;
  if (user.role?.toLowerCase() === "admin") return true;
  return Boolean(user.staffPermissions?.[key]);
}

export function hrefToPermission(href: string): StaffPermissionKey | "dashboard" | null {
  if (href === "/admin") return "dashboard";
  if (href.startsWith("/admin/orders")) return PERM.ORDERS;
  if (href.startsWith("/admin/customers")) return PERM.CUSTOMERS;
  if (href.startsWith("/admin/returns")) return PERM.RETURNS;
  if (href.startsWith("/admin/product-imports")) return PERM.PRODUCTS;
  if (href.startsWith("/admin/products")) return PERM.PRODUCTS;
  if (href.startsWith("/admin/products-csv")) return PERM.PRODUCTS_CSV;
  if (href.startsWith("/admin/discounts")) return PERM.DISCOUNTS;
  if (href.startsWith("/admin/analytics")) return PERM.REPORTS;
  if (href.startsWith("/admin/promo-analytics")) return PERM.PROMO_ANALYTICS;
  if (href.startsWith("/admin/inventory-audit")) return PERM.INVENTORY;
  if (href.startsWith("/admin/inventory")) return PERM.INVENTORY;
  if (href.startsWith("/admin/purchase-orders")) return PERM.PURCHASE_ORDERS;
  if (href.startsWith("/admin/homepage")) return PERM.HOMEPAGE;
  if (href.startsWith("/admin/content-pages")) return PERM.CONTENT;
  if (href.startsWith("/admin/gift-cards")) return PERM.GIFT_CARDS;
  if (href.startsWith("/admin/stripe-settings") || href.startsWith("/admin/easypost-settings")) return PERM.SETTINGS;
  if (href.startsWith("/admin/staff")) return null;
  return null;
}
