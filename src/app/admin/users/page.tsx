import { AppShell } from "@/components/layout/AppShell";
import { UserRoleAdminSimple } from "@/features/admin/UserRoleAdminSimple";

export default function UsersPage() {
  return (
    <AppShell>
      <UserRoleAdminSimple />
    </AppShell>
  );
}
