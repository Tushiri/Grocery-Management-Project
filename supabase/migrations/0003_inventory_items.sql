create type priority_level as enum ('LOW', 'MEDIUM', 'HIGH');

create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  standardized_name text not null,
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  unit_type text not null,
  category text,
  priority_tag priority_level not null default 'MEDIUM',
  min_threshold numeric(10,2) not null default 0 check (min_threshold >= 0),
  expiration_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_inventory_items_household_id on inventory_items(household_id);
create index idx_inventory_items_household_name on inventory_items(household_id, standardized_name);

create trigger trg_inventory_items_updated_at
  before update on inventory_items for each row execute function set_updated_at();

alter table inventory_items enable row level security;

create policy inventory_items_select on inventory_items for select using (is_household_member(household_id));
create policy inventory_items_insert on inventory_items for insert with check (is_household_member(household_id));
create policy inventory_items_update on inventory_items for update using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy inventory_items_delete on inventory_items for delete using (is_household_member(household_id));
