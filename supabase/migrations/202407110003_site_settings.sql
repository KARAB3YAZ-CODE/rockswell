-- Singleton site settings for maintenance mode and price-update notices

create table if not exists site_settings (
  id int primary key default 1 check (id = 1),
  maintenance_enabled boolean not null default false,
  maintenance_message text not null default 'Sistemimiz şu an bakımda. Lütfen daha sonra tekrar deneyin.',
  price_update_enabled boolean not null default false,
  price_update_date date,
  price_update_message text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);

insert into site_settings (id) values (1)
on conflict (id) do nothing;

alter table site_settings enable row level security;

drop policy if exists "site_settings_select_authenticated" on site_settings;
create policy "site_settings_select_authenticated"
  on site_settings for select
  using (auth.role() = 'authenticated');

drop policy if exists "site_settings_admin_update" on site_settings;
create policy "site_settings_admin_update"
  on site_settings for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "site_settings_admin_insert" on site_settings;
create policy "site_settings_admin_insert"
  on site_settings for insert
  with check (is_admin());
