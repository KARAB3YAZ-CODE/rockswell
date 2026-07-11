-- Volume / order-amount unlock discount tiers (global ladder)
-- Applied on top of each company's base discount_rate when cart subtotal reaches thresholds.

alter table site_settings
  add column if not exists volume_discount_tiers jsonb not null default '[
    {"threshold": 50000, "bonusPercent": 5},
    {"threshold": 150000, "bonusPercent": 10}
  ]'::jsonb;

comment on column site_settings.volume_discount_tiers is
  'Ordered volume unlock tiers: [{threshold: number, bonusPercent: number}]. Bonus adds to company discount_rate when cart subtotal >= threshold.';
