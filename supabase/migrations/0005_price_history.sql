create table price_history (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  item_id uuid not null references inventory_items(id) on delete cascade,
  price numeric(10,2) not null check (price >= 0),
  store_name text not null,
  date_purchased date not null,
  created_at timestamptz not null default now()
);

-- explicit requirement: composite B-Tree index on (item_id, date_purchased)
create index idx_price_history_item_date on price_history using btree (item_id, date_purchased);

alter table price_history enable row level security;

create policy price_history_select on price_history for select using (is_household_member(household_id));
create policy price_history_insert on price_history for insert with check (is_household_member(household_id));
-- append-only ledger: no update/delete policy by default
