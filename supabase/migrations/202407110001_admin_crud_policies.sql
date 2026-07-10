-- Admin CRUD policies: allow admins full management of companies, plus
-- delete rights on orders and profiles (user records).

drop policy if exists "companies_admin_all" on companies;
create policy "companies_admin_all"
  on companies for all
  using (is_admin())
  with check (is_admin());

drop policy if exists "orders_delete_admin" on orders;
create policy "orders_delete_admin"
  on orders for delete
  using (is_admin());

drop policy if exists "profiles_delete_admin" on profiles;
create policy "profiles_delete_admin"
  on profiles for delete
  using (is_admin());
