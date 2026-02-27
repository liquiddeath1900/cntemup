-- CNTEM'UP v2 Migration — Premium Tier Support
-- Run this AFTER supabase-migration.sql in Supabase SQL Editor

-- 1. Add premium columns to profiles
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists is_premium boolean default false,
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text default 'none',
  add column if not exists premium_since timestamptz,
  add column if not exists alert_target integer default 0;

-- 2. Index for Stripe webhook lookups
create index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- 3. Restrict user self-updates to safe columns only
-- Prevents users from setting is_premium, stripe_customer_id, etc. via API
-- Service role (webhook) bypasses RLS, so it can still update premium fields
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Column-level restriction: users can only modify these fields
-- Premium fields are webhook-only (service role bypasses RLS)
create or replace function public.check_profile_update()
returns trigger as $$
begin
  -- Service role bypasses this check
  if current_setting('role') = 'service_role' then
    return new;
  end if;
  -- Users cannot modify premium fields
  if new.is_premium is distinct from old.is_premium
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.subscription_status is distinct from old.subscription_status
    or new.premium_since is distinct from old.premium_since then
    raise exception 'Cannot modify premium fields';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_profile_update on public.profiles;
create trigger enforce_profile_update
  before update on public.profiles
  for each row execute function public.check_profile_update();

-- 4. Auto-purge sessions older than 45 days (run nightly via pg_cron)
-- Enable pg_cron extension first (Supabase Dashboard > Extensions > pg_cron)
-- Then schedule:
--
-- select cron.schedule(
--   'purge-old-sessions',
--   '0 3 * * *',  -- 3 AM UTC daily
--   $$delete from public.counting_sessions where created_at < now() - interval '45 days'$$
-- );
