import { AppShell } from "@/components/layout/AppShell";
import { AdminOverview } from "@/features/admin/AdminOverview";

export default function AdminPage() {
  return (
    <AppShell>
      <AdminOverview />
    </AppShell>
  );
}
