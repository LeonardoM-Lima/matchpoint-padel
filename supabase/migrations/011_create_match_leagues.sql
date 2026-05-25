create table if not exists public.match_leagues (
  match_id uuid primary key references public.matches(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null
);

create index if not exists match_leagues_league_id_idx on public.match_leagues(league_id);

create table if not exists public.match_league_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete set null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  league_points_before integer not null,
  league_points_delta integer not null default 0,
  league_points_after integer not null default 0 check (league_points_after >= 0),
  unique (match_id, profile_id)
);

create index if not exists match_league_players_league_id_idx on public.match_league_players(league_id);
create index if not exists match_league_players_match_id_idx on public.match_league_players(match_id);
create index if not exists match_league_players_profile_id_idx on public.match_league_players(profile_id);
