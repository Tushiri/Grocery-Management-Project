create or replace function increment_inventory_quantity(p_item_id uuid, p_amount numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update inventory_items
  set quantity = quantity + p_amount
  where id = p_item_id;
$$;
