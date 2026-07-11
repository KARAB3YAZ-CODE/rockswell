-- Security hardening: freeze order financial fields; restrict stock RPC restock; tighten stock grants

-- 1) Orders: non-admins cannot change pricing / payment / order_number / company_id / user_id
create or replace function public.guard_order_financial_fields()
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

  new.pricing := old.pricing;
  new.payment := old.payment;
  new.order_number := old.order_number;
  new.company_id := old.company_id;
  new.user_id := old.user_id;
  return new;
end;
$$;

drop trigger if exists trg_guard_order_financial on orders;
create trigger trg_guard_order_financial
  before update on orders
  for each row execute function public.guard_order_financial_fields();

-- 2) Stock RPC: only admins (or service role / no JWT) may restock; revoke public abuse surface
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
  pid uuid;
  wid text;
  qty numeric;
  stock jsonb;
  i int;
  row jsonb;
  found boolean;
  q numeric;
  r numeric;
  mode text := lower(coalesce(p_mode, ''));
begin
  if mode not in ('reserve', 'commit', 'release', 'restock') then
    raise exception 'Geçersiz stok modu: %', p_mode;
  end if;

  -- Restock: admin or service-role only (auth.uid() null = service role / backend)
  if mode = 'restock' and auth.uid() is not null and not public.is_admin() then
    raise exception 'Stok iadesi (restock) yalnızca yönetici tarafından yapılabilir';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    return;
  end if;

  for line in select * from jsonb_array_elements(p_lines)
  loop
    pid := nullif(line->>'productId', '')::uuid;
    wid := coalesce(nullif(line->>'warehouseId', ''), '');
    qty := greatest(0, coalesce((line->>'quantity')::numeric, 0));
    if pid is null or qty <= 0 then
      continue;
    end if;

    select products.stock into stock from products where id = pid for update;
    if stock is null then
      raise exception 'Ürün bulunamadı: %', coalesce(line->>'productName', pid::text);
    end if;
    if jsonb_typeof(stock) <> 'array' then
      stock := '[]'::jsonb;
    end if;

    found := false;
    for i in 0 .. greatest(jsonb_array_length(stock) - 1, -1)
    loop
      row := stock -> i;
      if coalesce(row->>'warehouseId', '') = wid or (wid = '' and i = 0) then
        found := true;
        q := coalesce((row->>'quantity')::numeric, 0);
        r := coalesce((row->>'reserved')::numeric, 0);

        if mode = 'reserve' then
          if (q - r) < qty then
            raise exception 'Yetersiz stok: %', coalesce(line->>'productName', pid::text);
          end if;
          r := r + qty;
        elsif mode = 'commit' then
          q := greatest(0, q - qty);
          r := greatest(0, r - qty);
        elsif mode = 'release' then
          r := greatest(0, r - qty);
        elsif mode = 'restock' then
          q := q + qty;
        end if;

        row := jsonb_set(row, '{quantity}', to_jsonb(q));
        row := jsonb_set(row, '{reserved}', to_jsonb(r));
        row := jsonb_set(row, '{available}', to_jsonb(greatest(0, q - r)));
        row := jsonb_set(row, '{lastUpdated}', to_jsonb(now()::text));
        stock := jsonb_set(stock, array[i::text], row);
        exit;
      end if;
    end loop;

    if not found then
      if mode = 'restock' then
        stock := stock || jsonb_build_array(jsonb_build_object(
          'warehouseId', wid,
          'warehouseName', '',
          'quantity', qty,
          'reserved', 0,
          'available', qty,
          'location', '',
          'lastUpdated', now()::text
        ));
      else
        raise exception 'Depo stok kaydı yok: %', coalesce(line->>'productName', pid::text);
      end if;
    end if;

    update products set stock = stock, updated_at = now() where id = pid;
  end loop;

  -- Sync warehouse used capacity
  update warehouses w
  set used_capacity = coalesce((
    select sum(coalesce((elem->>'quantity')::numeric, 0))
    from products p,
         lateral jsonb_array_elements(coalesce(p.stock, '[]'::jsonb)) elem
    where elem->>'warehouseId' = w.id::text
  ), 0);
end;
$$;

revoke all on function public.mutate_product_stock(jsonb, text) from public;
grant execute on function public.mutate_product_stock(jsonb, text) to authenticated;
grant execute on function public.mutate_product_stock(jsonb, text) to service_role;

comment on function public.mutate_product_stock(jsonb, text) is
  'Stock mutate. Restock restricted to admin/service_role. Reserve/commit/release allowed for authenticated checkout.';
