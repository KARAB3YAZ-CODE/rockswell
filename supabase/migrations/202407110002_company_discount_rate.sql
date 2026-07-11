-- Per-company dealer discount rate (percentage, e.g. 25 = %25)
alter table companies
  add column if not exists discount_rate numeric(5,2) not null default 25;

comment on column companies.discount_rate is 'Firma bazlı bayi iskonto oranı (yüzde)';
