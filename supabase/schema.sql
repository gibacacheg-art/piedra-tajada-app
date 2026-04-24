create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  create type public.related_entity_type as enum ('event_request', 'event', 'client', 'task', 'payment', 'document');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.responsible_scope as enum ('main', 'commercial', 'operations', 'department');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.payment_type as enum ('deposit', 'installment', 'balance', 'refund', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.task_priority as enum ('low', 'normal', 'high', 'urgent');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  company_name text,
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.venues_spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  capacity integer not null check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_statuses (
  code text primary key,
  label text not null,
  sort_order integer not null,
  is_blocking boolean not null default false
);

create table if not exists public.task_statuses (
  code text primary key,
  label text not null,
  sort_order integer not null
);

create table if not exists public.payment_statuses (
  code text primary key,
  label text not null,
  sort_order integer not null
);

create table if not exists public.event_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  event_type text not null,
  tentative_date date not null,
  start_time time not null,
  end_time time not null,
  guest_count integer not null check (guest_count > 0),
  requested_space_id uuid references public.venues_spaces(id),
  estimated_budget numeric(12, 2) check (estimated_budget is null or estimated_budget >= 0),
  lead_source text,
  special_requirements text,
  status text not null default 'request_received' references public.event_statuses(code),
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_requests_time_order check (end_time > start_time)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.event_requests(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete restrict,
  event_name text not null,
  event_type text not null,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  guest_count integer not null check (guest_count > 0),
  status text not null default 'pre_reserved' references public.event_statuses(code),
  main_responsible_id uuid references public.profiles(id),
  commercial_responsible_id uuid references public.profiles(id),
  operations_responsible_id uuid references public.profiles(id),
  contracted_services text,
  menu_details text,
  technical_requirements text,
  logistics_requirements text,
  internal_notes text,
  client_notes text,
  total_amount numeric(12, 2) not null default 0 check (total_amount >= 0),
  deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  balance_amount numeric(12, 2) generated always as (greatest(total_amount - deposit_amount, 0)) stored,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (end_time > start_time)
);

create table if not exists public.event_space_reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  space_id uuid not null references public.venues_spaces(id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'pre_reserved' references public.event_statuses(code),
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_space_reservations_time_order check (end_at > start_at),
  constraint no_overlapping_space_reservations exclude using gist (
    space_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pre_reserved', 'confirmed', 'executed'))
);

create table if not exists public.event_responsibles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  department_id uuid references public.departments(id),
  scope public.responsible_scope not null default 'department',
  notes text,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, scope)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  department_id uuid references public.departments(id),
  due_date timestamptz,
  priority public.task_priority not null default 'normal',
  status text not null default 'pending' references public.task_statuses(code),
  requires_acknowledgement boolean not null default false,
  acknowledged_at timestamptz,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  department_id uuid references public.departments(id),
  title text not null,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.checklists(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id),
  is_done boolean not null default false,
  done_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_type public.payment_type not null default 'installment',
  due_date date,
  paid_at timestamptz,
  status text not null default 'pending' references public.payment_statuses(code),
  reference text,
  notes text,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  related_type public.related_entity_type not null,
  related_id uuid not null,
  file_name text not null,
  file_path text not null unique,
  mime_type text,
  file_size integer check (file_size is null or file_size >= 0),
  uploaded_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  related_type public.related_entity_type not null,
  related_id uuid not null,
  author_id uuid references public.profiles(id) default auth.uid(),
  body text not null,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  related_type public.related_entity_type not null,
  related_id uuid not null,
  action text not null,
  description text not null,
  performed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  category text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  quantity integer not null default 0 check (quantity >= 0),
  unit text,
  location text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_incidents (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reported_by uuid references public.profiles(id) default auth.uid(),
  title text not null,
  description text not null,
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high', 'critical')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (code, name, description) values
  ('admin_general', 'Administrador general', 'Control total de usuarios, roles, eventos y configuración.'),
  ('ventas', 'Ventas', 'Gestiona clientes, solicitudes, cotizaciones, pagos y reservas comerciales.'),
  ('coordinador_evento', 'Coordinador de evento', 'Coordina eventos confirmados, responsables, tareas y operación.'),
  ('responsable_area', 'Responsable de área', 'Gestiona tareas y checklists asignados a su área o usuario.'),
  ('consulta_disponibilidad', 'Consulta general', 'Acceso de solo lectura para revisar calendario, reservas, solicitudes, eventos, clientes, cobros y documentos.')
on conflict (code) do nothing;

insert into public.event_statuses (code, label, sort_order, is_blocking) values
  ('request_received', 'Solicitud recibida', 10, false),
  ('quoted', 'Cotizada', 20, false),
  ('pre_reserved', 'Pre-reservada', 30, true),
  ('confirmed', 'Confirmada', 40, true),
  ('executed', 'Ejecutada', 50, true),
  ('cancelled', 'Cancelada', 60, false),
  ('lost', 'Perdida', 70, false)
on conflict (code) do nothing;

insert into public.task_statuses (code, label, sort_order) values
  ('pending', 'Pendiente', 10),
  ('in_progress', 'En progreso', 20),
  ('blocked', 'Bloqueada', 30),
  ('done', 'Completada', 40),
  ('cancelled', 'Cancelada', 50)
on conflict (code) do nothing;

insert into public.payment_statuses (code, label, sort_order) values
  ('pending', 'Pendiente', 10),
  ('paid', 'Pagado', 20),
  ('overdue', 'Vencido', 30),
  ('cancelled', 'Cancelado', 40)
on conflict (code) do nothing;

insert into public.departments (name, description) values
  ('Ventas', 'Gestión comercial, solicitudes y seguimiento de clientes.'),
  ('Operaciones', 'Montaje, logística y ejecución del evento.'),
  ('Cocina y banquetería', 'Menú, servicio y alimentación.'),
  ('Técnica', 'Audio, iluminación, energía y soporte técnico.'),
  ('Administración', 'Pagos, documentos y control interno.')
on conflict (name) do nothing;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and r.code = role_code
      and p.is_active = true
  );
$$;

create or replace function public.current_user_has_any_role(role_codes text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and r.code = any(role_codes)
      and p.is_active = true
  );
$$;

create or replace function public.is_event_responsible(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.event_responsibles er
    where er.event_id = target_event_id
      and er.user_id = auth.uid()
  );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Usuario'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  entity_type public.related_entity_type;
  entity_id uuid;
  action_name text;
begin
  if tg_table_name = 'event_requests' then
    entity_type := 'event_request';
  elsif tg_table_name = 'events' then
    entity_type := 'event';
  elsif tg_table_name = 'tasks' then
    entity_type := 'task';
  elsif tg_table_name = 'payments' then
    entity_type := 'payment';
  else
    return coalesce(new, old);
  end if;

  entity_id := coalesce(new.id, old.id);
  action_name := lower(tg_op);

  insert into public.activity_logs (related_type, related_id, action, description, performed_by)
  values (entity_type, entity_id, action_name, tg_table_name || ' ' || action_name, auth.uid());

  return coalesce(new, old);
end;
$$;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'profiles', 'clients', 'venues_spaces', 'event_requests', 'events',
    'event_space_reservations', 'tasks', 'checklists', 'checklist_items',
    'payments', 'suppliers', 'inventory_items', 'event_incidents'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', target_table, target_table);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', target_table, target_table);
  end loop;
end $$;

drop trigger if exists event_requests_activity_log on public.event_requests;
drop trigger if exists events_activity_log on public.events;
drop trigger if exists tasks_activity_log on public.tasks;
drop trigger if exists payments_activity_log on public.payments;
create trigger event_requests_activity_log after insert or update or delete on public.event_requests for each row execute function public.log_activity();
create trigger events_activity_log after insert or update or delete on public.events for each row execute function public.log_activity();
create trigger tasks_activity_log after insert or update or delete on public.tasks for each row execute function public.log_activity();
create trigger payments_activity_log after insert or update or delete on public.payments for each row execute function public.log_activity();

create index if not exists clients_search_idx on public.clients using gin (to_tsvector('spanish', coalesce(full_name, '') || ' ' || coalesce(company_name, '') || ' ' || coalesce(email, '')));
create index if not exists event_requests_client_idx on public.event_requests (client_id);
create index if not exists event_requests_date_idx on public.event_requests (tentative_date, start_time);
create index if not exists event_requests_status_idx on public.event_requests (status);
create index if not exists events_client_idx on public.events (client_id);
create index if not exists events_date_idx on public.events (event_date, start_time);
create index if not exists events_status_idx on public.events (status);
create index if not exists event_space_reservations_space_time_idx on public.event_space_reservations using gist (space_id, tstzrange(start_at, end_at, '[)'));
create index if not exists event_responsibles_user_idx on public.event_responsibles (user_id);
create index if not exists tasks_event_idx on public.tasks (event_id);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists payments_event_idx on public.payments (event_id);
create index if not exists documents_related_idx on public.documents (related_type, related_id);
create index if not exists comments_related_idx on public.comments (related_type, related_id);
create index if not exists activity_logs_related_idx on public.activity_logs (related_type, related_id, created_at desc);
