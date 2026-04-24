import { AppShell } from "@/components/layout/AppShell";
import { EventDetail } from "@/features/events/EventDetail";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <EventDetail id={id} />
    </AppShell>
  );
}
