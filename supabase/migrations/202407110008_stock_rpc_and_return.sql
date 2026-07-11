-- Stock mutations via SECURITY DEFINER (dealers cannot UPDATE products directly)
-- Plus allow company users to mark delivered orders as returned

create or replace function public.mutate_product_stock(
  p_lines jsonb,
  p_mode text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  line jsonb;
  prod record;
  stocks jsonb;
  i int;
  found int;
  qty int;
  wh text;
  row jsonb;
  new_qty int;
  new_reserved int;
  new_available int;
  usage_map jsonb := '{}'::jsonb;
  wid text;
  used int;
  prod_row record;
begin
  if p_mode not in ('reserve', 'commit', 'release', 'restock') then
    raise exception 'Invalid stock mode';
  end if;

  for line in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb))
  loop
    qty := greatest(0, coalesce((line->>'quantity')::int, 0));
    if qty = 0 then continue; end if;
    wh := coalesce(line->>'warehouseId', '');

    select id, name, stock into prod
    from products
    where id = (line->>'productId')::uuid
    for update;

    if not found then
      raise exception 'Ürün bulunamadı: %', line->>'productId';
    end if;

    stocks := coalesce(prod.stock, '[]'::jsonb);
    if jsonb_typeof(stocks) <> 'array' or jsonb_array_length(stocks) = 0 then
      raise exception '%: stok kaydı yok', coalesce(nullif(line->>'productName', ''), prod.name);
    end if;

    found := -1;
    for i in 0 .. jsonb_array_length(stocks) - 1 loop
      if stocks->i->>'warehouseId' = wh then
        found := i;
        exit;
      end if;
    end loop;
    if found < 0 then
      for i in 0 .. jsonb_array_length(stocks) - 1 loop
        if coalesce((stocks->i->>'available')::int, 0) > 0
           or coalesce((stocks->i->>'quantity')::int, 0) > 0 then
          found := i;
          exit;
        end if;
      end loop;
    end if;
    if found < 0 then found := 0; end if;

    row := stocks->found;
    new_qty := coalesce((row->>'quantity')::int, 0);
    new_reserved := coalesce((row->>'reserved')::int, 0);
    new_available := coalesce((row->>'available')::int, 0);

    if p_mode = 'reserve' then
      if new_available < qty then
        raise exception '%: yetersiz stok (%)', coalesce(nullif(line->>'productName', ''), prod.name), new_available;
      end if;
      new_available := new_available - qty;
      new_reserved := new_reserved + qty;
    elsif p_mode = 'commit' then
      new_reserved := greatest(0, new_reserved - qty);
      new_qty := greatest(0, new_qty - qty);
      new_available := greatest(0, new_qty - new_reserved);
    elsif p_mode = 'release' then
      new_reserved := greatest(0, new_reserved - qty);
      new_available := least(new_qty, new_available + qty);
    elsif p_mode = 'restock' then
      new_qty := new_qty + qty;
      new_available := new_available + qty;
    end if;

    stocks := jsonb_set(
      stocks,
      array[found::text],
      row || jsonb_build_object(
        'quantity', new_qty,
        'reserved', new_reserved,
        'available', new_available,
        'lastUpdated', to_jsonb(now())
      ),
      true
    );

    update products set stock = stocks where id = prod.id;
  end loop;

  -- Recompute used_capacity for all warehouses from product stock
  for prod_row in select stock from products loop
    if jsonb_typeof(prod_row.stock) <> 'array' then continue; end if;
    for i in 0 .. jsonb_array_length(prod_row.stock) - 1 loop
      wid := prod_row.stock->i->>'warehouseId';
      if wid is null or wid = '' then continue; end if;
      used := coalesce((usage_map->>wid)::int, 0)
        + greatest(0, coalesce((prod_row.stock->i->>'quantity')::int, 0));
      usage_map := usage_map || jsonb_build_object(wid, used);
    end loop;
  end loop;

  update warehouses w
  set used_capacity = coalesce((usage_map->>w.id::text)::int, 0);
end;
$$;

revoke all on function public.mutate_product_stock(jsonb, text) from public;
grant execute on function public.mutate_product_stock(jsonb, text) to authenticated;
grant execute on function public.mutate_product_stock(jsonb, text) to service_role;

-- Allow company members to request return on delivered orders
create or replace function public.guard_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status = 'returned'
       and old.status = 'delivered'
       and old.company_id = public.user_company_id() then
      return new;
    end if;
    raise exception 'Sipariş durumunu yalnızca yönetici değiştirebilir';
  end if;
  return new;
end;
$$;
