import { AdminProductEditorClient } from "../editorClient";

export default async function AdminEditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminProductEditorClient id={id} />;
}
