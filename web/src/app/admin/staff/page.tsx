import { AdminShell } from "@/components/AdminShell";
import { StaffAdminClient } from "@/app/admin/staff/staffClient";

export default function AdminStaffPage() {
  return (
    <AdminShell title="Staff">
      <StaffAdminClient />
    </AdminShell>
  );
}
