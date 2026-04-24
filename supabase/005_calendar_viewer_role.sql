insert into public.roles (code, name, description)
values (
  'consulta_disponibilidad',
  'Consulta de disponibilidad',
  'Acceso de solo lectura al calendario para revisar si un día está disponible u ocupado.'
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

drop policy if exists "staff read events" on public.events;

create policy "staff read events" on public.events for select to authenticated
using (
  public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad'])
  or public.is_event_responsible(id)
  or main_responsible_id = auth.uid()
  or commercial_responsible_id = auth.uid()
  or operations_responsible_id = auth.uid()
);
