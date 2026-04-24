create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.event_requests(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  service_name text not null,
  description text,
  quantity numeric(10, 2) not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  total_amount numeric(12, 2) generated always as (quantity * unit_price) stored,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_items_has_parent check (request_id is not null or event_id is not null)
);

drop trigger if exists quote_items_set_updated_at on public.quote_items;
create trigger quote_items_set_updated_at
before update on public.quote_items
for each row
execute function public.set_updated_at();

create index if not exists quote_items_request_idx on public.quote_items (request_id, sort_order);
create index if not exists quote_items_event_idx on public.quote_items (event_id, sort_order);

alter table public.quote_items enable row level security;

drop policy if exists "staff read quote items" on public.quote_items;
drop policy if exists "sales manage quote items" on public.quote_items;

create policy "staff read quote items" on public.quote_items for select to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas','coordinador_evento']));

create policy "sales manage quote items" on public.quote_items for all to authenticated
using (public.current_user_has_any_role(array['admin_general','ventas']))
with check (public.current_user_has_any_role(array['admin_general','ventas']));
