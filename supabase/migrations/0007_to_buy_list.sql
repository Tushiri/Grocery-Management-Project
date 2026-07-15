create type to_buy_status as enum ('OPEN', 'PARTIAL', 'FULFILLED', 'CANCELLED');

create table to_buy_list (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  quantity_requested numeric(10,2) not null check (quantity_requested > 0),
  quantity_remaining numeric(10,2) not null check (quantity_remaining >= 0),
  status to_buy_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_to_buy_list_household_status on to_buy_list(household_id, status);
create index idx_to_buy_list_item_id on to_buy_list(item_id);

create trigger trg_to_buy_list_updated_at
  before update on to_buy_list for each row execute function set_updated_at();

alter table to_buy_list enable row level security;

create policy to_buy_list_select on to_buy_list for select using (is_household_member(household_id));
create policy to_buy_list_insert on to_buy_list for insert with check (is_household_member(household_id));
create policy to_buy_list_update on to_buy_list for update using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy to_buy_list_delete on to_buy_list for delete using (is_household_member(household_id));
