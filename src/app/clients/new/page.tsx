import { AppShell } from "@/components/layout/AppShell";
import { ClientCreateForm } from "@/features/clients/ClientCreateForm";

export default function NewClientPage() {
  return (
    <AppShell>
      <ClientCreateForm />
    </AppShell>
  );
}
