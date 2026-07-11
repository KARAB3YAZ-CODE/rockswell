-- Havale bank details on site_settings + private receipt storage

alter table site_settings
  add column if not exists bank_name text not null default '',
  add column if not exists bank_iban text not null default '',
  add column if not exists bank_account_name text not null default '',
  add column if not exists bank_branch text not null default '';

-- Private bucket for havale dekontları (service-role / signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public policies: access only via service role (API routes issue signed URLs).
