import { AppShell } from "@/components/layout/AppShell";
import { MyTasksView } from "@/features/tasks/MyTasksView";

export default function MyTasksPage() {
  return (
    <AppShell>
      <MyTasksView />
    </AppShell>
  );
}
