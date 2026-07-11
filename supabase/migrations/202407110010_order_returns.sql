-- Partial returns: store return history on orders
alter table public.orders
  add column if not exists returns jsonb not null default '[]'::jsonb;
