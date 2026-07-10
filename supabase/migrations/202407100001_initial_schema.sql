-- rockswell initial schema
-- Core B2B automotive parts platform

-- 0. Extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 1. Companies
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_number text not null,
  tax_office text not null default '',
  address jsonb not null default '{}',
  phone text not null default '',
  email text not null default '',
  credit_limit numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Profiles (extends Supabase auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  name text not null default '',
  surname text not null default '',
  role text not null check (role in ('admin','purchase_manager','sales_manager','warehouse_user','finance_user','company_admin')),
  phone text not null default '',
  avatar text default '',
  is_active boolean not null default true,
  last_login timestamptz,
  permissions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Products
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text not null default '',
  brand text not null default '',
  category text not null default '',
  subcategory text not null default '',
  oem_numbers jsonb not null default '[]',
  cross_numbers jsonb not null default '[]',
  compatible_vehicles jsonb not null default '[]',
  images jsonb not null default '[]',
  specifications jsonb not null default '[]',
  documents jsonb not null default '[]',
  videos jsonb not null default '[]',
  stock jsonb not null default '[]',
  base_price numeric(12,2) not null default 0,
  unit text not null default 'adet',
  min_order_quantity int not null default 1,
  max_order_quantity int not null default 9999,
  is_active boolean not null default true,
  is_featured boolean not null default false,
  tags jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_sku on products(sku);
create index if not exists idx_products_brand on products(brand);
create index if not exists idx_products_category on products(category);
create index if not exists idx_products_is_active on products(is_active);
create index if not exists idx_products_is_featured on products(is_featured);

-- 3a. Customer-specific prices
create table if not exists customer_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  list_price numeric(12,2) not null default 0,
  dealer_price numeric(12,2) not null default 0,
  campaign_price numeric(12,2),
  net_price numeric(12,2),
  currency text not null default 'TRY',
  discount_rate numeric(5,2) not null default 0,
  discount_group text,
  contract_price numeric(12,2),
  volume_discount numeric(5,2),
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(customer_id, product_id)
);

-- 4. Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','quotation','confirmed','processing','shipped','delivered','cancelled','returned')),
  items jsonb not null default '[]',
  pricing jsonb not null default '{}',
  shipping jsonb not null default '{}',
  payment jsonb not null default '{}',
  documents jsonb not null default '[]',
  notes text not null default '',
  approval_flow jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_company on orders(company_id);
create index if not exists idx_orders_user on orders(user_id);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_created on orders(created_at desc);

-- 5. Invoices
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  order_id uuid references orders(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  type text not null check (type in ('invoice','credit_note','debit_note')),
  status text not null default 'draft' check (status in ('draft','sent','paid','overdue','cancelled')),
  items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  currency text not null default 'TRY',
  due_date timestamptz,
  paid_date timestamptz,
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoices_company on invoices(company_id);
create index if not exists idx_invoices_status on invoices(status);

-- 6. Campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  type text not null check (type in ('discount','bundle','free_shipping','fixed_price')),
  discount_rate numeric(5,2),
  conditions jsonb not null default '[]',
  products jsonb not null default '[]',
  brands jsonb not null default '[]',
  categories jsonb not null default '[]',
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean not null default true,
  usage_limit int,
  used_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_campaigns_active on campaigns(is_active);
create index if not exists idx_campaigns_dates on campaigns(start_date, end_date);

-- 7. Warehouses
create table if not exists warehouses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  address jsonb not null default '{}',
  is_active boolean not null default true,
  capacity int not null default 0,
  used_capacity int not null default 0,
  manager text not null default '',
  phone text not null default '',
  working_hours text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. Notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null default 'info' check (type in ('info','success','warning','error')),
  title text not null default '',
  message text not null default '',
  is_read boolean not null default false,
  link text,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id);
create index if not exists idx_notifications_unread on notifications(user_id, is_read);
create index if not exists idx_notifications_created on notifications(created_at desc);

-- 9. Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_companies_updated_at on companies;
create trigger trg_companies_updated_at before update on companies for each row execute function update_updated_at();
drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles for each row execute function update_updated_at();
drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products for each row execute function update_updated_at();
drop trigger if exists trg_customer_prices_updated_at on customer_prices;
create trigger trg_customer_prices_updated_at before update on customer_prices for each row execute function update_updated_at();
drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders for each row execute function update_updated_at();
drop trigger if exists trg_invoices_updated_at on invoices;
create trigger trg_invoices_updated_at before update on invoices for each row execute function update_updated_at();
drop trigger if exists trg_campaigns_updated_at on campaigns;
create trigger trg_campaigns_updated_at before update on campaigns for each row execute function update_updated_at();
drop trigger if exists trg_warehouses_updated_at on warehouses;
create trigger trg_warehouses_updated_at before update on warehouses for each row execute function update_updated_at();

-- 10. Handle new auth users -> create profile
create or replace function handle_new_user()
returns trigger as $$
declare
  v_role text;
  v_company_id uuid;
begin
  -- Check if this is the first user -> make admin
  select count(*) = 0 into v_role from profiles;
  if v_role then
    v_role := 'admin';
  else
    v_role := coalesce(new.raw_user_meta_data ->> 'role', 'company_admin');
  end if;

  -- Check if company_id in metadata
  v_company_id := (new.raw_user_meta_data ->> 'company_id')::uuid;

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
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
