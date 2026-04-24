import { AppShell } from "@/components/layout/AppShell";
import { EventList } from "@/features/events/EventList";

export default function EventsPage() {
  return (
    <AppShell>
      <EventList />
    </AppShell>
  );
}
