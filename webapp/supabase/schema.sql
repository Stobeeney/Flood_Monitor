-- Supabase Schema for LRT2 Flood Monitoring Dashboard + ESP32 Live Telemetry
-- Run this in your Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  email text not null,
  full_name text,
  role text not null default 'Operator',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Allow username lookup for login" on public.profiles;
create policy "Allow username lookup for login"
  on public.profiles for select
  using (true);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create table if not exists public.flood_readings (
  id bigint generated always as identity primary key,
  station_id text not null,
  raw_distance_cm numeric(6,2) not null,
  water_depth_cm numeric(6,2) not null,
  alert_level text not null check (alert_level in ('GREEN', 'ORANGE', 'RED')),
  source text not null default 'ESP32',
  recorded_at timestamptz not null default now()
);

create index if not exists idx_flood_readings_station_time
  on public.flood_readings (station_id, recorded_at desc);

alter table public.flood_readings enable row level security;

drop policy if exists "Authenticated users can read flood readings" on public.flood_readings;
create policy "Authenticated users can read flood readings"
  on public.flood_readings for select
  to authenticated, anon
  using (true);

-- Allows the ESP32 device (using the project anon key) to push live sensor readings
drop policy if exists "Device can insert flood readings" on public.flood_readings;
create policy "Device can insert flood readings"
  on public.flood_readings for insert
  to authenticated, anon
  with check (source in ('ESP32', 'SIMULATOR'));

-- Enable Supabase Realtime broadcasts for live updates on the Vercel dashboard
do $$
begin
  alter publication supabase_realtime add table public.flood_readings;
exception
  when duplicate_object then null;
end $$;
