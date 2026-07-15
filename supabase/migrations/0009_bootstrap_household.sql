-- `households` has no INSERT policy, and `household_members_owner_manage` (§0002)
-- requires is_household_owner() — which is false for everyone on a brand-new
-- household, since no OWNER row exists yet. A normal RLS-scoped client can
-- never create the first household/membership row: this is the standard
-- Supabase "self-service bootstrap" pattern, using a narrowly-scoped
-- SECURITY DEFINER function instead of handing the client a service-role key.
--
-- Scope is deliberately narrow: it only ever acts on behalf of auth.uid()
-- (the caller), never an arbitrary user_id/household_id passed as an
-- argument, so it cannot be abused to join/create households for others.
create or replace function bootstrap_household(p_household_name text default 'My Household')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  -- Idempotent: a caller who already belongs to a household just gets that
  -- household_id back, so this is safe to call on every login.
  select household_id into v_household_id
  from household_members
  where user_id = auth.uid()
  limit 1;

  if v_household_id is not null then
    return v_household_id;
  end if;

  insert into households (name)
  values (p_household_name)
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, auth.uid(), 'OWNER');

  return v_household_id;
end;
$$;

revoke all on function bootstrap_household(text) from public;
grant execute on function bootstrap_household(text) to authenticated;
