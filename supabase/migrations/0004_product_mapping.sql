create table product_mapping (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  raw_ocr_string text not null,
  standardized_item_id uuid not null references inventory_items(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- explicit requirement: B-Tree index on raw_ocr_string
create index idx_product_mapping_raw_ocr_string on product_mapping using btree (raw_ocr_string);
create index idx_product_mapping_standardized_item_id on product_mapping(standardized_item_id);
-- data-integrity addition: prevent duplicate mappings within a household
create unique index uq_product_mapping_household_raw_string on product_mapping(household_id, raw_ocr_string);

alter table product_mapping enable row level security;

create policy product_mapping_select on product_mapping for select using (is_household_member(household_id));
create policy product_mapping_insert on product_mapping for insert with check (is_household_member(household_id));
create policy product_mapping_update on product_mapping for update using (is_household_member(household_id)) with check (is_household_member(household_id));
create policy product_mapping_delete on product_mapping for delete using (is_household_member(household_id));
