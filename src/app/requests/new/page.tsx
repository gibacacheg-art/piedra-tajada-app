import { AppShell } from "@/components/layout/AppShell";
import { RequestCreatePage } from "@/features/requests/RequestCreatePage";

export default function NewRequestPage() {
  return (
    <AppShell>
      <RequestCreatePage />
    </AppShell>
  );
}
