import { AppShell } from "@/components/layout/AppShell";
import { TrashOverview } from "@/features/trash/TrashOverview";

export default function TrashPage() {
  return (
    <AppShell>
      <TrashOverview />
    </AppShell>
  );
}
