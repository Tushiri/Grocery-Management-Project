create or replace function is_household_member(target_household_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = auth.uid()
  );
$$;

create or replace function is_household_owner(target_household_id uuid)
returns boolean
language sql security definer stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id and user_id = auth.uid() and role = 'OWNER'
  );
$$;

create or replace function set_updated_at()
returns trigger language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create policy households_select on households
  for select using (is_household_member(id));
create policy household_members_select on household_members
  for select using (is_household_member(household_id));
create policy household_members_owner_manage on household_members
  for all using (is_household_owner(household_id)) with check (is_household_owner(household_id));
