import { AdminOrderDetailClient } from "./orderDetailClient";

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminOrderDetailClient id={id} />;
}

