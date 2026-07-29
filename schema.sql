-- TripSplit database schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New Query -> paste -> Run

create extension if not exists "pgcrypto";

-- One row per friend. pin_hash is a SHA-256 hash of their 4-digit PIN (hashed in-browser
-- before it ever reaches the database). This is a "trusted friend group" login, not
-- bank-grade auth -- good enough for a private trip app, not meant to resist a determined attacker.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  pin_hash text,  -- null until the person's first login, when they set their own PIN
  created_at timestamptz default now()
);

create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table trip_members (
  trip_id uuid references trips(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  primary key (trip_id, profile_id)
);

-- One row per expense (e.g. "Day 1 Breakfast", "Villa", "Corona").
-- meta stores the raw inputs (split_type, per-unit counts, subgroup list) for display/editing;
-- the actual money math always comes from expense_shares below, which is the source of truth.
create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade,
  description text not null,
  category text,
  paid_by uuid references profiles(id),
  total_amount numeric(12,2) not null,
  split_type text not null check (split_type in ('equal', 'custom', 'per_unit')),
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- One row per (expense, person) = that person's computed share of that expense.
create table expense_shares (
  expense_id uuid references expenses(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  share_amount numeric(12,2) not null,
  primary key (expense_id, profile_id)
);

-- Row Level Security: enabled, but permissive. We are not using Supabase Auth
-- (login is a custom name+PIN check against the profiles table), so there's no
-- auth.uid() to scope policies to. Anyone with the app URL can read/write --
-- fine for a private link shared only with your 8 friends. Tighten later if needed.
alter table profiles enable row level security;
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table expenses enable row level security;
alter table expense_shares enable row level security;

create policy "allow all - profiles" on profiles for all using (true) with check (true);
create policy "allow all - trips" on trips for all using (true) with check (true);
create policy "allow all - trip_members" on trip_members for all using (true) with check (true);
create policy "allow all - expenses" on expenses for all using (true) with check (true);
create policy "allow all - expense_shares" on expense_shares for all using (true) with check (true);

-- Seed your 8 friends so the login screen has names to pick from.
-- Nobody has a PIN yet -- the app prompts each person to set their own the first
-- time they select their name and log in.
insert into profiles (name) values
  ('Slayer'),
  ('Gudjiya'),
  ('Bhaijaan'),
  ('Muffin'),
  ('Mayu (Leader)'),
  ('Dee'),
  ('Ragina'),
  ('Hardik Uncle');
