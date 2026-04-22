import { redirect } from "next/navigation";

/** Old URL — inventory + history live under `/admin/inventory`. */
export default function AdminInventoryAuditRedirectPage() {
  redirect("/admin/inventory?tab=history");
}
