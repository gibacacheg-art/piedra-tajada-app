import { AppShell } from "@/components/layout/AppShell";
import { ClientList } from "@/features/clients/ClientList";

export default function ClientsPage() {
  return (
    <AppShell>
      <ClientList />
    </AppShell>
  );
}
