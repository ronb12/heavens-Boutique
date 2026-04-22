import { InventoryHubClient } from "./inventoryHubClient";

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const sp = await searchParams;
  const initialTab = sp.tab === "history" ? "history" : "stock";
  return <InventoryHubClient initialTab={initialTab} />;
}
