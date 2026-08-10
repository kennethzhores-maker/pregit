-- Phase 3: home/away form columns for match intelligence
alter table public.team_stats
  add column if not exists home_form text,
  add column if not exists away_form text;
