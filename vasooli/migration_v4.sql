-- ============================================================
-- Vasooli — migration v4 (ADDITIVE ONLY, safe on existing data)
-- Adds: group invite links with an optional PIN, and push notifications.
-- Run once: Supabase -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---- groups: invite link + optional PIN gate ----
alter table groups add column if not exists invite_code text unique;
alter table groups add column if not exists invite_pin_hash text;

-- Give every existing group an invite code (new ones get one via the default below).
update groups set invite_code = encode(gen_random_bytes(9), 'hex') where invite_code is null;
alter table groups alter column invite_code set default encode(gen_random_bytes(9), 'hex');

-- ---- brute-force guard for PIN entry ----
create table if not exists join_attempts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now()
);
create index if not exists join_attempts_lookup on join_attempts (group_id, profile_id, created_at);

alter table join_attempts enable row level security;
-- No policies: nothing reads this directly from the app. Only the SECURITY DEFINER
-- function below touches it, which bypasses RLS.

-- ---- ADMIN: set or clear the invite PIN, and rotate the link ----
-- SECURITY DEFINER so the PIN is hashed server-side with pgcrypto and the
-- plaintext never lands in a table. Admin-only.
create or replace function public.set_group_invite(p_group_id uuid, p_pin text, p_rotate boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_group_admin(p_group_id) then
    return jsonb_build_object('ok', false, 'error', 'not_admin');
  end if;

  update groups
     set invite_pin_hash = case
           when p_pin is null or p_pin = '' then null
           else crypt(p_pin, gen_salt('bf'))
         end,
         invite_code = case when p_rotate then encode(gen_random_bytes(9), 'hex') else invite_code end
   where id = p_group_id
   returning invite_code into v_code;

  return jsonb_build_object('ok', true, 'invite_code', v_code);
end;
$$;

grant execute on function public.set_group_invite(uuid, text, boolean) to authenticated;

-- ---- JOIN: exchange an invite code (+ PIN) for membership ----
-- SECURITY DEFINER because the caller is not yet a member, so RLS would hide
-- the group from them entirely. Returns only success/failure -- never leaks
-- group details to someone who fails the PIN check.
create or replace function public.join_group_with_code(p_invite_code text, p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups%rowtype;
  v_recent_failures int;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'not_logged_in');
  end if;

  select * into v_group from groups where invite_code = p_invite_code;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_link');
  end if;

  -- Already in? Just succeed quietly.
  if exists (select 1 from group_members where group_id = v_group.id and profile_id = auth.uid()) then
    return jsonb_build_object('ok', true, 'already_member', true, 'group_name', v_group.name);
  end if;

  -- Rate-limit PIN guessing: 5 failures per hour, per person, per group.
  select count(*) into v_recent_failures
    from join_attempts
   where group_id = v_group.id
     and profile_id = auth.uid()
     and created_at > now() - interval '1 hour';

  if v_recent_failures >= 5 then
    return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
  end if;

  if v_group.invite_pin_hash is not null then
    if p_pin is null or p_pin = '' or v_group.invite_pin_hash <> crypt(p_pin, v_group.invite_pin_hash) then
      insert into join_attempts (group_id, profile_id) values (v_group.id, auth.uid());
      return jsonb_build_object('ok', false, 'error', 'wrong_pin');
    end if;
  end if;

  insert into group_members (group_id, profile_id, role)
  values (v_group.id, auth.uid(), 'member')
  on conflict do nothing;

  delete from join_attempts where group_id = v_group.id and profile_id = auth.uid();

  return jsonb_build_object('ok', true, 'group_name', v_group.name);
end;
$$;

grant execute on function public.join_group_with_code(text, text) to authenticated;

-- ---- PEEK: does this invite link exist, and does it need a PIN? ----
-- Returns the group name so the join screen can say "Join Nashik Trip"
-- before asking for the PIN. Deliberately returns nothing else.
create or replace function public.peek_invite(p_invite_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when g.id is null then jsonb_build_object('found', false)
              else jsonb_build_object(
                'found', true,
                'group_name', g.name,
                'emoji', g.emoji,
                'needs_pin', g.invite_pin_hash is not null
              )
         end
    from (select 1) dummy
    left join groups g on g.invite_code = p_invite_code;
$$;

grant execute on function public.peek_invite(text) to anon, authenticated;

-- ---- PUSH NOTIFICATIONS: one row per device subscription ----
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now()
);
create index if not exists push_subs_by_profile on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

create policy "manage own push subscriptions"
  on push_subscriptions for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
