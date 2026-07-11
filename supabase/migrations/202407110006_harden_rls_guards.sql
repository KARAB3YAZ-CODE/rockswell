-- Harden RLS: prevent privilege escalation and sensitive field tampering

-- Companies: non-admins cannot change discount, credit, tax, or active flag
create or replace function public.guard_company_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.discount_rate := old.discount_rate;
  new.credit_limit := old.credit_limit;
  new.is_active := old.is_active;
  new.tax_number := old.tax_number;
  new.tax_office := old.tax_office;
  return new;
end;
$$;

drop trigger if exists trg_guard_company_sensitive on companies;
create trigger trg_guard_company_sensitive
  before update on companies
  for each row execute function public.guard_company_sensitive_columns();

-- Profiles: non-admins cannot change role, company, or is_active
create or replace function public.guard_profile_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  new.role := old.role;
  new.company_id := old.company_id;
  new.is_active := old.is_active;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privilege on profiles;
create trigger trg_guard_profile_privilege
  before update on profiles
  for each row execute function public.guard_profile_privilege();

-- Orders: only admins (or service role with no JWT) may change status
create or replace function public.guard_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / backend jobs (no JWT): allow
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    raise exception 'Sipariş durumunu yalnızca yönetici değiştirebilir';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_order_status on orders;
create trigger trg_guard_order_status
  before update on orders
  for each row execute function public.guard_order_status();
