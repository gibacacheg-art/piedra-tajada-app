alter table public.payments
  add column if not exists is_invoiced boolean not null default false,
  add column if not exists invoice_number text,
  add column if not exists invoice_issued_at date;

create index if not exists payments_is_invoiced_idx on public.payments (is_invoiced);
create index if not exists payments_invoice_number_idx on public.payments (invoice_number);
