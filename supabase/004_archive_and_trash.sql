alter table public.event_requests
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists trashed_at timestamptz;

alter table public.events
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists trashed_at timestamptz;

alter table public.documents
  add column if not exists trashed_at timestamptz;

create index if not exists event_requests_is_archived_idx on public.event_requests (is_archived);
create index if not exists event_requests_trashed_at_idx on public.event_requests (trashed_at);
create index if not exists events_is_archived_idx on public.events (is_archived);
create index if not exists events_trashed_at_idx on public.events (trashed_at);
create index if not exists documents_trashed_at_idx on public.documents (trashed_at);
