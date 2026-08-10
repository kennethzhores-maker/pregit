-- Phase 2: Football data foundation
-- Apply in Supabase SQL editor, or: supabase db push

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Core entities
-- ---------------------------------------------------------------------------

create table if not exists public.competitions (
  id text primary key,
  external_id text unique,
  name text not null,
  country text,
  season integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id text primary key,
  external_id text unique,
  competition_id text references public.competitions (id) on delete set null,
  name text not null,
  short_name text not null,
  tla text,
  crest_url text,
  venue text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id text primary key,
  external_id text unique,
  team_id text not null references public.teams (id) on delete cascade,
  name text not null,
  position text check (position in ('GK', 'DF', 'MF', 'FW')),
  shirt_number integer,
  nationality text,
  date_of_birth date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_team_id_idx on public.players (team_id);

create table if not exists public.fixtures (
  id text primary key,
  external_id text unique,
  competition_id text not null references public.competitions (id) on delete cascade,
  home_team_id text not null references public.teams (id),
  away_team_id text not null references public.teams (id),
  kickoff timestamptz not null,
  venue text,
  status text not null check (
    status in ('scheduled', 'lineups', 'live', 'finished', 'postponed', 'cancelled')
  ),
  home_score integer,
  away_score integer,
  referee text,
  round text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fixtures_kickoff_idx on public.fixtures (kickoff);
create index if not exists fixtures_status_idx on public.fixtures (status);

create table if not exists public.lineups (
  id text primary key default gen_random_uuid()::text,
  fixture_id text not null references public.fixtures (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  player_id text not null references public.players (id) on delete cascade,
  is_starter boolean not null default true,
  position text,
  shirt_number integer,
  grid text,
  unique (fixture_id, player_id)
);

create index if not exists lineups_fixture_id_idx on public.lineups (fixture_id);

create table if not exists public.player_stats (
  id text primary key default gen_random_uuid()::text,
  player_id text not null references public.players (id) on delete cascade,
  season integer not null,
  appearances integer not null default 0,
  minutes integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  yellow_cards integer not null default 0,
  red_cards integer not null default 0,
  rating numeric(4, 2),
  unique (player_id, season)
);

create table if not exists public.team_stats (
  id text primary key default gen_random_uuid()::text,
  team_id text not null references public.teams (id) on delete cascade,
  season integer not null,
  played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  form text,
  unique (team_id, season)
);

create table if not exists public.injuries (
  id text primary key default gen_random_uuid()::text,
  player_id text not null references public.players (id) on delete cascade,
  team_id text not null references public.teams (id) on delete cascade,
  injury_type text,
  reason text,
  start_date date,
  expected_return date,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists injuries_active_idx on public.injuries (is_active) where is_active;

create table if not exists public.predictions (
  id text primary key default gen_random_uuid()::text,
  fixture_id text not null references public.fixtures (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  model_version text,
  home_win_pct numeric(5, 2),
  draw_pct numeric(5, 2),
  away_win_pct numeric(5, 2),
  predicted_home_goals numeric(4, 2),
  predicted_away_goals numeric(4, 2),
  most_likely_score text,
  confidence numeric(5, 2),
  explanation jsonb,
  inputs_snapshot jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sync_runs (
  id text primary key default gen_random_uuid()::text,
  job_name text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_upserted integer not null default 0,
  error text,
  meta jsonb
);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists competitions_set_updated_at on public.competitions;
create trigger competitions_set_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
before update on public.teams
for each row execute function public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists fixtures_set_updated_at on public.fixtures;
create trigger fixtures_set_updated_at
before update on public.fixtures
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: football reference data readable by authenticated users
-- ---------------------------------------------------------------------------

alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.fixtures enable row level security;
alter table public.lineups enable row level security;
alter table public.player_stats enable row level security;
alter table public.team_stats enable row level security;
alter table public.injuries enable row level security;
alter table public.predictions enable row level security;
alter table public.sync_runs enable row level security;

create policy "competitions_read_auth"
  on public.competitions for select
  to authenticated, anon
  using (true);

create policy "teams_read_auth"
  on public.teams for select
  to authenticated, anon
  using (true);

create policy "players_read_auth"
  on public.players for select
  to authenticated, anon
  using (true);

create policy "fixtures_read_auth"
  on public.fixtures for select
  to authenticated, anon
  using (true);

create policy "lineups_read_auth"
  on public.lineups for select
  to authenticated, anon
  using (true);

create policy "player_stats_read_auth"
  on public.player_stats for select
  to authenticated, anon
  using (true);

create policy "team_stats_read_auth"
  on public.team_stats for select
  to authenticated, anon
  using (true);

create policy "injuries_read_auth"
  on public.injuries for select
  to authenticated, anon
  using (true);

create policy "predictions_read_own"
  on public.predictions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "predictions_insert_own"
  on public.predictions for insert
  to authenticated
  with check (auth.uid() = user_id);

-- sync_runs: no client policies (service role only)

-- Allow anon read in demo / public browse if you enable later:
-- create policy ... to anon using (true);

grant usage on schema public to anon, authenticated;
grant select on public.competitions, public.teams, public.players,
  public.fixtures, public.lineups, public.player_stats, public.team_stats,
  public.injuries to anon, authenticated;
grant select, insert on public.predictions to authenticated;
