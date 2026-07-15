create type receipt_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table pending_receipt (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  store_name text,
  parsed_json jsonb,
  status receipt_status not null default 'PENDING',
  raw_image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_pending_receipt_household_status on pending_receipt(household_id, status);

create trigger trg_pending_receipt_updated_at
  before update on pending_receipt for each row execute function set_updated_at();

alter table pending_receipt enable row level security;

create policy pending_receipt_select on pending_receipt for select using (is_household_member(household_id));
create policy pending_receipt_insert on pending_receipt for insert with check (is_household_member(household_id));
create policy pending_receipt_update on pending_receipt for update using (is_household_member(household_id)) with check (is_household_member(household_id));
