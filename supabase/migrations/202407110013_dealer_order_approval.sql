-- Allow company_admin to approve/reject own-company orders awaiting dealer approval

create or replace function public.guard_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if new.status is distinct from old.status then
    -- Partial return by dealer
    if new.status = 'returned'
       and old.status = 'delivered'
       and old.company_id = public.user_company_id() then
      return new;
    end if;

    select role into caller_role from profiles where id = auth.uid();

    -- Company admin: pending_approval → approved | cancelled
    if caller_role = 'company_admin'
       and old.company_id = public.user_company_id()
       and old.status = 'pending_approval'
       and new.status in ('approved', 'cancelled') then
      return new;
    end if;

    raise exception 'Sipariş durumunu yalnızca yönetici değiştirebilir';
  end if;
  return new;
end;
$$;
