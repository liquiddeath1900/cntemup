-- CNTEM'UP v6 Migration — Lock waitlist + DB-driven admin gate
-- Run in Supabase SQL Editor

-- =====================================================================
-- 1. WAITLIST RLS — was wide open, anon could SELECT every signup
-- (name + email + source + timestamp). Anyone with the publishable key
-- in the bundle could dump the list. Lock SELECT, keep INSERT open
-- so the public signup form still works.
-- =====================================================================
alter table public.waitlist enable row level security;

drop policy if exists "waitlist anon insert" on public.waitlist;
create policy "waitlist anon insert"
  on public.waitlist for insert
  with check (true);

drop policy if exists "waitlist no read" on public.waitlist;
create policy "waitlist no read"
  on public.waitlist for select
  using (false);

-- No update/delete policies — defaults to deny for non-service-role.

-- =====================================================================
-- 2. ADMIN FLAG — replace the hardcoded-email gate (VITE_ADMIN_EMAIL
-- inlined into the JS bundle by Vite) with a DB column. The client
-- reads profile.is_admin at runtime, the bundle no longer contains
-- the owner's personal email.
-- =====================================================================
alter table public.profiles
  add column if not exists is_admin boolean default false;

-- Promote the current owner.
do $$
declare
  target_user uuid;
begin
  select id into target_user from auth.users
    where email = 'liquiddeath1900@gmail.com'
    limit 1;

  if target_user is null then
    raise notice 'Admin promotion skipped — user not found';
    return;
  end if;

  set local session_replication_role = 'replica';

  update public.profiles
    set is_admin = true
    where user_id = target_user;

  raise notice 'is_admin=true set for %', target_user;
end$$;

-- =====================================================================
-- 3. BLOCK SELF-PROMOTION — extend check_profile_update so users
-- can't flip is_admin via the API. Service role (server-side only)
-- can still grant/revoke admin.
-- =====================================================================
create or replace function public.check_profile_update()
returns trigger as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::json->>'role'),
    ''
  );

  if jwt_role = 'service_role' then
    return new;
  end if;

  if new.is_premium is distinct from old.is_premium
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.subscription_status is distinct from old.subscription_status
    or new.premium_since is distinct from old.premium_since
    or new.is_admin is distinct from old.is_admin then
    raise exception 'Cannot modify protected fields';
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- =====================================================================
-- 4. CLEANER pro_checkout_log POLICY — was joined to auth.users by
-- hardcoded email; switch to profiles.is_admin so the schema no
-- longer carries the owner's personal email.
-- =====================================================================
drop policy if exists "Admin reads checkout log" on public.pro_checkout_log;
create policy "Admin reads checkout log"
  on public.pro_checkout_log for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.is_admin = true
    )
  );
