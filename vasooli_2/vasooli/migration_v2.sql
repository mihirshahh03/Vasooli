-- ============================================================
-- Vasooli — migration v2 (ADDITIVE ONLY)
-- Safe to run on your existing project: does NOT drop any tables,
-- so Slayer/Anushka and any existing groups/expenses are untouched.
-- Run once: Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---- profiles: real email (optional) + UPI id (optional) ----
alter table profiles add column if not exists email text;
alter table profiles add column if not exists upi_id text;

-- Backfill: existing accounts get their current (synthetic) auth email
-- copied in, so the login-lookup function below works for everyone.
update profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

-- Keep profiles.email in sync automatically whenever an account's real
-- auth email is set or changed (covers both new signups and later changes).
create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set email = new.email where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_synced on auth.users;
create trigger on_auth_user_email_synced
  after insert or update of email on auth.users
  for each row execute function public.sync_profile_email();

-- Also update handle_new_user so brand-new signups get email set on creation
-- (belt-and-braces alongside the trigger above).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, email)
  values (
    new.id,
    lower(new.raw_user_meta_data->>'username'),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username'),
    new.email
  );
  return new;
end;
$$;

-- ---- login-by-username support: resolve a username to its real login email ----
-- Needed because some accounts use a real email (for password reset) and
-- some still use the synthetic one -- the client must ask which to use
-- before calling signInWithPassword. Returns null if username not found.
-- SECURITY DEFINER so it works even before the caller is logged in.
create or replace function public.get_login_email(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from profiles where lower(username) = lower(p_username) limit 1;
$$;

grant execute on function public.get_login_email(text) to anon, authenticated;

-- ---- groups: emoji + archive ----
alter table groups add column if not exists emoji text default '🧾';
alter table groups add column if not exists archived_at timestamptz;

-- ---- admin-only helper (for expense edit permissions) ----
create or replace function public.is_group_admin(p_group_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and profile_id = auth.uid() and role = 'admin'
  );
$$;

-- ---- expenses: only the creator or a group admin can edit ----
-- (delete stays open to any group member, unchanged from before)
drop policy if exists "edit expenses of own groups" on expenses;
create policy "edit own expenses or as admin"
  on expenses for update to authenticated
  using (created_by = auth.uid() or public.is_group_admin(group_id));

-- ---- settlements: recording "this debt is cleared" ----
create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  from_profile_id uuid references profiles(id) on delete set null,
  to_profile_id uuid references profiles(id) on delete set null,
  amount numeric(12,2) not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

alter table settlements enable row level security;

create policy "see settlements of own groups"
  on settlements for select to authenticated
  using (public.is_group_member(group_id));

-- Either person in the transaction can record it -- not just any group member.
create policy "either party can record a settlement"
  on settlements for insert to authenticated
  with check (
    public.is_group_member(group_id)
    and (auth.uid() = from_profile_id or auth.uid() = to_profile_id)
  );

create policy "either party can undo a settlement"
  on settlements for delete to authenticated
  using (auth.uid() = from_profile_id or auth.uid() = to_profile_id);

-- ---- activity log: auto-populated by triggers, nothing for the app to write ----
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  message text not null,
  created_at timestamptz default now()
);

alter table activity_log enable row level security;

create policy "see activity of own groups"
  on activity_log for select to authenticated
  using (public.is_group_member(group_id));

create or replace function public.log_expense_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare actor_name text;
begin
  select display_name into actor_name from profiles where id = new.created_by;
  insert into activity_log (group_id, message)
  values (new.group_id, coalesce(actor_name, 'Someone') || ' added "' || new.description || '" (₹' || new.total_amount || ')');
  return new;
end;
$$;

drop trigger if exists on_expense_logged on expenses;
create trigger on_expense_logged
  after insert on expenses
  for each row execute function public.log_expense_activity();

create or replace function public.log_settlement_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare from_name text; to_name text;
begin
  select display_name into from_name from profiles where id = new.from_profile_id;
  select display_name into to_name from profiles where id = new.to_profile_id;
  insert into activity_log (group_id, message)
  values (new.group_id, coalesce(from_name,'Someone') || ' paid ' || coalesce(to_name,'someone') || ' ₹' || new.amount);
  return new;
end;
$$;

drop trigger if exists on_settlement_logged on settlements;
create trigger on_settlement_logged
  after insert on settlements
  for each row execute function public.log_settlement_activity();
