import { AppShell } from "@/components/layout/AppShell";
import { RequestDetail } from "@/features/requests/RequestDetail";

export default async function RequestDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const { section } = await searchParams;

  return (
    <AppShell>
      <RequestDetail id={id} initialSection={section ?? "resumen"} />
    </AppShell>
  );
}
