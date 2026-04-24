import { AppShell } from "@/components/layout/AppShell";
import { DocumentsOverview } from "@/features/documents/DocumentsOverview";

export default function DocumentsPage() {
  return (
    <AppShell>
      <DocumentsOverview />
    </AppShell>
  );
}
