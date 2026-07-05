-- CNTEM'UP v7 Migration — Definer-hijack hardening + INSERT guards + anti-forgery
-- Run in Supabase SQL Editor AFTER v6 is applied.
--
-- Depends on:
--   * v1 (public.profiles, public.counting_sessions w/ count/deposit_value/state_code)
--   * v2 (profiles.is_premium / subscription_status default 'none' / stripe_customer_id /
--         premium_since; check_profile_update trigger enforce_profile_update BEFORE UPDATE)
--   * v3 (counting_sessions.started_at / duration_seconds / is_flagged / flag_reason)
--   * v6 (profiles.is_admin; check_profile_update rewritten to detect service_role via
--         JWT-claim GUC coalesce chain)
--
-- Idempotent: safe to re-run (create or replace / drop trigger if exists ...).
--
-- =====================================================================
-- WHY THIS MIGRATION EXISTS
-- ---------------------------------------------------------------------
-- (A) There was NO guard on INSERT into profiles — a user creating their
--     own row could set is_premium/is_admin/stripe fields directly at
--     insert time, sidestepping the UPDATE trigger entirely. We add a
--     dedicated BEFORE INSERT guard (references NEW only; OLD is null on
--     INSERT so the update fn cannot be reused).
-- (B) The v6 check_profile_update is SECURITY DEFINER with NO fixed
--     search_path — a classic definer-function hijack vector (an attacker
--     who can create objects in a schema earlier on search_path could
--     shadow a referenced builtin). We re-harden it: identical behavior,
--     but SET search_path = '' + fully-qualified builtins.
-- (C) counting_sessions.is_flagged is client-supplied. A cheater can POST
--     is_flagged=false to bypass anti-cheat. We recompute it server-side.
-- (D) The verification-slips storage bucket was public — slip images are
--     PII-ish proof and should not be world-readable.
-- =====================================================================


-- =====================================================================
-- (A) INSERT GUARD — coerce protected columns to safe defaults on INSERT
-- ---------------------------------------------------------------------
-- Separate function from the UPDATE guard: on INSERT, OLD is NULL, so any
-- reference to OLD would raise and break every insert. This one touches
-- NEW only. Non-service-role inserts get protected fields forced to their
-- safe defaults (silently coerced, never aborted — an attacker just gets a
-- normal free account). Service-role inserts pass through unchanged so the
-- webhook / server can seed premium/admin rows.
--
-- SECURITY DEFINER + SET search_path = '' closes the definer-hijack vector;
-- all builtins are schema-qualified under pg_catalog for the empty path.
-- =====================================================================
create or replace function public.check_profile_insert()
returns trigger as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    pg_catalog.current_setting('request.jwt.claim.role', true),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.json->>'role'),
    ''
  );

  -- Server-side / webhook inserts are trusted.
  if jwt_role = 'service_role' then
    return new;
  end if;

  -- Optional attacker signal — a supplied value differed from the coerced
  -- default. Log only; never raise, never abort.
  if new.is_premium is distinct from false
    or new.is_admin is distinct from false
    or new.stripe_customer_id is distinct from null
    or new.premium_since is distinct from null
    or new.subscription_status is distinct from 'none' then
    raise notice 'check_profile_insert: protected fields coerced to defaults for user_id=%', new.user_id;
  end if;

  -- Coerce protected fields to their safe defaults.
  -- NOTE: subscription_status default is 'none' (the column default), NOT null.
  -- is_verified and every other column are left untouched.
  new.is_premium := false;
  new.is_admin := false;
  new.stripe_customer_id := null;
  new.premium_since := null;
  new.subscription_status := 'none';

  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists enforce_profile_insert on public.profiles;
create trigger enforce_profile_insert
  before insert on public.profiles
  for each row execute function public.check_profile_insert();


-- =====================================================================
-- (B) RE-HARDEN THE UPDATE GUARD — v6 behavior, plus search_path lockdown
-- ---------------------------------------------------------------------
-- Identical to v6 check_profile_update EXCEPT: SET search_path = '' and
-- builtins qualified under pg_catalog. Still raises 'Cannot modify
-- protected fields' for is_premium/is_admin/stripe_customer_id/
-- subscription_status/premium_since changes by non-service-role. The
-- trigger (enforce_profile_update, from v2) is left as-is.
-- =====================================================================
create or replace function public.check_profile_update()
returns trigger as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    pg_catalog.current_setting('request.jwt.claim.role', true),
    (nullif(pg_catalog.current_setting('request.jwt.claims', true), '')::pg_catalog.json->>'role'),
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
$$ language plpgsql security definer set search_path = '';


-- =====================================================================
-- (C) COUNTING-SESSION ANTI-FORGERY — recompute is_flagged server-side
-- ---------------------------------------------------------------------
-- is_flagged / flag_reason are client-supplied. A cheater can POST
-- is_flagged=false to hide an implausible session. We ALWAYS recompute
-- from scratch on INSERT, ignoring the incoming is_flagged entirely, so
-- a client value can never override a computed flag. This is an integrity
-- control, not an auth control — there is no role bypass (service-role
-- inserts are recomputed too).
--
-- SECURITY DEFINER + SET search_path = '' for consistency and hardening.
-- =====================================================================
create or replace function public.enforce_session_flag()
returns trigger as $$
declare
  -- ---- Thresholds (tune here) ----------------------------------------
  max_count       constant integer := 5000;  -- absurd for a single session
  max_rate        constant numeric := 10;     -- items/sec; >10 is physically implausible
  -- --------------------------------------------------------------------
  rate numeric;
begin
  -- items per second; nullif guards divide-by-zero when duration is 0/null
  rate := new.count::numeric / nullif(new.duration_seconds, 0);

  if new.count < 0 then
    new.is_flagged := true;
    new.flag_reason := 'negative count';
  elsif new.count > max_count then
    new.is_flagged := true;
    new.flag_reason := 'count exceeds ' || max_count || ' (absurd single session)';
  elsif new.duration_seconds is not null
        and new.duration_seconds > 0
        and rate > max_rate then
    new.is_flagged := true;
    new.flag_reason := 'rate ' || round(rate, 2) || '/sec exceeds ' || max_rate || '/sec';
  else
    -- Nothing implausible — force not-flagged, clear any client-supplied reason.
    new.is_flagged := false;
    new.flag_reason := null;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = '';

drop trigger if exists enforce_session_flag on public.counting_sessions;
create trigger enforce_session_flag
  before insert on public.counting_sessions
  for each row execute function public.enforce_session_flag();


-- =====================================================================
-- (D) LOCK DOWN THE VERIFICATION-SLIPS STORAGE BUCKET
-- ---------------------------------------------------------------------
-- Slip images are proof/PII and must not be world-readable. Flip the
-- bucket to private.
--
-- MANUAL FOLLOW-UP: if the Supabase dashboard ever auto-created an
-- anon/authenticated SELECT policy on storage.objects for this bucket,
-- the admin must DROP it by name — that cannot be done blindly in SQL
-- without knowing the exact policy name. Inspect with:
--   select policyname from pg_policies
--   where schemaname='storage' and tablename='objects';
-- =====================================================================
update storage.buckets set public = false where id = 'verification-slips';


-- MANUAL: run in Supabase SQL editor AFTER confirming v6 is applied. Owner seeds of protected columns must first run: set local session_replication_role='replica';
