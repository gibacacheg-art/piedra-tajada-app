insert into public.roles (code, name, description)
values (
  'consulta_disponibilidad',
  'Consulta general',
  'Acceso de solo lectura para revisar calendario, reservas, solicitudes, eventos, clientes, cobros y documentos.'
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

drop policy if exists "staff read clients" on public.clients;
drop policy if exists "staff read event requests" on public.event_requests;
drop policy if exists "staff read events" on public.events;
drop policy if exists "staff read space reservations" on public.event_space_reservations;
drop policy if exists "staff read tasks" on public.tasks;
drop policy if exists "staff read checklists" on public.checklists;
drop policy if exists "sales and coordinators read payments" on public.payments;
drop policy if exists "staff read documents" on public.documents;
drop policy if exists "staff read comments" on public.comments;
drop policy if exists "staff read activity logs" on public.activity_logs;
drop policy if exists "staff can read stored event documents" on storage.objects;

create policy "staff read clients" on public.clients for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad']));

create policy "staff read event requests" on public.event_requests for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad']));

create policy "staff read events" on public.events for select to authenticated
using (
  public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad'])
  or public.is_event_responsible(id)
  or main_responsible_id = auth.uid()
  or commercial_responsible_id = auth.uid()
  or operations_responsible_id = auth.uid()
);

create policy "staff read space reservations" on public.event_space_reservations for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area','consulta_disponibilidad']));

create policy "staff read tasks" on public.tasks for select to authenticated
using (
  public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad'])
  or assigned_to = auth.uid()
  or public.is_event_responsible(event_id)
);

create policy "staff read checklists" on public.checklists for select to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento','responsable_area','consulta_disponibilidad']) or public.is_event_responsible(event_id));

create policy "sales and coordinators read payments" on public.payments for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad']));

create policy "staff read documents" on public.documents for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area','consulta_disponibilidad']));

create policy "staff read comments" on public.comments for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area','consulta_disponibilidad']));

create policy "staff read activity logs" on public.activity_logs for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area','consulta_disponibilidad']));

create policy "staff can read stored event documents" on storage.objects for select to authenticated
using (bucket_id = 'event-documents' and public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area','consulta_disponibilidad']));
