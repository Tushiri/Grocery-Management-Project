insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false)
  on conflict (id) do nothing;

-- convention: object path = "{household_id}/{uuid}.jpg"
-- null-safe: returns NULL (never raises) for rootless uploads or non-UUID folder fragments
create or replace function storage_object_household_id(object_name text)
returns uuid
language plpgsql
security definer
stable
as $$
declare
  folder_parts text[];
begin
  folder_parts := storage.foldername(object_name);
  if folder_parts is null or array_length(folder_parts, 1) is null then
    return null;
  end if;
  return folder_parts[1]::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create policy receipts_storage_select on storage.objects
  for select using (bucket_id = 'receipts' and is_household_member(storage_object_household_id(name)));

create policy receipts_storage_insert on storage.objects
  for insert with check (bucket_id = 'receipts' and is_household_member(storage_object_household_id(name)));
