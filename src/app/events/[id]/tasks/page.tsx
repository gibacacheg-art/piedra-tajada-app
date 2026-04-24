import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EventTasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Coordinación operativa"
        title="Tareas del evento"
        description="Asignación, avance, prioridades, vencimientos y confirmación de responsables por área."
      />
      <section className="panel">
        <p className="muted">ID de evento: {id}</p>
        <p>
          Pantalla inicial preparada para listar `tasks`, cambiar estados y registrar avance de responsables con RLS por
          usuario asignado.
        </p>
      </section>
    </AppShell>
  );
}
