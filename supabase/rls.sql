alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.clients enable row level security;
alter table public.venues_spaces enable row level security;
alter table public.event_statuses enable row level security;
alter table public.task_statuses enable row level security;
alter table public.payment_statuses enable row level security;
alter table public.event_requests enable row level security;
alter table public.events enable row level security;
alter table public.event_space_reservations enable row level security;
alter table public.event_responsibles enable row level security;
alter table public.tasks enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.payments enable row level security;
alter table public.documents enable row level security;
alter table public.comments enable row level security;
alter table public.activity_logs enable row level security;
alter table public.suppliers enable row level security;
alter table public.inventory_items enable row level security;
alter table public.event_incidents enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'roles', 'profiles', 'user_roles', 'departments', 'clients', 'venues_spaces',
        'event_statuses', 'task_statuses', 'payment_statuses', 'event_requests',
        'events', 'event_space_reservations', 'event_responsibles', 'tasks',
        'checklists', 'checklist_items', 'payments', 'documents', 'comments',
        'activity_logs', 'suppliers', 'inventory_items', 'event_incidents'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);
  end loop;
end $$;

drop policy if exists "staff can read stored event documents" on storage.objects;
drop policy if exists "staff can upload event documents" on storage.objects;
drop policy if exists "admins can delete event documents" on storage.objects;

create policy "authenticated can read catalogs" on public.roles for select to authenticated using (true);
create policy "authenticated can read departments" on public.departments for select to authenticated using (true);
create policy "authenticated can read event statuses" on public.event_statuses for select to authenticated using (true);
create policy "authenticated can read task statuses" on public.task_statuses for select to authenticated using (true);
create policy "authenticated can read payment statuses" on public.payment_statuses for select to authenticated using (true);
create policy "authenticated can read spaces" on public.venues_spaces for select to authenticated using (true);

create policy "admins manage departments" on public.departments for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));
create policy "admins manage spaces" on public.venues_spaces for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));
create policy "admins manage event statuses" on public.event_statuses for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));
create policy "admins manage task statuses" on public.task_statuses for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));
create policy "admins manage payment statuses" on public.payment_statuses for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));

create policy "admins manage roles" on public.roles for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));

create policy "users read active profiles" on public.profiles for select to authenticated using (is_active = true or id = auth.uid());
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));

create policy "users read user roles" on public.user_roles for select to authenticated using (true);
create policy "admins manage user roles" on public.user_roles for all to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));

create policy "staff read clients" on public.clients for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "sales manage clients" on public.clients for all to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas']))
with check (public.current_user_has_any_role(array['admin_general','ventas']));

create policy "staff read event requests" on public.event_requests for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "sales manage event requests" on public.event_requests for all to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas']))
with check (public.current_user_has_any_role(array['admin_general','ventas']));

create policy "staff read events" on public.events for select to authenticated
using (
  public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','consulta_disponibilidad'])
  or public.is_event_responsible(id)
  or main_responsible_id = auth.uid()
  or commercial_responsible_id = auth.uid()
  or operations_responsible_id = auth.uid()
);
create policy "sales and coordinators create events" on public.events for insert to authenticated
with check (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "sales and coordinators update events" on public.events for update to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "admins delete events" on public.events for delete to authenticated
using (public.current_user_has_role('admin_general'));

create policy "staff read space reservations" on public.event_space_reservations for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area']));
create policy "sales and coordinators manage space reservations" on public.event_space_reservations for all to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));

create policy "staff read event responsibles" on public.event_responsibles for select to authenticated using (true);
create policy "coordinators manage event responsibles" on public.event_responsibles for all to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));

create policy "staff read tasks" on public.tasks for select to authenticated
using (
  public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento'])
  or assigned_to = auth.uid()
  or public.is_event_responsible(event_id)
);
create policy "coordinators create tasks" on public.tasks for insert to authenticated
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));
create policy "task owners update tasks" on public.tasks for update to authenticated
using (
  public.current_user_has_any_role(array['admin_general','coordinador_evento'])
  or assigned_to = auth.uid()
)
with check (
  public.current_user_has_any_role(array['admin_general','coordinador_evento'])
  or assigned_to = auth.uid()
);

create policy "staff read checklists" on public.checklists for select to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento','responsable_area']) or public.is_event_responsible(event_id));
create policy "coordinators manage checklists" on public.checklists for all to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));
create policy "staff read checklist items" on public.checklist_items for select to authenticated using (true);
create policy "assigned users update checklist items" on public.checklist_items for update to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']) or assigned_to = auth.uid())
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']) or assigned_to = auth.uid());
create policy "coordinators manage checklist items" on public.checklist_items for insert to authenticated
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));

create policy "sales and coordinators read payments" on public.payments for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "sales manage payments" on public.payments for all to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas']))
with check (public.current_user_has_any_role(array['admin_general','ventas']));

create policy "staff read documents" on public.documents for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area']));
create policy "staff upload documents" on public.documents for insert to authenticated
with check (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "admins update documents" on public.documents for update to authenticated
using (public.current_user_has_role('admin_general'))
with check (public.current_user_has_role('admin_general'));
create policy "admins delete documents" on public.documents for delete to authenticated
using (public.current_user_has_role('admin_general'));

create policy "staff read comments" on public.comments for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area']));
create policy "staff create comments" on public.comments for insert to authenticated
with check (author_id = auth.uid());
create policy "authors update comments" on public.comments for update to authenticated
using (author_id = auth.uid())
with check (author_id = auth.uid());

create policy "staff read activity logs" on public.activity_logs for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area']));

create policy "staff read suppliers" on public.suppliers for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "coordinators manage suppliers" on public.suppliers for all to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));

create policy "staff read inventory" on public.inventory_items for select to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento','responsable_area']));
create policy "coordinators manage inventory" on public.inventory_items for all to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']))
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']));

create policy "staff read incidents" on public.event_incidents for select to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento','responsable_area']) or public.is_event_responsible(event_id));
create policy "staff create incidents" on public.event_incidents for insert to authenticated
with check (reported_by = auth.uid());
create policy "coordinators update incidents" on public.event_incidents for update to authenticated
using (public.current_user_has_any_role(array['admin_general','coordinador_evento']) or reported_by = auth.uid())
with check (public.current_user_has_any_role(array['admin_general','coordinador_evento']) or reported_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('event-documents', 'event-documents', false)
on conflict (id) do nothing;

create policy "staff can read stored event documents" on storage.objects for select to authenticated
using (bucket_id = 'event-documents' and public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento','responsable_area']));
create policy "staff can upload event documents" on storage.objects for insert to authenticated
with check (bucket_id = 'event-documents' and public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));
create policy "admins can delete event documents" on storage.objects for delete to authenticated
using (bucket_id = 'event-documents' and public.current_user_has_role('admin_general'));
