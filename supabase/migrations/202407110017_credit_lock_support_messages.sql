-- Credit lock for açık hesap + support ticket message thread

-- 1) Atomically lock company and assert open-account credit capacity
create or replace function public.assert_open_account_credit(
  p_company_id uuid,
  p_order_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit numeric;
  v_open_invoices numeric := 0;
  v_pending numeric := 0;
  v_past_due_count int := 0;
  v_used numeric;
  v_amount numeric := greatest(0, coalesce(p_order_amount, 0));
begin
  if p_company_id is null then
    raise exception 'Firma gerekli';
  end if;

  select credit_limit into v_limit
  from companies
  where id = p_company_id
  for update;

  if not found then
    raise exception 'Firma bulunamadı';
  end if;

  v_limit := greatest(0, coalesce(v_limit, 0));

  -- Past-due açık hesap invoices block new open-account orders
  select
    coalesce(sum(i.grand_total), 0),
    count(*) filter (
      where i.due_date is not null and i.due_date::date < current_date
    )
  into v_open_invoices, v_past_due_count
  from invoices i
  left join orders o on o.id = i.order_id
  where i.company_id = p_company_id
    and i.status in ('sent', 'overdue')
    and (
      i.order_id is null
      or coalesce(o.payment->>'method', 'acik_hesap') = 'acik_hesap'
    );

  if v_past_due_count > 0 then
    raise exception 'Vadesi geçmiş açık hesap borcunuz nedeniyle yeni açık hesap siparişi açılamaz';
  end if;

  -- Pending açık hesap orders (not yet invoiced)
  select coalesce(sum(coalesce((o.pricing->>'grandTotal')::numeric, 0)), 0)
  into v_pending
  from orders o
  where o.company_id = p_company_id
    and o.status in ('pending_approval', 'approved')
    and coalesce(o.payment->>'method', '') = 'acik_hesap'
    and coalesce(o.payment->>'status', '') <> 'paid'
    and not exists (
      select 1 from invoices inv where inv.order_id = o.id
    );

  v_used := coalesce(v_open_invoices, 0) + coalesce(v_pending, 0);

  if v_limit <= 0 then
    raise exception 'Firmanız için açık hesap (kredi) tanımlı değil';
  end if;

  if v_used + v_amount > v_limit + 0.009 then
    raise exception 'Açık hesap limitiniz yetersiz (limit %, kullanılan %, sipariş %)',
      v_limit, v_used, v_amount;
  end if;
end;
$$;

revoke all on function public.assert_open_account_credit(uuid, numeric) from public;
grant execute on function public.assert_open_account_credit(uuid, numeric) to authenticated;
grant execute on function public.assert_open_account_credit(uuid, numeric) to service_role;

-- 2) Support ticket replies
create table if not exists support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_messages_ticket
  on support_ticket_messages(ticket_id, created_at);

alter table support_ticket_messages enable row level security;

drop policy if exists support_ticket_messages_select on support_ticket_messages;
create policy support_ticket_messages_select on support_ticket_messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from support_tickets t
      where t.id = ticket_id and t.user_id = auth.uid()
    )
  );

drop policy if exists support_ticket_messages_insert on support_ticket_messages;
create policy support_ticket_messages_insert on support_ticket_messages
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from support_tickets t
        where t.id = ticket_id
          and t.user_id = auth.uid()
          and t.status <> 'closed'
      )
    )
  );

-- Allow ticket owner to bump status back to open when replying (optional soft reopen via API)
drop policy if exists support_tickets_update_owner_reopen on support_tickets;
create policy support_tickets_update_owner_reopen on support_tickets
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
