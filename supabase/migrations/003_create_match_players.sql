create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  team char(1) not null check (team in ('A', 'B')),
  result char(1) not null check (result in ('W', 'L')),
  points_before integer not null check (points_before >= 0),
  points_delta integer not null default 0,
  points_after integer not null default 0 check (points_after >= 0),
  unique (match_id, profile_id)
);

create index if not exists match_players_match_id_idx on public.match_players(match_id);
create index if not exists match_players_profile_id_idx on public.match_players(profile_id);
