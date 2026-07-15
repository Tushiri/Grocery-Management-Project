create extension if not exists "pgcrypto";

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create type household_role as enum ('OWNER', 'MEMBER');

create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role household_role not null default 'MEMBER',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index idx_household_members_user_id on household_members(user_id);

alter table households enable row level security;
alter table household_members enable row level security;
