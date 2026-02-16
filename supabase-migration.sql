-- CNTEM'UP Supabase Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- 1. Profiles table
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  state_code char(2) default 'NY',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. State rules table (seeded from app, but also stored in DB for admin editing)
create table if not exists public.state_rules (
  state_code char(2) primary key,
  state_name text not null,
  deposit_rates jsonb not null,
  eligible_containers jsonb default '[]',
  eligible_beverages jsonb default '[]',
  exclusions jsonb default '[]',
  size_limits jsonb default '{}',
  special_rates jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Counting sessions table
create table if not exists public.counting_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  count integer not null default 0,
  deposit_value numeric(10,2) default 0,
  state_code char(2),
  created_at timestamptz default now()
);

-- 4. Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.state_rules enable row level security;
alter table public.counting_sessions enable row level security;

-- Profiles: users can read/update their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = user_id);

-- State rules: all authenticated users can read
create policy "Authenticated users can read state rules"
  on public.state_rules for select
  to authenticated
  using (true);

-- Counting sessions: users can read/insert their own sessions
create policy "Users can view own sessions"
  on public.counting_sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.counting_sessions for insert
  with check (auth.uid() = user_id);

-- 5. Seed state rules
insert into public.state_rules (state_code, state_name, deposit_rates, eligible_containers, eligible_beverages, exclusions, size_limits, special_rates, notes)
values
  ('CA', 'California',
    '{"standard": 0.05, "large": 0.10, "wine_pouch": 0.25}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "wine coolers", "soda", "water", "juice", "coffee", "tea", "kombucha", "sports drinks", "energy drinks"]',
    '["milk", "infant formula", "medical food"]',
    '{"min_oz": 0}',
    '{"threshold_oz": 24, "large_rate": 0.10, "wine_pouch_rate": 0.25}',
    'CRV program. Broadest beverage coverage.'),

  ('CT', 'Connecticut',
    '{"standard": 0.10}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "soda", "seltzer", "water", "kombucha", "energy drinks", "sports drinks"]',
    '["milk", "dairy", "wine", "spirits", "juice"]',
    '{"min_oz": 0, "max_oz": 128}',
    null,
    'Increased from 5¢ to 10¢ in January 2024.'),

  ('HI', 'Hawaii',
    '{"standard": 0.05, "handling_fee": 0.01}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "soda", "water", "juice", "tea", "coffee", "sports drinks", "wine", "spirits"]',
    '["milk", "dairy", "infant formula"]',
    '{"min_oz": 0, "max_oz": 68}',
    null,
    'HI-5 program. 1¢ non-refundable fee.'),

  ('IA', 'Iowa',
    '{"standard": 0.05}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "carbonated soda", "mineral water", "wine coolers", "carbonated water"]',
    '["non-carbonated beverages", "wine", "spirits", "juice"]',
    '{}',
    null,
    'Carbonated beverages + alcohol only.'),

  ('ME', 'Maine',
    '{"standard": 0.05, "wine_liquor": 0.15}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "soda", "water", "juice", "tea", "coffee", "wine", "spirits", "hard cider"]',
    '["milk", "dairy", "infant formula"]',
    '{"min_oz": 0, "max_oz": 128}',
    '{"wine_liquor_rate": 0.15}',
    'Most comprehensive bottle bill. Wine/liquor = 15¢.'),

  ('MA', 'Massachusetts',
    '{"standard": 0.05}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "carbonated soda", "mineral water", "carbonated water"]',
    '["non-carbonated beverages", "wine", "spirits", "juice"]',
    '{}',
    null,
    'Carbonated only. ~43% redemption rate.'),

  ('MI', 'Michigan',
    '{"standard": 0.10}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "carbonated soda", "carbonated water", "mineral water", "wine coolers"]',
    '["non-carbonated beverages", "wine", "spirits", "juice"]',
    '{"min_oz": 0, "max_oz": 128}',
    null,
    'Highest single rate. 97% return rate.'),

  ('NY', 'New York',
    '{"standard": 0.05}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "carbonated soda", "carbonated water", "seltzer", "water", "wine coolers"]',
    '["wine", "spirits", "juice", "dairy"]',
    '{"min_oz": 0, "max_oz": 128}',
    null,
    'Carbonated beverages + water. Under 1 gallon.'),

  ('OR', 'Oregon',
    '{"standard": 0.10}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "soda", "water", "kombucha", "hard cider", "wine (canned)", "coffee"]',
    '["spirits", "wine (glass)", "dairy"]',
    '{"min_oz": 4, "max_oz": 128}',
    null,
    'BottleDrop system. 87% return rate. Includes canned wine.'),

  ('VT', 'Vermont',
    '{"standard": 0.05, "liquor": 0.15}',
    '["glass", "plastic", "aluminum", "bi-metal"]',
    '["beer", "malt", "carbonated soda", "water", "spirits", "wine coolers", "hard cider"]',
    '["wine", "juice", "dairy"]',
    '{"min_oz": 0, "max_oz": 128}',
    '{"liquor_rate": 0.15}',
    'First bottle bill state (1953). Spirits = 15¢.')
on conflict (state_code) do nothing;
