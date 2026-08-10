-- Phase 7: prediction history + trust evaluation

create table if not exists public.prediction_history (
  id text primary key,
  fixture_id text not null references public.fixtures (id) on delete cascade,
  model_version text not null,
  predicted_result text not null,
  home_win_pct numeric(5, 2),
  draw_pct numeric(5, 2),
  away_win_pct numeric(5, 2),
  most_likely_score text,
  expected_home_goals numeric(4, 2),
  expected_away_goals numeric(4, 2),
  btts_pct numeric(5, 2),
  over25_pct numeric(5, 2),
  confidence numeric(5, 2),
  confidence_reliable boolean not null default false,
  lineup_status text,
  reasons jsonb,
  actual_home_score integer,
  actual_away_score integer,
  evaluated_at timestamptz,
  markets jsonb,
  result_correct boolean,
  home_name text,
  away_name text,
  kickoff timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists prediction_history_created_idx
  on public.prediction_history (created_at desc);

create index if not exists prediction_history_fixture_idx
  on public.prediction_history (fixture_id);

alter table public.prediction_history enable row level security;

create policy "prediction_history_read_auth"
  on public.prediction_history for select
  to authenticated, anon
  using (true);

grant select on public.prediction_history to anon, authenticated;
