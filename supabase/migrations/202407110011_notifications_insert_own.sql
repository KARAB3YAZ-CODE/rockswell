-- Allow users to insert notifications for themselves (order/invoice events);
-- admins retain full insert via notifications_admin_all.
create policy "notifications_insert_own_or_admin"
  on notifications for insert
  with check (is_admin() or user_id = auth.uid());
