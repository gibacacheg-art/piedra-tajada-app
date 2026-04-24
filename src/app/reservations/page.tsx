import { AppShell } from "@/components/layout/AppShell";
import { ReservationsOverview } from "@/features/reservations/ReservationsOverview";

export default function ReservationsPage() {
  return (
    <AppShell>
      <ReservationsOverview />
    </AppShell>
  );
}
