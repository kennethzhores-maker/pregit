-- Phase 6: pre-kickoff refresh metadata + richer prediction snapshots

alter table public.fixtures
  add column if not exists last_refreshed_at timestamptz,
  add column if not exists lineup_confirmed_at timestamptz,
  add column if not exists refresh_source text,
  add column if not exists refresh_notes text;

create table if not exists public.match_refresh_logs (
  id text primary key default gen_random_uuid()::text,
  fixture_id text not null references public.fixtures (id) on delete cascade,
  refreshed_at timestamptz not null default now(),
  source text not null,
  lineup_status text,
  home_xi_count integer not null default 0,
  away_xi_count integer not null default 0,
  injury_count integer not null default 0,
  notes jsonb,
  meta jsonb
);

create index if not exists match_refresh_logs_fixture_idx
  on public.match_refresh_logs (fixture_id, refreshed_at desc);

alter table public.predictions
  add column if not exists refresh_meta jsonb,
  add column if not exists lineup_status text,
  add column if not exists snapshot_hash text;

alter table public.match_refresh_logs enable row level security;

create policy "match_refresh_logs_read_auth"
  on public.match_refresh_logs for select
  to authenticated, anon
  using (true);

grant select on public.match_refresh_logs to anon, authenticated;
