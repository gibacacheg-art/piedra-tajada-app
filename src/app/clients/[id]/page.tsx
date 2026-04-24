import { AppShell } from "@/components/layout/AppShell";
import { ClientDetail } from "@/features/clients/ClientDetail";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <ClientDetail id={id} />
    </AppShell>
  );
}
