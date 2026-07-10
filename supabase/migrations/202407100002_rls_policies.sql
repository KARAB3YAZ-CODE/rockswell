-- RLS helper functions
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from profiles where id = auth.uid();
$$;

-- Fix handle_new_user trigger (boolean was assigned to text variable)
create or replace function handle_new_user()
returns trigger as $$
declare
  v_is_first boolean;
  v_role text;
  v_company_id uuid;
begin
  select count(*) = 0 into v_is_first from profiles;

  if v_is_first then
    v_role := 'admin';
  else
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'company_admin');
  end if;

  v_company_id := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;

  insert into public.profiles (id, name, surname, role, company_id, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'surname', ''),
    v_role,
    v_company_id,
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Enable RLS
alter table companies enable row level security;
alter table profiles enable row level security;
alter table products enable row level security;
alter table customer_prices enable row level security;
alter table orders enable row level security;
alter table invoices enable row level security;
alter table campaigns enable row level security;
alter table warehouses enable row level security;
alter table notifications enable row level security;

-- Companies
create policy "companies_select_own_or_admin"
  on companies for select
  using (is_admin() or id = user_company_id());

create policy "companies_update_own_or_admin"
  on companies for update
  using (is_admin() or id = user_company_id());

-- Profiles
create policy "profiles_select_own_or_company_or_admin"
  on profiles for select
  using (
    is_admin()
    or id = auth.uid()
    or company_id = user_company_id()
  );

create policy "profiles_update_own_or_admin"
  on profiles for update
  using (is_admin() or id = auth.uid());

-- Products (catalog readable by authenticated users)
create policy "products_select_authenticated"
  on products for select
  using (auth.role() = 'authenticated' and (is_active = true or is_admin()));

create policy "products_admin_all"
  on products for all
  using (is_admin())
  with check (is_admin());

-- Customer prices
create policy "customer_prices_select_own_or_admin"
  on customer_prices for select
  using (is_admin() or customer_id = auth.uid());

create policy "customer_prices_admin_all"
  on customer_prices for all
  using (is_admin())
  with check (is_admin());

-- Orders
create policy "orders_select_company_or_admin"
  on orders for select
  using (is_admin() or company_id = user_company_id());

create policy "orders_insert_company"
  on orders for insert
  with check (company_id = user_company_id() and user_id = auth.uid());

create policy "orders_update_company_or_admin"
  on orders for update
  using (is_admin() or company_id = user_company_id());

-- Invoices
create policy "invoices_select_company_or_admin"
  on invoices for select
  using (is_admin() or company_id = user_company_id());

create policy "invoices_admin_all"
  on invoices for all
  using (is_admin())
  with check (is_admin());

-- Campaigns
create policy "campaigns_select_authenticated"
  on campaigns for select
  using (auth.role() = 'authenticated' and (is_active = true or is_admin()));

create policy "campaigns_admin_all"
  on campaigns for all
  using (is_admin())
  with check (is_admin());

-- Warehouses
create policy "warehouses_select_authenticated"
  on warehouses for select
  using (auth.role() = 'authenticated');

create policy "warehouses_admin_all"
  on warehouses for all
  using (is_admin())
  with check (is_admin());

-- Notifications
create policy "notifications_select_own_or_admin"
  on notifications for select
  using (is_admin() or user_id = auth.uid());

create policy "notifications_update_own_or_admin"
  on notifications for update
  using (is_admin() or user_id = auth.uid());

create policy "notifications_admin_all"
  on notifications for all
  using (is_admin())
  with check (is_admin());
