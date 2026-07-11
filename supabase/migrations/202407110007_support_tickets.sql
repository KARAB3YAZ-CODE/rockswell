-- Support tickets for dealer → admin requests
create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  subject text not null,
  category text not null default 'genel',
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_user on support_tickets(user_id);
create index if not exists idx_support_tickets_status on support_tickets(status);

alter table support_tickets enable row level security;

drop policy if exists support_tickets_select_own on support_tickets;
create policy support_tickets_select_own on support_tickets
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists support_tickets_insert_own on support_tickets;
create policy support_tickets_insert_own on support_tickets
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists support_tickets_update_admin on support_tickets;
create policy support_tickets_update_admin on support_tickets
  for update to authenticated
  using (public.is_admin());
