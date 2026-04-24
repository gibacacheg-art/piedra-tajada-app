import { AppShell } from "@/components/layout/AppShell";
import { PaymentsOverview } from "@/features/payments/PaymentsOverview";

export default function PaymentsPage() {
  return (
    <AppShell>
      <PaymentsOverview />
    </AppShell>
  );
}
