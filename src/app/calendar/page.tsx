import { AppShell } from "@/components/layout/AppShell";
import { EventCalendar } from "@/features/calendar/EventCalendar";

export default function CalendarPage() {
  return (
    <AppShell>
      <EventCalendar />
    </AppShell>
  );
}
