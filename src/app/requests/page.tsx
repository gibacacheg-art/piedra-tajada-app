import { AppShell } from "@/components/layout/AppShell";
import { RequestList } from "@/features/requests/RequestList";

export default function RequestsPage() {
  return (
    <AppShell>
      <RequestList />
    </AppShell>
  );
}
