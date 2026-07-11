-- Home page banners (hero carousel + small promo cards) managed from admin

create table if not exists home_banners (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('hero', 'promo')),
  title text not null default '',
  subtitle text not null default '',
  cta text not null default '',
  href text not null default '/products',
  badge text not null default '',
  gradient text not null default 'from-accent/20 via-accent/5 to-transparent',
  image_url text not null default '',
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_home_banners_updated_at on home_banners;
create trigger trg_home_banners_updated_at
  before update on home_banners
  for each row execute function update_updated_at();

alter table home_banners enable row level security;

drop policy if exists "home_banners_select_authenticated" on home_banners;
create policy "home_banners_select_authenticated"
  on home_banners for select
  using (auth.role() = 'authenticated');

drop policy if exists "home_banners_admin_insert" on home_banners;
create policy "home_banners_admin_insert"
  on home_banners for insert
  with check (is_admin());

drop policy if exists "home_banners_admin_update" on home_banners;
create policy "home_banners_admin_update"
  on home_banners for update
  using (is_admin())
  with check (is_admin());

drop policy if exists "home_banners_admin_delete" on home_banners;
create policy "home_banners_admin_delete"
  on home_banners for delete
  using (is_admin());

-- Seed defaults only when empty
insert into home_banners (kind, title, subtitle, cta, href, badge, gradient, sort_order, is_active)
select * from (values
  ('hero'::text, 'Hızlı Sipariş', 'SKU veya OEM ile hızlıca sipariş oluşturun.', 'Ürünlere Git', '/products', 'Hızlı', 'from-warning/20 via-warning/5 to-transparent', 0, true),
  ('hero'::text, 'Siparişlerim', 'Sipariş durumunu takip edin.', 'Siparişler', '/orders', 'Sipariş', 'from-info/20 via-info/5 to-transparent', 1, true),
  ('promo'::text, 'Kampanyalar', 'Güncel fırsatları kaçırmayın.', 'İncele', '/account/campaigns', 'Fırsat', 'from-accent/20 via-accent/5 to-transparent', 0, true),
  ('promo'::text, 'Markalar', 'Araç markasına göre ürün bulun.', 'Markalar', '/products/brands', 'Marka', 'from-info/20 via-info/5 to-transparent', 1, true),
  ('promo'::text, 'Destek', 'Sipariş ve hesap sorularınız için.', 'Destek', '/account/support', 'Yardım', 'from-success/20 via-success/5 to-transparent', 2, true)
) as v(kind, title, subtitle, cta, href, badge, gradient, sort_order, is_active)
where not exists (select 1 from home_banners limit 1);
