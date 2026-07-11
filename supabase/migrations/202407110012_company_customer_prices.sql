-- Company-scoped contract prices (B2B price lists)

alter table customer_prices
  add column if not exists company_id uuid references companies(id) on delete cascade;

-- Backfill from profile's company
update customer_prices cp
set company_id = p.company_id
from profiles p
where cp.customer_id = p.id
  and cp.company_id is null
  and p.company_id is not null;

-- Drop orphan rows that cannot be linked to a company
delete from customer_prices where company_id is null;

alter table customer_prices
  alter column company_id set not null;

-- customer_id becomes optional (legacy / audit); company is source of truth
alter table customer_prices
  alter column customer_id drop not null;

alter table customer_prices
  drop constraint if exists customer_prices_customer_id_product_id_key;

create unique index if not exists customer_prices_company_product_uidx
  on customer_prices (company_id, product_id);

create index if not exists idx_customer_prices_company on customer_prices(company_id);

-- Dealers can read prices for their own company
drop policy if exists "customer_prices_select_own_or_admin" on customer_prices;
create policy "customer_prices_select_own_or_admin"
  on customer_prices for select
  using (
    is_admin()
    or company_id = user_company_id()
    or customer_id = auth.uid()
  );
