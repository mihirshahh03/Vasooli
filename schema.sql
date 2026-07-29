-- ============================================================
-- Vasooli - database schema (multi-group version)
-- Run this once: Supabase Dashboard -> SQL Editor -> New Query -> paste -> Run
-- ============================================================

-- Clean slate (safe to run even on a fresh project)
drop table if exists expense_shares cascade;
drop table if exists expenses cascade;
drop table if exists group_members cascade;
drop table if exists groups cascade;
drop table if exists trip_members cascade;
drop table if exists trips cascade;
drop table if exists profiles cascade;
drop function if exists public.is_group_member(uuid) cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.add_creator_as_admin() cascade;

-- ------------------------------------------------------------
-- PROFILES: one row per signed-up person, linked to Supabase Auth.
-- Created automatically by a trigger when someone signs up.
-- ------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- GROUPS: e.g. "Nashik Trip". Created by whoever makes it.
-- ------------------------------------------------------------
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- GROUP_MEMBERS: who is in which group. role is 'admin' or 'member'.
-- Any member can add others (your choice); only admins can remove.
-- ------------------------------------------------------------
create table group_members (
  group_id uuid references groups(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  primary key (group_id, profile_id)
);

-- ------------------------------------------------------------
-- EXPENSES + EXPENSE_SHARES
-- expenses  = one row per thing bought ("Day 1 Breakfast", "Corona")
-- shares    = one row per (expense, person) = that person's computed share.
--             This is the source of truth for all the money math.
-- ------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  description text not null,
  category text,
  paid_by uuid references profiles(id) on delete set null,
  total_amount numeric(12,2) not null,
  split_type text not null check (split_type in ('equal', 'custom', 'per_unit')),
  meta jsonb default '{}'::jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

create table expense_shares (
  expense_id uuid references expenses(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  share_amount numeric(12,2) not null,
  primary key (expense_id, profile_id)
);

create index on expenses (group_id);
create index on group_members (profile_id);

-- ------------------------------------------------------------
-- HELPER: "is the logged-in person a member of this group?"
-- SECURITY DEFINER so it can read group_members without triggering
-- the RLS policy that itself calls this function (avoids infinite recursion).
-- ------------------------------------------------------------
create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and profile_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- TRIGGER: when someone signs up, create their profile row.
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- TRIGGER: whoever creates a group is automatically its admin.
-- ------------------------------------------------------------
create or replace function public.add_creator_as_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into group_members (group_id, profile_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_group_created
  after insert on groups
  for each row execute function public.add_creator_as_admin();

-- ============================================================
-- ROW LEVEL SECURITY
-- This is what actually keeps Kaizer's groups invisible to your friends.
-- Enforced by the database itself, not by the app -- so it holds even if
-- someone pokes at the API directly.
-- ============================================================
alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table expenses enable row level security;
alter table expense_shares enable row level security;

-- PROFILES: any signed-in person can look up profiles (needed so you can
-- add a friend by typing their exact username). Only you can edit yours.
create policy "profiles readable by signed-in users"
  on profiles for select to authenticated using (true);
create policy "update own profile"
  on profiles for update to authenticated using (id = auth.uid());

-- GROUPS: you only see groups you belong to.
create policy "see own groups"
  on groups for select to authenticated using (public.is_group_member(id));
create policy "create groups"
  on groups for insert to authenticated with check (created_by = auth.uid());
create policy "members can rename group"
  on groups for update to authenticated using (public.is_group_member(id));

-- GROUP_MEMBERS: you see the member list of your own groups.
-- Any member can add someone new. You can always remove yourself (leave).
create policy "see members of own groups"
  on group_members for select to authenticated using (public.is_group_member(group_id));
create policy "members can add members"
  on group_members for insert to authenticated with check (public.is_group_member(group_id));
create policy "remove members of own groups"
  on group_members for delete to authenticated using (public.is_group_member(group_id));

-- EXPENSES: fully scoped to groups you belong to.
create policy "see expenses of own groups"
  on expenses for select to authenticated using (public.is_group_member(group_id));
create policy "add expenses to own groups"
  on expenses for insert to authenticated with check (public.is_group_member(group_id));
create policy "edit expenses of own groups"
  on expenses for update to authenticated using (public.is_group_member(group_id));
create policy "delete expenses of own groups"
  on expenses for delete to authenticated using (public.is_group_member(group_id));

-- EXPENSE_SHARES: scoped via the parent expense's group.
create policy "see shares of own groups"
  on expense_shares for select to authenticated
  using (exists (select 1 from expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "add shares to own groups"
  on expense_shares for insert to authenticated
  with check (exists (select 1 from expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
create policy "delete shares of own groups"
  on expense_shares for delete to authenticated
  using (exists (select 1 from expenses e where e.id = expense_id and public.is_group_member(e.group_id)));
