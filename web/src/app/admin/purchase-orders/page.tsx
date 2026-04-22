import { AdminShell } from "@/components/AdminShell";
import { PurchaseOrdersClient } from "./purchaseOrdersClient";

export default function AdminPurchaseOrdersPage() {
  return (
    <AdminShell title="Purchase orders">
      <PurchaseOrdersClient />
    </AdminShell>
  );
}

