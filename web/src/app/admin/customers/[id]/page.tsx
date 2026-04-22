import { AdminCustomerDetailClient } from "./detailClient";

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminCustomerDetailClient id={id} />;
}

