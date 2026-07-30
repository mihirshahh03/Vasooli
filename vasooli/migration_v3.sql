-- ============================================================
-- Vasooli — migration v3 (ADDITIVE ONLY, safe on existing data)
-- Run once: Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---- groups: international flag + trip dates ----
alter table groups add column if not exists is_international boolean default false;
alter table groups add column if not exists start_date date;
alter table groups add column if not exists end_date date;

-- ---- groups: only an admin can delete the whole group ----
-- (existing select/insert/update policies are untouched; this only adds delete)
drop policy if exists "admin can delete group" on groups;
create policy "admin can delete group"
  on groups for delete to authenticated
  using (public.is_group_admin(id));

-- ---- expenses: optional original foreign-currency amount ----
-- total_amount stays the INR-equivalent (drives all split/settle math, unchanged).
-- These columns are just for display -- "this was originally $45".
alter table expenses add column if not exists original_currency text;
alter table expenses add column if not exists original_amount numeric(12,2);
alter table expenses add column if not exists exchange_rate numeric(12,6);

-- ---- comments on an expense ----
create table if not exists expense_comments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  message text not null,
  created_at timestamptz default now()
);

alter table expense_comments enable row level security;

create policy "see comments in own groups"
  on expense_comments for select to authenticated
  using (exists (
    select 1 from expenses e where e.id = expense_id and public.is_group_member(e.group_id)
  ));

create policy "comment in own groups"
  on expense_comments for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from expenses e where e.id = expense_id and public.is_group_member(e.group_id))
  );

create policy "delete own comments"
  on expense_comments for delete to authenticated
  using (profile_id = auth.uid());
